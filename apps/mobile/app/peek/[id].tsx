/** * Path: src/app/peek/[id].tsx 
 * Description: Blue Peek Page. Updated "Friend of a friend" fallback to use the host's actual name.
 * Added dynamic host name mapping to the guest list social context labels. */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Switch, Platform, StatusBar, Share, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyledText } from '@tarti-flette/ui';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@tarti-flette/core';
import * as SecureStore from 'expo-secure-store';

export default function PeekPage() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [event, setEvent] = useState<any>(null);
  const [attendees, setAttendees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  const [isPastEvent, setIsPastEvent] = useState(false);
  const [hasWaved, setHasWaved] = useState(false);
  const [keepInLoop, setKeepInLoop] = useState(false);

  useEffect(() => {
    if (id) initPeek();
  }, [id]);

  const capitalize = (str: string) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  async function initPeek() {
    const email = await SecureStore.getItemAsync('pallinky_user_email');
    const cleanEmail = email?.toLowerCase().trim() || '';
    setUserEmail(cleanEmail);

    try {
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .single();

      if (eventError || !eventData) return;
      setEvent(eventData);
      setIsPastEvent(eventData.starts_at ? new Date(eventData.starts_at) < new Date() : false);

      await fetchGuestList(eventData.slug, cleanEmail);

      if (cleanEmail) {
        const { data: rsvp } = await supabase.from('rsvps').select('status').eq('event_id', id).eq('email_lc', cleanEmail).maybeSingle();
        if (rsvp) setHasWaved(true);

        const { data: intent } = await supabase.from('social_intent').select('keep_in_loop').eq('event_id', id).eq('user_email', cleanEmail).maybeSingle();
        if (intent) setKeepInLoop(intent.keep_in_loop);
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }

  async function fetchGuestList(slug: string, viewerEmail: string) {
    const { data, error } = await supabase.rpc('get_guest_list', { p_slug: slug, p_viewer_email: viewerEmail || null });
    if (!error) setAttendees(data || []);
  }

  const handleWave = async () => {
    let emailToUse = userEmail;
    if (!emailToUse) {
      const email = await new Promise<string | null>((resolve) => {
        Alert.prompt("Who are you?", "Enter email to wave:", [
          { text: "Cancel", onPress: () => resolve(null), style: "cancel" },
          { text: "OK", onPress: (val?: string) => resolve(val?.includes('@') ? val.toLowerCase().trim() : null) }
        ]);
      });
      if (!email) return;
      emailToUse = email;
      await SecureStore.setItemAsync('pallinky_user_email', emailToUse);
      setUserEmail(emailToUse);
    }

    const now = new Date().toISOString();
    const { error } = await supabase.from('rsvps').upsert({
      event_id: id, email: emailToUse, name: emailToUse.split('@')[0], status: 'interested', responded_at: now, updated_at: now
    }, { onConflict: 'event_id,email' });

    if (!error) {
      setHasWaved(true);
      Alert.alert("Wave Sent!");
      if (event?.slug) fetchGuestList(event.slug, emailToUse);
    }
  };

  const handleToggleLoop = async (value: boolean) => {
    if (!userEmail && value) {
        Alert.alert("Identity required", "Please wave or enter your email first!");
        setKeepInLoop(false);
        return;
    }
    setKeepInLoop(value);
    await supabase.from('social_intent').upsert({ event_id: id, user_email: userEmail, keep_in_loop: value }, { onConflict: 'event_id,user_email' });
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator color="#1e3a8a" /></View>;

  const hostName = capitalize(event?.host_name || 'the host');

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.blueHeader}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}><Ionicons name="close-circle" size={32} color="#fff" /></TouchableOpacity>
        <StyledText style={styles.peekLabel}>{isPastEvent ? 'LOOKING BACK AT' : 'PEEKING AT'}</StyledText>
        <StyledText style={styles.title}>{event?.title}</StyledText>
        <StyledText style={styles.host}>Hosted by {hostName}</StyledText>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.actionCard}>
          <View style={styles.buttonRow}>
            <TouchableOpacity style={[styles.waveBtn, hasWaved && styles.waveBtnDisabled]} onPress={handleWave} disabled={hasWaved}>
              <Ionicons name={hasWaved ? "checkmark-circle" : "hand-right-outline"} size={20} color="#fff" />
              <StyledText style={styles.waveBtnText}>{hasWaved ? "Wave Sent!" : "Wave"}</StyledText>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareBtn} onPress={() => Share.share({ message: `Peek at ${event?.title}: https://pallinky.com/peek/${id}` })}>
              <Ionicons name="share-outline" size={20} color="#1e3a8a" />
              <StyledText style={styles.shareBtnText}>Share</StyledText>
            </TouchableOpacity>
          </View>
          <View style={styles.divider} />
          <View style={styles.loopToggle}>
            <View style={{ flex: 1 }}>
              <StyledText style={styles.loopLabel}>Join {hostName}'s circle</StyledText>
              <StyledText style={styles.loopSub}>Keep me in the loop for future events.</StyledText>
            </View>
            <Switch value={keepInLoop} onValueChange={handleToggleLoop} trackColor={{ false: "#d1d1d1", true: "#1e3a8a" }} />
          </View>
        </View>

        <StyledText style={styles.sectionLabel}>The Guest List ({attendees.length})</StyledText>
        {attendees.map((person, index) => {
            const isHostItem = person.name?.toLowerCase() === event?.host_name?.toLowerCase();
            return (
                <View key={index} style={[styles.personRow, isHostItem && styles.hostRow]}>
                    <View style={[styles.avatarMini, isHostItem && styles.hostAvatar]}>
                        <StyledText style={[styles.avatarChar, isHostItem && styles.hostAvatarChar]}>{person.name?.[0] || '?'}</StyledText>
                    </View>
                    <View style={styles.personInfo}>
                        <StyledText style={styles.personName}>{person.name}</StyledText>
                        
                        {/* IMPROVED CONTEXT CLUES */}
                        {isHostItem ? (
                            <StyledText style={styles.hostBadge}>Hosting this event</StyledText>
                        ) : person.common_event ? (
                            <View style={styles.contextBadge}>
                                <Ionicons name="sparkles" size={12} color="#1e3a8a" />
                                <StyledText style={styles.contextText}>Both went to {person.common_event}</StyledText>
                            </View>
                        ) : person.mutual_friend_count > 0 ? (
                            <View style={[styles.contextBadge, { backgroundColor: '#f0fdf4' }]}>
                                <Ionicons name="people" size={12} color="#15803d" />
                                <StyledText style={[styles.contextText, { color: '#15803d' }]}>{person.mutual_friend_count} mutual friends</StyledText>
                            </View>
                        ) : (
                            <StyledText style={styles.friendOfFriend}>Friend of {hostName}</StyledText>
                        )}
                        
                        <StyledText style={styles.statusTag}>{person.status}</StyledText>
                    </View>
                </View>
            );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  blueHeader: { backgroundColor: '#1e3a8a', padding: 25, paddingTop: 60, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  closeBtn: { alignSelf: 'flex-end', marginBottom: 10 },
  peekLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  title: { fontSize: 26, fontWeight: '900', color: '#fff' },
  host: { fontSize: 16, color: '#93c5fd', fontWeight: '600' },
  scrollContent: { padding: 20 },
  actionCard: { backgroundColor: '#fff', borderRadius: 24, padding: 20, marginBottom: 30 },
  buttonRow: { flexDirection: 'row', gap: 10 },
  waveBtn: { flex: 2, backgroundColor: '#1e3a8a', padding: 16, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  waveBtnDisabled: { backgroundColor: '#10b981' },
  waveBtnText: { color: '#fff', fontWeight: 'bold' },
  shareBtn: { flex: 1, backgroundColor: '#dbeafe', padding: 16, borderRadius: 16, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8 },
  shareBtnText: { color: '#1e3a8a', fontWeight: 'bold' },
  divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 20 },
  loopToggle: { flexDirection: 'row', alignItems: 'center' },
  loopLabel: { fontSize: 15, fontWeight: '700' },
  loopSub: { fontSize: 12, color: '#666' },
  sectionLabel: { fontSize: 12, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: 10 },
  personRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 14, borderRadius: 18, marginBottom: 10 },
  hostRow: { borderColor: '#1e3a8a', borderWidth: 1 },
  avatarMini: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#dbeafe', justifyContent: 'center', alignItems: 'center' },
  hostAvatar: { backgroundColor: '#1e3a8a' },
  avatarChar: { fontWeight: 'bold', color: '#1e3a8a' },
  hostAvatarChar: { color: '#fff' },
  personInfo: { flex: 1, marginLeft: 15 },
  personName: { fontSize: 16, fontWeight: '700' },
  statusTag: { fontSize: 10, color: '#94a3b8', fontWeight: '900', textTransform: 'uppercase', marginTop: 2 },
  contextBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#eff6ff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginVertical: 4, alignSelf: 'flex-start' },
  contextText: { fontSize: 11, color: '#1e3a8a', fontWeight: '700' },
  friendOfFriend: { fontSize: 11, color: '#64748b', fontStyle: 'italic', marginVertical: 4 },
  hostBadge: { fontSize: 11, color: '#1e3a8a', fontWeight: 'bold', marginVertical: 4 }
});