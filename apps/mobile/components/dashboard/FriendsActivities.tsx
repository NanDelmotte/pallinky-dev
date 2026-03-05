/** * Path: components/dashboard/FriendsActivitiesList.tsx 
 * Description: Friends' activities list. Removed hidden card filtering logic. */

import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { StyledText } from '@tarti-flette/ui';
import PlanCard from '../../../../packages/ui/src/PlanCard';

interface FriendsActivitiesListProps {
  data: {
    events: any[];
    rsvps: any[];
    userEmail: string;
  };
  theme: any;
  onRefresh?: () => void;
}

export default function FriendsActivitiesList({ data, theme, onRefresh }: FriendsActivitiesListProps) {
  const router = useRouter();
  const { events, rsvps, userEmail } = data;
  const emailLower = userEmail.toLowerCase().trim();

  // Filter for plans where the user is NOT the host, but friends are going
  const friendsPlans = events.filter((ev) => {
    const isNotHost = ev.host_email?.toLowerCase() !== emailLower;
    const hasFriends = rsvps.some((r) => 
      r.event_id === ev.id && 
      r.email_lc !== emailLower &&
      (r.status?.toLowerCase() === 'yes' || r.status?.toLowerCase() === 'maybe')
    );
    return isNotHost && hasFriends;
  });

  if (friendsPlans.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.headerGroup}>
        <StyledText style={[styles.label, { color: theme.label }]}>Friends' Activities</StyledText>
        <StyledText style={styles.disclaimer}>Don't worry, they agreed to let you peek inside.</StyledText>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollPadding}>
        {friendsPlans.map((ev) => (
          <View key={`friend-plan-wrapper-${ev.id}`} style={styles.cardWrapper}>
            <PlanCard 
              id={ev.id}
              currentUserEmail={emailLower}
              hostEmail={ev.host_email}
              title={ev.title}
              startsAt={ev.starts_at}
              location={ev.location}
              coverImageUrl={ev.cover_image_url || null}
              gifKey={ev.gif_key}
              hostName={ev.host_name}
              showPeek={true}
              onPress={() => router.push(`/peek/${ev.id}`)}
              onRefresh={onRefresh}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 25 },
  headerGroup: { marginLeft: 16, marginBottom: 8 },
  label: { fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase' },
  disclaimer: { fontSize: 11, color: '#aaa', fontStyle: 'italic', marginTop: 2 },
  scrollPadding: { paddingRight: 16 },
  cardWrapper: { width: 320, marginRight: -10 }
});