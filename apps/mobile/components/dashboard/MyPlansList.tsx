/** * Path: components/dashboard/MyPlansList.tsx 
 * Description: Horizontal plans list. Cleaned of hidden card logic. */

import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { StyledText } from '@tarti-flette/ui';
import PlanCard from '../../../../packages/ui/src/PlanCard';

interface MyPlansListProps {
  data: {
    events: any[];
    rsvps: any[];
    userEmail: string;
  };
  theme: any;
  onRefresh?: () => void;
}

export default function MyPlansList({ data, theme, onRefresh }: MyPlansListProps) {
  const router = useRouter();
  const { events, rsvps, userEmail } = data;
  const emailLower = userEmail.toLowerCase().trim();

  const myPlans = events
    .filter((ev) => {
      const isHost = ev.host_email?.toLowerCase() === emailLower;
      const hasJoined = rsvps.some((r) => 
        r.event_id === ev.id && 
        (r.email_lc === emailLower || r.email?.toLowerCase() === emailLower) && 
        (r.status?.toLowerCase() === 'yes' || r.status?.toLowerCase() === 'going')
      );
      return isHost || hasJoined;
    })
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

  if (myPlans.length === 0) return null;

  return (
    <View style={styles.container}>
      <StyledText style={[styles.label, { color: theme.label }]}>My Upcoming Plans</StyledText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollPadding}>
        {myPlans.map((ev) => {
          const isHost = ev.host_email?.toLowerCase() === emailLower;
          return (
            <View key={`my-plan-wrapper-${ev.id}`} style={styles.cardWrapper}>
              <PlanCard 
                id={ev.id}
                currentUserEmail={emailLower}
                hostEmail={ev.host_email}
                title={ev.title}
                startsAt={ev.starts_at}
                location={ev.location}
                coverImageUrl={ev.cover_image_url || null}
                gifKey={ev.gif_key}
                fontFamily={ev.font_family}
                hostName={ev.host_name}
                status={isHost ? 'host' : 'guest'}
                actionLabel={isHost ? 'Manage' : 'View'}
                onPress={() => router.push((isHost ? `/m/${ev.manage_handle}` : `/event/${ev.slug}`) as any)}
                onRefresh={onRefresh}
              />
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 15 },
  label: { fontSize: 13, fontWeight: 'bold', marginLeft: 16, marginBottom: 8, textTransform: 'uppercase' },
  scrollPadding: { paddingRight: 16 },
  cardWrapper: { width: 320, marginRight: -10 }
});