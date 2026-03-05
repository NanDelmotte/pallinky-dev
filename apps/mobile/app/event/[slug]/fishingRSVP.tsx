/** * Path: app/event/[slug]/fishingRSVP.tsx 
 * Description: RSVP page for Hatchery/Fishing ideas. Added Web-only App Store banner.
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform, Alert, TextInput, SafeAreaView, StatusBar, Image, Text, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase, useSession } from '@tarti-flette/core';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const PALETTES: Record<string, { bg: string; accent: string; text: string; isDark: boolean }> = {
  "submerged": { bg: "#e0f2fe", accent: "#0077b6", text: "#003049", isDark: false },
  "zen": { bg: "#f8e9dc", accent: "#43691b", text: "#1f2a1b", isDark: false },
  "girly": { bg: "#f4bbd3", accent: "#fe5d9f", text: "#2b1f24", isDark: false },
  "fiesta": { bg: "#1729ae", accent: "#fe20e8", text: "#ffffff", isDark: true },
  "classy": { bg: "#03172f", accent: "#efd466", text: "#fff7b6", isDark: true },
  "spicy": { bg: "#656c12", accent: "#ecc216", text: "#ffffff", isDark: true },
};

const FONT_MAP: Record<string, string> = {
  'Sans': Platform.OS === 'ios' ? 'Arial-BoldMT' : 'sans-serif-condensed',
  'Serif': Platform.OS === 'ios' ? 'Times New Roman' : 'serif',
  'Cursive': Platform.OS === 'ios' ? 'SnellRoundhand-Bold' : 'cursive',
  'Gothic': Platform.OS === 'ios' ? 'Copperplate-Bold' : 'monospace'
};

const STORE_URL = Platform.OS === 'ios' 
  ? 'https://apps.apple.com/app/idYOUR_APP_ID' 
  : 'https://play.google.com/store/apps/details?id=com.your.package';

export default function FishingRSVPScreen() {
  const { slug } = useLocalSearchParams();
  const router = useRouter();
  const { userEmail, loading: sessionLoading } = useSession();
  
  const [event, setEvent] = useState<any>(null);
  const [allVotes, setAllVotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [note, setNote] = useState('');

  const themeKey = event?.gif_key && PALETTES[event.gif_key] ? event.gif_key : "submerged";
  const theme = PALETTES[themeKey];
  const customFont = { fontFamily: FONT_MAP[event?.font_family] || (Platform.OS === 'ios' ? 'Arial-BoldMT' : 'sans-serif') };

  const formatFriendlyDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    });
  };

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: eventData } = await supabase.from('events').select('*').eq('slug', slug).single();
        if (eventData) {
          setEvent(eventData);
          const { data: voteData } = await supabase.from('vibe_responses').select('user_email, selected_dates, note').eq('event_id', eventData.id);
          if (voteData) {
            setAllVotes(voteData);
            const cleanEmail = userEmail?.toLowerCase().trim();
            const myVote = voteData.find(v => v.user_email === cleanEmail);
            if (myVote) {
              setSelectedDates(myVote.selected_dates || []);
              setNote(myVote.note || '');
            }
          }
        }
      } catch (e) { console.error(e); } finally { setLoading(false); }
    }
    fetchData();
  }, [slug, userEmail]);

  const toggleDate = (date: string) => {
    if (selectedDates.includes(date)) {
      setSelectedDates(selectedDates.filter(d => d !== date));
    } else {
      setSelectedDates([...selectedDates, date]);
    }
  };

  const handleInterest = async () => {
    if (!userEmail) return router.push(`/auth?slug=${slug}`);
    if (event.proposed_dates?.length > 0 && selectedDates.length === 0) {
      return Alert.alert("Pick a date", "Please select at least one date!");
    }

    setSubmitting(true);
    try {
      const cleanEmail = userEmail.toLowerCase().trim();
      await supabase.from('rsvps').upsert({ event_id: event.id, email_lc: cleanEmail, status: 'interested' }, { onConflict: 'event_id,email_lc' });
      await supabase.from('vibe_responses').upsert({ event_id: event.id, user_email: cleanEmail, guest_name: cleanEmail.split('@')[0], selected_dates: selectedDates, note: note.trim() }, { onConflict: 'event_id,user_email' });
      router.push({ pathname: `/event/${slug}/thanks` as any, params: { status: 'interested', theme: themeKey } });
    } catch (e: any) { Alert.alert("Error", e.message); } finally { setSubmitting(false); }
  };

  if (loading || sessionLoading || !event) {
    return <ActivityIndicator color={theme?.accent || "#000"} style={{ flex: 1, backgroundColor: theme?.bg || '#fff' }} />;
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.isDark ? "light-content" : "dark-content"} />
      <View style={styles.container}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
            <Ionicons name="arrow-back" size={20} color={theme.text} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* WEB-ONLY APP DOWNLOAD BANNER */}
          {Platform.OS === 'web' && (
            <TouchableOpacity style={[styles.webBanner, { backgroundColor: theme.accent }]} onPress={() => Linking.openURL(STORE_URL)}>
              <View style={styles.bannerTextContent}>
                <MaterialCommunityIcons name="cellphone-arrow-down" size={18} color={theme.bg} />
                <Text style={[styles.bannerText, { color: theme.bg }]}>Get the full app experience</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.bg} />
            </TouchableOpacity>
          )}

          {event.cover_image_url && (
            <View style={styles.coverContainer}>
              <Image source={{ uri: event.cover_image_url }} style={styles.coverImage} />
              <View style={styles.vibeBadge}>
                 <MaterialCommunityIcons name="egg-outline" size={16} color="#fff" />
                 <Text style={styles.vibeBadgeText}>HATCHING</Text>
              </View>
            </View>
          )}

          <View style={styles.headerSection}>
            <View style={styles.row}>
                <MaterialCommunityIcons name="waves" size={20} color={theme.accent} style={{marginRight: 6}} />
                <Text style={[styles.hostLabel, { color: theme.accent }, customFont]}>{event.host_name}'s Idea</Text>
            </View>
            <Text style={[styles.title, { color: theme.text }, customFont]}>{event.title}</Text>
            {event.description && <Text style={[styles.desc, { color: theme.text, opacity: 0.8 }, customFont]}>{event.description}</Text>}
          </View>

          {event.proposed_dates?.length > 0 ? (
            <View style={styles.pollSection}>
              <Text style={[styles.sectionLabel, { color: theme.text, opacity: 0.6 }, customFont]}>Cast your votes:</Text>
              {event.proposed_dates.map((date: string, index: number) => {
                const isSelected = selectedDates.includes(date);
                const count = allVotes.filter(v => v.selected_dates?.includes(date)).length;
                return (
                  <TouchableOpacity key={index} style={[styles.dateCard, { borderColor: theme.accent + '30' }, isSelected && { backgroundColor: theme.accent, borderColor: theme.accent }]} onPress={() => toggleDate(date)}>
                    <View style={styles.dateInfoLeft}>
                      <Ionicons name={isSelected ? "checkmark-circle" : "ellipse-outline"} size={24} color={isSelected ? theme.bg : theme.accent} />
                      <Text style={[styles.dateText, { color: isSelected ? theme.bg : theme.text }, customFont]}>{formatFriendlyDate(date)}</Text>
                    </View>
                    {count > 0 && (
                      <View style={[styles.badge, { backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : theme.accent + '15' }]}>
                        <Text style={[styles.badgeText, { color: isSelected ? theme.bg : theme.accent }]}>{count} votes</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.pollSection}>
               <Text style={[styles.sectionLabel, { color: theme.text, opacity: 0.6 }, customFont]}>Date & Time</Text>
               <Text style={[styles.dateText, { color: theme.text, opacity: 0.5 }, customFont]}>No specific dates suggested yet.</Text>
            </View>
          )}

          <View style={styles.noteSection}>
            <Text style={[styles.sectionLabel, { color: theme.text, opacity: 0.6 }, customFont]}>Any thoughts?</Text>
            <TextInput
              style={[styles.noteInput, { borderColor: theme.accent + '30', color: theme.text, backgroundColor: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }]}
              placeholder="Suggest something else..."
              placeholderTextColor={theme.text + '50'}
              multiline
              value={note}
              onChangeText={setNote}
            />
          </View>

          <TouchableOpacity style={[styles.mainBtn, { backgroundColor: theme.accent }]} onPress={handleInterest} disabled={submitting}>
            {submitting ? <ActivityIndicator color={theme.bg} /> : <Text style={[styles.mainBtnText, { color: theme.bg }, customFont]}>I'm Interested</Text>}
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  headerBar: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 5 },
  scrollContent: { paddingHorizontal: 25, paddingBottom: 40 },
  backBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  webBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 16, marginBottom: 20 },
  bannerTextContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bannerText: { fontSize: 13, fontWeight: '800' },
  coverContainer: { width: '100%', height: 220, borderRadius: 24, overflow: 'hidden', marginBottom: 25, position: 'relative' },
  coverImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  vibeBadge: { position: 'absolute', top: 15, right: 15, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 5 },
  vibeBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  headerSection: { marginBottom: 25 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  hostLabel: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { fontSize: 34, fontWeight: '900', marginBottom: 12 },
  desc: { fontSize: 18, lineHeight: 26, fontWeight: '500' },
  pollSection: { marginBottom: 25 },
  sectionLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 12, letterSpacing: 1 },
  dateCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'transparent', padding: 18, borderRadius: 20, marginBottom: 10, borderWidth: 1.5 },
  dateInfoLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dateText: { fontSize: 16, fontWeight: '700' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  noteSection: { marginBottom: 40 },
  noteInput: { borderRadius: 20, padding: 18, height: 100, fontSize: 16, borderWidth: 1, textAlignVertical: 'top' },
  mainBtn: { padding: 22, borderRadius: 18, alignItems: 'center' },
  mainBtnText: { fontSize: 19, fontWeight: '800' }
});