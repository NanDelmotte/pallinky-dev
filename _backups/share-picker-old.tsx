/**
 * Path: apps/mobile/app/circles/share-picker.tsx
 * Description: Unified invite picker for Pallinky users + uploaded contacts.
 * Host selects people, confirms once, then shares once for non-users.
 */

import React, { useEffect, useMemo, useState } from 'react';
import * as Contacts from 'expo-contacts';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  Share,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StyledText } from '@pallinky/ui';
import { supabase } from '@pallinky/core';

interface DeviceContactRow {
  id?: string | null;
  device_contact_id?: string | null;
  display_name?: string | null;
  name?: string | null;
  email_lc?: string | null;
  phone_e164?: string | null;
  matched_user_id?: string | null;
  matched_profile_id?: string | null;
  is_user?: boolean | null;
  avatar_url?: string | null;
}

interface PredictedFriend {
  name: string | null;
  email_lc: string | null;
  total_hangouts: number | null;
  avatar_url: string | null;
}

interface CircleRow {
  id: string;
  circle_name: string;
}

interface CircleMemberRow {
  id: string;
  circle_id: string;
  member_name: string | null;
  member_email_lc: string | null;
}

interface Circle {
  id: string;
  circle_name: string;
  member_emails: string[];
}

type PersonSource = 'pallinky' | 'contact';

interface UnifiedPerson {
  key: string;
  selection_id: string;
  email_lc: string | null;
  name: string;
  avatar_url: string | null;
  source: PersonSource;
  total_hangouts: number;
  device_contact_id: string | null;
  phone_e164: string | null;
}

const COLORS = {
  background: '#F6F7F9',
  surface: '#FFFFFF',
  text: '#1f2a1b',
  textMuted: '#66715f',
  primary: '#43691b',
  border: '#bac9ad',
  borderSoft: '#e7ede2',
  secondary: '#6A4C93',
  secondaryBg: '#efe9f7',
  overlay: 'rgba(31, 42, 27, 0.35)',
};

function normalizeEmail(value: string | null | undefined) {
  return value?.toLowerCase().trim() || '';
}

function normalizePhone(value: string | null | undefined) {
  if (!value) return '';
  return value.trim().replace(/[\s\-()]/g, '');
}

function firstName(value: string | null | undefined) {
  return value?.trim().split(/\s+/)[0] || '';
}

function emailToFallbackName(email: string) {
  const first = email.split('@')[0].split(/[._-]+/)[0]?.trim();
  return first || 'Friend';
}

function phoneToFallbackName(phone: string) {
  const digits = phone.replace(/[^\d+]/g, '');
  const tail = digits.slice(-4);
  return tail ? `Contact ${tail}` : 'Contact';
}

function avatarFor(name: string | null | undefined, avatarUrl: string | null | undefined) {
  if (avatarUrl) return avatarUrl;

  const safeName = name?.trim() || 'Friend';
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    safeName
  )}&background=6A4C93&color=fff`;
}

function getSelectionId(input: {
  device_contact_id?: string | null;
  phone_e164?: string | null;
  email_lc?: string | null;
}) {
  const deviceContactId = input.device_contact_id?.trim();
  if (deviceContactId) return `device:${deviceContactId}`;

  const phone = normalizePhone(input.phone_e164);
  if (phone) return `phone:${phone}`;

  const email = normalizeEmail(input.email_lc);
  if (email) return `email:${email}`;

  return '';
}

export default function CircleSharePickerScreen() {
  const { slug, circleId } = useLocalSearchParams<{ slug: string; circleId?: string }>();

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploadingContacts, setUploadingContacts] = useState(false);
  const [contactPermissionStatus, setContactPermissionStatus] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [eventTitle, setEventTitle] = useState('this event');

  const [circles, setCircles] = useState<Circle[]>([]);
  const [people, setPeople] = useState<UnifiedPerson[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [didPreloadCircle, setDidPreloadCircle] = useState(false);

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [circleOverlayVisible, setCircleOverlayVisible] = useState(false);
  const [activeCircle, setActiveCircle] = useState<Circle | null>(null);

  async function loadContactPermissionStatus() {
    try {
      const { status } = await Contacts.getPermissionsAsync();
      setContactPermissionStatus(String(status));
    } catch {
      setContactPermissionStatus(null);
    }
  }

  async function fetchData() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const userId = session?.user?.id;
      const userEmail = normalizeEmail(session?.user?.email);

      if (!userId || !userEmail) {
        Alert.alert('Login Required', 'Please sign in before inviting people.');
        router.back();
        return;
      }

      const [eventRes, circleRes, predictedRes, deviceContactsRes] = await Promise.all([
        supabase.from('events').select('id, title').eq('slug', slug).single(),
        supabase
          .from('social_circles')
          .select('id, circle_name')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        supabase
          .from('predicted_circles')
          .select('name, email_lc, total_hangouts, avatar_url')
          .neq('email_lc', userEmail)
          .order('total_hangouts', { ascending: false }),
        supabase.rpc('get_my_device_contacts'),
      ]);

      if (eventRes.error) throw eventRes.error;
      if (circleRes.error) throw circleRes.error;
      if (predictedRes.error) throw predictedRes.error;
      if (deviceContactsRes.error) throw deviceContactsRes.error;

      setEventTitle(eventRes.data?.title || 'this event');

      const circleRows = (circleRes.data as CircleRow[]) || [];
      const circleIds = circleRows.map((circle) => circle.id);

      let circleMemberRows: CircleMemberRow[] = [];
      if (circleIds.length > 0) {
        const { data: membersRes, error: membersError } = await supabase
          .from('social_circle_members')
          .select('id, circle_id, member_name, member_email_lc')
          .in('circle_id', circleIds);

        if (membersError) throw membersError;
        circleMemberRows = (membersRes as CircleMemberRow[]) || [];
      }

      const membersByCircleId = new Map<string, string[]>();
      circleRows.forEach((circle) => membersByCircleId.set(circle.id, []));

      circleMemberRows.forEach((row) => {
        const email = normalizeEmail(row.member_email_lc);
        if (!email) return;

        const current = membersByCircleId.get(row.circle_id) || [];
        if (!current.includes(email)) {
          current.push(email);
          membersByCircleId.set(row.circle_id, current);
        }
      });

      const safeCircles: Circle[] = circleRows.map((circle) => ({
        id: circle.id,
        circle_name: circle.circle_name,
        member_emails: membersByCircleId.get(circle.id) || [],
      }));

      const predictedFriends = ((predictedRes.data as PredictedFriend[]) || []).filter((friend) => {
        const cleanEmail = normalizeEmail(friend.email_lc);
        return cleanEmail !== '' && cleanEmail !== userEmail;
      });

      const deviceContacts = ((deviceContactsRes.data as DeviceContactRow[]) || []).filter(
        (contact) => {
          const cleanEmail = normalizeEmail(contact.email_lc);
          const cleanPhone = normalizePhone(contact.phone_e164);
          const isSelf = cleanEmail !== '' && cleanEmail === userEmail;
          return !isSelf && Boolean(cleanEmail || cleanPhone);
        }
      );

      const personMap = new Map<string, UnifiedPerson>();

      predictedFriends.forEach((friend) => {
        const email = normalizeEmail(friend.email_lc);
        if (!email) return;

        const selectionId = getSelectionId({ email_lc: email });

        personMap.set(`email:${email}`, {
          key: `email:${email}`,
          selection_id: selectionId,
          email_lc: email,
          name: friend.name?.trim() || emailToFallbackName(email),
          avatar_url: friend.avatar_url || null,
          source: 'pallinky',
          total_hangouts: friend.total_hangouts || 0,
          device_contact_id: null,
          phone_e164: null,
        });
      });

      deviceContacts.forEach((contact) => {
        const email = normalizeEmail(contact.email_lc) || null;
        const phone = normalizePhone(contact.phone_e164) || null;
        if (!email && !phone) return;

        const looksLikeUser = Boolean(
          contact.is_user || contact.matched_user_id || contact.matched_profile_id
        );

        const existing = email ? personMap.get(`email:${email}`) : null;

        if (existing) {
          const mergedDeviceContactId = contact.device_contact_id || existing.device_contact_id;
          const mergedPhone = phone || existing.phone_e164;
          const mergedEmail = existing.email_lc || email;
          const mergedSelectionId = getSelectionId({
            device_contact_id: mergedDeviceContactId,
            phone_e164: mergedPhone,
            email_lc: mergedEmail,
          });

          personMap.set(`email:${mergedEmail}`, {
            ...existing,
            key: `email:${mergedEmail}`,
            selection_id: mergedSelectionId,
            email_lc: mergedEmail,
            name:
              contact.display_name?.trim() ||
              contact.name?.trim() ||
              existing.name ||
              (mergedEmail
                ? emailToFallbackName(mergedEmail)
                : phoneToFallbackName(mergedPhone || '')),
            avatar_url: existing.avatar_url || contact.avatar_url || null,
            source: existing.source === 'pallinky' || looksLikeUser ? 'pallinky' : 'contact',
            total_hangouts: existing.total_hangouts,
            device_contact_id: mergedDeviceContactId,
            phone_e164: mergedPhone,
          });
          return;
        }

        const selectionId = getSelectionId({
          device_contact_id: contact.device_contact_id,
          phone_e164: phone,
          email_lc: email,
        });

        const key = email
          ? `email:${email}`
          : contact.device_contact_id
          ? `device:${contact.device_contact_id}`
          : phone
          ? `phone:${phone}`
          : `contact:${Math.random().toString(36).slice(2)}`;

        personMap.set(key, {
          key,
          selection_id: selectionId,
          email_lc: email,
          name:
            contact.display_name?.trim() ||
            contact.name?.trim() ||
            (email ? emailToFallbackName(email) : phoneToFallbackName(phone || '')),
          avatar_url: contact.avatar_url || null,
          source: looksLikeUser ? 'pallinky' : 'contact',
          total_hangouts: 0,
          device_contact_id: contact.device_contact_id || null,
          phone_e164: phone,
        });
      });

      const mergedPeople = Array.from(personMap.values()).sort((a, b) => {
        if (a.source !== b.source) {
          return a.source === 'pallinky' ? -1 : 1;
        }

        if (b.total_hangouts !== a.total_hangouts) {
          return b.total_hangouts - a.total_hangouts;
        }

        return a.name.localeCompare(b.name);
      });

      setCircles(safeCircles);
      setPeople(mergedPeople);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not load invite picker.');
    } finally {
      setLoading(false);
    }
  }

  async function importDeviceContacts() {
    setUploadingContacts(true);

    try {
      const { status } = await Contacts.getPermissionsAsync();
      let finalStatus = String(status);

      if (finalStatus !== 'granted' && finalStatus !== 'limited') {
        const request = await Contacts.requestPermissionsAsync();
        finalStatus = String(request.status);
      }

      if (finalStatus !== 'granted' && finalStatus !== 'limited') {
        Alert.alert(
          'Contacts permission required',
          'Please enable contacts access in Settings.'
        );
        return;
      }

      if (finalStatus === 'limited' && Platform.OS === 'ios') {
        try {
          await Contacts.presentAccessPickerAsync();
        } catch {
          Alert.alert(
            'Limited access',
            'To add more contacts, update contact access in Settings.'
          );
        }

        const refreshed = await Contacts.getPermissionsAsync();
        finalStatus = String(refreshed.status);
      }

      setContactPermissionStatus(finalStatus);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user?.id) return;

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Emails, Contacts.Fields.PhoneNumbers],
      });

      const meaningfulContacts = (data || []).filter((contact) => {
        const firstEmail = normalizeEmail(contact.emails?.[0]?.email);
        const firstPhone = normalizePhone(contact.phoneNumbers?.[0]?.number);
        return Boolean(firstEmail || firstPhone);
      });

      const dedupedByIdentity = new Map<
        string,
        {
          display_name: string | null;
          email_lc: string | null;
          phone_e164: string | null;
          device_contact_id: string | null;
          avatar_uri: null;
        }
      >();

      for (const contact of meaningfulContacts) {
        const firstEmail = normalizeEmail(contact.emails?.[0]?.email) || null;
        const firstPhone = normalizePhone(contact.phoneNumbers?.[0]?.number) || null;

        if (!firstEmail && !firstPhone) continue;

        const dedupeKey = firstEmail ? `email:${firstEmail}` : `phone:${firstPhone}`;
        const existing = dedupedByIdentity.get(dedupeKey);

        const nextRow = {
          display_name: contact.name?.trim() || null,
          email_lc: firstEmail,
          phone_e164: firstPhone,
          device_contact_id: contact.id || null,
          avatar_uri: null,
        };

        if (!existing) {
          dedupedByIdentity.set(dedupeKey, nextRow);
          continue;
        }

        const existingScore =
          (existing.display_name ? 1 : 0) +
          (existing.email_lc ? 2 : 0) +
          (existing.phone_e164 ? 1 : 0);

        const nextScore =
          (nextRow.display_name ? 1 : 0) +
          (nextRow.email_lc ? 2 : 0) +
          (nextRow.phone_e164 ? 1 : 0);

        if (nextScore > existingScore) {
          dedupedByIdentity.set(dedupeKey, nextRow);
        }
      }

      const payload = Array.from(dedupedByIdentity.values());

      if (payload.length > 0) {
        const { error: upsertError } = await supabase.rpc('upsert_device_contacts', {
          p_contacts: payload,
        });

        if (upsertError) throw upsertError;

        const { error: matchError } = await supabase.rpc('match_device_contacts');

        if (matchError) throw matchError;
      }

      await fetchData();
      await loadContactPermissionStatus();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not import contacts.');
    } finally {
      setUploadingContacts(false);
    }
  }

useFocusEffect(
  React.useCallback(() => {
    void fetchData();
    void loadContactPermissionStatus();
  }, [slug, circleId])
);

  useEffect(() => {
    if (!circleId || didPreloadCircle) return;
    if (!circles.length || !people.length) return;

    const circle = circles.find((item) => item.id === circleId);

    if (!circle) {
      setDidPreloadCircle(true);
      return;
    }

    const memberEmailSet = new Set(circle.member_emails.map((email) => normalizeEmail(email)));

    const preloadIds = people
      .filter((person) => person.email_lc && memberEmailSet.has(normalizeEmail(person.email_lc)))
      .map((person) => person.selection_id)
      .filter(Boolean);

    if (preloadIds.length > 0) {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...preloadIds])));
    }

    setDidPreloadCircle(true);
  }, [circleId, didPreloadCircle, circles, people]);

  const filteredPeople = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return people;

    return people.filter((person) => {
      return (
        person.name.toLowerCase().includes(q) ||
        (person.email_lc || '').toLowerCase().includes(q) ||
        (person.phone_e164 || '').toLowerCase().includes(q)
      );
    });
  }, [people, search]);

  const selectedPeople = useMemo(() => {
    const selectedSet = new Set(selectedIds);
    return people.filter((person) => selectedSet.has(person.selection_id));
  }, [people, selectedIds]);

  const pallinkyUsers = useMemo(
    () => selectedPeople.filter((person) => person.source === 'pallinky'),
    [selectedPeople]
  );

  const contacts = useMemo(
    () => selectedPeople.filter((person) => person.source === 'contact'),
    [selectedPeople]
  );

  const uploadButtonLabel = useMemo(() => {
    if (contactPermissionStatus === 'limited') return 'Add More Contacts';
    if (contactPermissionStatus === 'granted') return 'Sync Contacts';
    return 'Upload Contacts';
  }, [contactPermissionStatus]);

  function togglePerson(selectionId: string) {
    if (!selectionId) return;

    setSelectedIds((prev) =>
      prev.includes(selectionId)
        ? prev.filter((item) => item !== selectionId)
        : [...prev, selectionId]
    );
  }

  function openCircleOverlay(circle: Circle) {
    setActiveCircle(circle);
    setCircleOverlayVisible(true);
  }

  function toggleCircleMember(selectionId: string) {
    togglePerson(selectionId);
  }

  function confirmCircleSelection() {
    setCircleOverlayVisible(false);
    setActiveCircle(null);
  }

  function openConfirm() {
    if (selectedIds.length === 0) {
      Alert.alert('No recipients', 'Select at least one person.');
      return;
    }

    setConfirmVisible(true);
  }

  async function handleSendInvites() {
    if (!slug) {
      Alert.alert('Missing Event', 'We could not find the event slug.');
      return;
    }

    if (selectedPeople.length === 0) {
      Alert.alert('No recipients', 'Select at least one person.');
      return;
    }

    setSending(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const inviterEmail = normalizeEmail(session?.user?.email);

      if (!inviterEmail) {
        throw new Error('You must be signed in to send invites.');
      }

      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('id')
        .eq('slug', slug)
        .single();

      if (eventError || !eventData?.id) {
        throw new Error('Event not found.');
      }

      const personResults = await Promise.all(
        selectedPeople.map(async (person) => {
          const { data, error } = await supabase.rpc('resolve_or_create_person', {
            p_email_lc: person.email_lc,
            p_phone_e164: person.phone_e164,
            p_matched_user_id: null,
          });

          if (error) throw error;

          return {
            ...person,
            person_id: data as string,
          };
        })
      );

      const inviteRows = personResults.map((person) => ({
        event_id: eventData.id,
        invitee_email_lc: person.email_lc,
        invitee_phone_e164: person.source === 'contact' ? person.phone_e164 : null,
        invitee_name: person.name,
        invited_by_email_lc: inviterEmail,
        invited_by_invite_id: null,
        source_type: 'host_friend',
        source_ref: null,
        status: 'pending',
        can_forward: false,
        requires_host_approval: false,
        claimed_at: null,
        revoked_at: null,
        device_contact_id: null,
        person_id: person.person_id,
      }));

      const { error: inviteError } = await supabase
        .from('event_invites')
        .upsert(inviteRows, { onConflict: 'event_id,invitee_email_lc' });

      if (inviteError) throw inviteError;

      if (pallinkyUsers.length > 0) {
        const notificationRows = pallinkyUsers
          .filter((person) => Boolean(person.email_lc))
          .map((person) => ({
            event_id: eventData.id,
            recipient_email: person.email_lc as string,
            template: 'event_invite',
            payload: {
              slug,
              title: eventTitle,
            },
            status: 'pending',
            attempts: 0,
          }));

        if (notificationRows.length > 0) {
          const { error: notifyError } = await supabase
            .from('notifications_outbox')
            .insert(notificationRows);

          if (notifyError) throw notifyError;
        }
      }

      const shouldOpenShareSheet = contacts.length > 0;

      setConfirmVisible(false);

      if (shouldOpenShareSheet) {
        await new Promise((resolve) => setTimeout(resolve, 300));

        await Share.share({
          message: `You're invited to "${eventTitle}".\n\nhttps://pallinky.com/event/${slug}`,
        });
      }

      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to send invites.');
    } finally {
      setSending(false);
    }
  }

  const renderSelectedChip = ({ item }: { item: UnifiedPerson }) => (
    <View style={styles.selectedChip}>
      <StyledText style={styles.selectedChipText}>
        {firstName(item.name) || item.name}
      </StyledText>
    </View>
  );

  const renderCircleItem = ({ item }: { item: Circle }) => (
    <TouchableOpacity style={styles.circleCard} onPress={() => openCircleOverlay(item)}>
      <View style={styles.circleCardTop}>
        <MaterialCommunityIcons name="account-group" size={20} color={COLORS.secondary} />
        <StyledText style={styles.circleCount}>({item.member_emails.length})</StyledText>
      </View>
      <StyledText style={styles.circleName}>{item.circle_name}</StyledText>
    </TouchableOpacity>
  );

  const renderPersonItem = ({ item }: { item: UnifiedPerson }) => {
    const isSelected = selectedIds.includes(item.selection_id);

    return (
      <TouchableOpacity style={styles.personRow} onPress={() => togglePerson(item.selection_id)}>
        <View style={styles.personLeft}>
          <Image
            source={{ uri: avatarFor(item.name, item.avatar_url) }}
            style={styles.avatar}
          />

          <View style={styles.personText}>
            <StyledText style={styles.personName}>{item.name}</StyledText>
            <StyledText style={styles.personMeta}>
              {item.source === 'pallinky' ? 'Pallinky' : 'Contact'}
              {item.email_lc
                ? ` • ${item.email_lc}`
                : item.phone_e164
                ? ` • ${item.phone_e164}`
                : ''}
            </StyledText>
          </View>
        </View>

        <Ionicons
          name={isSelected ? 'checkbox' : 'square-outline'}
          size={24}
          color={isSelected ? COLORS.primary : '#b0b7c3'}
        />
      </TouchableOpacity>
    );
  };

  const circleOverlayMembers = useMemo(() => {
    if (!activeCircle) return [];

    const memberSet = new Set(activeCircle.member_emails);
    return people.filter((person) => person.email_lc && memberSet.has(person.email_lc));
  }, [activeCircle, people]);

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={28} color={COLORS.primary} />
        </TouchableOpacity>

        <StyledText style={styles.headerTitle}>Invite People</StyledText>

        <View style={{ width: 28 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={COLORS.primary} />
      ) : (
        <>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={18} color={COLORS.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search name, email, or number..."
              placeholderTextColor={COLORS.textMuted}
              style={styles.searchInput}
            />
          </View>

          <View style={styles.uploadRow}>
            <TouchableOpacity
              style={[
                styles.uploadContactsButton,
                uploadingContacts && styles.uploadContactsButtonDisabled,
              ]}
              onPress={importDeviceContacts}
              disabled={uploadingContacts}
            >
              {uploadingContacts ? (
                <ActivityIndicator color={COLORS.primary} />
              ) : (
                <>
                  <Ionicons name="cloud-upload-outline" size={18} color={COLORS.primary} />
                  <StyledText style={styles.uploadContactsButtonText}>
                    {uploadButtonLabel}
                  </StyledText>
                </>
              )}
            </TouchableOpacity>
          </View>

          {selectedPeople.length > 0 && (
            <View style={styles.selectedSection}>
              <StyledText style={styles.sectionTitle}>
                Selected ({selectedPeople.length})
              </StyledText>

              <FlatList
                horizontal
                data={selectedPeople}
                keyExtractor={(item) => item.key}
                renderItem={renderSelectedChip}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.selectedList}
              />
            </View>
          )}

          <View style={styles.section}>
            <StyledText style={styles.sectionTitle}>Your Circles</StyledText>

            {circles.length === 0 ? (
              <View style={styles.emptyState}>
                <StyledText style={styles.emptyText}>No circles yet</StyledText>
              </View>
            ) : (
              <FlatList
                horizontal
                data={circles}
                keyExtractor={(item) => item.id}
                renderItem={renderCircleItem}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.circlesList}
              />
            )}
          </View>

          <View style={styles.peopleSection}>
            <StyledText style={styles.sectionTitle}>People</StyledText>

            <FlatList
              data={filteredPeople}
              keyExtractor={(item) => item.key}
              renderItem={renderPersonItem}
              contentContainerStyle={styles.peopleList}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <StyledText style={styles.emptyText}>No people found</StyledText>
                </View>
              }
            />
          </View>

          <View style={styles.bottomBar}>
            <StyledText style={styles.bottomBarCount}>
              {selectedPeople.length} Selected
            </StyledText>

            <TouchableOpacity
              style={[
                styles.inviteButton,
                selectedPeople.length === 0 && styles.inviteButtonDisabled,
              ]}
              disabled={selectedPeople.length === 0}
              onPress={openConfirm}
            >
              <StyledText style={styles.inviteButtonText}>
                Invite {selectedPeople.length} {selectedPeople.length === 1 ? 'person' : 'people'}
              </StyledText>
            </TouchableOpacity>
          </View>
        </>
      )}

      <Modal
        visible={circleOverlayVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCircleOverlayVisible(false)}
      >
        <View style={styles.overlayScrim}>
          <View style={styles.overlayCard}>
            <View style={styles.overlayHeader}>
              <StyledText style={styles.overlayTitle}>
                {activeCircle?.circle_name || 'Circle'}
              </StyledText>
              <TouchableOpacity onPress={() => setCircleOverlayVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.primary} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={circleOverlayMembers}
              keyExtractor={(item) => item.key}
              renderItem={({ item }) => {
                const isSelected = selectedIds.includes(item.selection_id);

                return (
                  <TouchableOpacity
                    style={styles.overlayMemberRow}
                    onPress={() => toggleCircleMember(item.selection_id)}
                  >
                    <View style={styles.personLeft}>
                      <Image
                        source={{ uri: avatarFor(item.name, item.avatar_url) }}
                        style={styles.avatar}
                      />
                      <StyledText style={styles.personName}>{item.name}</StyledText>
                    </View>

                    <Ionicons
                      name={isSelected ? 'checkbox' : 'square-outline'}
                      size={24}
                      color={isSelected ? COLORS.primary : '#b0b7c3'}
                    />
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <StyledText style={styles.emptyText}>No members in this circle</StyledText>
                </View>
              }
            />

            <TouchableOpacity style={styles.overlayButton} onPress={confirmCircleSelection}>
              <StyledText style={styles.overlayButtonText}>
                Invite {selectedPeople.length}
              </StyledText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmVisible(false)}
      >
        <View style={styles.overlayScrim}>
          <View style={styles.confirmCard}>
            <StyledText style={styles.confirmTitle}>Send Invitations</StyledText>

            {pallinkyUsers.length > 0 && (
              <View style={styles.confirmSection}>
                <StyledText style={styles.confirmLabel}>Pallinky Users</StyledText>
                {pallinkyUsers.map((person) => (
                  <StyledText key={person.key} style={styles.confirmName}>
                    {person.name}
                  </StyledText>
                ))}
              </View>
            )}

            {contacts.length > 0 && (
              <View style={styles.confirmSection}>
                <StyledText style={styles.confirmLabel}>Contacts</StyledText>
                {contacts.map((person) => (
                  <StyledText key={person.key} style={styles.confirmName}>
                    {person.name}
                  </StyledText>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={[styles.confirmButton, sending && styles.inviteButtonDisabled]}
              onPress={handleSendInvites}
              disabled={sending}
            >
              {sending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <StyledText style={styles.confirmButtonText}>Send Invites</StyledText>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 18,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.text,
  },
  searchWrap: {
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
  },
  uploadRow: {
    paddingHorizontal: 20,
  },
  uploadContactsButton: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  uploadContactsButtonDisabled: {
    opacity: 0.65,
  },
  uploadContactsButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
  },
  selectedSection: {
    marginTop: 6,
  },
  selectedList: {
    paddingHorizontal: 20,
    gap: 8,
  },
  selectedChip: {
    backgroundColor: COLORS.secondaryBg,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#d9cdea',
  },
  selectedChipText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.secondary,
  },
  section: {
    marginTop: 18,
  },
  peopleSection: {
    marginTop: 18,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.text,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  circlesList: {
    paddingHorizontal: 20,
  },
  circleCard: {
    width: 140,
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 14,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#e5daf1',
  },
  circleCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
  },
  circleName: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  circleCount: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '700',
  },
  peopleList: {
    paddingHorizontal: 20,
    paddingBottom: 220,
  },
  personRow: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  personLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  personText: {
    flex: 1,
    minWidth: 0,
  },
  personName: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  personMeta: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.secondaryBg,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 34,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSoft,
  },
  bottomBarCount: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 10,
  },
  inviteButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteButtonDisabled: {
    backgroundColor: '#b8c2cc',
  },
  inviteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  overlayScrim: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  overlayCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: '80%',
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSoft,
  },
  overlayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  overlayTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.text,
  },
  overlayMemberRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  overlayButton: {
    marginTop: 18,
    height: 52,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  confirmCard: {
    margin: 20,
    marginBottom: 40,
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.text,
    marginBottom: 18,
  },
  confirmSection: {
    marginBottom: 16,
  },
  confirmLabel: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  confirmName: {
    fontSize: 15,
    color: COLORS.text,
    marginBottom: 6,
  },
  confirmButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
});