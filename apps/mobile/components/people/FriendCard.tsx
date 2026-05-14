/**
 * Path: apps/mobile/components/people/FriendCard.tsx
 * Description:
 * Expandable friend relationship card for My People > Friends tab.
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Image,
  Pressable,
} from 'react-native';
import { StyledText } from '@pallinky/ui';
import { Ionicons } from '@expo/vector-icons';

export type FriendActivity =
  | {
      type: 'shared_event';
      id: string;
      title: string;
      subtitle: string;
      dateLabel: string;
      detail: string;
    }
  | {
      type: 'idea_response';
      id: string;
      title: string;
      subtitle: string;
      dateLabel: string;
      detail: string;
    };

export type FriendCardData = {
  id: string;
  name: string;
  avatarUrl: string | null;
  crossedPathsCount: number;
  lastSeenLabel: string;
  lastSeenAtEventTitle: string;
  sharedEventsCount: number;
  hostedByYouCount: number;
  hostedByThemCount: number;
  wavesCount: number;
  activity: FriendActivity[];
};

function avatarFor(name: string, avatarUrl?: string | null) {
  if (avatarUrl) return avatarUrl;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name
  )}&background=6A4C93&color=fff`;
}

export default function FriendCard({ friend }: { friend: FriendCardData }) {
  const [expanded, setExpanded] = useState(false);

  const sharedEvents = friend.activity.filter((item) => item.type === 'shared_event');
  const ideaResponses = friend.activity.filter((item) => item.type === 'idea_response');

  return (
    <View style={styles.friendCard}>
      <Pressable onPress={() => setExpanded((prev) => !prev)} style={styles.friendCardTop}>
        <Image
          source={{ uri: avatarFor(friend.name, friend.avatarUrl) }}
          style={styles.friendAvatar}
        />

        <View style={styles.friendMainText}>
          <StyledText style={styles.friendName}>{friend.name}</StyledText>

          <StyledText style={styles.friendSummary}>
            {friend.lastSeenAtEventTitle.startsWith('You both know')
              ? `${friend.crossedPathsCount} mutual ${
                  friend.crossedPathsCount === 1 ? 'connection' : 'connections'
                }`
              : ` ${friend.crossedPathsCount} ${
                  friend.crossedPathsCount === 1 ? 'event' : 'events'
                }`}
          </StyledText>

          <StyledText style={styles.friendSummarySub}>
            {`${friend.lastSeenAtEventTitle}`}
          </StyledText>

          <StyledText style={styles.friendSummarySubMuted}>
            {friend.lastSeenLabel}
          </StyledText>
        </View>

        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={22}
          color="#66715f"
        />
      </Pressable>

      {expanded && (
        <View style={styles.expandedContent}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <StyledText style={styles.statNumber}>{friend.sharedEventsCount}</StyledText>
              <StyledText style={styles.statLabel}>Shared{'\n'}events</StyledText>
            </View>

            <View style={styles.statItem}>
              <StyledText style={styles.statNumber}>{friend.hostedByYouCount}</StyledText>
              <StyledText style={styles.statLabel}>Hosted by{'\n'}you</StyledText>
            </View>

            <View style={styles.statItem}>
              <StyledText style={styles.statNumber}>{friend.hostedByThemCount}</StyledText>
              <StyledText style={styles.statLabel}>Hosted by{'\n'}them</StyledText>
            </View>

            <View style={styles.statItem}>
              <StyledText style={styles.statNumber}>{friend.wavesCount}</StyledText>
              <StyledText style={styles.statLabel}>Waves</StyledText>
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <StyledText style={styles.sectionTitle}>Shared Events</StyledText>

            {sharedEvents.length === 0 ? (
              <View style={styles.activityCard}>
                <StyledText style={styles.emptyText}>No shared events yet</StyledText>
              </View>
            ) : (
              sharedEvents.map((item) => (
                <View key={item.id} style={styles.activityCard}>
                  
                  <StyledText style={styles.activitySubtitle}>{item.title}</StyledText>
                  <StyledText style={styles.activityDate}>
  {item.dateLabel ? new Date(item.dateLabel).toDateString() : 'TBD'}
</StyledText>
                  {!!item.detail && (
                    <StyledText style={styles.activityDetail}>{item.detail}</StyledText>
                  )}
                </View>
              ))
            )}
          </View>

          <View style={styles.sectionBlock}>
            <StyledText style={styles.sectionTitle}>Responses to Your Ideas</StyledText>

            {ideaResponses.length === 0 ? (
              <View style={styles.activityCard}>
                <StyledText style={styles.emptyText}>No responses yet</StyledText>
              </View>
            ) : (
              ideaResponses.map((item) => (
                <View key={item.id} style={styles.activityCard}>
                  
                  <StyledText style={styles.activitySubtitle}>{item.subtitle}</StyledText>
                  <StyledText style={styles.activityDate}>
  {item.dateLabel ? new Date(item.dateLabel).toDateString() : 'TBD'}
</StyledText>
                  {!!item.detail && (
                    <StyledText style={styles.activityDetail}>{item.detail}</StyledText>
                  )}
                </View>
              ))
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  friendCard: {
  backgroundColor: '#FFFFFF',
  borderRadius: 18,
  padding: 14,
  borderWidth: 1,
  borderColor: '#E4E7EC',
},
  friendCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  friendAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#DDD',
  },
  friendMainText: {
    flex: 1,
    minWidth: 0,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111111',
    marginBottom: 2,
  },
  friendSummary: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1f2a1b',
  },
  friendSummarySub: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1f2a1b',
    marginTop: 2,
  },
  friendSummarySubMuted: {
    fontSize: 13,
    color: '#66715f',
    marginTop: 3,
  },
  expandedContent: {
    paddingTop: 20,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 24,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111111',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    color: '#66715f',
    fontWeight: '700',
  },
  sectionBlock: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111111',
    marginBottom: 12,
  },
  activityCard: {
    backgroundColor: '#F8F9FB',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EEF1F4',
    marginBottom: 10,
  },
  activityTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111111',
    marginBottom: 4,
  },
  activitySubtitle: {
    fontSize: 14,
    color: '#4a524b',
    fontWeight: '700',
    marginBottom: 4,
  },
  activityDate: {
    fontSize: 14,
    color: '#4a524b',
    fontWeight: '700',
    marginBottom: 4,
  },
  activityDetail: {
    fontSize: 14,
    color: '#4a524b',
    fontWeight: '700',
  },
  emptyText: {
    color: '#66715f',
    fontWeight: '700',
  },
});