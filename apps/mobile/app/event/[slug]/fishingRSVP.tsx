/**
 * Path: app/event/[slug]/fishingRSVP.tsx
 * Description: RSVP page for vibe events. Uses canonical backend write path.
 * Approval-aware:
 * - canonical submit_vibe_rsvp may return pending_approval
 * - gated events show Request to Join instead of direct RSVP copy
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  TextInput,
  StatusBar,
  Image,
  Text,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase, useSession } from '@pallinky/core';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

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
  submerged: { bg: '#F6F7F9', accent: '#6A4C93', text: '#1f2a1b', isDark: false },
  zen: { bg: '#F6F7F9', accent: '#43691b', text: '#1f2a1b', isDark: false },
  girly: { bg: '#f4bbd3', accent: '#fe5d9f', text: '#2b1f24', isDark: false },
  fiesta: { bg: '#1729ae', accent: '#fe20e8', text: '#ffffff', isDark: true },
  classy: { bg: '#03172f', accent: '#efd466', text: '#fff7b6', isDark: true },
  spicy: { bg: '#656c12', accent: '#ecc216', text: '#ffffff', isDark: true },
};

const FONT_MAP: Record<string, string> = {
  Sans: Platform.OS === 'ios' ? 'Arial-BoldMT' : 'sans-serif-condensed',
  Serif: Platform.OS === 'ios' ? 'Times New Roman' : 'serif',
  Cursive: Platform.OS === 'ios' ? 'SnellRoundhand-Bold' : 'cursive',
  Gothic: Platform.OS === 'ios' ? 'Copperplate-Bold' : 'monospace',
};

const STORE_URL =
  Platform.OS === 'ios'
    ? 'https://apps.apple.com/app/idYOUR_APP_ID'
    : 'https://play.google.com/store/apps/details?id=com.your.package';

function normalizeEmail(value: string | null | undefined) {
  return value?.toLowerCase().trim() || '';
}

export default function FishingRSVPScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { userEmail, loading: sessionLoading } = useSession();

  const [event, setEvent] = useState<any>(null);
  const [allVotes, setAllVotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [hasPendingRequest, setHasPendingRequest] = useState(false);

  const themeKey = event?.gif_key && PALETTES[event.gif_key] ? event.gif_key : 'submerged';
  const theme = PALETTES[themeKey];
  const customFont = {
    fontFamily:
      FONT_MAP[event?.font_family] || (Platform.OS === 'ios' ? 'Arial-BoldMT' : 'sans-serif'),
  };

  const requiresApproval =
    event?.forwarding_mode === 'approval_required' ||
    event?.forwarding_mode === 'host_approval';

  const formatFriendlyDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: eventData, error: eventError } = await supabase
          .from('events')
          .select('*')
          .eq('slug', slug)
          .single();

        if (eventError) throw eventError;
        if (!eventData) return;

        setEvent(eventData);

        const { data: voteData, error: voteError } = await supabase
          .from('vibe_responses')
          .select('user_email, selected_dates, note')
          .eq('event_id', eventData.id);

        if (voteError) throw voteError;

        const votes = voteData || [];
        setAllVotes(votes);

        const cleanEmail = normalizeEmail(userEmail);

        if (cleanEmail) {
          const { data: myVote, error: myVoteError } = await supabase
            .from('vibe_responses')
            .select('user_email, selected_dates, note')
            .eq('event_id', eventData.id)
            .eq('user_email', cleanEmail)
            .maybeSingle();

          if (myVoteError) throw myVoteError;

          if (myVote) {
            setSelectedDates(myVote.selected_dates || []);
            setNote(myVote.note || '');
          } else {
            setSelectedDates([]);
            setNote('');
          }

          const { data: pendingRequest } = await supabase
            .from('rsvp_join_requests')
            .select('id')
            .eq('event_id', eventData.id)
            .eq('requester_email', cleanEmail)
            .maybeSingle();

          setHasPendingRequest(!!pendingRequest);
        } else {
          setSelectedDates([]);
          setNote('');
          setHasPendingRequest(false);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }

    void fetchData();
  }, [slug, userEmail]);

  const toggleDate = (date: string) => {
    setSelectedDates((prev) =>
      prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date]
    );
  };

  const handleInterest = async () => {
    if (!userEmail) {
      router.push(`/auth?slug=${slug}` as any);
      return;
    }

    if (hasPendingRequest) {
      return;
    }

    if (event?.proposed_dates?.length > 0 && selectedDates.length === 0) {
      Alert.alert('Pick a date', 'Please select at least one date.');
      return;
    }

    setSubmitting(true);

    try {
      const cleanEmail = normalizeEmail(userEmail);
      const guestName = cleanEmail.split('@')[0];

      const { data, error } = await supabase.rpc('submit_vibe_rsvp', {
        p_slug: slug,
        p_user_email: cleanEmail,
        p_guest_name: guestName,
        p_selected_dates: selectedDates,
        p_note: note.trim() || null,
        p_status: 'interested',
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const pendingApproval = data?.pending_approval === true;

      if (pendingApproval) {
        setHasPendingRequest(true);
      }

      router.push({
        pathname: `/event/${slug}/thanks` as any,
        params: {
          status: pendingApproval ? 'pending' : 'interested',
          theme: themeKey,
        },
      });
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not save RSVP');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || sessionLoading || !event) {
    return (
      <ActivityIndicator
        color={theme?.accent || SYSTEM.primary}
        style={{ flex: 1, backgroundColor: theme?.bg || SYSTEM.background }}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
      >
        <View style={styles.headerBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[
              styles.backBtn,
              {
                backgroundColor: theme.isDark ? 'rgba(255,255,255,0.1)' : SYSTEM.surface,
                borderColor: theme.isDark ? 'rgba(255,255,255,0.12)' : SYSTEM.borderSoft,
              },
            ]}
          >
            <Ionicons name="arrow-back" size={20} color={theme.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {Platform.OS === 'web' ? (
            <TouchableOpacity
              style={[styles.webBanner, { backgroundColor: theme.accent }]}
              onPress={() => Linking.openURL(STORE_URL)}
            >
              <View style={styles.bannerTextContent}>
                <MaterialCommunityIcons name="cellphone-arrow-down" size={18} color={theme.bg} />
                <Text style={[styles.bannerText, { color: theme.bg }]}>
                  Get the full app experience
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.bg} />
            </TouchableOpacity>
          ) : null}

          {event.cover_image_url ? (
            <View style={styles.coverContainer}>
              <Image source={{ uri: event.cover_image_url }} style={styles.coverImage} />
              <View style={styles.vibeBadge}>
                <MaterialCommunityIcons name="egg-outline" size={16} color="#fff" />
                <Text style={styles.vibeBadgeText}>HATCHING</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.headerSection}>
            <View style={styles.row}>
              <MaterialCommunityIcons
                name="waves"
                size={20}
                color={theme.accent}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.hostLabel, { color: theme.accent }, customFont]}>
                {event.host_name}&apos;s Idea
              </Text>
            </View>
            <Text style={[styles.title, { color: theme.text }, customFont]}>{event.title}</Text>
            {event.description ? (
              <Text style={[styles.desc, { color: theme.text, opacity: 0.8 }, customFont]}>
                {event.description}
              </Text>
            ) : null}
          </View>

          {event.proposed_dates?.length > 0 ? (
            <View style={styles.pollSection}>
              <Text style={[styles.sectionLabel, { color: theme.text, opacity: 0.6 }, customFont]}>
                Cast your votes:
              </Text>
              {event.proposed_dates.map((date: string, index: number) => {
                const isSelected = selectedDates.includes(date);
                const count = allVotes.filter((v) => v.selected_dates?.includes(date)).length;

                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.dateCard,
                      {
                        borderColor: isSelected
                          ? theme.accent
                          : theme.isDark
                            ? `${theme.accent}33`
                            : SYSTEM.border,
                        backgroundColor: isSelected
                          ? theme.accent
                          : theme.isDark
                            ? 'rgba(255,255,255,0.04)'
                            : SYSTEM.surface,
                      },
                    ]}
                    onPress={() => toggleDate(date)}
                    disabled={hasPendingRequest}
                  >
                    <View style={styles.dateInfoLeft}>
                      <Ionicons
                        name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                        size={24}
                        color={isSelected ? theme.bg : theme.accent}
                      />
                      <Text
                        style={[
                          styles.dateText,
                          { color: isSelected ? theme.bg : theme.text },
                          customFont,
                        ]}
                      >
                        {formatFriendlyDate(date)}
                      </Text>
                    </View>

                    {count > 0 ? (
                      <View
                        style={[
                          styles.badge,
                          {
                            backgroundColor: isSelected
                              ? 'rgba(255,255,255,0.2)'
                              : theme.isDark
                                ? 'rgba(255,255,255,0.08)'
                                : SYSTEM.secondaryBg,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.badgeText,
                            { color: isSelected ? theme.bg : theme.accent },
                          ]}
                        >
                          {count} votes
                        </Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.pollSection}>
              <Text style={[styles.sectionLabel, { color: theme.text, opacity: 0.6 }, customFont]}>
                Date &amp; Time
              </Text>
              <Text style={[styles.dateText, { color: theme.text, opacity: 0.5 }, customFont]}>
                No specific dates suggested yet.
              </Text>
            </View>
          )}

          <View style={styles.noteSection}>
            <Text style={[styles.sectionLabel, { color: theme.text, opacity: 0.6 }, customFont]}>
              
            </Text>
            <TextInput
              style={[
                styles.noteInput,
                {
                  borderColor: theme.isDark ? `${theme.accent}33` : SYSTEM.border,
                  color: theme.text,
                  backgroundColor: theme.isDark
                    ? 'rgba(255,255,255,0.05)'
                    : SYSTEM.surface,
                  opacity: hasPendingRequest ? 0.65 : 1,
                },
              ]}
              placeholder={
  event?.proposed_dates?.length > 0
    ? 'Share your thoughts ...'
    : 'Share you thoughts ...'
}
              placeholderTextColor={theme.text + '50'}
              multiline
              value={note}
              onChangeText={setNote}
              editable={!hasPendingRequest}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.mainBtn,
              {
                backgroundColor: theme.accent,
                opacity: hasPendingRequest ? 0.6 : 1,
              },
            ]}
            onPress={handleInterest}
            disabled={submitting || hasPendingRequest}
          >
            {submitting ? (
              <ActivityIndicator color={theme.bg} />
            ) : (
              <Text style={[styles.mainBtnText, { color: theme.bg }, customFont]}>
                {hasPendingRequest
                  ? 'Request Pending'
                  : requiresApproval
                    ? 'Request to Join'
                    : event?.proposed_dates?.length > 0
                      ? 'Vote'
                      : `Send to ${event?.host_name || 'Host'}`}
              </Text>
            )}
          </TouchableOpacity>

          <View style={{ height: 140 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  headerBar: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 5 },
  scrollContent: { paddingHorizontal: 25, paddingBottom: 40 },

  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },

  webBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginBottom: 20,
  },
  bannerTextContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bannerText: { fontSize: 13, fontWeight: '800' },

  coverContainer: {
    width: '100%',
    height: 220,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 25,
    position: 'relative',
  },
  coverImage: { width: '100%', height: '100%', resizeMode: 'cover' },

  vibeBadge: {
    position: 'absolute',
    top: 15,
    right: 15,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  vibeBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1 },

  headerSection: { marginBottom: 25 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },

  hostLabel: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  title: { fontSize: 34, fontWeight: '900', marginBottom: 12 },
  desc: { fontSize: 18, lineHeight: 26, fontWeight: '500' },

  pollSection: { marginBottom: 25 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 12,
    letterSpacing: 1,
  },

  dateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderRadius: 20,
    marginBottom: 10,
    borderWidth: 1.5,
  },

  dateInfoLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dateText: { fontSize: 16, fontWeight: '700' },

  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 11, fontWeight: '800' },

  noteSection: { marginBottom: 40 },
  noteInput: {
    borderRadius: 20,
    padding: 18,
    height: 100,
    fontSize: 16,
    borderWidth: 1,
    textAlignVertical: 'top',
  },

  mainBtn: { padding: 22, borderRadius: 18, alignItems: 'center' },
  mainBtnText: { fontSize: 19, fontWeight: '800' },
});