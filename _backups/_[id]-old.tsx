/**
 * Path: src/app/peek/[id].tsx
 * Description: Peek Page.
 * Uses signed-in session email when available, otherwise guest email memory.
 * Aligned to current tables/functions:
 * - event lookup from events
 * - attendee list from get_guest_list(slug, viewer_email)
 * - wave uses submit_rsvp_enriched
 * - keep-in-loop uses social_intent
 * Approval-aware:
 * - canonical submit_rsvp_enriched may return pending_approval
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
  StatusBar,
  Share,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyledText } from '@pallinky/ui';
import { Ionicons } from '@expo/vector-icons';
import { supabase, useSession } from '@pallinky/core';
import * as SecureStore from 'expo-secure-store';
import { getEventAccessDecision } from '../../lib/visibility/getEventAccessDecision';

const SYSTEM = {
  bg: '#EEF2EC',
  surface: '#F8FAF7',
  text: '#162014',
  textMuted: '#556250',
  primary: '#355a16',
  secondary: '#5E3F86',
  secondaryBg: '#E8DEF1',
  border: '#A8B997',
  borderSoft: '#C9D5BE',
  iconBg: '#DEE7D6',
};

function normalizeEmail(value: string | null | undefined) {
  return value?.toLowerCase().trim() || '';
}

function capitalize(str: string) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatStatus(status: string | null | undefined) {
  const v = String(status || '').toLowerCase().trim();
  if (!v) return 'Responded';
  if (v === 'yes' || v === 'going') return 'Going';
  if (v === 'maybe' || v === 'interested') return 'Interested';
  if (v === 'no' || v === 'declined' || v === 'not_going') return 'Not going';
  return capitalize(v);
}

export default function PeekPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { userEmail: sessionEmail } = useSession();

  const [event, setEvent] = useState<any>(null);
  const [attendees, setAttendees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  const [isPastEvent, setIsPastEvent] = useState(false);
  const [hasWaved, setHasWaved] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [keepInLoop, setKeepInLoop] = useState(false);
  const [accessDecision, setAccessDecision] = useState<any>(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (id) void initPeek();
  }, [id, sessionEmail]);

  async function initPeek() {
    const rememberedGuestEmail = normalizeEmail(
      await SecureStore.getItemAsync('pallinky_guest_email')
    );
    const cleanEmail = normalizeEmail(sessionEmail) || rememberedGuestEmail || '';
    setUserEmail(cleanEmail);

    try {
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .single();

      if (eventError || !eventData) return;

      const decision = await getEventAccessDecision({
        eventId: String(eventData.id),
        viewerEmail: cleanEmail || null,
      });

      setAccessDecision(decision);

      setEvent(eventData);
      setIsPastEvent(
        eventData.starts_at ? new Date(eventData.starts_at).getTime() < Date.now() : false
      );

      if (decision.can_see !== true) {
        setBlocked(true);
        setAttendees([]);
        setHasWaved(false);
        setIsPending(false);
        setKeepInLoop(false);
        return;
      }

      setBlocked(false);

      if (decision.can_see_guest_list === true) {
        await fetchGuestList(eventData.slug, cleanEmail);
      } else {
        setAttendees([]);
      }

      if (cleanEmail) {
        const { data: rsvp } = await supabase
          .from('rsvps')
          .select('status')
          .eq('event_id', id)
          .eq('email_lc', cleanEmail)
          .maybeSingle();

        const { data: pendingRequest } = await supabase
          .from('rsvp_join_requests')
          .select('id')
          .eq('event_id', id)
          .eq('requester_email', cleanEmail)
          .maybeSingle();

        setHasWaved(!!rsvp);
        setIsPending(!!pendingRequest);

        const { data: intent } = await supabase
          .from('social_intent')
          .select('keep_in_loop')
          .eq('event_id', id)
          .eq('user_email', cleanEmail)
          .maybeSingle();

        setKeepInLoop(!!intent?.keep_in_loop);
      } else {
        setHasWaved(false);
        setIsPending(false);
        setKeepInLoop(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchGuestList(slug: string, viewerEmail: string) {
    const { data, error } = await supabase.rpc('get_guest_list', {
      p_slug: slug,
      p_viewer_email: viewerEmail || null,
    });

    if (!error) setAttendees(data || []);
  }

  const handleWave = async () => {
    if (isPending || hasWaved) {
      return;
    }

    let emailToUse = userEmail;
    const isSignedInMember = !!normalizeEmail(sessionEmail);

    if (!emailToUse) {
      Alert.prompt('Who are you?', 'Enter email to wave:', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'OK',
          onPress: async (val?: string) => {
            const email = val?.includes('@') ? val.toLowerCase().trim() : null;
            if (!email) return;

            emailToUse = email;

            if (!isSignedInMember) {
              await SecureStore.setItemAsync('pallinky_guest_email', emailToUse);
            }

            setUserEmail(emailToUse);
            await performWave(emailToUse);
          },
        },
      ]);
      return;
    }

    await performWave(emailToUse);
  };

  const performWave = async (emailToUse: string) => {
    const cleanEmail = normalizeEmail(emailToUse);
    if (!cleanEmail) return;

    const fallbackName = cleanEmail.split('@')[0];

    const { data, error } = await supabase.rpc('submit_rsvp_enriched', {
      p_event_id: id,
      p_name: fallbackName,
      p_email: cleanEmail,
      p_status: 'interested',
      p_phone_e164: null,
      p_message: null,
    });

    if (!error) {
      const pendingApproval = data?.pending_approval === true;

      setUserEmail(cleanEmail);
      setIsPending(pendingApproval);
      setHasWaved(!pendingApproval);

      if (pendingApproval) {
        Alert.alert('Request sent');
      } else {
        Alert.alert('Interest sent');
      }

      if (event?.slug) {
        await fetchGuestList(event.slug, cleanEmail);
      }
    } else {
      Alert.alert('Error', 'Could not send your interest.');
    }
  };

  const handleToggleLoop = async (value: boolean) => {
    const cleanEmail = normalizeEmail(userEmail);

    if (!cleanEmail && value) {
      Alert.alert('Identity required', 'Please wave or enter your email first.');
      setKeepInLoop(false);
      return;
    }

    setKeepInLoop(value);

    await supabase.from('social_intent').upsert(
      {
        event_id: id,
        user_email: cleanEmail,
        keep_in_loop: value,
      },
      { onConflict: 'event_id,user_email' }
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={SYSTEM.primary} />
      </View>
    );
  }

  if (blocked || !event) {
    return (
      <View style={styles.centered}>
        <StyledText style={styles.emptyTitle}>This event is not available to you.</StyledText>
      </View>
    );
  }

  const hostName = capitalize(event?.host_name || 'the host');
  const canWave = accessDecision?.can_rsvp === true && !isPending && !hasWaved;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <Ionicons name="close-circle" size={32} color={SYSTEM.secondary} />
        </TouchableOpacity>

        <StyledText style={styles.peekLabel}>
          {isPastEvent ? 'YOU CAME ACROSS THIS' : 'SOMEONE IN YOUR NETWORK IS DOING THIS'}
        </StyledText>
        <StyledText style={styles.title}>{event?.title}</StyledText>
        <StyledText style={styles.host}>Hosted by {hostName}</StyledText>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.actionCard}>
          <StyledText style={styles.intentLine}>
            Let {hostName} know you&apos;re interested and might want to join next time.
          </StyledText>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[
                styles.waveBtn,
                !canWave && styles.waveBtnDisabled,
              ]}
              onPress={handleWave}
              disabled={!canWave}
            >
              <Ionicons
                name={
                  isPending || hasWaved
                    ? 'checkmark-circle'
                    : accessDecision?.can_rsvp === true
                    ? 'hand-right-outline'
                    : 'lock-closed'
                }
                size={20}
                color="#fff"
              />
              <StyledText style={styles.waveBtnText}>
                {isPending
                  ? 'Request Pending'
                  : hasWaved
                  ? 'Interest Sent'
                  : accessDecision?.can_rsvp === true
                  ? 'Show Interest'
                  : 'Unavailable'}
              </StyledText>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.shareLink}
            onPress={() =>
              Share.share({
                message: `Peek at ${event?.title}: https://pallinky.com/peek/${id}`,
              })
            }
          >
            <Ionicons name="share-outline" size={16} color={SYSTEM.secondary} />
            <StyledText style={styles.shareLinkText}>Share this peek</StyledText>
          </TouchableOpacity>

          <View style={styles.divider} />

          <View style={styles.loopToggle}>
            <View style={styles.loopCopy}>
              <StyledText style={styles.loopLabel}>See more from {hostName}</StyledText>
              <StyledText style={styles.loopSub}>
                Let them know you&apos;d like to hear about future plans.
              </StyledText>
            </View>
            <Switch
              value={keepInLoop}
              onValueChange={handleToggleLoop}
              trackColor={{ false: '#d1d1d1', true: SYSTEM.primary }}
            />
          </View>
        </View>

        {accessDecision?.can_see_guest_list === true ? (
          <>
            <StyledText style={styles.sectionLabel}>
              Who&apos;s already in ({attendees.length})
            </StyledText>

            {attendees.length === 0 ? (
              <View style={styles.emptyCard}>
                <StyledText style={styles.emptyTitle}>No responses yet</StyledText>
                <StyledText style={styles.emptyBody}>
                  When people respond, they will appear here.
                </StyledText>
              </View>
            ) : (
              attendees.map((person, index) => (
                <View key={`${person.name || 'person'}-${index}`} style={styles.personRow}>
                  <View style={styles.avatarMini}>
                    <StyledText style={styles.avatarChar}>
                      {String(person.name || '?').charAt(0).toUpperCase()}
                    </StyledText>
                  </View>

                  <View style={styles.personInfo}>
                    <StyledText style={styles.personName}>{person.name || 'Guest'}</StyledText>

                    {person.common_event ? (
                      <View style={styles.contextBadge}>
                        <Ionicons name="sparkles" size={12} color={SYSTEM.primary} />
                        <StyledText style={styles.contextText}>
                          Both went to {person.common_event}
                        </StyledText>
                      </View>
                    ) : person.mutual_friend_count > 0 ? (
                      <View style={styles.contextBadge}>
                        <Ionicons name="people" size={12} color={SYSTEM.primary} />
                        <StyledText style={styles.contextText}>
                          {person.mutual_friend_count} mutual friends
                        </StyledText>
                      </View>
                    ) : (
                      <StyledText style={styles.friendOfFriend}>
                        In {hostName}&apos;s orbit
                      </StyledText>
                    )}

                    <StyledText style={styles.statusTag}>
                      {formatStatus(person.status)}
                    </StyledText>
                  </View>
                </View>
              ))
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SYSTEM.bg,
  },

  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: SYSTEM.bg,
  },

  header: {
    backgroundColor: SYSTEM.secondaryBg,
    padding: 24,
    paddingTop: 60,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    borderBottomWidth: 1,
    borderColor: SYSTEM.borderSoft,
  },

  closeBtn: {
    alignSelf: 'flex-end',
    marginBottom: 10,
  },

  peekLabel: {
    color: SYSTEM.secondary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },

  title: {
    fontSize: 28,
    fontWeight: '900',
    color: SYSTEM.text,
    marginTop: 4,
  },
  intentLine: {
    fontSize: 15,
    lineHeight: 22,
    color: SYSTEM.text,
    fontWeight: '600',
    marginBottom: 16,
  },
  host: {
    fontSize: 15,
    color: SYSTEM.textMuted,
    fontWeight: '600',
    marginTop: 4,
  },

  scrollContent: {
    padding: 20,
  },

  actionCard: {
    backgroundColor: SYSTEM.surface,
    borderRadius: 24,
    padding: 20,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: SYSTEM.border,
  },

  buttonRow: {
    flexDirection: 'row',
  },

  waveBtn: {
    flex: 1,
    backgroundColor: SYSTEM.primary,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },

  waveBtnDisabled: {
    backgroundColor: '#6F8A5E',
  },

  waveBtnText: {
    color: '#fff',
    fontWeight: 'bold',
  },

  shareLink: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },

  shareLinkText: {
    color: SYSTEM.secondary,
    fontWeight: '700',
    fontSize: 13,
  },

  divider: {
    height: 1,
    backgroundColor: SYSTEM.borderSoft,
    marginVertical: 18,
  },

  loopToggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  loopCopy: {
    flex: 1,
  },

  loopLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: SYSTEM.text,
  },

  loopSub: {
    fontSize: 12,
    color: SYSTEM.textMuted,
  },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: SYSTEM.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },

  emptyCard: {
    backgroundColor: SYSTEM.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: SYSTEM.borderSoft,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: SYSTEM.text,
  },

  emptyBody: {
    marginTop: 4,
    fontSize: 13,
    color: SYSTEM.textMuted,
  },

  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SYSTEM.surface,
    padding: 14,
    borderRadius: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: SYSTEM.borderSoft,
  },

  avatarMini: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SYSTEM.secondaryBg,
    justifyContent: 'center',
    alignItems: 'center',
  },

  avatarChar: {
    fontWeight: 'bold',
    color: SYSTEM.secondary,
  },

  personInfo: {
    flex: 1,
    marginLeft: 15,
  },

  personName: {
    fontSize: 16,
    fontWeight: '700',
    color: SYSTEM.text,
  },

  statusTag: {
    fontSize: 10,
    color: SYSTEM.textMuted,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginTop: 2,
  },

   contextBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EDF4E8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginVertical: 4,
    alignSelf: 'flex-start',
  },

  contextText: {
    fontSize: 11,
    color: SYSTEM.primary,
    fontWeight: '700',
  },

  friendOfFriend: {
    fontSize: 11,
    color: SYSTEM.textMuted,
    fontStyle: 'italic',
    marginVertical: 4,
  },
});