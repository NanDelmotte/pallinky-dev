/**
 * Path: apps/mobile/app/profile.tsx
 * Description: Current-user profile page.
 * Shows profile identity and lightweight activity summary,
 * with a secondary link into Settings.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  TextInput,
} from 'react-native';
import { StyledText } from '@pallinky/ui';
import { supabase, useSession } from '@pallinky/core';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

interface ProfileRow {
  id: string;
  email_lc: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string | null;
}

interface EventRow {
  id: string;
  slug: string;
  title: string | null;
  starts_at: string | null;
  host_email: string | null;
  host_name: string | null;
}

interface RsvpRow {
  event_id: string;
  status: string | null;
  responded_at: string | null;
}

type ActivityItem = {
  id: string;
  kind: 'hosted' | 'rsvped';
  title: string;
  slug: string;
  happenedAt: string | null;
  status?: string | null;
};

function normalizeEmail(value: string | null | undefined): string {
  return value?.toLowerCase().trim() || '';
}

function fallbackNameFromEmail(email: string): string {
  const local = email.split('@')[0] || 'You';
  return local.split(/[._-]+/)[0] || 'You';
}

function avatarFallback(name: string) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name
  )}&background=43691b&color=fff`;
}

function formatJoinedDate(value: string | null | undefined) {
  if (!value) return '';
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
  });
}

function formatActivityDate(value: string | null | undefined) {
  if (!value) return '';
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function ProfileScreen() {
  const { session } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [savingName, setSavingName] = useState(false);

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [hostedCount, setHostedCount] = useState(0);
  const [rsvpedCount, setRsvpedCount] = useState(0);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);

  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');

  const emailLower = normalizeEmail(session?.user?.email);

  const displayName = useMemo(() => {
    const fullName = profile?.full_name?.trim();
    if (fullName) return fullName;
    if (emailLower) return fallbackNameFromEmail(emailLower);
    return 'You';
  }, [profile?.full_name, emailLower]);

  const avatarUrl = profile?.avatar_url || avatarFallback(displayName);

  const joinedDate = useMemo(() => {
    const fromProfile = profile?.created_at || null;
    const fromAuth = (session?.user as any)?.created_at || null;
    return formatJoinedDate(fromProfile || fromAuth);
  }, [profile?.created_at, session?.user]);

  useEffect(() => {
    void loadProfile();
  }, [session?.user?.id, session?.user?.email]);

  useEffect(() => {
    if (profile?.full_name) {
      setDraftName(profile.full_name);
    } else if (emailLower) {
      setDraftName(fallbackNameFromEmail(emailLower));
    }
  }, [profile?.full_name, emailLower]);

  async function loadProfile() {
    if (!session?.user?.id || !emailLower) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const [{ data: profileRes, error: profileError }, hostedRes, myRsvpsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, email_lc, full_name, avatar_url, created_at')
          .eq('id', session.user.id)
          .maybeSingle(),

        supabase
          .from('events')
          .select('id, slug, title, starts_at, host_email, host_name')
          .eq('host_email', emailLower)
          .order('starts_at', { ascending: false, nullsFirst: false }),

        supabase
          .from('rsvps')
          .select('event_id, status, responded_at')
          .eq('email_lc', emailLower)
          .order('responded_at', { ascending: false, nullsFirst: false }),
      ]);

      if (profileError) throw profileError;
      if (hostedRes.error) throw hostedRes.error;
      if (myRsvpsRes.error) throw myRsvpsRes.error;

      const profileRow = (profileRes as ProfileRow | null) || null;
      const hostedEvents = (hostedRes.data as EventRow[]) || [];
      const myRsvps = (myRsvpsRes.data as RsvpRow[]) || [];

      setProfile(profileRow);
      setHostedCount(hostedEvents.length);

      const uniqueRsvpedEventIds = Array.from(
        new Set(myRsvps.map((row) => row.event_id).filter(Boolean))
      );
      setRsvpedCount(uniqueRsvpedEventIds.length);

      let rsvpedActivity: ActivityItem[] = [];

      if (uniqueRsvpedEventIds.length > 0) {
        const recentRsvps = myRsvps.slice(0, 10);
        const recentRsvpedIds = Array.from(
          new Set(recentRsvps.map((row) => row.event_id).filter(Boolean))
        );

        if (recentRsvpedIds.length > 0) {
          const { data: rsvpedEventsRes, error: rsvpedEventsError } = await supabase
            .from('events')
            .select('id, slug, title, starts_at, host_email, host_name')
            .in('id', recentRsvpedIds);

          if (rsvpedEventsError) throw rsvpedEventsError;

          const rsvpedEventMap = new Map<string, EventRow>();
          ((rsvpedEventsRes as EventRow[]) || []).forEach((event) => {
            rsvpedEventMap.set(event.id, event);
          });

          rsvpedActivity = recentRsvps
            .map((row) => {
              const event = rsvpedEventMap.get(row.event_id);
              if (!event) return null;

              return {
                id: `rsvped:${row.event_id}`,
                kind: 'rsvped' as const,
                title: event.title || 'Event',
                slug: event.slug,
                happenedAt: row.responded_at || event.starts_at,
                status: row.status,
              };
            })
            .filter(Boolean) as ActivityItem[];
        }
      }

      const hostedActivity: ActivityItem[] = hostedEvents.slice(0, 10).map((event) => ({
        id: `hosted:${event.id}`,
        kind: 'hosted',
        title: event.title || 'Event',
        slug: event.slug,
        happenedAt: event.starts_at,
      }));

      const merged = [...hostedActivity, ...rsvpedActivity]
        .sort((a, b) => {
          const aTime = a.happenedAt ? new Date(a.happenedAt).getTime() : 0;
          const bTime = b.happenedAt ? new Date(b.happenedAt).getTime() : 0;
          return bTime - aTime;
        })
        .slice(0, 4);

      setRecentActivity(merged);
    } catch (error) {
      console.error('Profile load failed', error);
      Alert.alert('Error', 'Could not load your profile.');
    } finally {
      setLoading(false);
    }
  }

  async function saveName() {
    if (!session?.user?.id || !emailLower) return;

    const clean = draftName.trim();
    if (!clean) {
      Alert.alert('Name required', 'Please enter a name.');
      return;
    }

    setSavingName(true);

    try {
      const { error } = await supabase.from('profiles').upsert({
        id: session.user.id,
        email_lc: emailLower,
        full_name: clean,
        avatar_url: profile?.avatar_url || null,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      setProfile((prev) => ({
        id: session.user.id,
        email_lc: emailLower,
        full_name: clean,
        avatar_url: prev?.avatar_url || null,
        created_at: prev?.created_at || null,
      }));

      setEditingName(false);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Could not update name.');
    } finally {
      setSavingName(false);
    }
  }

  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow photo library access.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
  mediaTypes: ImagePicker.MediaTypeOptions.Images,
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.7,
});

    if (result.canceled || !result.assets?.[0]?.uri) return;

    await uploadImage(result.assets[0].uri);
  }

  async function uploadImage(uri: string) {
    if (!session?.user?.id || !emailLower) return;

    setUploading(true);

    try {
      const fileName = `${emailLower.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.jpg`;
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(fileName);

      const { error: upsertError } = await supabase.from('profiles').upsert({
        id: session.user.id,
        email_lc: emailLower,
        full_name: profile?.full_name || null,
        avatar_url: publicUrl,
        updated_at: new Date().toISOString(),
      });

      if (upsertError) throw upsertError;

      setProfile((prev) => ({
        id: session.user.id,
        email_lc: emailLower,
        full_name: prev?.full_name || null,
        created_at: prev?.created_at || null,
        avatar_url: publicUrl,
      }));

      Alert.alert('Success', 'Photo updated.');
    } catch (error: any) {
      Alert.alert('Upload Error', error?.message || 'Could not update photo.');
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#43691b" size="large" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backArrow}>
          <Ionicons name="arrow-back" size={28} color="#43691b" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingsLink} onPress={() => router.push('/settings')}>
          <Ionicons name="settings-outline" size={18} color="#43691b" />
          <StyledText style={styles.settingsLinkText}>Settings</StyledText>
        </TouchableOpacity>
      </View>

      <StyledText style={styles.headerTitle}>Profile</StyledText>

      <View style={styles.heroCard}>
        <Image source={{ uri: avatarUrl }} style={styles.avatar} />

        <TouchableOpacity style={styles.avatarButton} onPress={pickImage} disabled={uploading}>
          <StyledText style={styles.avatarButtonText}>
            {uploading ? 'Updating...' : 'Change Photo'}
          </StyledText>
        </TouchableOpacity>

        {editingName ? (
          <View style={styles.nameEditor}>
            <TextInput
              value={draftName}
              onChangeText={setDraftName}
              style={styles.nameInput}
              placeholder="Your name"
              placeholderTextColor="#8b9487"
              autoCapitalize="words"
              autoCorrect={false}
            />

            <View style={styles.nameEditorActions}>
              <TouchableOpacity
                onPress={() => {
                  setDraftName(displayName);
                  setEditingName(false);
                }}
                style={styles.cancelNameBtn}
                disabled={savingName}
              >
                <StyledText style={styles.cancelNameText}>Cancel</StyledText>
              </TouchableOpacity>

              <TouchableOpacity onPress={saveName} style={styles.saveNameBtn} disabled={savingName}>
                <StyledText style={styles.saveNameText}>
                  {savingName ? 'Saving...' : 'Save'}
                </StyledText>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity onPress={() => setEditingName(true)}>
            <StyledText style={styles.name}>{displayName}</StyledText>
            <StyledText style={styles.editHint}>Tap name to edit</StyledText>
          </TouchableOpacity>
        )}

        {joinedDate ? <StyledText style={styles.joined}>Joined {joinedDate}</StyledText> : null}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <StyledText style={styles.statValue}>{hostedCount}</StyledText>
          <StyledText style={styles.statLabel}>Hosted</StyledText>
        </View>

        <View style={styles.statCard}>
          <StyledText style={styles.statValue}>{rsvpedCount}</StyledText>
          <StyledText style={styles.statLabel}>RSVP’d</StyledText>
        </View>
      </View>

      <View style={styles.section}>
        <StyledText style={styles.sectionTitle}>Recent Activity</StyledText>

        {recentActivity.length === 0 ? (
          <View style={styles.emptyCard}>
            <StyledText style={styles.emptyText}>No activity yet.</StyledText>
          </View>
        ) : (
          recentActivity.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.activityCard}
              onPress={() => router.push(`/event/${item.slug}/details`)}
            >
              <View style={styles.activityTopRow}>
                <StyledText style={styles.activityTitle}>{item.title}</StyledText>
           {item.kind === 'hosted' ? (
  <View style={[styles.badge, styles.hostedBadge]}>
    <StyledText style={[styles.badgeText, styles.hostedBadgeText]}>
      Hosted
    </StyledText>
  </View>
) : null}
              </View>

              {item.happenedAt ? (
                <StyledText style={styles.activityMeta}>
                  {formatActivityDate(item.happenedAt)}
                </StyledText>
              ) : null}

              {item.kind === 'rsvped' && item.status ? (
                <StyledText style={styles.activityMeta}>RSVP: {item.status}</StyledText>
              ) : null}
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#F6F7F9',
    padding: 24,
    paddingTop: 56,
    paddingBottom: 48,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F6F7F9',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backArrow: {
    width: 40,
  },
  settingsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#bac9ad',
  },
  settingsLinkText: {
    color: '#43691b',
    fontWeight: '800',
    fontSize: 13,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: '900',
    color: '#1f2a1b',
    marginTop: 12,
    marginBottom: 18,
  },
  heroCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9dfd3',
  },
  avatar: {
    width: 116,
    height: 116,
    borderRadius: 58,
    backgroundColor: '#eee',
  },
  avatarButton: {
    marginTop: 14,
    backgroundColor: '#43691b',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  avatarButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  name: {
    marginTop: 18,
    fontSize: 26,
    fontWeight: '900',
    color: '#1f2a1b',
    textAlign: 'center',
  },
  editHint: {
    marginTop: 6,
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  nameEditor: {
    marginTop: 18,
    alignItems: 'center',
    width: '100%',
  },
  nameInput: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 220,
    textAlign: 'center',
    color: '#1f2a1b',
  },
  nameEditorActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  cancelNameBtn: {
    backgroundColor: '#eef0ea',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  cancelNameText: {
    color: '#4f5a48',
    fontWeight: '800',
  },
  saveNameBtn: {
    backgroundColor: '#43691b',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  saveNameText: {
    color: '#fff',
    fontWeight: '800',
  },
  joined: {
    marginTop: 6,
    fontSize: 14,
    color: '#5f6b57',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9dfd3',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1f2a1b',
  },
  statLabel: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700',
    color: '#5f6b57',
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1f2a1b',
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9dfd3',
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 14,
  },
  activityCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9dfd3',
  },
  activityTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  activityTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: '#1f2a1b',
  },
  activityMeta: {
    marginTop: 6,
    fontSize: 12,
    color: '#6b7280',
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  hostedBadge: {
    backgroundColor: '#e6f0db',
  },
  rsvpedBadge: {
    backgroundColor: '#efe7ff',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  hostedBadgeText: {
    color: '#43691b',
  },
  rsvpedBadgeText: {
    color: '#6A4C93',
  },
});