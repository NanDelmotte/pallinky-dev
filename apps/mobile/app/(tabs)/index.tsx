/**
 * Path: apps/mobile/app/(tabs)/index.tsx
 * Description: Feed surface composed into:
 * - What is Happening
 * - Reconnect
 * - Start Something
 *
 * This version keeps the existing dashboard components,
 * but moves feed-state and feed-signal derivation into a central truth layer.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  ScrollView,
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Pressable,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as Contacts from 'expo-contacts';
import { Ionicons } from '@expo/vector-icons';

import { supabase, useSession } from '@pallinky/core';
import { StyledText, DASHBOARD_THEMES } from '@pallinky/ui';

import MyPlansList from '../../components/dashboard/MyPlansList';
import FriendsActivities from '../../components/dashboard/FriendsActivities';
import PeopleYouMayKnow from '../../components/dashboard/PeopleYouMayKnow';
import { deriveFeedSignals, type FeedState } from '../../lib/feed/deriveFeed';
import {
  getEventAccessDecision,
  type EventAccessDecision,
} from '../../lib/visibility/getEventAccessDecision';

type IdeaPrompt = {
  key: string;
  emoji: string;
  title: string;
  subtitle: string;
  route: string;
  params?: Record<string, string>;
};

const IDEA_PROMPTS: IdeaPrompt[] = [
  {
    key: 'coffee',
    emoji: '☕',
    title: 'Coffee this week',
    subtitle: 'Low-friction catch-up',
    route: '/create/vibe',
    params: {
      prefill_title: 'Coffee?',
      prefill_desc: 'Anyone up for coffee?',
    },
  },
  {
    key: 'drinks',
    emoji: '🍸',
    title: 'Drinks tonight',
    subtitle: 'See who is around',
    route: '/create/vibe',
    params: {
      prefill_title: 'Drinks?',
      prefill_desc: 'Thinking about drinks. Who’s in?',
    },
  },
  {
    key: 'dinner',
    emoji: '🍽️',
    title: 'Dinner this weekend',
    subtitle: 'Start a real plan',
    route: '/create/formal',
    params: {
      prefill_title: 'Dinner',
      prefill_desc: 'Come join for dinner.',
    },
  },
  {
    key: 'walk',
    emoji: '🚶',
    title: 'Walk in the park',
    subtitle: 'Easy outdoor plan',
    route: '/create/vibe',
    params: {
      prefill_title: 'Walk?',
      prefill_desc: 'Anyone up for a walk?',
    },
  },
  {
    key: 'movie',
    emoji: '🎬',
    title: 'Movie night',
    subtitle: 'Quick group invite',
    route: '/create/vibe',
    params: {
      prefill_title: 'Movie?',
      prefill_desc: 'Thinking about a movie night. Interested?',
    },
  },
];

function normalizeEmail(value: string | null | undefined) {
  return (value || '').toLowerCase().trim();
}

function normalizeId(value: unknown) {
  return String(value || '').trim();
}

export default function HomeScreen() {
  const router = useRouter();
  const { session } = useSession();

  const [loading, setLoading] = useState(true);
  const [themeKey, setThemeKey] = useState('classic');
  const [deviceContactCount, setDeviceContactCount] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [data, setData] = useState<any>({
    events: [],
    rsvps: [],
    vibeResponses: [],
    secondDegreeEvents: [],
    secondDegreeRsvps: [],
    invites: [],
    socialCircles: [],
    contacts: [],
    userEmail: '',
    userPersonId: '',
    chatSummaries: {},
    accessByEventId: {},
  });

  const loadData = async () => {
    if (!session?.user?.email) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const emailLower = normalizeEmail(session.user.email);

      const theme = await SecureStore.getItemAsync('pallinky_theme');
      if (theme) setThemeKey(theme);

      const { status } = await Contacts.getPermissionsAsync();
      let nextDeviceContactCount = 0;
      if (status === 'granted') {
        const { data: contacts } = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.Emails],
          pageSize: 1,
        });
        nextDeviceContactCount = contacts?.length || 0;
      }
      setDeviceContactCount(nextDeviceContactCount);

      const [{ data: profile }, { data: mePerson }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, avatar_url')
          .eq('id', session.user.id)
          .maybeSingle(),
        supabase
          .from('people')
          .select('id, primary_email_lc, matched_user_id')
          .or(`matched_user_id.eq.${session.user.id},primary_email_lc.eq.${emailLower}`)
          .limit(1)
          .maybeSingle(),
      ]);

      setAvatarUrl((profile as any)?.avatar_url || null);

      const userPersonId = normalizeId((mePerson as any)?.id);

      const [
        hostedEventsRes,
        invitesRes,
        myRsvpsRes,
        myVibeResponsesRes,
        circlesRes,
        deviceContactsRes,
      ] = await Promise.all([
        supabase.from('events').select('*').eq('host_email', emailLower),

        supabase
          .from('event_invites')
          .select('event_id, invitee_email_lc, invitee_phone_e164, person_id, status')
          .eq('invitee_email_lc', emailLower),

        supabase
          .from('rsvps')
          .select('*')
          .eq('email_lc', emailLower),

        supabase
          .from('vibe_responses')
          .select('*')
          .eq('email_lc', emailLower),

        profile?.id
          ? supabase
              .from('social_circles')
              .select('id, circle_name, created_at')
              .eq('user_id', profile.id)
              .order('created_at', { ascending: false })
          : Promise.resolve({ data: [] }),

        supabase.rpc('get_my_device_contacts'),
      ]);

      const circleRows = circlesRes.data || [];
      const circleIds = circleRows.map((circle: any) => circle.id);

      let circleMemberRows: any[] = [];
      if (circleIds.length > 0) {
        const { data: membersRes, error: membersError } = await supabase
          .from('social_circle_members')
          .select(
            'id, circle_id, member_name, member_email_lc, member_phone_e164, member_user_id, sort_order, created_at, device_contact_id, person_id'
          )
          .in('circle_id', circleIds)
          .order('sort_order', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: true });

        if (membersError) throw membersError;
        circleMemberRows = membersRes || [];
      }

      const membersByCircleId = new Map<string, any[]>();
      circleRows.forEach((circle: any) => membersByCircleId.set(circle.id, []));
      circleMemberRows.forEach((row: any) => {
        const current = membersByCircleId.get(row.circle_id) || [];
        current.push(row);
        membersByCircleId.set(row.circle_id, current);
      });

      const socialCircles = circleRows.map((circle: any) => ({
        ...circle,
        members: membersByCircleId.get(circle.id) || [],
      }));

      const circleMemberEmails = Array.from(
        new Set(
          socialCircles
            .flatMap((circle: any) => (Array.isArray(circle?.members) ? circle.members : []))
            .map((member: any) => normalizeEmail(member?.member_email_lc))
            .filter((email: string) => email && email !== emailLower)
        )
      );

      const sharedHistoryEventIds = Array.from(
        new Set(
          (myRsvpsRes.data || [])
            .map((r: any) => (r.event_id ? String(r.event_id) : null))
            .filter(Boolean)
        )
      );

      let sharedHistoryRsvps: any[] = [];
      if (sharedHistoryEventIds.length > 0) {
        const { data: sharedHistoryRows } = await supabase
          .from('rsvps')
          .select('event_id, person_id, email_lc, email')
          .in('event_id', sharedHistoryEventIds);

        sharedHistoryRsvps = sharedHistoryRows || [];
      }

      const relatedHostEmails = Array.from(
        new Set([
          ...circleMemberEmails,
          ...sharedHistoryRsvps
            .map((r: any) => normalizeEmail(r.email_lc || r.email))
            .filter((email: string) => email && email !== emailLower),
        ])
      );

      let relatedHostedEvents: any[] = [];
      if (relatedHostEmails.length > 0) {
        const { data: relatedHostedEventsRes } = await supabase
          .from('events')
          .select('*')
          .in('host_email', relatedHostEmails);

        relatedHostedEvents = relatedHostedEventsRes || [];
      }

      const inviteEventIds = (invitesRes.data || []).map((i: any) => i.event_id);
      const rsvpEventIds = (myRsvpsRes.data || []).map((r: any) => r.event_id);
      const vibeResponseEventIds = (myVibeResponsesRes.data || []).map((r: any) => r.event_id);

      const directEventIdsToLoad = Array.from(
        new Set([
          ...(hostedEventsRes.data || []).map((e: any) => e.id),
          ...inviteEventIds,
          ...rsvpEventIds,
          ...vibeResponseEventIds,
          ...relatedHostedEvents.map((e: any) => e.id),
        ])
      );

      let directEvents: any[] = [];
      if (directEventIdsToLoad.length > 0) {
        const { data: allEventsRes } = await supabase
          .from('events')
          .select('*')
          .in('id', directEventIdsToLoad);

        directEvents = allEventsRes || [];
      }

      const accessEntries = await Promise.all(
        directEvents.map(async (ev: any) => {
          const decision = await getEventAccessDecision({
            eventId: String(ev.id),
            viewerEmail: emailLower,
          });

          return [String(ev.id), decision] as const;
        })
      );

      const accessByEventId: Record<string, EventAccessDecision> = Object.fromEntries(accessEntries);

      const visibleDirectEvents = directEvents.filter(
        (ev: any) => accessByEventId[String(ev.id)]?.can_see === true
      );

      const visibleDirectEventIds = visibleDirectEvents.map((ev: any) => String(ev.id));

      let directEventRsvps: any[] = [];
      if (visibleDirectEventIds.length > 0) {
        const { data: eventRsvpsRes } = await supabase
          .from('rsvps')
          .select('*')
          .in('event_id', visibleDirectEventIds);

        directEventRsvps = eventRsvpsRes || [];
      }

      const directPersonEmails = Array.from(
        new Set(
          directEventRsvps
            .map((r: any) => normalizeEmail(r.email_lc || r.email))
            .filter((email: string) => email && email !== emailLower)
        )
      );

      let secondDegreeBridgeRsvps: any[] = [];
      if (directPersonEmails.length > 0) {
        const { data } = await supabase
          .from('rsvps')
          .select('*')
          .in('email_lc', directPersonEmails);

        secondDegreeBridgeRsvps = data || [];
      }

      const secondDegreeEventIds = Array.from(
        new Set(
          secondDegreeBridgeRsvps
            .map((r: any) => r.event_id)
            .filter(Boolean)
        )
      );

      let secondDegreeEvents: any[] = [];
      if (secondDegreeEventIds.length > 0) {
        const { data } = await supabase
          .from('events')
          .select('*')
          .in('id', secondDegreeEventIds);

        secondDegreeEvents = data || [];
      }

      const secondDegreeAccessEntries = await Promise.all(
        secondDegreeEvents.map(async (ev: any) => {
          const decision = await getEventAccessDecision({
            eventId: String(ev.id),
            viewerEmail: emailLower,
          });

          return [String(ev.id), decision] as const;
        })
      );

      for (const [eventId, decision] of secondDegreeAccessEntries) {
        if (!accessByEventId[eventId]) {
          accessByEventId[eventId] = decision;
        }
      }

      let secondDegreeEventRsvps: any[] = [];
      if (secondDegreeEventIds.length > 0) {
        const { data } = await supabase
          .from('rsvps')
          .select('*')
          .in('event_id', secondDegreeEventIds);

        secondDegreeEventRsvps = data || [];
      }

      const allEventMap = new Map<string, any>();
      for (const ev of [...visibleDirectEvents, ...secondDegreeEvents]) {
        allEventMap.set(String(ev.id), ev);
      }

      const allRsvpMap = new Map<string, any>();
      for (const r of [...directEventRsvps, ...secondDegreeEventRsvps]) {
        allRsvpMap.set(String(r.id), r);
      }

      const allEvents = Array.from(allEventMap.values());
      const eventRsvps = Array.from(allRsvpMap.values());

      const visibleInviteEventIds = new Set(visibleDirectEventIds);
      const visibleInvites = (invitesRes.data || []).filter((invite: any) =>
        visibleInviteEventIds.has(String(invite.event_id))
      );

      const chatSummaryPairs = await Promise.all(
        visibleDirectEvents.map(async (ev: any) => {
          try {
            const { data } = await supabase.rpc('get_event_chat_summary', {
              p_event_id: ev.id,
              p_user_email: emailLower,
            });

            return [ev.id, data?.[0] || null] as const;
          } catch {
            return [ev.id, null] as const;
          }
        })
      );

      const chatSummaries = Object.fromEntries(chatSummaryPairs);

      setData({
        events: allEvents,
        rsvps: eventRsvps,
        vibeResponses: myVibeResponsesRes.data || [],
        secondDegreeEvents,
        secondDegreeRsvps: secondDegreeEventRsvps,
        invites: visibleInvites,
        socialCircles,
        contacts: deviceContactsRes.data || [],
        chatSummaries,
        accessByEventId,
        userEmail: emailLower,
        userPersonId,
      });
    } catch (error) {
      console.error('Social Feed data load failed', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [session])
  );

  const theme = DASHBOARD_THEMES[themeKey] || DASHBOARD_THEMES.classic;

  const feed = useMemo(() => {
    return deriveFeedSignals({
      data,
      deviceContactCount,
    });
  }, [data, deviceContactCount]);

  const feedState: FeedState = feed.feedState;

  const brewingSignals = useMemo(() => {
    const accessByEventId = data.accessByEventId || {};

    const base = feed.items.filter((s) => {
      const evId = String(s?.payload?.id || s?.eventId || '');
      if (!evId) return false;

      if (accessByEventId[evId]?.can_see !== true) return false;

      return (
        s.type === 'upcoming_plan' ||
        s.type === 'event_starting_soon' ||
        s.type === 'friend_created_event' ||
        s.type === 'friend_attending_event'
      );
    });

    const hostedEvents = data.events
      .filter(
        (ev: any) =>
          normalizeEmail(ev.host_email) === data.userEmail &&
          accessByEventId[String(ev.id)]?.can_see === true
      )
      .map((ev: any) => ({
        id: `hosted_event:${ev.id}`,
        type: 'upcoming_plan',
        payload: ev,
      }));

    return [...hostedEvents, ...base];
  }, [feed, data]);

  const compactStartSomething = feedState === 'mature_network';
  const visibleIdeaPrompts =
    feedState === 'cold_start'
      ? IDEA_PROMPTS.slice(0, 5)
      : compactStartSomething
      ? IDEA_PROMPTS.slice(0, 3)
      : IDEA_PROMPTS.slice(0, 4);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#0077b6" size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={styles.header}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <StyledText style={[styles.mainTitle, { color: theme.text }]}>Social Feed</StyledText>
          <StyledText style={[styles.mainSubtitle, { color: '#66715f' }]}>
            Plans and people moving around you.
          </StyledText>
        </View>

        <TouchableOpacity onPress={() => router.push('/profile')}>
          <Image
            source={{
              uri:
                avatarUrl ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                  session?.user?.email || 'U'
                )}&background=43691b&color=fff`,
            }}
            style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#eee' }}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {feedState === 'cold_start' ? (
          <>
            <FeedSectionHeader
              title="Start Something"
              subtitle="The fastest way to get motion into your feed."
              theme={theme}
            />
            <StartSomethingSection
              prompts={visibleIdeaPrompts}
              onPressPrompt={(prompt) =>
                router.push({
                  pathname: prompt.route as any,
                  params: prompt.params,
                })
              }
            />

            <FeedSectionHeader
              title="What is Happening?"
              subtitle="Once plans and people start showing up, they will appear here."
              theme={theme}
            />
            <EmptyBrewingCard theme={theme} />
          </>
        ) : (
          <>
            <FeedSectionHeader
              title="What is Happening?"
              subtitle="Your active plans"
              theme={theme}
            />
            <WhatIsBrewingSection
              data={data}
              theme={theme}
              signals={brewingSignals}
              onRefresh={loadData}
            />

            {brewingSignals.some(
              (s) => s.type === 'friend_created_event' || s.type === 'friend_attending_event'
            ) && (
              <>
                <FeedSectionHeader
                  title="Your friends active plans"
                  subtitle="Don't worry, they said you could peek, and we won't show them that you did"
                  theme={theme}
                />
                <FriendsActivities
                  data={data}
                  theme={theme}
                  signals={brewingSignals}
                  onRefresh={loadData}
                />
              </>
            )}

            <ReconnectSection
              data={data}
              theme={theme}
              signals={feed.items}
              onRefresh={loadData}
            />

            <FeedSectionHeader
              title="Start Something"
              subtitle="Fast prompts to open the create flow."
              theme={theme}
              compact={compactStartSomething}
            />
            <StartSomethingSection
              prompts={visibleIdeaPrompts}
              compact={compactStartSomething}
              onPressPrompt={(prompt) =>
                router.push({
                  pathname: prompt.route as any,
                  params: prompt.params,
                })
              }
            />
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function FeedSectionHeader({
  title,
  subtitle,
  theme,
  compact = false,
}: {
  title: string;
  subtitle?: string;
  theme: any;
  compact?: boolean;
}) {
  return (
    <View style={[styles.sectionHeader, compact && styles.sectionHeaderCompact]}>
      <StyledText style={[styles.sectionTitle, { color: theme.text }]}>{title}</StyledText>
      {subtitle ? (
        <StyledText style={[styles.sectionSubtitle, { color: theme.text }]}>
          {subtitle}
        </StyledText>
      ) : null}
    </View>
  );
}

function WhatIsBrewingSection({
  data,
  theme,
  onRefresh,
  signals,
}: {
  data: any;
  theme: any;
  signals: any[];
  onRefresh?: () => void;
}) {
  return (
    <View>
      <MyPlansList
        data={data}
        theme={theme}
        signals={signals}
        onRefresh={onRefresh}
      />
    </View>
  );
}

function ReconnectSection({
  data,
  theme,
  signals,
  onRefresh,
}: {
  data: any;
  theme: any;
  signals: any[];
  onRefresh?: () => void;
}) {
  const suggestionSignals = signals.filter((s) => s.type === 'suggested_connection');

  if (suggestionSignals.length === 0) return null;

  return (
    <>
      <FeedSectionHeader
        title="Connect"
        subtitle="People you may want to pull into orbit."
        theme={theme}
      />

      <PeopleYouMayKnow
        data={data}
        theme={theme}
        signals={suggestionSignals}
        onRefresh={onRefresh}
      />
    </>
  );
}

function StartSomethingSection({
  prompts,
  onPressPrompt,
  compact = false,
}: {
  prompts: IdeaPrompt[];
  onPressPrompt: (prompt: IdeaPrompt) => void;
  compact?: boolean;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.ideaScrollContent}
    >
      {prompts.map((prompt) => (
        <Pressable
          key={prompt.key}
          onPress={() => onPressPrompt(prompt)}
          style={({ pressed }) => [
            styles.ideaCard,
            compact && styles.ideaCardCompact,
            pressed && { opacity: 0.9 },
          ]}
        >
          <StyledText style={styles.ideaEmoji}>{prompt.emoji}</StyledText>
          <StyledText style={styles.ideaTitle}>{prompt.title}</StyledText>
          <StyledText style={styles.ideaSubtitle}>{prompt.subtitle}</StyledText>

          <View style={styles.ideaFooter}>
            <StyledText style={styles.ideaAction}>Start</StyledText>
            <Ionicons name="arrow-forward" size={14} color="#1f2a1b" />
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function ImportCoffeeCard({
  theme,
  onPress,
}: {
  theme: any;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.utilityCard,
        { borderColor: theme.border || '#e5e7eb', backgroundColor: '#ffffff' },
        pressed && { opacity: 0.92 },
      ]}
    >
      <View style={styles.utilityIconWrap}>
        <Ionicons name="cafe-outline" size={20} color="#1f2a1b" />
      </View>
      <View style={{ flex: 1 }}>
        <StyledText style={styles.utilityTitle}>Invite someone for coffee</StyledText>
        <StyledText style={styles.utilitySubtitle}>
          One easy plan is enough to get things moving.
        </StyledText>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#64748b" />
    </Pressable>
  );
}

function EmptyBrewingCard({ theme }: { theme: any }) {
  return (
    <View
      style={[
        styles.utilityCard,
        { borderColor: theme.border || '#e5e7eb', backgroundColor: '#ffffff' },
      ]}
    >
      <View style={styles.utilityIconWrap}>
        <Ionicons name="sparkles-outline" size={20} color="#1f2a1b" />
      </View>
      <View style={{ flex: 1 }}>
        <StyledText style={styles.utilityTitle}>No live activity yet</StyledText>
        <StyledText style={styles.utilitySubtitle}>
          As soon as plans, invites, or network activity appear, this section will populate.
        </StyledText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F6F7F9',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },

  mainTitle: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
    color: '#1f2a1b',
  },

  scrollContent: {
    paddingBottom: 20,
    backgroundColor: '#F6F7F9',
  },

  sectionHeader: {
    paddingHorizontal: 16,
    marginTop: 18,
    marginBottom: 6,
  },

  sectionHeaderCompact: {
    marginTop: 14,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
    color: '#1f2a1b',
  },

  sectionSubtitle: {
    fontSize: 13,
    marginTop: 4,
    color: '#66715f',
  },

  ideaScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
  },

  ideaCard: {
    width: 170,
    minHeight: 150,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    padding: 14,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#bac9ad',
    justifyContent: 'space-between',
  },

  ideaCardCompact: {
    width: 155,
    minHeight: 136,
  },

  ideaEmoji: {
    fontSize: 24,
  },

  ideaTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1f2a1b',
    marginTop: 10,
  },

  ideaSubtitle: {
    fontSize: 12,
    color: '#66715f',
    marginTop: 6,
    lineHeight: 17,
  },

  ideaFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
  },

  ideaAction: {
    fontSize: 12,
    fontWeight: '800',
    color: '#43691b',
  },

  utilityCard: {
    marginHorizontal: 16,
    marginTop: 6,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#bac9ad',
    backgroundColor: '#FFFFFF',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  utilityIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#bac9ad',
    alignItems: 'center',
    justifyContent: 'center',
  },

  utilityTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1f2a1b',
  },
  mainSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#66715f',
  },
  utilitySubtitle: {
    fontSize: 12,
    color: '#66715f',
    marginTop: 3,
    lineHeight: 17,
  },
});