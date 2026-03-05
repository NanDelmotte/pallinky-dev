/** * Path: app/event/[slug]/details.tsx 
 * Description: Pure Event Details destination. 
 * Correctly exports as default and handles guest merging. */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, Image, SafeAreaView, Platform, Linking, StatusBar } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '@tarti-flette/core';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { CalendarButton } from '@tarti-flette/ui';

const PALETTES: Record<string, { bg: string; accent: string; text: string; isDark: boolean }> = {
  "zen": { bg: "#f8e9dc", accent: "#43691b", text: "#1f2a1b", isDark: false },
  "girly": { bg: "#f4bbd3", accent: "#fe5d9f", text: "#2b1f24", isDark: false },
  "fiesta": { bg: "#1729ae", accent: "#fe20e8", text: "#ffffff", isDark: true },
  "classy": { bg: "#03172f", accent: "#efd466", text: "#fff7b6", isDark: true },
  "spicy": { bg: "#656c12", accent: "#ecc216", text: "#ffffff", isDark: true },
  "submerged": { bg: "#e0f2fe", accent: "#0077b6", text: "#003049", isDark: false },
};

const FONT_MAP: Record<string, string> = {
  'Sans': Platform.OS === 'ios' ? 'Arial-BoldMT' : 'sans-serif-condensed',
  'Serif': Platform.OS === 'ios' ? 'Times New Roman' : 'serif',
  'Cursive': Platform.OS === 'ios' ? 'SnellRoundhand-Bold' : 'cursive',
  'Gothic': Platform.OS === 'ios' ? 'Copperplate-Bold' : 'monospace'
};

export default function EventDetailsPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<any>(null);
  const [guests, setGuests] = useState<any[]>([]);
  const [myStatus, setMyStatus] = useState<string | null>(null);

  useEffect(() => { fetchData(); }, [slug]);

  const fetchData = async () => {
    try {
      const { data: eventData } = await supabase.from('events').select('*').eq('slug', slug).single();
      if (!eventData) return;
      setEvent(eventData);

      const savedEmail = await SecureStore.getItemAsync('pallinky_user_email');
      const cleanEmail = savedEmail?.toLowerCase().trim();

      const [rsvpRes, vibeRes] = await Promise.all([
        supabase.from('rsvps').select('email_lc, status, name').eq('event_id', eventData.id),
        supabase.from('vibe_responses').select('user_email, guest_name').eq('event_id', eventData.id)
      ]);

      const rsvps = rsvpRes.data || [];
      const vibes = vibeRes.data || [];

      if (cleanEmail) {
        const me = rsvps.find(r => r.email_lc === cleanEmail);
        setMyStatus(me?.status || null);
      }

      const guestMap = new Map();
      rsvps.forEach(r => {
        const v = vibes.find(vibe => vibe.user_email === r.email_lc);
        guestMap.set(r.email_lc, {
          name: v?.guest_name || r.name || r.email_lc.split('@')[0],
          status: r.status
        });
      });

      setGuests(Array.from(guestMap.values()));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !event) return <View style={styles.centered}><ActivityIndicator color="#43691b" /></View>;

  const theme = PALETTES[event.gif_key] || PALETTES.zen;
  const customFont = { fontFamily: FONT_MAP[event.font_family] || (Platform.OS === 'ios' ? 'Arial-BoldMT' : 'sans-serif') };
  const isVibe = event.event_type === 'vibe';

  const hasLocationInDesc = event.description?.includes('Location: ');
  const displayDescription = hasLocationInDesc ? event.description.split('Location: ')[0].trim() : event.description;
  const locationText = hasLocationInDesc ? event.description.split('Location: ')[1].trim() : event.location;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.isDark ? "light-content" : "dark-content"} />
      
      <View style={styles.header}>
        <TouchableOpacity 
          style={[styles.backBtn, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]} 
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={20} color={theme.text} />
        </TouchableOpacity>

        <View style={[styles.typeBadge, { backgroundColor: isVibe ? '#43691b' : theme.accent }]}>
           <MaterialCommunityIcons name={isVibe ? "egg-outline" : "seal-variant"} size={14} color={theme.bg} />
           <Text style={[styles.typeBadgeText, { color: theme.bg }]}>{isVibe ? "HATCHING" : "HATCHED"}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {event.cover_image_url && (
          <View style={styles.imageWrapper}>
            <Image source={{ uri: event.cover_image_url }} style={styles.coverImage} />
          </View>
        )}

        <View style={styles.content}>
          <Text style={[styles.title, { color: theme.text }, customFont]}>{event.title}</Text>
          <Text style={[styles.host, { color: theme.text, opacity: 0.7 }, customFont]}>Hosted by {event.host_name}</Text>

          <View style={styles.infoBox}>
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="calendar-clock" size={22} color={theme.accent} />
              <Text style={[styles.infoText, { color: theme.text }, customFont]}>
                {new Date(event.starts_at).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>

            {locationText && (
              <TouchableOpacity 
                style={[styles.infoRow, { marginTop: 12 }]}
                onPress={() => Linking.openURL(Platform.OS === 'ios' ? `maps:0,0?q=${locationText}` : `geo:0,0?q=${locationText}`)}
              >
                <MaterialCommunityIcons name="map-marker-radius" size={22} color={theme.accent} />
                <Text style={[styles.infoText, { color: theme.accent, textDecorationLine: 'underline' }, customFont]}>
                  {locationText}
                </Text>
              </TouchableOpacity>
            )}

            {!isVibe && (
              <View style={{ marginTop: 20 }}>
                <CalendarButton event={event} theme={theme} />
              </View>
            )}
          </View>

          {displayDescription && (
            <View style={styles.descriptionContainer}>
              <Text style={[styles.descriptionText, { color: theme.text }, customFont]}>
                {displayDescription}
              </Text>
            </View>
          )}

          <TouchableOpacity 
            style={[styles.primaryBtn, { backgroundColor: theme.accent }]} 
            onPress={() => router.push(`/event/${slug}/${isVibe ? 'fishingRSVP' : 'formalRSVP'}`)}
          >
            <Text style={[styles.primaryBtnText, { color: theme.bg }]}>
              {myStatus ? `Change Response (${myStatus})` : isVibe ? "I'm Interested" : "RSVP to this Plan"}
            </Text>
          </TouchableOpacity>

          <Text style={[styles.sectionTitle, { color: theme.text, borderBottomColor: theme.accent + '30' }, customFont]}>
            Guest List ({guests.length})
          </Text>
          <View style={styles.guestList}>
            {guests.map((guest, i) => (
              <View key={i} style={[styles.guestCard, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                {guest.status === 'yes' && <Ionicons name="checkmark-circle" size={14} color={theme.accent} style={{marginRight: 4}} />}
                <Text style={[styles.guestName, { color: theme.text }, customFont]}>{guest.name?.split(' ')[0]}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 20, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  typeBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  typeBadgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  imageWrapper: { width: '100%', paddingHorizontal: 20 },
  coverImage: { width: '100%', height: 220, borderRadius: 24 },
  content: { padding: 25 },
  title: { fontSize: 34, fontWeight: '900', letterSpacing: -1, marginBottom: 4 },
  host: { fontSize: 18, marginBottom: 25 },
  infoBox: { marginBottom: 30 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoText: { fontSize: 17, fontWeight: '600' },
  descriptionContainer: { marginBottom: 35 },
  descriptionText: { fontSize: 17, lineHeight: 26 },
  primaryBtn: { height: 60, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 40 },
  primaryBtnText: { fontSize: 19, fontWeight: '800' },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 15, paddingBottom: 8, borderBottomWidth: 1 },
  guestList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  guestCard: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  guestName: { fontSize: 14, fontWeight: '600' }
});