/**
 * Path: app/event/[slug]/details.tsx
 * Description: Canonical event details page with CTA and chat access.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  Linking,
  StatusBar,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { supabase, useSession } from '@pallinky/core';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { CalendarButton } from '@pallinky/ui';
import { getEventAccessDecision } from '../../../lib/visibility/getEventAccessDecision';

const SYSTEM = {
  background: '#F6F7F9',
  surface: '#FFFFFF',
  text: '#1f2a1b',
  textMuted: '#66715f',
  primary: '#43691b',
  border: '#bac9ad',
  borderSoft: '#e7ede2',
  secondary: '#6A4C93',
  secondaryBg: '#efe9f7',
};

const PALETTES: Record<string, { bg: string; accent: string; text: string; isDark: boolean }> = {
  zen: { bg: '#F6F7F9', accent: '#43691b', text: '#1f2a1b', isDark: false },
  girly: { bg: '#f4bbd3', accent: '#fe5d9f', text: '#2b1f24', isDark: false },
  fiesta: { bg: '#1729ae', accent: '#fe20e8', text: '#ffffff', isDark: true },
  classy: { bg: '#03172f', accent: '#efd466', text: '#fff7b6', isDark: true },
  spicy: { bg: '#656c12', accent: '#ecc216', text: '#ffffff', isDark: true },
  submerged: { bg: '#F6F7F9', accent: '#6A4C93', text: '#1f2a1b', isDark: false },
};

function normalizeEmail(value: string | null | undefined) {
  return value?.toLowerCase().trim() || '';
}

function normalizeStatus(value: string | null | undefined) {
  return value?.toLowerCase().trim() || '';
}

function getFirstName(value: string | null | undefined) {
  return (value || '').trim().split(' ')[0] || 'Guest';
}

function getGuestStatusIcon(status: string | null | undefined) {
  const normalized = normalizeStatus(status);

  if (normalized === 'maybe' || normalized === 'interested') {
    return 'help-circle' as const;
  }

  if (normalized === 'no' || normalized === 'not_going' || normalized === 'declined') {
    return 'close-circle' as const;
  }

  if (normalized === 'yes' || normalized === 'going') {
    return 'checkmark-circle' as const;
  }

  return null;
}

export default function EventDetailsPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { session } = useSession();

  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<any>(null);
  const [seriesEvents, setSeriesEvents] = useState<any[]>([]);
  const [guests, setGuests] = useState<any[]>([]);
  const [approvalsOpen, setApprovalsOpen] = useState(false);
  const [resolvingRequestId, setResolvingRequestId] = useState<string | null>(null);
  const [allRsvps, setAllRsvps] = useState<any[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [profileNamesByEmail, setProfileNamesByEmail] = useState<Record<string, string>>({});
  const [myRsvp, setMyRsvp] = useState<any>(null);
  const [chatSummary, setChatSummary] = useState<any>(null);
  const [accessDecision, setAccessDecision] = useState<any>(null);
  const [blocked, setBlocked] = useState(false);

  const viewerEmail = normalizeEmail(session?.user?.email);

  const theme = useMemo(
    () => (event?.gif_key && event.gif_key in PALETTES ? PALETTES[event.gif_key] : PALETTES.zen),
    [event]
  );

  const fetchData = useCallback(async () => {
    setLoading(true);

    try {
      const { data: eventLookup, error: eventLookupError } = await supabase
        .from('events')
        .select('id')
        .eq('slug', slug)
        .single();

      if (eventLookupError) throw eventLookupError;

      if (!eventLookup) {
        setBlocked(false);
        setEvent(null);
        setSeriesEvents([]);
        setGuests([]);
        setAllRsvps([]);
        setPendingApprovals([]);
        setProfileNamesByEmail({});
        setMyRsvp(null);
        setChatSummary(null);
        return;
      }

      const decision = await getEventAccessDecision({
        eventId: String(eventLookup.id),
        viewerEmail: viewerEmail || null,
      });

      setAccessDecision(decision);

      if (decision.can_see !== true) {
        setBlocked(true);
        setEvent(null);
        setSeriesEvents([]);
        setGuests([]);
        setAllRsvps([]);
        setPendingApprovals([]);
        setProfileNamesByEmail({});
        setMyRsvp(null);
        setChatSummary(null);
        return;
      }

      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select(
          'id, slug, title, starts_at, event_type, manage_handle, series_id, host_email, gif_key, description, location, cover_image_url, host_name, proposed_dates'
        )
        .eq('id', eventLookup.id)
        .single();

      if (eventError) throw eventError;

      if (!eventData) {
        setBlocked(false);
        setEvent(null);
        setSeriesEvents([]);
        setGuests([]);
        setAllRsvps([]);
        setPendingApprovals([]);
        setProfileNamesByEmail({});
        setMyRsvp(null);
        setChatSummary(null);
        return;
      }

      setBlocked(false);
      setEvent(eventData);

      const seriesPromise = eventData.series_id
        ? supabase
            .from('events')
            .select('id, slug, title, starts_at, event_type, manage_handle, series_id')
            .eq('series_id', eventData.series_id)
            .order('starts_at', { ascending: true, nullsFirst: false })
        : Promise.resolve({ data: [], error: null });

      const isHostViewer =
        viewerEmail !== '' && normalizeEmail(eventData.host_email) === viewerEmail;

      const [seriesRes, rsvpRes, guestListRes, pendingRes] = await Promise.all([
        seriesPromise,
        supabase.from('rsvps').select('email_lc, email, status').eq('event_id', eventData.id),
        supabase.rpc('get_guest_list', {
          p_slug: slug,
          p_viewer_email: viewerEmail || null,
        }),
        isHostViewer
          ? supabase
              .from('rsvp_join_requests')
              .select('id, requester_email, email, requester_name, requested_status')
              .eq('event_id', eventData.id)
              .eq('status', 'pending')
              .order('created_at', { ascending: false })
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (seriesRes.error) throw seriesRes.error;

      setSeriesEvents(seriesRes.data || []);

      const rsvps = rsvpRes.data || [];
      const guestList =
        decision.can_see_guest_list === true ? guestListRes.data || [] : [];

      setAllRsvps(rsvps);
      setGuests(guestList);
      setPendingApprovals(pendingRes.data || []);

      const emailSet = new Set<string>();

      (pendingRes.data || []).forEach((r: any) => {
        const email = normalizeEmail(r.requester_email || r.email);
        if (email) emailSet.add(email);
      });

      (guestList || []).forEach((g: any) => {
        const email = normalizeEmail(g.email_lc || g.email);
        if (email) emailSet.add(email);
      });

      const emails = Array.from(emailSet);

      if (emails.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('email_lc, full_name')
          .in('email_lc', emails);

        const map: Record<string, string> = {};
        (profiles || []).forEach((p: any) => {
          const key = normalizeEmail(p.email_lc);
          if (key && p.full_name) map[key] = p.full_name;
        });

        setProfileNamesByEmail(map);
      } else {
        setProfileNamesByEmail({});
      }

      const nextMyRsvp =
        rsvps.find((rsvp: any) => normalizeEmail(rsvp.email_lc || rsvp.email) === viewerEmail) ||
        null;

      setMyRsvp(nextMyRsvp);

      if (viewerEmail) {
        const { data: chatData } = await supabase.rpc('get_event_chat_summary', {
          p_event_id: eventData.id,
          p_user_email: viewerEmail,
        });

        if (chatData && chatData.length > 0) {
          setChatSummary(chatData[0]);
        } else {
          setChatSummary(null);
        }
      } else {
        setChatSummary(null);
      }
    } catch (err) {
      console.error(err);
      setSeriesEvents([]);
      setPendingApprovals([]);
      setProfileNamesByEmail({});
      setChatSummary(null);
    } finally {
      setLoading(false);
    }
  }, [slug, viewerEmail]);

  const handleResolveApproval = useCallback(
    async (requestId: string, decision: 'approved' | 'denied') => {
      if (!viewerEmail || !requestId) return;

      try {
        setResolvingRequestId(requestId);

        const { error } = await supabase.rpc('resolve_join_request', {
          p_request_id: requestId,
          p_decision: decision,
          p_decided_by_email: viewerEmail,
        });

        if (error) throw error;

        await fetchData();
        setApprovalsOpen(false);
        Alert.alert('Done', decision === 'approved' ? 'Request approved.' : 'Request declined.');
      } finally {
        setResolvingRequestId(null);
      }
    },
    [viewerEmail, fetchData]
  );

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useFocusEffect(
    useCallback(() => {
      void fetchData();
    }, [fetchData])
  );

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: SYSTEM.background }]}>
        <ActivityIndicator color={SYSTEM.primary} />
      </View>
    );
  }

  if (!event || blocked) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: SYSTEM.background }]}>
        <View style={styles.centered}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: SYSTEM.text }}>
            This event is not available to you.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const isFormal = event.event_type === 'formal';
  const isVibe = !isFormal;
  const isFuture = event.starts_at && new Date(event.starts_at) > new Date();
  const isHost = viewerEmail !== '' && normalizeEmail(event.host_email) === viewerEmail;
  const myStatus = (myRsvp?.status || '').toLowerCase().trim();

  const hasRsvpAccess =
    ['yes', 'going', 'interested', 'maybe'].includes(myStatus) ||
    allRsvps.some(
      (rsvp: any) =>
        normalizeEmail(rsvp.email_lc || rsvp.email) === viewerEmail &&
        ['yes', 'going', 'interested', 'maybe'].includes(
          (rsvp.status || '').toLowerCase().trim()
        )
    );

  const canOpenChat = isHost || hasRsvpAccess;
  const canShowRsvpCta = accessDecision?.can_rsvp === true || isHost || !!myRsvp;
  const isSeries = !!event?.series_id;
  const visibleSeriesEvents = seriesEvents.filter((item) => item?.id !== event?.id);

  const formatSeriesDateTime = (value: string | null) => {
    if (!value) return 'Date TBD';
    return new Date(value).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const hasLocationInDesc = event.description?.includes('Location: ');
  const description = hasLocationInDesc
    ? event.description.split('Location: ')[0].trim()
    : event.description;

  const locationText = hasLocationInDesc
    ? event.description.split('Location: ')[1].trim()
    : event.location;

  const cta = (() => {
    if (isHost) {
      return {
        label: 'Manage Event',
        onPress: () => {
          if (event.manage_handle) {
            router.push(`/m/${event.manage_handle}` as any);
            return;
          }
          router.push('/(tabs)' as any);
        },
      };
    }

    if (isVibe) {
      return {
        label: myStatus ? 'Update RSVP' : 'RSVP',
        onPress: () => router.push(`/event/${slug}/fishingRSVP` as any),
      };
    }

    return {
      label: myStatus ? 'Update RSVP' : 'RSVP',
      onPress: () => router.push(`/event/${slug}/formalRSVP` as any),
    };
  })();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={theme.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {event.cover_image_url ? (
          <View style={styles.imageWrapper}>
            <Image source={{ uri: event.cover_image_url }} style={styles.coverImage} />
          </View>
        ) : null}

        <View style={styles.content}>
          <Text style={[styles.title, { color: theme.text }]}>{event.title}</Text>

          <Text style={[styles.host, { color: theme.text }]}>Hosted by {event.host_name}</Text>

          {isFormal && event.starts_at ? (
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="calendar-clock" size={22} color={theme.accent} />
              <Text style={[styles.infoText, { color: theme.text }]}>
                {new Date(event.starts_at).toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          ) : null}

          {locationText ? (
            <TouchableOpacity
              style={styles.infoRow}
              onPress={() =>
                Linking.openURL(
                  Platform.OS === 'ios'
                    ? `maps:0,0?q=${locationText}`
                    : `geo:0,0?q=${locationText}`
                )
              }
            >
              <MaterialCommunityIcons name="map-marker-radius" size={22} color={theme.accent} />
              <Text
                style={[
                  styles.infoText,
                  { color: theme.accent, textDecorationLine: 'underline' },
                ]}
              >
                {locationText}
              </Text>
            </TouchableOpacity>
          ) : null}

          {description ? (
            <View style={styles.descriptionContainer}>
              <Text style={[styles.descriptionText, { color: theme.text }]}>{description}</Text>
            </View>
          ) : null}

          {!isFormal && event.proposed_dates?.length > 0 ? (
            <View style={styles.pollContainer}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Suggested Dates</Text>

              {event.proposed_dates.map((d: string, i: number) => (
                <View
                  key={i}
                  style={[
                    styles.dateChip,
                    {
                      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : SYSTEM.surface,
                      borderColor: theme.isDark ? 'rgba(255,255,255,0.10)' : SYSTEM.borderSoft,
                    },
                  ]}
                >
                  <Text style={{ color: theme.text }}>
                    {new Date(d).toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {isFormal && isFuture ? (
            <View style={{ marginBottom: 28 }}>
              <CalendarButton event={event} theme={theme} />
            </View>
          ) : null}

          {isSeries ? (
            <View style={styles.seriesSection}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Series</Text>

              <View style={styles.seriesList}>
                <TouchableOpacity
                  activeOpacity={1}
                  style={[
                    styles.seriesRow,
                    styles.seriesRowCurrent,
                    {
                      backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : SYSTEM.surface,
                      borderColor: theme.accent,
                    },
                  ]}
                >
                  <View style={styles.seriesRowTextWrap}>
                    <Text style={[styles.seriesRowTitle, { color: theme.text }]}>
                      {event.title || 'This event'}
                    </Text>
                    <Text style={[styles.seriesRowMeta, { color: theme.text }]}>
                      {formatSeriesDateTime(event.starts_at)}
                    </Text>
                  </View>

                  <Text style={[styles.seriesCurrentBadge, { color: theme.accent }]}>Current</Text>
                </TouchableOpacity>

                {visibleSeriesEvents.map((item: any) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.seriesRow,
                      {
                        backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : SYSTEM.surface,
                        borderColor: theme.isDark ? 'rgba(255,255,255,0.10)' : SYSTEM.borderSoft,
                      },
                    ]}
                    onPress={() => router.push(`/event/${item.slug}` as any)}
                  >
                    <View style={styles.seriesRowTextWrap}>
                      <Text style={[styles.seriesRowTitle, { color: theme.text }]}>
                        {item.title || 'Untitled event'}
                      </Text>
                      <Text style={[styles.seriesRowMeta, { color: theme.text }]}>
                        {formatSeriesDateTime(item.starts_at)}
                      </Text>
                    </View>

                    <Ionicons name="chevron-forward" size={18} color={theme.accent} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}

          {canShowRsvpCta ? (
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: theme.accent }]}
              onPress={cta.onPress}
            >
              <Text
                style={[
                  styles.primaryBtnText,
                  { color: theme.isDark ? theme.bg : '#fff' },
                ]}
              >
                {cta.label}
              </Text>
            </TouchableOpacity>
          ) : null}

          {isHost ? (
            <View style={styles.hostActionsRow}>
              <TouchableOpacity
                style={[
                  styles.hostActionBtn,
                  {
                    borderColor: theme.accent,
                    backgroundColor: theme.isDark ? 'transparent' : SYSTEM.surface,
                  },
                ]}
                onPress={() =>
                  router.push({
                    pathname: '/create/success',
                    params: {
                      slug: event.slug,
                      manage_handle: event.manage_handle,
                      title: event.title,
                    },
                  })
                }
              >
                <Text style={[styles.hostActionText, { color: theme.text }]}>Invite</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.hostActionBtn,
                  {
                    borderColor: theme.accent,
                    backgroundColor: theme.isDark ? 'transparent' : SYSTEM.surface,
                  },
                ]}
                onPress={() => setApprovalsOpen(true)}
              >
                <Text style={[styles.hostActionText, { color: theme.text }]}>
                  Approve{pendingApprovals.length > 0 ? ` (${pendingApprovals.length})` : ''}
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {canOpenChat ? (
            <View style={styles.chatRow}>
              <TouchableOpacity
                style={[
                  styles.chatButton,
                  {
                    borderColor: theme.accent,
                    backgroundColor: theme.isDark ? 'transparent' : SYSTEM.surface,
                  },
                ]}
                onPress={() => router.push(`/event/${slug}/chat` as any)}
              >
                <MaterialCommunityIcons name="chat-outline" size={18} color={theme.accent} />
                <Text style={[styles.chatLabel, { color: theme.text }]}>Chat</Text>

                {chatSummary?.unread_count > 0 ? (
                  <View style={[styles.chatBadge, { backgroundColor: theme.accent }]}>
                    <Text style={styles.chatBadgeText}>{chatSummary.unread_count}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            </View>
          ) : null}

          {isHost && pendingApprovals.length > 0 ? (
            <>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Pending approvals ({pendingApprovals.length})
              </Text>

              <View style={styles.guestList}>
                {pendingApprovals.map((req: any, i: number) => {
                  const emailLc = normalizeEmail(req.requester_email || req.email);
                  const label =
                    profileNamesByEmail[emailLc] ||
                    req.requester_name ||
                    req.requester_email ||
                    req.email ||
                    'Guest';

                  return (
                    <View
                      key={req.id || `${label}-${i}`}
                      style={[
                        styles.guestCard,
                        {
                          backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : SYSTEM.surface,
                          borderColor: theme.isDark ? 'rgba(255,255,255,0.10)' : SYSTEM.borderSoft,
                        },
                      ]}
                    >
                      <Text style={[styles.guestName, { color: theme.text }]}>
                        {getFirstName(label)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </>
          ) : null}

          {accessDecision?.can_see_guest_list === true ? (
            <>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Guests ({guests.length})
              </Text>

              <View style={styles.guestList}>
                {guests.map((guest: any, i: number) => {
                  const emailLc = normalizeEmail(guest.email_lc || guest.email);
                  const label =
                    profileNamesByEmail[emailLc] ||
                    guest.name ||
                    guest.email ||
                    'Guest';
                  const statusIcon = getGuestStatusIcon(guest.status);

                  return (
                    <View
                      key={guest.id || `${emailLc || label}-${i}`}
                      style={[
                        styles.guestCard,
                        {
                          backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : SYSTEM.surface,
                          borderColor: theme.isDark ? 'rgba(255,255,255,0.10)' : SYSTEM.borderSoft,
                        },
                      ]}
                    >
                      <View style={styles.guestChipContent}>
                        <Text style={[styles.guestName, { color: theme.text }]}>
                          {getFirstName(label)}
                        </Text>

                        {statusIcon ? (
                          <Ionicons
  name={statusIcon}
  size={18}
  color={
    normalizeStatus(guest.status) === 'yes' || normalizeStatus(guest.status) === 'going'
      ? SYSTEM.primary
      : normalizeStatus(guest.status) === 'no' ||
        normalizeStatus(guest.status) === 'not_going' ||
        normalizeStatus(guest.status) === 'declined'
      ? '#C62828'
      : SYSTEM.secondary
  }
  style={styles.guestStatusIcon}
/>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          ) : null}
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>

      <Modal
        visible={approvalsOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setApprovalsOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Approvals</Text>
              <TouchableOpacity onPress={() => setApprovalsOpen(false)}>
                <Ionicons name="close" size={22} color={SYSTEM.text} />
              </TouchableOpacity>
            </View>

            {pendingApprovals.length === 0 ? (
              <View style={styles.emptyApprovalsState}>
                <Text style={styles.emptyApprovalsTitle}>No pending approvals</Text>
                <Text style={styles.emptyApprovalsText}>
                  New requests will appear here.
                </Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {pendingApprovals.map((req: any) => {
                  const emailLc = normalizeEmail(req.requester_email || req.email);
                  const label =
                    profileNamesByEmail[emailLc] ||
                    req.requester_name ||
                    req.requester_email ||
                    req.email ||
                    'Guest';

                  const requestId = String(req.id);
                  const busy = resolvingRequestId === requestId;

                  return (
                    <View key={requestId} style={styles.approvalRow}>
                      <View style={styles.approvalCopy}>
                        <Text style={styles.approvalName}>{label}</Text>
                        {!!req.requester_email && (
                          <Text style={styles.approvalMeta}>{req.requester_email}</Text>
                        )}
                        {!!req.requested_status && (
                          <Text style={styles.approvalMeta}>
                            Wants to respond: {req.requested_status}
                          </Text>
                        )}
                      </View>

                      <View style={styles.approvalActions}>
                        <TouchableOpacity
                          disabled={busy}
                          style={[
                            styles.approvalBtn,
                            styles.declineBtn,
                            busy && styles.approvalBtnDisabled,
                          ]}
                          onPress={() => handleResolveApproval(requestId, 'denied')}
                        >
                          <Text style={styles.declineBtnText}>
                            {busy ? 'Working...' : 'Decline'}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          disabled={busy}
                          style={[
                            styles.approvalBtn,
                            styles.approveBtn,
                            busy && styles.approvalBtnDisabled,
                          ]}
                          onPress={() => handleResolveApproval(requestId, 'approved')}
                        >
                          <Text style={styles.approveBtnText}>
                            {busy ? 'Working...' : 'Approve'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },

  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  header: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.28)',
    justifyContent: 'flex-end',
  },

  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    maxHeight: '78%',
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: SYSTEM.text,
  },

  emptyApprovalsState: {
    paddingVertical: 24,
  },

  emptyApprovalsTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: SYSTEM.text,
  },

  emptyApprovalsText: {
    marginTop: 4,
    fontSize: 13,
    color: SYSTEM.textMuted,
  },

  approvalRow: {
    borderWidth: 1,
    borderColor: SYSTEM.borderSoft,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },

  approvalCopy: {
    marginBottom: 12,
  },

  approvalName: {
    fontSize: 16,
    fontWeight: '800',
    color: SYSTEM.text,
  },

  approvalMeta: {
    marginTop: 4,
    fontSize: 13,
    color: SYSTEM.textMuted,
  },

  approvalActions: {
    flexDirection: 'row',
    gap: 10,
  },

  approvalBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },

  approvalBtnDisabled: {
    opacity: 0.6,
  },

  approveBtn: {
    backgroundColor: SYSTEM.primary,
  },

  approveBtnText: {
    color: '#fff',
    fontWeight: '800',
  },

  declineBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: SYSTEM.border,
  },

  declineBtnText: {
    color: SYSTEM.text,
    fontWeight: '800',
  },

  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: SYSTEM.surface,
    borderWidth: 1,
    borderColor: SYSTEM.borderSoft,
  },

  scrollContent: {
    paddingBottom: 20,
  },

  imageWrapper: {
    width: '100%',
    paddingHorizontal: 20,
  },

  coverImage: {
    width: '100%',
    height: 220,
    borderRadius: 24,
  },

  seriesSection: {
    marginBottom: 28,
  },

  seriesList: {
    gap: 10,
  },

  seriesRow: {
    minHeight: 64,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  seriesRowCurrent: {
    borderWidth: 1.5,
  },

  seriesRowTextWrap: {
    flex: 1,
  },

  seriesRowTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },

  seriesRowMeta: {
    fontSize: 14,
    opacity: 0.72,
  },

  seriesCurrentBadge: {
    fontSize: 12,
    fontWeight: '800',
  },

  content: {
    padding: 25,
  },

  title: {
    fontSize: 34,
    fontWeight: '900',
    marginBottom: 4,
  },

  host: {
    fontSize: 18,
    marginBottom: 25,
    opacity: 0.7,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },

  infoText: {
    fontSize: 17,
    fontWeight: '600',
    flex: 1,
  },

  descriptionContainer: {
    marginBottom: 35,
  },

  descriptionText: {
    fontSize: 17,
    lineHeight: 26,
  },

  pollContainer: {
    marginBottom: 35,
  },

  hostActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },

  hostActionBtn: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },

  hostActionText: {
    fontSize: 15,
    fontWeight: '800',
  },

  dateChip: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },

  primaryBtn: {
    minHeight: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    paddingHorizontal: 18,
  },

  primaryBtnText: {
    fontSize: 17,
    fontWeight: '800',
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 15,
  },

  guestList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  guestCard: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },

  guestChipContent: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
},

  guestName: {
    fontSize: 14,
    fontWeight: '600',
  },

  guestStatusIcon: {
    marginTop: 0,
  },

  chatRow: {
    marginBottom: 24,
  },

  chatButton: {
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  chatLabel: {
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
  },

  chatBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },

  chatBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
});