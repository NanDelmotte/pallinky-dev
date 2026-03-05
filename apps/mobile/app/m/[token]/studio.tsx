/** * Path: app/m/[token]/studio.tsx 
 * Description: Main Design Studio controller. 
 * Updated: Added a safety check to prevent infinite loading if token is missing. */
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, SafeAreaView, Platform, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@pallinky/core'; 
import { StyledText } from '@pallinky/ui';
import { GiphyPicker } from '@pallinky/ui';
import { StudioPreview } from '@pallinky/ui';
import {ImageSearchModal} from '@pallinky/ui';
import { Ionicons } from '@expo/vector-icons';
import { decode } from 'base64-arraybuffer';

const PALETTES: Record<string, { bg: string; accent: string; text: string; isDark: boolean }> = {
  "zen": { bg: "#f8e9dc", accent: "#43691b", text: "#1f2a1b", isDark: false },
  "girly": { bg: "#f4bbd3", accent: "#fe5d9f", text: "#2b1f24", isDark: false },
  "fiesta": { bg: "#1729ae", accent: "#fe20e8", text: "#ffffff", isDark: true },
  "classy": { bg: "#03172f", accent: "#efd466", text: "#fff7b6", isDark: true },
  "spicy": { bg: "#656c12", accent: "#ecc216", text: "#ffffff", isDark: true },
};

const FONTS = [
  { id: 'Sans', family: Platform.OS === 'ios' ? 'Arial-BoldMT' : 'sans-serif' },
  { id: 'Serif', family: Platform.OS === 'ios' ? 'Times New Roman' : 'serif' },
  { id: 'Cursive', family: Platform.OS === 'ios' ? 'SnellRoundhand-Bold' : 'cursive' },
  { id: 'Gothic', family: Platform.OS === 'ios' ? 'Copperplate-Bold' : 'monospace' }
];

export default function DesignStudioScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showGiphy, setShowGiphy] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [event, setEvent] = useState<any>(null);

  const [selectedPalette, setSelectedPalette] = useState("zen");
  const [selectedFont, setSelectedFont] = useState("Sans");
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [thanksGifUrl, setThanksGifUrl] = useState('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHJueHBybmZ4bmZ4bmZ4bmZ4bmZ4bmZ4bmZ4bmZ4bmZ4bmZ4JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/3o7abKhOpu0NwenH3O/giphy.gif');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    async function getEventData() {
      if (!token) {
        setLoading(false);
        return;
      }
      const { data: ev } = await supabase.rpc('get_event_by_manage_token', { p_manage_token: token });
      if (ev?.[0]) {
        const e = ev[0];
        setEvent(e);
        if (e.gif_key && PALETTES[e.gif_key]) setSelectedPalette(e.gif_key);
        setCoverImageUrl(e.cover_image_url || '');
        setSelectedFont(e.font_family || "Sans");
        if (e.thanks_gif_url) setThanksGifUrl(e.thanks_gif_url);
      }
      setLoading(false);
    }
    getEventData();
  }, [token]);

  const handleImageUpload = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [16, 9], quality: 0.7, base64: true });
    if (!result.canceled && result.assets[0].base64) {
      const fileName = `cover_${Date.now()}.jpg`;
      const { error } = await supabase.storage.from('covers').upload(fileName, decode(result.assets[0].base64), { contentType: 'image/jpeg' });
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('covers').getPublicUrl(fileName);
        setCoverImageUrl(publicUrl);
        setHasChanges(true);
      }
    }
  };

  const handleSave = async () => {
    if (!event?.id) return;
    setSaving(true);
    const { error } = await supabase.from('events').update({ 
      gif_key: selectedPalette, 
      cover_image_url: coverImageUrl,
      font_family: selectedFont,
      thanks_gif_url: thanksGifUrl
    }).eq('id', event.id);
    
    setSaving(false);
    if (!error) {
        router.back();
    } else {
        Alert.alert("Error", "Could not save changes.");
    }
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#43691b" /></View>;

  if (!event) return (
    <View style={styles.centered}>
      <StyledText>Event not found.</StyledText>
      <TouchableOpacity onPress={() => router.back()} style={{marginTop: 20}}>
        <StyledText style={{color: '#43691b'}}>Go Back</StyledText>
      </TouchableOpacity>
    </View>
  );

  const theme = PALETTES[selectedPalette] || PALETTES["zen"];
  const fontStyle = { fontFamily: FONTS.find(f => f.id === selectedFont)?.family || 'System' };

  return (
    <SafeAreaView style={styles.safeArea}>
      <GiphyPicker 
        visible={showGiphy} 
        onClose={() => setShowGiphy(false)} 
        onSelect={(url: string) => { setThanksGifUrl(url); setShowGiphy(false); setHasChanges(true); }} 
      />

      <ImageSearchModal 
        visible={showSearch}
        onClose={() => setShowSearch(false)}
        onSelect={(url: string) => { setCoverImageUrl(url); setHasChanges(true); }}
      />

      <View style={styles.headerNav}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="close" size={28} color="#1a1a1a" /></TouchableOpacity>
        <StyledText style={styles.headerTitle}>Studio</StyledText>
        <TouchableOpacity onPress={handleSave} disabled={!hasChanges || saving}>
          {saving ? <ActivityIndicator size="small" /> : <StyledText style={[styles.saveAction, !hasChanges && { color: '#ccc' }]}>Save</StyledText>}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container}>
        <StudioPreview 
          theme={theme} 
          fontStyle={fontStyle} 
          event={event} 
          coverImageUrl={coverImageUrl} 
          thanksGifUrl={thanksGifUrl} 
        />

        <View style={styles.controls}>
          <StyledText style={styles.label}>Media</StyledText>
          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={handleImageUpload}>
              <Ionicons name="cloud-upload" size={18} color="#fff" />
              <StyledText style={styles.btnText}>Upload</StyledText>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.btn, styles.btnSec]} onPress={() => setShowSearch(true)}>
              <Ionicons name="search" size={18} color="#43691b" />
              <StyledText style={[styles.btnText, {color: '#43691b'}]}>Photos</StyledText>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.btn, styles.btnSec]} onPress={() => setShowGiphy(true)}>
              <Ionicons name="happy" size={18} color="#43691b" />
              <StyledText style={[styles.btnText, {color: '#43691b'}]}>GIF</StyledText>
            </TouchableOpacity>
          </View>

          {coverImageUrl ? (
            <TouchableOpacity 
              style={styles.removeBtn} 
              onPress={() => { setCoverImageUrl(''); setHasChanges(true); }}
            >
              <Ionicons name="trash-outline" size={14} color="#e63946" />
              <StyledText style={styles.removeBtnText}>Remove Cover Photo</StyledText>
            </TouchableOpacity>
          ) : null}

          <StyledText style={styles.label}>Palette</StyledText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {Object.keys(PALETTES).map(k => (
              <TouchableOpacity key={k} onPress={() => { setSelectedPalette(k); setHasChanges(true); }} style={[styles.dot, { backgroundColor: PALETTES[k].bg, borderColor: selectedPalette === k ? PALETTES[k].accent : '#eee' }]}>
                <View style={[styles.innerDot, { backgroundColor: PALETTES[k].accent }]} />
              </TouchableOpacity>
            ))}
          </ScrollView>

          <StyledText style={styles.label}>Font</StyledText>
          <View style={styles.row}>
            {FONTS.map(f => (
              <TouchableOpacity key={f.id} onPress={() => { setSelectedFont(f.id); setHasChanges(true); }} style={[styles.fontTab, selectedFont === f.id && { borderColor: '#43691b' }]}>
                <StyledText style={{ fontFamily: f.family, fontSize: 18 }}>Aa</StyledText>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerNav: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '900' },
  saveAction: { color: '#43691b', fontWeight: '900' },
  container: { flex: 1 },
  controls: { padding: 20 },
  label: { fontSize: 10, fontWeight: '900', color: '#999', marginTop: 15, marginBottom: 10, textTransform: 'uppercase' },
  row: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  btn: { flex: 1, backgroundColor: '#43691b', height: 48, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  btnSec: { backgroundColor: '#f0f4ec', borderWidth: 1, borderColor: '#43691b' },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  removeBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5, padding: 5 },
  removeBtnText: { color: '#e63946', fontSize: 12, fontWeight: '700' },
  dot: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, marginRight: 15, justifyContent: 'center', alignItems: 'center' },
  innerDot: { width: 10, height: 10, borderRadius: 5 },
  fontTab: { flex: 1, height: 45, borderRadius: 12, backgroundColor: '#f9f9f9', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#eee' }
});