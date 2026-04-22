/**
 * Path: apps/mobile/app/m/[token]/studio/index.tsx
 * Description: Design Studio for event theming. Separates cover photo, palette,
 * font, and thank-you GIF controls, uses derived dirty-state, and warns before
 * discarding unsaved changes.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '@pallinky/core';
import {
  StyledText,
  GiphyPicker,
  StudioPreview,
  ImageSearchModal,
} from '@pallinky/ui';

const PALETTES: Record<
  string,
  { bg: string; accent: string; text: string; isDark: boolean; label: string }
> = {
  zen: { bg: '#F6F7F9', accent: '#43691b', text: '#1f2a1b', isDark: false, label: 'Zen' },
  girly: { bg: '#f4bbd3', accent: '#fe5d9f', text: '#2b1f24', isDark: false, label: 'Girly' },
  fiesta: { bg: '#1729ae', accent: '#fe20e8', text: '#ffffff', isDark: true, label: 'Fiesta' },
  classy: { bg: '#03172f', accent: '#efd466', text: '#fff7b6', isDark: true, label: 'Classy' },
  spicy: { bg: '#656c12', accent: '#ecc216', text: '#ffffff', isDark: true, label: 'Spicy' },
};

const FONTS = [
  {
    id: 'Sans',
    family: Platform.OS === 'ios' ? 'Arial-BoldMT' : 'sans-serif',
    sample: 'Sunday Roast',
  },
  {
    id: 'Serif',
    family: Platform.OS === 'ios' ? 'Times New Roman' : 'serif',
    sample: 'Dinner at 8',
  },
  {
    id: 'Cursive',
    family: Platform.OS === 'ios' ? 'SnellRoundhand-Bold' : 'cursive',
    sample: 'Poetry Night',
  },
  {
    id: 'Gothic',
    family: Platform.OS === 'ios' ? 'Copperplate-Bold' : 'monospace',
    sample: 'Fiesta',
  },
];

type StudioState = {
  palette: string;
  font: string;
  coverImageUrl: string;
  thanksGifUrl: string;
};

export default function DesignStudioScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [showGiphy, setShowGiphy] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [event, setEvent] = useState<any>(null);

  const [studioState, setStudioState] = useState<StudioState>({
    palette: 'zen',
    font: 'Sans',
    coverImageUrl: '',
    thanksGifUrl: '',
  });

  const [initialStudioState, setInitialStudioState] = useState<StudioState>({
    palette: 'zen',
    font: 'Sans',
    coverImageUrl: '',
    thanksGifUrl: '',
  });

  useEffect(() => {
    async function getEventData() {
      try {
        if (!token) {
          setLoading(false);
          return;
        }

        const { data: ev, error } = await supabase.rpc('get_event_by_manage_token', {
          p_manage_token: token,
        });

        if (error) throw error;

        if (ev?.[0]) {
          const e = ev[0];
          setEvent(e);

          const nextState: StudioState = {
            palette: e.gif_key && PALETTES[e.gif_key] ? e.gif_key : 'zen',
            font: e.font_family || 'Sans',
            coverImageUrl: e.cover_image_url || '',
            thanksGifUrl: e.thanks_gif_url || '',
          };

          setStudioState(nextState);
          setInitialStudioState(nextState);
        }
      } catch {
        Alert.alert('Error', 'Could not load Design Studio.');
      } finally {
        setLoading(false);
      }
    }

    void getEventData();
  }, [token]);

  const hasChanges = useMemo(() => {
    return JSON.stringify(studioState) !== JSON.stringify(initialStudioState);
  }, [studioState, initialStudioState]);

  const theme = PALETTES[studioState.palette] || PALETTES.zen;
  const fontStyle = {
    fontFamily: FONTS.find((f) => f.id === studioState.font)?.family || 'System',
  };

  const updateStudioState = (patch: Partial<StudioState>) => {
    setStudioState((prev) => ({ ...prev, ...patch }));
  };

  const handleDismiss = () => {
    if (!hasChanges) {
      router.back();
      return;
    }

    Alert.alert(
      'Discard changes?',
      'You have unsaved studio changes.',
      [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => router.back() },
      ]
    );
  };

  const handleImageUpload = async () => {
    try {
      setUploadingCover(true);

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.7,
        base64: true,
      });

      if (result.canceled || !result.assets?.[0]?.base64) {
        setUploadingCover(false);
        return;
      }

      const fileName = `cover_${Date.now()}.jpg`;

      const { error } = await supabase.storage
        .from('covers')
        .upload(fileName, decode(result.assets[0].base64), {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (error) throw error;

      const {
        data: { publicUrl },
      } = supabase.storage.from('covers').getPublicUrl(fileName);

      updateStudioState({ coverImageUrl: publicUrl });
    } catch {
      Alert.alert('Upload failed', 'Could not upload the cover image.');
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSave = async () => {
    if (!event?.id) return;

    try {
      setSaving(true);

      const { error } = await supabase
        .from('events')
        .update({
          gif_key: studioState.palette,
          cover_image_url: studioState.coverImageUrl || null,
          font_family: studioState.font,
          thanks_gif_url: studioState.thanksGifUrl || null,
        })
        .eq('id', event.id);

      if (error) throw error;

      setInitialStudioState(studioState);
      router.back();
    } catch {
      Alert.alert('Error', 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  const resetChanges = () => {
    setStudioState(initialStudioState);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#43691b" />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.centered}>
        <StyledText>Event not found.</StyledText>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
          <StyledText style={{ color: '#43691b' }}>Close</StyledText>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <GiphyPicker
        visible={showGiphy}
        onClose={() => setShowGiphy(false)}
        onSelect={(url: string) => {
          updateStudioState({ thanksGifUrl: url });
          setShowGiphy(false);
        }}
      />

      <ImageSearchModal
        visible={showSearch}
        onClose={() => setShowSearch(false)}
        onSelect={(url: string) => {
          updateStudioState({ coverImageUrl: url });
          setShowSearch(false);
        }}
      />

      <View style={styles.headerNav}>
        <TouchableOpacity onPress={handleDismiss}>
          <Ionicons name="close" size={28} color="#1a1a1a" />
        </TouchableOpacity>

        <StyledText style={styles.headerTitle}>Studio</StyledText>

        <TouchableOpacity onPress={handleSave} disabled={!hasChanges || saving}>
          {saving ? (
            <ActivityIndicator size="small" />
          ) : (
            <StyledText style={[styles.saveAction, !hasChanges && styles.disabledText]}>
              Save
            </StyledText>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <StyledText style={styles.previewLabel}>Live Preview</StyledText>

        <StudioPreview
          theme={theme}
          fontStyle={fontStyle}
          event={event}
          coverImageUrl={studioState.coverImageUrl}
          thanksGifUrl={studioState.thanksGifUrl}
        />

        <View style={styles.controls}>
          <View style={styles.sectionHeader}>
            <StyledText style={styles.sectionTitle}>Cover Photo</StyledText>
            {hasChanges ? (
              <TouchableOpacity onPress={resetChanges}>
                <StyledText style={styles.linkText}>Revert</StyledText>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={handleImageUpload} disabled={uploadingCover}>
              {uploadingCover ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="cloud-upload" size={18} color="#fff" />
                  <StyledText style={styles.btnText}>Upload</StyledText>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={[styles.btn, styles.btnSec]} onPress={() => setShowSearch(true)}>
              <Ionicons name="search" size={18} color="#43691b" />
              <StyledText style={[styles.btnText, styles.btnSecText]}>Photos</StyledText>
            </TouchableOpacity>
          </View>

          {studioState.coverImageUrl ? (
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => updateStudioState({ coverImageUrl: '' })}
            >
              <Ionicons name="trash-outline" size={14} color="#e63946" />
              <StyledText style={styles.removeBtnText}>Remove Cover Photo</StyledText>
            </TouchableOpacity>
          ) : null}

          <StyledText style={styles.sectionTitle}>Theme</StyledText>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.paletteRow}>
            {Object.keys(PALETTES).map((key) => {
              const palette = PALETTES[key];
              const isSelected = studioState.palette === key;

              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => updateStudioState({ palette: key })}
                  style={[styles.paletteCard, isSelected && styles.paletteCardSelected]}
                >
                  <View style={[styles.dot, { backgroundColor: palette.bg, borderColor: palette.accent }]}>
                    <View style={[styles.innerDot, { backgroundColor: palette.accent }]} />
                  </View>
                  <StyledText style={styles.paletteLabel}>{palette.label}</StyledText>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <StyledText style={styles.sectionTitle}>Font</StyledText>

          {FONTS.map((font) => {
            const isSelected = studioState.font === font.id;

            return (
              <TouchableOpacity
                key={font.id}
                onPress={() => updateStudioState({ font: font.id })}
                style={[styles.fontCard, isSelected && styles.fontCardSelected]}
              >
                <StyledText style={[styles.fontSample, { fontFamily: font.family }]}>
                  {font.sample}
                </StyledText>
                <StyledText style={styles.fontLabel}>{font.id}</StyledText>
              </TouchableOpacity>
            );
          })}

          <StyledText style={styles.sectionTitle}>Thank-you GIF</StyledText>

          <View style={styles.row}>
            <TouchableOpacity style={styles.btn} onPress={() => setShowGiphy(true)}>
              <Ionicons name="happy" size={18} color="#fff" />
              <StyledText style={styles.btnText}>Pick GIF</StyledText>
            </TouchableOpacity>
          </View>

          {studioState.thanksGifUrl ? (
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={() => updateStudioState({ thanksGifUrl: '' })}
            >
              <Ionicons name="trash-outline" size={14} color="#e63946" />
              <StyledText style={styles.removeBtnText}>Remove Thank-you GIF</StyledText>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  headerNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  saveAction: {
    color: '#43691b',
    fontWeight: '800',
    fontSize: 16,
  },
  disabledText: {
    color: '#ccc',
  },

  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 18,
    marginBottom: 10,
  },

  controls: {
    paddingTop: 20,
    paddingBottom: 40,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1a1a1a',
    marginBottom: 12,
    marginTop: 18,
  },
  linkText: {
    color: '#43691b',
    fontWeight: '700',
  },

  row: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  btn: {
    backgroundColor: '#43691b',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minWidth: 120,
  },
  btnSec: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d8e7cc',
  },
  btnText: {
    color: '#fff',
    fontWeight: '800',
  },
  btnSecText: {
    color: '#43691b',
  },

  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  removeBtnText: {
    color: '#e63946',
    fontWeight: '700',
  },

  paletteRow: {
    paddingRight: 12,
  },
  paletteCard: {
    alignItems: 'center',
    marginRight: 14,
    paddingBottom: 4,
  },
  paletteCardSelected: {
    opacity: 1,
  },
  paletteLabel: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  dot: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },

  fontCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  fontCardSelected: {
    borderColor: '#43691b',
    backgroundColor: '#f9fbf7',
  },
  fontSample: {
    fontSize: 22,
    color: '#1a1a1a',
    marginBottom: 4,
  },
  fontLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
});