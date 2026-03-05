/** * Path: app/event/[slug]/index.tsx 
 * Description: Traffic controller directing all guests to the Event Details page.
 * Version: v8 (Directs to /details instead of RSVP pages)
 */

import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@tarti-flette/core';

export default function EventTrafficController() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();

  useEffect(() => {
    async function routeGuest() {
      if (!slug) return;
      console.log("DEBUG | Routing traffic for slug:", slug);

      // 1. Try Exact Match
      const { data, error } = await supabase
        .from('events')
        .select('id, event_type, slug')
        .eq('slug', slug)
        .maybeSingle();

      if (error) {
        console.error("DEBUG | Supabase Error:", error.message, error.details);
      }

      let finalEvent = data;

      // 2. Try Case-Insensitive Match
      if (!finalEvent) {
        console.log("DEBUG | No exact match. Trying case-insensitive...");
        const { data: ilikeData } = await supabase
          .from('events')
          .select('id, event_type, slug')
          .ilike('slug', slug)
          .maybeSingle();
        finalEvent = ilikeData;
      }

      // 3. Last Resort: Check if it's a UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!finalEvent && uuidRegex.test(slug)) {
        console.log("DEBUG | Not a slug. Checking as UUID...");
        const { data: byId } = await supabase
          .from('events')
          .select('id, event_type, slug')
          .eq('id', slug)
          .maybeSingle();
        finalEvent = byId;
      }

      if (!finalEvent) {
        console.log("DEBUG | FINAL FAIL | No record found for:", slug);
        Alert.alert("Plan Not Found", `Check the link: ${slug}`);
        router.replace('/(tabs)');
        return;
      }

      // SUCCESS: Route everyone to the Details Destination
      const targetSlug = finalEvent.slug || slug;
      console.log("DEBUG | SUCCESS | Routing to details for:", targetSlug);
      
      router.replace(`/event/${targetSlug}/details`);
    }

    routeGuest();
  }, [slug]);

  return (
    <View style={styles.loader}>
      <ActivityIndicator size="large" color="#43691b" />
    </View>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8e9dc' }
});