/** * Path: app/event/[slug]/thanks.tsx 
 * Description: Success page with scale-in animation. Added App Store bridge for Web users.
 */

import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Image, ActivityIndicator, Platform, Animated, StatusBar, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@tarti-flette/core';
import { CalendarButton } from '@tarti-flette/ui';
import { MaterialCommunityIcons } from '@expo/vector-icons';

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

// TODO: Replace with your actual store URLs
const STORE_URL = Platform.OS === 'ios' 
  ? 'https://apps.apple.com/app/idYOUR_APP_ID' 
  : 'https://play.google.com/store/apps/details?id=com.your.package';

export default function ThanksPage() {
  const { slug, status } = useLocalSearchParams<{ slug: string; status: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<any>(null);
  
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    async function loadEvent() {
      const { data } = await supabase.from('events').select('*').eq('slug', slug).single();
      if (data) setEvent(data);
      setLoading(false);
      
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }).start();
    }
    loadEvent();
  }, [slug]);

  if (loading || !event) return <ActivityIndicator style={{flex:1}} color="#0077b6" />;

  const isHatchery = status === 'interested' || event.event_type === 'vibe';
  const theme = isHatchery ? PALETTES.submerged : (PALETTES[event.gif_key] || PALETTES.zen);
  const customFont = { fontFamily: FONT_MAP[event.font_family] || (Platform.OS === 'ios' ? 'Arial-BoldMT' : 'sans-serif') };

  const vibeGif = 'https://media1.giphy.com/media/v1.Y2lkPTJkNzUyNDZlOG03eHk5bnh1NWJ4YjJxZXZwZjFjMTU3c3ZncHkxOWU2aGNhbndqaiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/30lffTNIXXB4AE4gzy/200.gif';
  const formalGif = event.thanks_gif_url || 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHJueGZ3bm5qZzR4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/3o7abKhOpu0NwenH3O/giphy.gif';
  const finalGif = isHatchery ? vibeGif : formalGif;

  const getStatusMessage = () => {
    if (status === 'yes') return "You're on the list!";
    if (status === 'maybe') return "We've marked you as a maybe.";
    if (status === 'interested') return "You're Hooked!";
    if (status === 'no') return "Sorry you can't make it!";
    return "Response recorded!";
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.isDark ? "light-content" : "dark-content"} />
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          
          <Animated.View style={[styles.gifContainer, { borderColor: theme.accent, transform: [{ scale: scaleAnim }] }]}>
            <Image source={{ uri: finalGif }} style={styles.gif} />
          </Animated.View>
          
          <Text style={[styles.title, { color: theme.text }, customFont]}>{getStatusMessage()}</Text>
          <Text style={[styles.subtitle, { color: theme.text, opacity: 0.7 }, customFont]}>{event.host_name} has been notified.</Text>

          {/* APP DOWNLOAD PROMPT (Web Only) */}
          {Platform.OS === 'web' && (
            <TouchableOpacity 
              style={[styles.appPrompt, { backgroundColor: theme.accent }]} 
              onPress={() => Linking.openURL(STORE_URL)}
            >
              <MaterialCommunityIcons name="cellphone-arrow-down" size={24} color={theme.bg} />
              <View>
                <Text style={[styles.appPromptTitle, { color: theme.bg }]}>Get the Pallinky App</Text>
                <Text style={[styles.appPromptSub, { color: theme.bg, opacity: 0.9 }]}>Never miss a group update.</Text>
              </View>
            </TouchableOpacity>
          )}

          {event.event_type !== 'vibe' && status !== 'interested' && event.starts_at && (
            <View style={[styles.card, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.02)' }]}>
               <Text style={[styles.cardTitle, { color: theme.text }, customFont]}>Don't forget!</Text>
               <CalendarButton event={event} theme={theme} />
            </View>
          )}

          <View style={styles.buttonStack}>
            <TouchableOpacity style={[styles.backBtn, { borderColor: theme.accent }]} onPress={() => router.replace(status === 'interested' ? `/event/${slug}/fishingRSVP` : `/event/${slug}`)}>
              <Text style={[styles.backBtnText, { color: theme.accent }]}>Back to Details</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={styles.homeBtn}>
              <Text style={[styles.homeLink, { color: theme.text, opacity: 0.6 }]}>Go to Home</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContainer: { flexGrow: 1, justifyContent: 'center' },
  content: { padding: 40, alignItems: 'center', paddingBottom: 60 },
  gifContainer: { width: 220, height: 220, borderRadius: 110, borderWidth: 6, overflow: 'hidden', marginBottom: 30, backgroundColor: 'rgba(0,0,0,0.05)' },
  gif: { width: '100%', height: '100%' },
  title: { fontSize: 32, fontWeight: '900', textAlign: 'center', marginBottom: 12, letterSpacing: -0.5 },
  subtitle: { fontSize: 18, textAlign: 'center', marginBottom: 30, fontWeight: '500' },
  appPrompt: { flexDirection: 'row', alignItems: 'center', gap: 15, padding: 20, borderRadius: 24, marginBottom: 30, width: '100%', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8 },
  appPromptTitle: { fontSize: 18, fontWeight: '800' },
  appPromptSub: { fontSize: 13, fontWeight: '600' },
  card: { width: '100%', padding: 25, borderRadius: 28, alignItems: 'center', marginBottom: 30 },
  cardTitle: { fontSize: 14, fontWeight: '800', marginBottom: 15, textTransform: 'uppercase', letterSpacing: 1 },
  buttonStack: { width: '100%', alignItems: 'center' },
  backBtn: { width: '100%', paddingVertical: 18, borderRadius: 20, borderWidth: 2, alignItems: 'center' },
  backBtnText: { fontSize: 16, fontWeight: '800' },
  homeBtn: { marginTop: 25, padding: 10 },
  homeLink: { fontSize: 15, fontWeight: '700', textDecorationLine: 'underline' }
});