/**
 * Path: apps/mobile/app/circles/share-picker.tsx
 * Description: Invite surface led by Circles. Supports circle selection,
 * in-place circle management, contact import choices, recent people,
 * all people grid selection, manual add, and invite send flow.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as Contacts from 'expo-contacts';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Keyboard,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StyledText } from '@pallinky/ui';
import { buildInviteMessage, supabase } from '@pallinky/core';

type PersonSource = 'pallinky' | 'contact' | 'host_manual';

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
  avatar_uri?: string | null;
  person_id?: string | null;
}

interface PredictedFriend {
  name: string | null;
  email_lc: string | null;
  total_hangouts: number | null;
  avatar_url: string | null;
}

interface ProfileAvatarRow {
  id: string;
  email_lc: string | null;
  avatar_url: string | null;
}

interface CircleRow {
  id: string;
  circle_name: string;
  created_at?: string | null;
}

interface CircleMemberRow {
  id: string;
  circle_id: string;
  member_name: string | null;
  member_email_lc: string | null;
  member_phone_e164?: string | null;
  member_user_id?: string | null;
  sort_order?: number | null;
  created_at?: string | null;
  device_contact_id?: string | null;
  person_id?: string | null;
}

interface Circle {
  id: string;
  circle_name: string;
  created_at?: string | null;
  members: CircleMemberRow[];
}

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
  matched_user_id: string | null;
  person_id: string | null;
}

interface RawContactChoice {
  key: string;
  name: string;
  email_lc: string | null;
  phone_e164: string | null;
  device_contact_id: string | null;
}

const COLORS = {
  background: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceAlt: '#F9FBF7',
  text: '#1f2a1b',
  textMuted: '#66715f',
  primary: '#43691b',
  primarySoft: '#eef4e8',
  border: '#bac9ad',
  borderSoft: '#e7ede2',
  secondary: '#6A4C93',
  secondaryBg: '#efe9f7',
  danger: '#e63946',
  dangerBg: '#fff3f3',
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

function initialsFor(name: string | null | undefined) {
  const words = (name || 'Friend')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  return words.map((w) => w[0]?.toUpperCase() || '').join('') || 'FR';
}

function avatarFor(name: string | null | undefined, avatarUrl: string | null | undefined) {
  if (avatarUrl) return avatarUrl;
  const safeName = name?.trim() || 'Friend';
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    safeName,
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

function dedupePeople(people: UnifiedPerson[]) {
  const seen = new Set<string>();
  const result: UnifiedPerson[] = [];

  for (const person of people) {
    const keys = [
      person.person_id ? `person:${person.person_id}` : '',
      person.email_lc ? `email:${person.email_lc}` : '',
      person.phone_e164 ? `phone:${person.phone_e164}` : '',
      person.selection_id ? `selection:${person.selection_id}` : '',
    ].filter(Boolean);

    const match = keys.find((key) => seen.has(key));
    if (match) continue;

    keys.forEach((key) => seen.add(key));
    result.push(person);
  }

  return result;
}

export default function CircleSharePickerScreen() {
  const { slug, circleId } = useLocalSearchParams<{ slug: string; circleId?: string }>();

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const [search, setSearch] = useState('');
  const [eventTitle, setEventTitle] = useState('this event');
  const [contactPermissionStatus, setContactPermissionStatus] = useState<string | null>(null);

  const [circles, setCircles] = useState<Circle[]>([]);
  const [people, setPeople] = useState<UnifiedPerson[]>([]);

  const [selectedCircleIds, setSelectedCircleIds] = useState<string[]>([]);
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [manualSelected, setManualSelected] = useState<UnifiedPerson[]>([]);
  const [didPreloadCircle, setDidPreloadCircle] = useState(false);

  const [syncSheetVisible, setSyncSheetVisible] = useState(false);
  const [importingContacts, setImportingContacts] = useState(false);

  const [rawContactPickerVisible, setRawContactPickerVisible] = useState(false);
  const [rawContactsLoading, setRawContactsLoading] = useState(false);
  const [rawContacts, setRawContacts] = useState<RawContactChoice[]>([]);
  const [selectedRawContactKeys, setSelectedRawContactKeys] = useState<string[]>([]);
  const [rawContactsSearch, setRawContactsSearch] = useState('');

  const [manageCircleVisible, setManageCircleVisible] = useState(false);
  const [manageMode, setManageMode] = useState<'create' | 'edit'>('create');
  const [activeCircle, setActiveCircle] = useState<Circle | null>(null);
  const [circleSaving, setCircleSaving] = useState(false);
  const [circleNameValue, setCircleNameValue] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('');

  const [uploadedContactPickerVisible, setUploadedContactPickerVisible] = useState(false);
  const [uploadedContactsLoading, setUploadedContactsLoading] = useState(false);
  const [uploadedContactsSearch, setUploadedContactsSearch] = useState('');
  const [uploadedContacts, setUploadedContacts] = useState<DeviceContactRow[]>([]);
  const [selectedUploadedContactIds, setSelectedUploadedContactIds] = useState<string[]>([]);
  const [returnToManageCircleAfterContacts, setReturnToManageCircleAfterContacts] = useState(false);

  const [manualAddVisible, setManualAddVisible] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualPhone, setManualPhone] = useState('');

  const [confirmVisible, setConfirmVisible] = useState(false);

  async function loadContactPermissionStatus() {
    try {
      const { status } = await Contacts.getPermissionsAsync();
      setContactPermissionStatus(String(status));
    } catch {
      setContactPermissionStatus(null);
    }
  }

    const buildMergedPeople = useCallback(
    (
      predictedFriends: PredictedFriend[],
      deviceContacts: DeviceContactRow[],
      profileRows: ProfileAvatarRow[],
      userEmail: string,
    ): UnifiedPerson[] => {
      const personMap = new Map<string, UnifiedPerson>();
      const profileAvatarByEmail = new Map<string, string>();
      const profileAvatarById = new Map<string, string>();

      profileRows.forEach((profile) => {
        const email = normalizeEmail(profile.email_lc);
        const avatar = profile.avatar_url?.trim() || '';

        if (email && avatar) {
          profileAvatarByEmail.set(email, avatar);
        }

        if (profile.id && avatar) {
          profileAvatarById.set(profile.id, avatar);
        }
      });

      predictedFriends
        .filter((friend) => {
          const cleanEmail = normalizeEmail(friend.email_lc);
          return cleanEmail !== '' && cleanEmail !== userEmail;
        })
        .forEach((friend) => {
          const email = normalizeEmail(friend.email_lc);
          if (!email) return;

          const selectionId = getSelectionId({ email_lc: email });

          personMap.set(`email:${email}`, {
            key: `email:${email}`,
            selection_id: selectionId,
            email_lc: email,
            name: friend.name?.trim() || emailToFallbackName(email),
            avatar_url: profileAvatarByEmail.get(email) || friend.avatar_url || null,
            source: 'pallinky',
            total_hangouts: friend.total_hangouts || 0,
            device_contact_id: null,
            phone_e164: null,
            matched_user_id: null,
            person_id: null,
          });
        });

      deviceContacts
        .filter((contact) => {
          const cleanEmail = normalizeEmail(contact.email_lc);
          const cleanPhone = normalizePhone(contact.phone_e164);
          const isSelf = cleanEmail !== '' && cleanEmail === userEmail;
          return !isSelf && Boolean(cleanEmail || cleanPhone);
        })
        .forEach((contact) => {
          const email = normalizeEmail(contact.email_lc) || null;
          const phone = normalizePhone(contact.phone_e164) || null;
          if (!email && !phone) return;

          const looksLikeUser = Boolean(
            contact.is_user || contact.matched_user_id || contact.matched_profile_id,
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
              avatar_url:
                profileAvatarById.get(contact.matched_user_id || contact.matched_profile_id || '') ||
                (mergedEmail ? profileAvatarByEmail.get(mergedEmail) : null) ||
                existing.avatar_url ||
                contact.avatar_url ||
                contact.avatar_uri ||
                null,
              source: existing.source === 'pallinky' || looksLikeUser ? 'pallinky' : 'contact',
              total_hangouts: existing.total_hangouts,
              device_contact_id: mergedDeviceContactId,
              phone_e164: mergedPhone,
              matched_user_id:
                contact.matched_user_id || contact.matched_profile_id || existing.matched_user_id,
              person_id: contact.person_id || existing.person_id,
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
            avatar_url:
              profileAvatarById.get(contact.matched_user_id || contact.matched_profile_id || '') ||
              (email ? profileAvatarByEmail.get(email) : null) ||
              contact.avatar_url ||
              contact.avatar_uri ||
              null,
            source: looksLikeUser ? 'pallinky' : 'contact',
            total_hangouts: 0,
            device_contact_id: contact.device_contact_id || null,
            phone_e164: phone,
            matched_user_id: contact.matched_user_id || contact.matched_profile_id || null,
            person_id: contact.person_id || null,
          });
        });

      return Array.from(personMap.values()).sort((a, b) => {
        if (a.source !== b.source) {
          return a.source === 'pallinky' ? -1 : 1;
        }
        if (b.total_hangouts !== a.total_hangouts) {
          return b.total_hangouts - a.total_hangouts;
        }
        return a.name.localeCompare(b.name);
      });
    },
    [],
  );

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

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
          .select('id, circle_name, created_at')
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

      
      const predictedFriends = (predictedRes.data as PredictedFriend[]) || [];
      const deviceContacts = (deviceContactsRes.data as DeviceContactRow[]) || [];

      const profileEmailSet = new Set<string>();
      const profileIdSet = new Set<string>();

      predictedFriends.forEach((friend) => {
        const email = normalizeEmail(friend.email_lc);
        if (email) profileEmailSet.add(email);
      });

      deviceContacts.forEach((contact) => {
        const email = normalizeEmail(contact.email_lc);
        const matchedId = contact.matched_user_id || contact.matched_profile_id || '';

        if (email) profileEmailSet.add(email);
        if (matchedId) profileIdSet.add(matchedId);
      });

      let profileRows: ProfileAvatarRow[] = [];
      if (profileEmailSet.size || profileIdSet.size) {
        let profileQuery = supabase.from('profiles').select('id, email_lc, avatar_url');

        if (profileEmailSet.size && profileIdSet.size) {
          profileQuery = profileQuery.or(
            `email_lc.in.(${Array.from(profileEmailSet).join(',')}),id.in.(${Array.from(profileIdSet).join(',')})`,
          );
        } else if (profileEmailSet.size) {
          profileQuery = profileQuery.in('email_lc', Array.from(profileEmailSet));
        } else {
          profileQuery = profileQuery.in('id', Array.from(profileIdSet));
        }

        const { data: profilesRes, error: profilesError } = await profileQuery;
        if (profilesError) throw profilesError;
        profileRows = (profilesRes as ProfileAvatarRow[]) || [];
      }

      const circleRows = (circleRes.data as CircleRow[]) || [];
      const circleIds = circleRows.map((circle) => circle.id);

      let circleMemberRows: CircleMemberRow[] = [];
      if (circleIds.length > 0) {
        const { data: membersRes, error: membersError } = await supabase
          .from('social_circle_members')
          .select(
            'id, circle_id, member_name, member_email_lc, member_phone_e164, member_user_id, sort_order, created_at, device_contact_id, person_id',
          )
          .in('circle_id', circleIds)
          .order('sort_order', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: true });

        if (membersError) throw membersError;
        circleMemberRows = (membersRes as CircleMemberRow[]) || [];
      }

      const membersByCircleId = new Map<string, CircleMemberRow[]>();
      circleRows.forEach((circle) => membersByCircleId.set(circle.id, []));
      circleMemberRows.forEach((row) => {
        const current = membersByCircleId.get(row.circle_id) || [];
        current.push(row);
        membersByCircleId.set(row.circle_id, current);
      });

      const safeCircles: Circle[] = circleRows.map((circle) => ({
        id: circle.id,
        circle_name: circle.circle_name,
        created_at: circle.created_at || null,
        members: membersByCircleId.get(circle.id) || [],
      }));

      const mergedPeople = buildMergedPeople(
        predictedFriends,
        deviceContacts,
        profileRows,
        userEmail,
      );

      setCircles(safeCircles);
      setPeople(mergedPeople);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not load invite picker.');
    } finally {
      setLoading(false);
    }
  }, [buildMergedPeople, slug]);

  useFocusEffect(
    React.useCallback(() => {
      void fetchData();
      void loadContactPermissionStatus();
    }, [fetchData]),
  );

  useEffect(() => {
    if (!circleId || didPreloadCircle) return;
    if (!circles.length) return;

    const circle = circles.find((item) => item.id === circleId);
    if (!circle) {
      setDidPreloadCircle(true);
      return;
    }

    setSelectedCircleIds((prev) => (prev.includes(circle.id) ? prev : [...prev, circle.id]));
    setDidPreloadCircle(true);
  }, [circleId, circles, didPreloadCircle]);

  const selectedCircleSet = useMemo(() => new Set(selectedCircleIds), [selectedCircleIds]);
  const selectedPersonSet = useMemo(() => new Set(selectedPersonIds), [selectedPersonIds]);

  const circleMemberPeople = useMemo(() => {
    const out: UnifiedPerson[] = [];

    for (const circle of circles) {
      if (!selectedCircleSet.has(circle.id)) continue;

      for (const member of circle.members) {
        const email = normalizeEmail(member.member_email_lc) || null;
        const phone = normalizePhone(member.member_phone_e164) || null;

        const fromPeople =
          people.find(
            (person) =>
              (email && person.email_lc === email) ||
              (phone && person.phone_e164 === phone) ||
              (member.person_id && person.person_id === member.person_id),
          ) || null;

        if (fromPeople) {
          out.push(fromPeople);
          continue;
        }

        const selectionId = getSelectionId({
          device_contact_id: member.device_contact_id,
          phone_e164: phone,
          email_lc: email,
        });

        out.push({
          key: `circle-member:${member.id}`,
          selection_id: selectionId || `circle-member:${member.id}`,
          email_lc: email,
          name:
            member.member_name ||
            (email ? emailToFallbackName(email) : phoneToFallbackName(phone || '')),
          avatar_url: null,
          source: member.member_user_id ? 'pallinky' : 'contact',
          total_hangouts: 0,
          device_contact_id: member.device_contact_id || null,
          phone_e164: phone,
          matched_user_id: member.member_user_id || null,
          person_id: member.person_id || null,
        });
      }
    }

    return dedupePeople(out);
  }, [circles, people, selectedCircleSet]);

  const selectedDirectPeople = useMemo(
    () => people.filter((person) => selectedPersonSet.has(person.selection_id)),
    [people, selectedPersonSet],
  );

  const allSelectedPeople = useMemo(
    () => dedupePeople([...circleMemberPeople, ...selectedDirectPeople, ...manualSelected]),
    [circleMemberPeople, selectedDirectPeople, manualSelected],
  );

  const selectedPills = useMemo(() => {
    const circlePills = circles
      .filter((circle) => selectedCircleSet.has(circle.id))
      .map((circle) => ({
        type: 'circle' as const,
        key: `circle:${circle.id}`,
        label: `${circle.circle_name} (${circle.members.length})`,
        circleId: circle.id,
      }));

    const personPills = dedupePeople([...selectedDirectPeople, ...manualSelected]).map((person) => ({
      type: 'person' as const,
      key: `person:${person.key}`,
      label: firstName(person.name) || person.name,
      personSelectionId: person.selection_id,
      avatar_url: person.avatar_url,
      name: person.name,
    }));

    return [...circlePills, ...personPills];
  }, [circles, manualSelected, selectedCircleSet, selectedDirectPeople]);

  const recentPeople = useMemo(() => {
    const q = search.trim().toLowerCase();
    const seed = people
      .filter((person) => person.total_hangouts > 0 || person.source === 'pallinky')
      .slice(0, 10);

    if (!q) return seed;

    return seed.filter((person) => {
      return (
        person.name.toLowerCase().includes(q) ||
        (person.email_lc || '').toLowerCase().includes(q) ||
        (person.phone_e164 || '').toLowerCase().includes(q)
      );
    });
  }, [people, search]);

  const filteredPeople = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? people.filter((person) => {
          return (
            person.name.toLowerCase().includes(q) ||
            (person.email_lc || '').toLowerCase().includes(q) ||
            (person.phone_e164 || '').toLowerCase().includes(q)
          );
        })
      : people;

    return base;
  }, [people, search]);

  const filteredCircles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return circles;

    return circles.filter((circle) => {
      if (circle.circle_name.toLowerCase().includes(q)) return true;
      return circle.members.some((member) => {
        const name = (member.member_name || '').toLowerCase();
        const email = (member.member_email_lc || '').toLowerCase();
        const phone = (member.member_phone_e164 || '').toLowerCase();
        return name.includes(q) || email.includes(q) || phone.includes(q);
      });
    });
  }, [circles, search]);

  const filteredRawContacts = useMemo(() => {
    const q = rawContactsSearch.trim().toLowerCase();
    if (!q) return rawContacts;

    return rawContacts.filter((contact) => {
      return (
        contact.name.toLowerCase().includes(q) ||
        (contact.email_lc || '').toLowerCase().includes(q) ||
        (contact.phone_e164 || '').toLowerCase().includes(q)
      );
    });
  }, [rawContacts, rawContactsSearch]);

  const filteredUploadedContacts = useMemo(() => {
    const q = uploadedContactsSearch.trim().toLowerCase();
    if (!q) return uploadedContacts;

    return uploadedContacts.filter((contact) => {
      const name =
        contact.display_name?.trim() ||
        contact.name?.trim() ||
        contact.email_lc ||
        contact.phone_e164 ||
        'Contact';
      return (
        name.toLowerCase().includes(q) ||
        (contact.email_lc || '').toLowerCase().includes(q) ||
        (contact.phone_e164 || '').toLowerCase().includes(q)
      );
    });
  }, [uploadedContacts, uploadedContactsSearch]);

  function toggleCircle(circleIdValue: string) {
    setSelectedCircleIds((prev) =>
      prev.includes(circleIdValue)
        ? prev.filter((item) => item !== circleIdValue)
        : [...prev, circleIdValue],
    );
  }

  function togglePerson(selectionId: string) {
    Keyboard.dismiss();
    
    if (!selectionId) return;

    setSelectedPersonIds((prev) =>
      prev.includes(selectionId)
        ? prev.filter((item) => item !== selectionId)
        : [...prev, selectionId],
    );
  }

  function removeSelectedPill(item: (typeof selectedPills)[number]) {
    if (item.type === 'circle') {
      setSelectedCircleIds((prev) => prev.filter((id) => id !== item.circleId));
      return;
    }

    setSelectedPersonIds((prev) => prev.filter((id) => id !== item.personSelectionId));
    setManualSelected((prev) => prev.filter((person) => person.selection_id !== item.personSelectionId));
  }

  function openNewCircle() {
    setManageMode('create');
    setActiveCircle(null);
    setCircleNameValue('');
    setNewMemberName('');
    setNewMemberEmail('');
    setNewMemberPhone('');
    setManageCircleVisible(true);
  }

  function openManageCircle(circle: Circle) {
    setManageMode('edit');
    setActiveCircle(circle);
    setCircleNameValue(circle.circle_name || '');
    setNewMemberName('');
    setNewMemberEmail('');
    setNewMemberPhone('');
    setManageCircleVisible(true);
  }

    function closeManageCircle() {
    setManageCircleVisible(false);
    setActiveCircle(null);
    setCircleNameValue('');
    setNewMemberName('');
    setNewMemberEmail('');
    setNewMemberPhone('');
    setUploadedContactPickerVisible(false);
    setSelectedUploadedContactIds([]);
    setUploadedContactsSearch('');
    setReturnToManageCircleAfterContacts(false);
      if (returnToManageCircleAfterContacts) {
        setManageCircleVisible(true);
      }
  }

  async function handleCreateCircle() {
    const name = circleNameValue.trim();
    if (!name) {
      Alert.alert('Enter a circle name');
      return;
    }

    setCircleSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('You need to be signed in.');
      }

      const { data, error } = await supabase
        .from('social_circles')
        .insert({
          user_id: user.id,
          circle_name: name,
          members: [],
        })
        .select('id, circle_name, created_at')
        .single();

      if (error) throw error;

      const createdCircle: Circle = {
        id: data.id,
        circle_name: data.circle_name,
        created_at: data.created_at || null,
        members: [],
      };

      setCircles((prev) => [createdCircle, ...prev]);
      setSelectedCircleIds((prev) =>
        prev.includes(createdCircle.id) ? prev : [...prev, createdCircle.id],
      );
      closeManageCircle();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not create circle.');
    } finally {
      setCircleSaving(false);
    }
  }

  async function handleRenameCircle() {
    if (!activeCircle) return;

    const nextName = circleNameValue.trim();
    if (!nextName) {
      Alert.alert('Enter a circle name');
      return;
    }

    setCircleSaving(true);

    try {
      const { error } = await supabase
        .from('social_circles')
        .update({ circle_name: nextName })
        .eq('id', activeCircle.id);

      if (error) throw error;

      setCircles((prev) =>
        prev.map((circle) =>
          circle.id === activeCircle.id ? { ...circle, circle_name: nextName } : circle,
        ),
      );
      setActiveCircle((prev) => (prev ? { ...prev, circle_name: nextName } : prev));
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not rename circle.');
    } finally {
      setCircleSaving(false);
    }
  }

  function handleDeleteCircle(circle: Circle) {
    Alert.alert('Delete circle', `Delete "${circle.circle_name}" and all its members?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setCircleSaving(true);

          try {
            const { error: membersError } = await supabase
              .from('social_circle_members')
              .delete()
              .eq('circle_id', circle.id);

            if (membersError) throw membersError;

            const { error: circleError } = await supabase
              .from('social_circles')
              .delete()
              .eq('id', circle.id);

            if (circleError) throw circleError;

            setCircles((prev) => prev.filter((item) => item.id !== circle.id));
            setSelectedCircleIds((prev) => prev.filter((id) => id !== circle.id));
            if (activeCircle?.id === circle.id) closeManageCircle();
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Could not delete circle.');
          } finally {
            setCircleSaving(false);
          }
        },
      },
    ]);
  }

  async function handleAddMemberToCircle() {
    if (!activeCircle) return;

    const member_name = newMemberName.trim() || null;
    const member_email_lc = normalizeEmail(newMemberEmail) || null;
    const member_phone_e164 = normalizePhone(newMemberPhone) || null;

    if (!member_name && !member_email_lc && !member_phone_e164) {
      Alert.alert('Add at least a name, email, or phone.');
      return;
    }

    setCircleSaving(true);

    try {
      let member_user_id: string | null = null;

      if (member_email_lc) {
        const { data: profileRow, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('email_lc', member_email_lc)
          .maybeSingle();

        if (profileError) throw profileError;
        member_user_id = profileRow?.id || null;
      }

      const { data: personId, error: personError } = await supabase.rpc(
        'resolve_or_create_person',
        {
          p_email_lc: member_email_lc,
          p_phone_e164: member_phone_e164,
          p_matched_user_id: member_user_id,
        },
      );

      if (personError) throw personError;

      const nextSortOrder =
        activeCircle.members.reduce((max, item) => Math.max(max, item.sort_order ?? 0), 0) + 1;

      const { data: inserted, error } = await supabase
        .from('social_circle_members')
        .insert({
          circle_id: activeCircle.id,
          member_name,
          member_email_lc,
          member_phone_e164,
          member_user_id,
          person_id: personId,
          sort_order: nextSortOrder,
        })
        .select(
          'id, circle_id, member_name, member_email_lc, member_phone_e164, member_user_id, sort_order, created_at, device_contact_id, person_id',
        )
        .single();

      if (error) throw error;

      const nextMember = inserted as CircleMemberRow;
      const nextCircle = {
        ...activeCircle,
        members: [...activeCircle.members, nextMember],
      };

      setCircles((prev) =>
        prev.map((circle) => (circle.id === activeCircle.id ? nextCircle : circle)),
      );
      setActiveCircle(nextCircle);
      setNewMemberName('');
      setNewMemberEmail('');
      setNewMemberPhone('');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not add member.');
    } finally {
      setCircleSaving(false);
    }
  }

  function handleRemoveCircleMember(member: CircleMemberRow) {
    if (!activeCircle) return;

    Alert.alert(
      'Remove member',
      `Remove ${member.member_name || member.member_email_lc || member.member_phone_e164 || 'this member'} from the circle?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setCircleSaving(true);

            try {
              const { error } = await supabase
                .from('social_circle_members')
                .delete()
                .eq('id', member.id);

              if (error) throw error;

              const nextCircle = {
                ...activeCircle,
                members: activeCircle.members.filter((item) => item.id !== member.id),
              };

              setCircles((prev) =>
                prev.map((circle) => (circle.id === activeCircle.id ? nextCircle : circle)),
              );
              setActiveCircle(nextCircle);
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Could not remove member.');
            } finally {
              setCircleSaving(false);
            }
          },
        },
      ],
    );
  }

  async function loadUploadedContacts() {
    setUploadedContactsLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_my_device_contacts');
      if (error) throw error;

      const rows = ((data as DeviceContactRow[]) || []).filter(
        (contact) => Boolean(contact?.id) && Boolean(contact.email_lc || contact.phone_e164),
      );

      setUploadedContacts(rows);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not load uploaded contacts.');
      setUploadedContacts([]);
    } finally {
      setUploadedContactsLoading(false);
    }
  }

    async function openUploadedContactsPicker() {
    if (!activeCircle) return;

    setSelectedUploadedContactIds([]);
    setUploadedContactsSearch('');
    setReturnToManageCircleAfterContacts(true);
    setManageCircleVisible(false);
    setUploadedContactPickerVisible(true);

    await loadUploadedContacts();
  }

  async function handleAddUploadedContactsToCircle() {
    if (!activeCircle) return;
    if (!selectedUploadedContactIds.length) {
      Alert.alert('Select at least one contact.');
      return;
    }

    setCircleSaving(true);

    try {
      const { error } = await supabase.rpc('add_device_contacts_to_circle', {
        p_circle_id: activeCircle.id,
        p_contact_ids: selectedUploadedContactIds,
      });

      if (error) throw error;

      await fetchData();
      const refreshed = circles.find((circle) => circle.id === activeCircle.id) || activeCircle;
      const nextActive =
        (await (async () => {
          const { data: membersRes, error: membersError } = await supabase
            .from('social_circle_members')
            .select(
              'id, circle_id, member_name, member_email_lc, member_phone_e164, member_user_id, sort_order, created_at, device_contact_id, person_id',
            )
            .eq('circle_id', activeCircle.id)
            .order('sort_order', { ascending: true, nullsFirst: false })
            .order('created_at', { ascending: true });

          if (membersError) throw membersError;

          return {
            ...refreshed,
            members: (membersRes as CircleMemberRow[]) || [],
          } as Circle;
        })()) || refreshed;

      setCircles((prev) =>
        prev.map((circle) => (circle.id === activeCircle.id ? nextActive : circle)),
      );
      setActiveCircle(nextActive);
      setUploadedContactPickerVisible(false);
      setSelectedUploadedContactIds([]);
      setUploadedContactsSearch('');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not add contacts to circle.');
    } finally {
      setCircleSaving(false);
    }
  }

  async function ensureContactsPermission() {
    const { status } = await Contacts.getPermissionsAsync();
    let finalStatus = String(status);

    if (finalStatus !== 'granted' && finalStatus !== 'limited') {
      const request = await Contacts.requestPermissionsAsync();
      finalStatus = String(request.status);
    }

    if (finalStatus !== 'granted' && finalStatus !== 'limited') {
      throw new Error('Please enable contacts access in Settings.');
    }

    if (finalStatus === 'limited' && Platform.OS === 'ios') {
      try {
        await Contacts.presentAccessPickerAsync();
      } catch {
        // keep current limited access
      }
    }

    setContactPermissionStatus(finalStatus);
  }

  async function uploadPayloadToSupabase(
    payload: {
      display_name: string | null;
      email_lc: string | null;
      phone_e164: string | null;
      device_contact_id: string | null;
      avatar_uri: null;
    }[],
  ) {
    if (!payload.length) return;

    const { error: upsertError } = await supabase.rpc('upsert_device_contacts', {
      p_contacts: payload,
    });

    if (upsertError) throw upsertError;

    const { error: matchError } = await supabase.rpc('match_device_contacts');
    if (matchError) throw matchError;
  }

  async function handleImportAllContacts() {
    setImportingContacts(true);

    try {
      await ensureContactsPermission();

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
        if (dedupedByIdentity.has(dedupeKey)) continue;

        dedupedByIdentity.set(dedupeKey, {
          display_name: contact.name?.trim() || null,
          email_lc: firstEmail,
          phone_e164: firstPhone,
          device_contact_id: contact.id || null,
          avatar_uri: null,
        });
      }

      await uploadPayloadToSupabase(Array.from(dedupedByIdentity.values()));
      setSyncSheetVisible(false);
      await fetchData();
      await loadContactPermissionStatus();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not import contacts.');
    } finally {
      setImportingContacts(false);
    }
  }

  async function openChooseRawContacts() {
    setImportingContacts(true);

    try {
      await ensureContactsPermission();

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Emails, Contacts.Fields.PhoneNumbers],
      });

      const deduped = new Map<string, RawContactChoice>();

      for (const contact of data || []) {
        const firstEmail = normalizeEmail(contact.emails?.[0]?.email) || null;
        const firstPhone = normalizePhone(contact.phoneNumbers?.[0]?.number) || null;
        if (!firstEmail && !firstPhone) continue;

        const key = firstEmail ? `email:${firstEmail}` : `phone:${firstPhone}`;
        if (deduped.has(key)) continue;

        deduped.set(key, {
          key,
          name:
            contact.name?.trim() ||
            (firstEmail ? emailToFallbackName(firstEmail) : phoneToFallbackName(firstPhone || '')),
          email_lc: firstEmail,
          phone_e164: firstPhone,
          device_contact_id: contact.id || null,
        });
      }

      setRawContacts(Array.from(deduped.values()).sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedRawContactKeys([]);
      setRawContactsSearch('');
      setSyncSheetVisible(false);
      setRawContactPickerVisible(true);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not load contacts.');
    } finally {
      setImportingContacts(false);
    }
  }

  async function handleImportSelectedRawContacts() {
    if (!selectedRawContactKeys.length) {
      Alert.alert('Select at least one contact.');
      return;
    }

    setImportingContacts(true);

    try {
      const payload = rawContacts
        .filter((contact) => selectedRawContactKeys.includes(contact.key))
        .map((contact) => ({
          display_name: contact.name || null,
          email_lc: contact.email_lc,
          phone_e164: contact.phone_e164,
          device_contact_id: contact.device_contact_id,
          avatar_uri: null,
        }));

      await uploadPayloadToSupabase(payload);
      setRawContactPickerVisible(false);
      setSelectedRawContactKeys([]);
      setRawContactsSearch('');
      await fetchData();
      await loadContactPermissionStatus();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not import selected contacts.');
    } finally {
      setImportingContacts(false);
    }
  }

  function toggleRawContact(key: string) {
    setSelectedRawContactKeys((prev) =>
      prev.includes(key) ? prev.filter((id) => id !== key) : [...prev, key],
    );
  }

  function toggleUploadedContact(id: string) {
    setSelectedUploadedContactIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function openConfirm() {
    if (!allSelectedPeople.length) {
      Alert.alert('No recipients', 'Select at least one person or circle.');
      return;
    }
    setConfirmVisible(true);
  }

  async function handleAddManualSelection() {
    const cleanName = manualName.trim();
    const cleanEmail = normalizeEmail(manualEmail) || null;
    const cleanPhone = normalizePhone(manualPhone) || null;

    if (!cleanName && !cleanEmail && !cleanPhone) {
      Alert.alert('Add at least a name, email, or phone.');
      return;
    }

    const name =
      cleanName ||
      (cleanEmail ? emailToFallbackName(cleanEmail) : phoneToFallbackName(cleanPhone || ''));

    const person: UnifiedPerson = {
      key: `host_manual:${cleanEmail || cleanPhone || Date.now().toString()}`,
      selection_id: getSelectionId({
        email_lc: cleanEmail,
        phone_e164: cleanPhone,
      }) || `host_manual:${Date.now()}`,
      email_lc: cleanEmail,
      name,
      avatar_url: null,
      source: 'host_manual',
      total_hangouts: 0,
      device_contact_id: null,
      phone_e164: cleanPhone,
      matched_user_id: null,
      person_id: null,
    };

    setManualSelected((prev) => dedupePeople([...prev, person]));
    setManualName('');
    setManualEmail('');
    setManualPhone('');
    setManualAddVisible(false);
  }

  async function handleSendInvites() {
    if (!slug) {
      Alert.alert('Missing Event', 'We could not find the event slug.');
      return;
    }

    if (allSelectedPeople.length === 0) {
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

      const peopleToInvite = dedupePeople(allSelectedPeople);

      const personResults = await Promise.all(
        peopleToInvite.map(async (person) => {
          let resolvedPersonId = person.person_id;

          if (!resolvedPersonId) {
            const { data, error } = await supabase.rpc('resolve_or_create_person', {
              p_email_lc: person.email_lc,
              p_phone_e164: person.phone_e164,
              p_matched_user_id: person.matched_user_id,
            });

            if (error) throw error;
            resolvedPersonId = data as string;
          }

          return {
            ...person,
            person_id: resolvedPersonId,
          };
        }),
      );

      const inviteRows = personResults.map((person) => ({
        event_id: eventData.id,
        invitee_email_lc: person.email_lc,
        invitee_phone_e164:
          person.source === 'contact' || person.source === 'host_manual' ? person.phone_e164 : null,
        invitee_name: person.name,
        invited_by_email_lc: inviterEmail,
        invited_by_invite_id: null,
        source_type:
          person.source === 'pallinky'
            ? 'host_friend'
            : person.source === 'host_manual'
              ? 'host_manual'
              : 'host_friend',
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

      const matchedUsers = personResults.filter(
        (person) => (person.source === 'pallinky' || !!person.matched_user_id) && !!person.email_lc,
      );

      if (matchedUsers.length > 0) {
        const notificationRows = matchedUsers.map((person) => ({
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

        const { error: notifyError } = await supabase
          .from('notifications_outbox')
          .insert(notificationRows);

        if (notifyError) throw notifyError;
      }

      const shouldOpenShareSheet = personResults.some(
        (person) =>
          !(person.source === 'pallinky' || !!person.matched_user_id) &&
          Boolean(person.phone_e164 || person.email_lc),
      );

      setConfirmVisible(false);

      if (shouldOpenShareSheet) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        const message = buildInviteMessage({
  title: eventTitle,
  link: `https://pallinky.com/event/${slug}`,
});

await Share.share({ message });
      }

      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to send invites.');
    } finally {
      setSending(false);
    }
  }

  const renderCircleCard = ({ item }: { item: Circle }) => {
    const isSelected = selectedCircleSet.has(item.id);
    const previewMembers = item.members.slice(0, 3);

    return (
      <Pressable
        onPress={() => toggleCircle(item.id)}
        onLongPress={() => openManageCircle(item)}
        style={[
          styles.circleCard,
          isSelected && styles.circleCardSelected,
        ]}
      >
        <View style={styles.circleCardTop}>
          <View style={styles.avatarStack}>
            {previewMembers.length > 0 ? (
              previewMembers.map((member, index) => (
                <View
                  key={member.id}
                  style={[
                    styles.avatarStackItem,
                    { marginLeft: index === 0 ? 0 : -10, zIndex: 10 - index },
                  ]}
                >
                  <StyledText style={styles.avatarStackText}>
                    {initialsFor(member.member_name || member.member_email_lc || member.member_phone_e164)}
                  </StyledText>
                </View>
              ))
            ) : (
              <View style={styles.avatarStackItem}>
                <MaterialCommunityIcons name="account-group" size={18} color={COLORS.secondary} />
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.circleMenuButton}
            onPress={() => openManageCircle(item)}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        <StyledText style={styles.circleCardTitle}>{item.circle_name}</StyledText>
        <StyledText style={styles.circleCardMeta}>
          {item.members.length} {item.members.length === 1 ? 'member' : 'members'}
        </StyledText>

        {isSelected ? (
          <View style={styles.circleSelectedBadge}>
            <Ionicons name="checkmark" size={14} color="#fff" />
            <StyledText style={styles.circleSelectedBadgeText}>Selected</StyledText>
          </View>
        ) : (
          <StyledText style={styles.circleActionHint}>Tap to invite</StyledText>
        )}
      </Pressable>
    );
  };

  const renderRecentPerson = ({ item }: { item: UnifiedPerson }) => {
    const isSelected = selectedPersonSet.has(item.selection_id);

    return (
      <TouchableOpacity
        style={[styles.recentCard, isSelected && styles.recentCardSelected]}
        onPress={() => togglePerson(item.selection_id)}
      >
        <Image source={{ uri: avatarFor(item.name, item.avatar_url) }} style={styles.recentAvatar} />
        <StyledText style={styles.recentName} numberOfLines={1}>
          {firstName(item.name) || item.name}
        </StyledText>
        <Ionicons
          name={isSelected ? 'checkbox' : 'square-outline'}
          size={20}
          color={isSelected ? COLORS.primary : '#b0b7c3'}
        />
      </TouchableOpacity>
    );
  };

  const renderSelectedPill = ({ item }: { item: (typeof selectedPills)[number] }) => (
    <TouchableOpacity style={styles.selectedPill} onPress={() => removeSelectedPill(item)}>
      {item.type === 'person' ? (
        <Image
          source={{ uri: avatarFor(item.name, item.avatar_url || null) }}
          style={styles.selectedPillAvatar}
        />
      ) : (
        <MaterialCommunityIcons name="account-group" size={16} color={COLORS.secondary} />
      )}
      <StyledText style={styles.selectedPillText}>{item.label}</StyledText>
      <Ionicons name="close" size={14} color={COLORS.textMuted} />
    </TouchableOpacity>
  );

  const selectedCount = allSelectedPeople.length;

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.wrapper}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerIcon}>
            <Ionicons name="close" size={28} color={COLORS.primary} />
          </TouchableOpacity>

          <StyledText style={styles.headerTitle}>Invite People</StyledText>

          <View style={styles.headerSpacer} />
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <>
            <ScrollView
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeaderRow}>
                  <StyledText style={styles.sectionTitle}>Circles</StyledText>

                  <TouchableOpacity style={styles.syncPill} onPress={() => setSyncSheetVisible(true)}>
                    <Ionicons name="cloud-upload-outline" size={16} color={COLORS.primary} />
                    <StyledText style={styles.syncPillText}>
                      {contactPermissionStatus === 'granted' || contactPermissionStatus === 'limited'
                        ? 'Sync contacts'
                        : 'Import contacts'}
                    </StyledText>
                  </TouchableOpacity>
                </View>

                <FlatList
                  horizontal
                  data={[{ id: 'new-circle' } as any, ...filteredCircles]}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => {
                    if (item.id === 'new-circle') {
                      return (
                        <TouchableOpacity style={styles.newCircleCard} onPress={openNewCircle}>
                          <View style={styles.newCircleIcon}>
                            <Ionicons name="add" size={26} color={COLORS.primary} />
                          </View>
                          <StyledText style={styles.newCircleTitle}>New Circle</StyledText>
                          <StyledText style={styles.newCircleMeta}>Create and invite fast</StyledText>
                        </TouchableOpacity>
                      );
                    }

                    return renderCircleCard({ item });
                  }}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.circlesList}
                />
              </View>

              {selectedPills.length > 0 && (
                <View style={styles.selectedRowBlock}>
                  <FlatList
                    horizontal
                    data={selectedPills}
                    keyExtractor={(item) => item.key}
                    renderItem={renderSelectedPill}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.selectedRow}
                  />
                </View>
              )}

              <View style={styles.searchWrap}>
                <Ionicons name="search" size={18} color={COLORS.textMuted} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search circles, people, email, or number..."
                  placeholderTextColor={COLORS.textMuted}
                  style={styles.searchInput}
                />
              </View>

              <View style={styles.sectionCard}>
                <View style={styles.sectionCardHeader}>
                  <StyledText style={styles.sectionTitle}>Recently Invited</StyledText>
                </View>

                {recentPeople.length === 0 ? (
                  <StyledText style={styles.emptyText}>No recent people yet</StyledText>
                ) : (
                  <FlatList
                    horizontal
                    data={recentPeople}
                    keyExtractor={(item) => item.key}
                    renderItem={renderRecentPerson}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.recentList}
                  />
                )}
              </View>

              <View style={styles.manualRowCard}>
                <View>
                  <StyledText style={styles.manualRowTitle}>Add someone directly</StyledText>
                  <StyledText style={styles.manualRowMeta}>Name, email, or phone</StyledText>
                </View>

                <TouchableOpacity style={styles.manualRowButton} onPress={() => setManualAddVisible(true)}>
                  <Ionicons name="add" size={18} color="#fff" />
                  <StyledText style={styles.manualRowButtonText}>Add someone</StyledText>
                </TouchableOpacity>
              </View>

              <View style={styles.sectionCard}>
                <View style={styles.sectionCardHeader}>
                  <StyledText style={styles.sectionTitle}>People</StyledText>
                </View>

                {filteredPeople.length === 0 ? (
                  <StyledText style={styles.emptyText}>No people found</StyledText>
                ) : (
                  <View style={styles.peopleGrid}>
                    {filteredPeople.map((item) => {
                      const isSelected = selectedPersonSet.has(item.selection_id);

                      return (
                        <TouchableOpacity
                          key={item.key}
                          style={[styles.personTile, isSelected && styles.personTileSelected]}
                          onPress={() => togglePerson(item.selection_id)}
                        >
                          <View style={styles.personTileCheck}>
                            <Ionicons
                              name={isSelected ? 'checkbox' : 'square-outline'}
                              size={20}
                              color={isSelected ? COLORS.primary : '#b0b7c3'}
                            />
                          </View>

                          <Image
                            source={{ uri: avatarFor(item.name, item.avatar_url) }}
                            style={styles.personTileAvatar}
                          />

                          <StyledText style={styles.personTileName} numberOfLines={2}>
                            {item.name}
                          </StyledText>

                          <StyledText style={styles.personTileMeta} numberOfLines={2}>
                            {item.source === 'pallinky' ? 'Pallinky' : 'Contact'}
                            {item.email_lc
                              ? ` • ${item.email_lc}`
                              : item.phone_e164
                                ? ` • ${item.phone_e164}`
                                : ''}
                          </StyledText>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            </ScrollView>

            <View style={styles.bottomBar}>
              <StyledText style={styles.bottomBarCount}>
                {selectedCount} {selectedCount === 1 ? 'selected' : 'selected'}
              </StyledText>

              <TouchableOpacity
                style={[styles.inviteButton, selectedCount === 0 && styles.inviteButtonDisabled]}
                disabled={selectedCount === 0}
                onPress={openConfirm}
              >
                <StyledText style={styles.inviteButtonText}>Invite</StyledText>
              </TouchableOpacity>
            </View>
          </>
        )}

        <Modal
          visible={syncSheetVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setSyncSheetVisible(false)}
        >
          <Pressable style={styles.overlayScrim} onPress={() => setSyncSheetVisible(false)}>
            <Pressable style={styles.sheetCard} onPress={() => null}>
              <View style={styles.sheetHandle} />
              <StyledText style={styles.sheetTitle}>Import Contacts</StyledText>

              <TouchableOpacity
                style={styles.sheetAction}
                onPress={handleImportAllContacts}
                disabled={importingContacts}
              >
                <Ionicons name="cloud-upload-outline" size={20} color={COLORS.primary} />
                <View style={styles.sheetActionTextWrap}>
                  <StyledText style={styles.sheetActionTitle}>Import All Contacts</StyledText>
                  <StyledText style={styles.sheetActionMeta}>
                    Bring in everything at once
                  </StyledText>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sheetAction}
                onPress={openChooseRawContacts}
                disabled={importingContacts}
              >
                <Ionicons name="list-outline" size={20} color={COLORS.primary} />
                <View style={styles.sheetActionTextWrap}>
                  <StyledText style={styles.sheetActionTitle}>Choose Contacts</StyledText>
                  <StyledText style={styles.sheetActionMeta}>
                    Import only selected contacts
                  </StyledText>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sheetAction, styles.sheetActionGhost]}
                onPress={() => setSyncSheetVisible(false)}
                disabled={importingContacts}
              >
                <Ionicons name="play-forward-outline" size={20} color={COLORS.textMuted} />
                <View style={styles.sheetActionTextWrap}>
                  <StyledText style={styles.sheetActionTitle}>Skip for now</StyledText>
                </View>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal
          visible={rawContactPickerVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setRawContactPickerVisible(false)}
        >
          <SafeAreaView style={styles.modalWrap}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setRawContactPickerVisible(false)}>
                <StyledText style={styles.modalHeaderAction}>Cancel</StyledText>
              </TouchableOpacity>

              <StyledText style={styles.modalTitle}>Choose Contacts</StyledText>

              <TouchableOpacity
                onPress={handleImportSelectedRawContacts}
                disabled={importingContacts || !selectedRawContactKeys.length}
              >
                <StyledText
                  style={[
                    styles.modalHeaderAction,
                    (!selectedRawContactKeys.length || importingContacts) && styles.headerActionDisabled,
                  ]}
                >
                  Import
                </StyledText>
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <View style={styles.searchWrapModal}>
                <Ionicons name="search" size={18} color={COLORS.textMuted} />
                <TextInput
                  value={rawContactsSearch}
                  onChangeText={setRawContactsSearch}
                  placeholder="Search contacts"
                  placeholderTextColor={COLORS.textMuted}
                  style={styles.searchInput}
                />
              </View>

              <StyledText style={styles.modalSummary}>
                {selectedRawContactKeys.length} selected
              </StyledText>

              {rawContactsLoading ? (
                <View style={styles.stateWrap}>
                  <ActivityIndicator color={COLORS.primary} />
                </View>
              ) : (
                <ScrollView contentContainerStyle={styles.modalListContent}>
                  {filteredRawContacts.map((contact) => {
                    const isSelected = selectedRawContactKeys.includes(contact.key);

                    return (
                      <TouchableOpacity
                        key={contact.key}
                        style={styles.contactRow}
                        onPress={() => toggleRawContact(contact.key)}
                      >
                        <View style={styles.contactAvatar}>
                          <StyledText style={styles.contactAvatarText}>
                            {initialsFor(contact.name)}
                          </StyledText>
                        </View>

                        <View style={styles.contactMain}>
                          <StyledText style={styles.contactName}>{contact.name}</StyledText>
                          {!!contact.email_lc && (
                            <StyledText style={styles.contactMeta}>{contact.email_lc}</StyledText>
                          )}
                          {!!contact.phone_e164 && (
                            <StyledText style={styles.contactMeta}>{contact.phone_e164}</StyledText>
                          )}
                        </View>

                        <Ionicons
                          name={isSelected ? 'checkbox' : 'square-outline'}
                          size={22}
                          color={isSelected ? COLORS.primary : '#b0b7c3'}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          </SafeAreaView>
        </Modal>

        <Modal
          visible={manageCircleVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={closeManageCircle}
        >
          <SafeAreaView style={styles.modalWrap}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={closeManageCircle}>
                <StyledText style={styles.modalHeaderAction}>Close</StyledText>
              </TouchableOpacity>

              <StyledText style={styles.modalTitle}>
                {manageMode === 'create' ? 'New Circle' : 'Manage Circle'}
              </StyledText>

              <View style={styles.headerSpacer} />
            </View>

            <ScrollView contentContainerStyle={styles.manageContent}>
              <View style={styles.manageCard}>
                <StyledText style={styles.manageLabel}>
                  {manageMode === 'create' ? 'Circle name' : 'Rename circle'}
                </StyledText>
                <TextInput
                  value={circleNameValue}
                  onChangeText={setCircleNameValue}
                  placeholder="Besties, Book Club, Work Crew"
                  placeholderTextColor={COLORS.textMuted}
                  style={styles.manageInput}
                />

                <TouchableOpacity
                  style={[styles.primaryButton, circleSaving && styles.buttonDisabled]}
                  onPress={manageMode === 'create' ? handleCreateCircle : handleRenameCircle}
                  disabled={circleSaving}
                >
                  <StyledText style={styles.primaryButtonText}>
                    {manageMode === 'create' ? 'Create circle' : 'Save name'}
                  </StyledText>
                </TouchableOpacity>
              </View>

              {manageMode === 'edit' && activeCircle && (
                <>
                  <View style={styles.manageCard}>
                    <View style={styles.manageCardHeaderRow}>
                      <StyledText style={styles.manageLabel}>Members</StyledText>
                      <StyledText style={styles.manageMetaCount}>
                        {activeCircle.members.length}
                      </StyledText>
                    </View>

                    {activeCircle.members.length === 0 ? (
                      <StyledText style={styles.emptyText}>No members in this circle yet.</StyledText>
                    ) : (
                      activeCircle.members.map((member) => (
                        <View key={member.id} style={styles.memberRow}>
                          <View style={styles.memberAvatar}>
                            <StyledText style={styles.memberAvatarText}>
                              {initialsFor(
                                member.member_name ||
                                  member.member_email_lc ||
                                  member.member_phone_e164,
                              )}
                            </StyledText>
                          </View>

                          <View style={styles.memberTextWrap}>
                            <StyledText style={styles.memberName}>
                              {member.member_name ||
                                member.member_email_lc ||
                                member.member_phone_e164 ||
                                'Unnamed member'}
                            </StyledText>

                            {!!member.member_email_lc && (
                              <StyledText style={styles.memberMeta}>
                                {member.member_email_lc}
                              </StyledText>
                            )}

                            {!!member.member_phone_e164 && (
                              <StyledText style={styles.memberMeta}>
                                {member.member_phone_e164}
                              </StyledText>
                            )}
                          </View>

                          <TouchableOpacity
                            style={styles.memberRemoveButton}
                            onPress={() => handleRemoveCircleMember(member)}
                          >
                            <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                          </TouchableOpacity>
                        </View>
                      ))
                    )}
                  </View>

                  <View style={styles.manageCard}>
                    <StyledText style={styles.manageLabel}>Add member</StyledText>

                    <TouchableOpacity
                      style={styles.secondaryButtonFull}
                      onPress={openUploadedContactsPicker}
                    >
                      <StyledText style={styles.secondaryButtonText}>
                        Add from uploaded contacts
                      </StyledText>
                    </TouchableOpacity>

                    <TextInput
                      value={newMemberName}
                      onChangeText={setNewMemberName}
                      placeholder="Name"
                      placeholderTextColor={COLORS.textMuted}
                      style={styles.manageInput}
                    />
                    <TextInput
                      value={newMemberEmail}
                      onChangeText={setNewMemberEmail}
                      placeholder="Email"
                      placeholderTextColor={COLORS.textMuted}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      style={styles.manageInput}
                    />
                    <TextInput
                      value={newMemberPhone}
                      onChangeText={setNewMemberPhone}
                      placeholder="Phone"
                      placeholderTextColor={COLORS.textMuted}
                      keyboardType="phone-pad"
                      style={styles.manageInput}
                    />

                    <TouchableOpacity
                      style={[styles.primaryButton, circleSaving && styles.buttonDisabled]}
                      onPress={handleAddMemberToCircle}
                      disabled={circleSaving}
                    >
                      <StyledText style={styles.primaryButtonText}>Add manually</StyledText>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.manageCard}>
                    <TouchableOpacity
                      style={styles.primaryButton}
                      onPress={() => {
                        toggleCircle(activeCircle.id);
                        closeManageCircle();
                      }}
                    >
                      <StyledText style={styles.primaryButtonText}>Use this circle</StyledText>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.secondaryDangerButtonFull}
                      onPress={() => handleDeleteCircle(activeCircle)}
                    >
                      <StyledText style={styles.secondaryDangerButtonText}>Delete circle</StyledText>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>
          </SafeAreaView>
        </Modal>

        <Modal
          visible={uploadedContactPickerVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setUploadedContactPickerVisible(false)}
        >
          <SafeAreaView style={styles.modalWrap}>
            <View style={styles.modalHeader}>
                            <TouchableOpacity
                onPress={() => {
                  setUploadedContactPickerVisible(false);
                  if (returnToManageCircleAfterContacts) {
                    setManageCircleVisible(true);
                  }
                }}
              >
                <StyledText style={styles.modalHeaderAction}>Back</StyledText>
              </TouchableOpacity>
              <StyledText style={styles.modalTitle}>Add from uploaded contacts</StyledText>

              <TouchableOpacity
                onPress={handleAddUploadedContactsToCircle}
                disabled={circleSaving || !selectedUploadedContactIds.length}
              >
                <StyledText
                  style={[
                    styles.modalHeaderAction,
                    (!selectedUploadedContactIds.length || circleSaving) &&
                      styles.headerActionDisabled,
                  ]}
                >
                  Add
                </StyledText>
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <View style={styles.searchWrapModal}>
                <Ionicons name="search" size={18} color={COLORS.textMuted} />
                <TextInput
                  value={uploadedContactsSearch}
                  onChangeText={setUploadedContactsSearch}
                  placeholder="Search uploaded contacts"
                  placeholderTextColor={COLORS.textMuted}
                  style={styles.searchInput}
                />
              </View>

              <StyledText style={styles.modalSummary}>
                {selectedUploadedContactIds.length} selected
              </StyledText>

              {uploadedContactsLoading ? (
                <View style={styles.stateWrap}>
                  <ActivityIndicator color={COLORS.primary} />
                </View>
              ) : (
                <ScrollView contentContainerStyle={styles.modalListContent}>
                  {filteredUploadedContacts.map((contact) => {
                    const isSelected = selectedUploadedContactIds.includes(contact.id || '');
                    const name =
                      contact.display_name?.trim() ||
                      contact.name?.trim() ||
                      contact.email_lc ||
                      contact.phone_e164 ||
                      'Contact';

                    return (
                      <TouchableOpacity
                        key={contact.id || name}
                        style={styles.contactRow}
                        onPress={() => toggleUploadedContact(contact.id || '')}
                      >
                        <View style={styles.contactAvatar}>
                          <StyledText style={styles.contactAvatarText}>
                            {initialsFor(name)}
                          </StyledText>
                        </View>

                        <View style={styles.contactMain}>
                          <StyledText style={styles.contactName}>{name}</StyledText>
                          {!!contact.email_lc && (
                            <StyledText style={styles.contactMeta}>{contact.email_lc}</StyledText>
                          )}
                          {!!contact.phone_e164 && (
                            <StyledText style={styles.contactMeta}>{contact.phone_e164}</StyledText>
                          )}
                        </View>

                        <Ionicons
                          name={isSelected ? 'checkbox' : 'square-outline'}
                          size={22}
                          color={isSelected ? COLORS.primary : '#b0b7c3'}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          </SafeAreaView>
        </Modal>

        <Modal
          visible={manualAddVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setManualAddVisible(false)}
        >
          <Pressable style={styles.overlayCenter} onPress={() => setManualAddVisible(false)}>
            <Pressable style={styles.manualModalCard} onPress={() => null}>
              <StyledText style={styles.manualModalTitle}>Add someone</StyledText>

              <TextInput
                value={manualName}
                onChangeText={setManualName}
                placeholder="Name"
                placeholderTextColor={COLORS.textMuted}
                style={styles.manageInput}
              />
              <TextInput
                value={manualEmail}
                onChangeText={setManualEmail}
                placeholder="Email"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.manageInput}
              />
              <TextInput
                value={manualPhone}
                onChangeText={setManualPhone}
                placeholder="Phone"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="phone-pad"
                style={styles.manageInput}
              />

              <TouchableOpacity style={styles.primaryButton} onPress={handleAddManualSelection}>
                <StyledText style={styles.primaryButtonText}>Add to invite</StyledText>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal
          visible={confirmVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setConfirmVisible(false)}
        >
          <Pressable style={styles.overlayCenter} onPress={() => setConfirmVisible(false)}>
            <Pressable style={styles.confirmCard} onPress={() => null}>
              <StyledText style={styles.confirmTitle}>Send Invitations</StyledText>

              <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
                {allSelectedPeople.map((person) => (
                  <View key={`${person.key}-${person.selection_id}`} style={styles.confirmRow}>
                    <Image
                      source={{ uri: avatarFor(person.name, person.avatar_url) }}
                      style={styles.confirmAvatar}
                    />
                    <View style={{ flex: 1 }}>
                      <StyledText style={styles.confirmName}>{person.name}</StyledText>
                      <StyledText style={styles.confirmMeta}>
                        {person.email_lc || person.phone_e164 || 'No contact info'}
                      </StyledText>
                    </View>
                  </View>
                ))}
              </ScrollView>

              <TouchableOpacity
                style={[styles.confirmButton, sending && styles.buttonDisabled]}
                onPress={handleSendInvites}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <StyledText style={styles.confirmButtonText}>Send Invites</StyledText>
                )}
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  wrapper: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    minHeight: 68,
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerIcon: {
    width: 36,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 36,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.text,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 180,
  },
  sectionBlock: {
    marginBottom: 14,
  },
  sectionHeaderRow: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: COLORS.text,
  },
  syncPill: {
    height: 34,
    borderRadius: 17,
    paddingHorizontal: 12,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: '#d8e5cc',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  syncPillText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary,
  },
  circlesList: {
    paddingRight: 8,
  },
  newCircleCard: {
    width: 170,
    minHeight: 164,
    borderRadius: 24,
    padding: 16,
    marginRight: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: '#d8e5cc',
    justifyContent: 'space-between',
  },
  newCircleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newCircleTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.text,
  },
  newCircleMeta: {
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.textMuted,
  },
  circleCard: {
    width: 192,
    minHeight: 164,
    borderRadius: 24,
    padding: 16,
    marginRight: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: '#e5daf1',
    justifyContent: 'space-between',
  },
  circleCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#f7fbf3',
  },
  circleCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 42,
  },
  avatarStackItem: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.secondaryBg,
    borderWidth: 2,
    borderColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarStackText: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.secondary,
  },
  circleMenuButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f5f7f3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleCardTitle: {
    marginTop: 14,
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.text,
  },
  circleCardMeta: {
    marginTop: 4,
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '700',
  },
  circleSelectedBadge: {
    marginTop: 14,
    alignSelf: 'flex-start',
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 10,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  circleSelectedBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  circleActionHint: {
    marginTop: 14,
    fontSize: 12,
    color: COLORS.secondary,
    fontWeight: '800',
  },
  selectedRowBlock: {
    marginBottom: 12,
  },
  selectedRow: {
    paddingRight: 8,
  },
  selectedPill: {
    height: 38,
    borderRadius: 19,
    paddingHorizontal: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 8,
  },
  selectedPillAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.secondaryBg,
  },
  selectedPillText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
  },
  searchWrap: {
    marginBottom: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    paddingHorizontal: 14,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  searchWrapModal: {
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
  sectionCard: {
    marginBottom: 14,
    borderRadius: 24,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    paddingVertical: 16,
  },
  sectionCardHeader: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  recentList: {
    paddingHorizontal: 16,
    paddingBottom: 2,
  },
  recentCard: {
    width: 96,
    borderRadius: 18,
    padding: 12,
    marginRight: 10,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    alignItems: 'center',
    gap: 8,
  },
  recentCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#f7fbf3',
  },
  recentAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.secondaryBg,
  },
  recentName: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
  },
  manualRowCard: {
    marginBottom: 14,
    borderRadius: 22,
    padding: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  manualRowTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.text,
  },
  manualRowMeta: {
    marginTop: 4,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  manualRowButton: {
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  manualRowButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  peopleGrid: {
    paddingHorizontal: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  personTile: {
    width: '50%',
    padding: 8,
  },
  personTileSelected: {},
  personTileCheck: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 2,
  },
  personTileAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.secondaryBg,
    marginBottom: 10,
  },
  personTileName: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.text,
    marginBottom: 4,
  },
  personTileMeta: {
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.textMuted,
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
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
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
    fontSize: 17,
    fontWeight: '900',
  },
  overlayScrim: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
  },
  sheetHandle: {
    width: 46,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#d9dfd3',
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.text,
    marginBottom: 14,
  },
  sheetAction: {
    minHeight: 66,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sheetActionGhost: {
    backgroundColor: COLORS.surface,
  },
  sheetActionTextWrap: {
    flex: 1,
  },
  sheetActionTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.text,
  },
  sheetActionMeta: {
    marginTop: 2,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  modalWrap: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalHeaderAction: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.primary,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.text,
  },
  headerActionDisabled: {
    opacity: 0.35,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  modalSummary: {
    marginBottom: 10,
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textMuted,
  },
  modalListContent: {
    paddingBottom: 24,
  },
  stateWrap: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactRow: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  contactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.secondaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactAvatarText: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.secondary,
  },
  contactMain: {
    flex: 1,
    minWidth: 0,
  },
  contactName: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.text,
  },
  contactMeta: {
    marginTop: 2,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  manageContent: {
    paddingHorizontal: 20,
    paddingBottom: 36,
  },
  manageCard: {
    marginBottom: 14,
    padding: 16,
    borderRadius: 22,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  manageLabel: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.text,
    marginBottom: 10,
  },
  manageInput: {
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
    backgroundColor: COLORS.surfaceAlt,
    marginBottom: 10,
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    marginTop: 2,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 15,
  },
  secondaryButtonFull: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    marginTop: 10,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  secondaryDangerButtonFull: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#efc9c9',
    backgroundColor: COLORS.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    marginTop: 10,
  },
  secondaryDangerButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.danger,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  manageCardHeaderRow: {
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  manageMetaCount: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textMuted,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSoft,
  },
  memberAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.secondaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.secondary,
  },
  memberTextWrap: {
    flex: 1,
    paddingRight: 10,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  memberMeta: {
    marginTop: 2,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  memberRemoveButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.dangerBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualModalCard: {
    width: '88%',
    maxWidth: 420,
    borderRadius: 24,
    padding: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  manualModalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.text,
    marginBottom: 14,
  },
  overlayCenter: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  confirmCard: {
    width: '90%',
    maxWidth: 440,
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
    marginBottom: 16,
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  confirmAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.secondaryBg,
  },
  confirmName: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  confirmMeta: {
    marginTop: 2,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  confirmButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textMuted,
    lineHeight: 20,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
});