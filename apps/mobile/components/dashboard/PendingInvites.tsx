/** * Path: components/dashboard/PendingInvites.tsx 
 * Description: Section for events where user hasn't responded or replied 'Maybe'. 
 * Removed hidden card filtering logic. */

import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import PlanCard from '../../../../packages/ui/src/PlanCard';

interface PendingInvitesProps {
  data: {
    events: any[];
    rsvps: any[];
    userEmail: string;
  };
  theme: {
    label: string;
    text: string;
  };
  onRefresh?: () => void;
}

export default function PendingInvites({ data, theme, onRefresh }: PendingInvitesProps) {
  const { events, rsvps, userEmail } = data;
  const router = useRouter();
  
  const emailLower = userEmail?.toLowerCase().trim();

  // Find events that are pending or marked 'maybe'
  const pendingList = events.filter((ev) => {
    return rsvps.some((r) => {
      const rsvpEmail = (r.email_lc || r.email || "").toLowerCase().trim();
      const status = (r.status || "").toLowerCase().trim();
      
      return (
        r.event_id === ev.id && 
        rsvpEmail === emailLower && 
        (status === '' || status === 'none' || status === 'invited' || status === 'pending' || status === 'maybe')
      );
    });
  });

  if (pendingList.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={[styles.label, { color: theme.label }]}>
        Pending Invites
      </Text>
      
      {pendingList.map((ev: any) => {
        // Find the specific status for this event to pass to the card
        const userRsvp = rsvps.find(r => 
          r.event_id === ev.id && 
          (r.email_lc || r.email || "").toLowerCase().trim() === emailLower
        );
        const currentStatus = userRsvp?.status?.toLowerCase().trim();

        return (
          <PlanCard
            key={`pending-${ev.id}`}
            id={ev.id}
            currentUserEmail={emailLower}
            hostEmail={ev.host_email}
            title={ev.title}
            startsAt={ev.starts_at}
            location={ev.location}
            coverImageUrl={ev.cover_image_url}
            gifKey={ev.gif_key}
            fontFamily={ev.font_family}
            hostName={ev.host_name || 'A Friend'}
            actionLabel={currentStatus === 'maybe' ? "Update" : "RSVP"}
            onPress={() => router.push(`/event/${ev.slug}` as any)}
            onRefresh={onRefresh}
            showPeek={true}
            badge={currentStatus === 'maybe' ? "MAYBE" : undefined}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 20 },
  label: { 
    fontSize: 13, 
    fontWeight: 'bold', 
    marginBottom: 10, 
    textTransform: 'uppercase', 
    paddingHorizontal: 16 
  }
});