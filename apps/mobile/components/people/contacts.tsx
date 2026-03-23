/**
 * Path: apps/mobile/components/people/contacts.tsx
 * Description: Utility Contacts tab for uploading, reviewing, selecting,
 * deleting, and adding uploaded contacts to circles.
 */

import React, { useEffect, useMemo, useState } from 'react';
import * as Contacts from 'expo-contacts';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StyledText } from '@pallinky/ui';
import { supabase } from '@pallinky/core';

type DeviceContactRow = {
  id: string;
  display_name: string | null;
  phone_e164: string | null;
  email_lc: string | null;
  device_contact_id: string | null;
  avatar_uri?: string | null;
  matched_user_id: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type CircleRow = {
  id: string;
  circle_name: string;
};

const COLORS = {
  background: '#F6F7F9',
  surface: '#FFFFFF',
  text: '#1f2a1b',
  textMuted: '#66715f',
  primary: '#43691b',
  secondary: '#6A4C93',
  secondaryBg: '#efe9f7',
  border: '#eef2ea',
  borderStrong: '#bac9ad',
  danger: '#e63946',
  dangerBorder: '#ffd6d6',
  iconBg: '#f1f3eb',
  overlay: 'rgba(31, 42, 27, 0.28)',
};

function normalizeEmail(value: string | null | undefined) {
  return value?.toLowerCase().trim() || '';
}

function normalizePhone(value: string | null | undefined) {
  if (!value) return '';
  return value.trim().replace(/[\s\-()]/g, '');
}

function firstUsableEmail(
  emails:
    | {
        email?: string | null;
      }[]
    | null
    | undefined
) {
  for (const item of emails || []) {
    const email = normalizeEmail(item?.email);
    if (email) return email;
  }
  return '';
}

function firstUsablePhone(
  phoneNumbers:
    | {
        number?: string | null;
      }[]
    | null
    | undefined
) {
  for (const item of phoneNumbers || []) {
    const phone = normalizePhone(item?.number);
    if (phone) return phone;
  }
  return '';
}

function fallbackName(contact: Pick<DeviceContactRow, 'display_name' | 'email_lc' | 'phone_e164'>) {
  if (contact.display_name?.trim()) return contact.display_name.trim();

  const email = normalizeEmail(contact.email_lc);
  if (email) {
    return email.split('@')[0].split(/[._-]+/)[0] || email;
  }

  const phone = normalizePhone(contact.phone_e164);
  if (phone) {
    const tail = phone.slice(-4);
    return tail ? `Contact ${tail}` : 'Contact';
  }

  return 'Contact';
}

export default function ContactsTab() {
  const [loading, setLoading] = useState(true);
  const [uploadingContacts, setUploadingContacts] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [addingToCircle, setAddingToCircle] = useState(false);
  const [creatingCircle, setCreatingCircle] = useState(false);

  const [contactPermissionStatus, setContactPermissionStatus] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [contacts, setContacts] = useState<DeviceContactRow[]>([]);
  const [circles, setCircles] = useState<CircleRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [circleModalVisible, setCircleModalVisible] = useState(false);
  const [newCircleName, setNewCircleName] = useState('');

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
      const [
        deviceContactsRes,
        {
          data: { session },
        },
      ] = await Promise.all([
        supabase.rpc('get_my_device_contacts'),
        supabase.auth.getSession(),
      ]);

      const userId = session?.user?.id;
      if (!userId) {
        throw new Error('You must be signed in to use Contacts.');
      }

      if (deviceContactsRes.error) throw deviceContactsRes.error;

      const circleRes = await supabase
        .from('social_circles')
        .select('id, circle_name')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (circleRes.error) throw circleRes.error;

      const deviceContacts = ((deviceContactsRes.data as DeviceContactRow[]) || []).filter(
        (contact) => Boolean(contact?.id) && Boolean(contact.email_lc || contact.phone_e164)
      );

      setContacts(deviceContacts);
      setCircles((circleRes.data as CircleRow[]) || []);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not load contacts.');
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

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Emails, Contacts.Fields.PhoneNumbers],
      });

      const meaningfulContacts = (data || []).filter((contact) => {
        const firstEmail = firstUsableEmail(contact.emails);
        const firstPhone = firstUsablePhone(contact.phoneNumbers);
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
        const firstEmail = firstUsableEmail(contact.emails) || null;
        const firstPhone = firstUsablePhone(contact.phoneNumbers) || null;

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
          (existing.phone_e164 ? 2 : 0);

        const nextScore =
          (nextRow.display_name ? 1 : 0) +
          (nextRow.email_lc ? 2 : 0) +
          (nextRow.phone_e164 ? 2 : 0);

        if (nextScore > existingScore) {
          dedupedByIdentity.set(dedupeKey, nextRow);
          continue;
        }

        dedupedByIdentity.set(dedupeKey, {
          display_name: existing.display_name || nextRow.display_name,
          email_lc: existing.email_lc || nextRow.email_lc,
          phone_e164: existing.phone_e164 || nextRow.phone_e164,
          device_contact_id: existing.device_contact_id || nextRow.device_contact_id,
          avatar_uri: null,
        });
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

  function toggleSelect(contactId: string) {
    setSelectedIds((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
        : [...prev, contactId]
    );
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;

    return contacts.filter((contact) => {
      const name = fallbackName(contact).toLowerCase();
      const email = (contact.email_lc || '').toLowerCase();
      const phone = (contact.phone_e164 || '').toLowerCase();

      return name.includes(q) || email.includes(q) || phone.includes(q);
    });
  }, [contacts, search]);

  const selectedContacts = useMemo(() => {
    const selectedSet = new Set(selectedIds);
    return contacts.filter((contact) => selectedSet.has(contact.id));
  }, [contacts, selectedIds]);

  const matchedCount = useMemo(
    () => contacts.filter((contact) => Boolean(contact.matched_user_id)).length,
    [contacts]
  );

  const visibleSelectedCount = useMemo(() => {
    const selectedSet = new Set(selectedIds);
    return filteredContacts.filter((contact) => selectedSet.has(contact.id)).length;
  }, [filteredContacts, selectedIds]);

  const allVisibleSelected =
    filteredContacts.length > 0 && visibleSelectedCount === filteredContacts.length;

  const uploadButtonLabel = useMemo(() => {
    if (contactPermissionStatus === 'limited') return 'Add More Contacts';
    if (contactPermissionStatus === 'granted') return 'Sync Contacts';
    return 'Upload Contacts';
  }, [contactPermissionStatus]);

  function handleToggleSelectAllVisible() {
    const visibleIds = filteredContacts.map((contact) => contact.id);
    if (visibleIds.length === 0) return;

    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
      return;
    }

    setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
  }

  async function handleDeleteSelected() {
    if (selectedContacts.length === 0) {
      Alert.alert('No contacts selected', 'Select at least one contact to delete.');
      return;
    }

    Alert.alert(
      'Delete selected contacts',
      `Delete ${selectedContacts.length} selected ${selectedContacts.length === 1 ? 'contact' : 'contacts'} from your uploaded contacts?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);

            try {
              const ids = selectedContacts.map((contact) => contact.id);

              const { error } = await supabase.from('device_contacts').delete().in('id', ids);

              if (error) throw error;

              setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
              await fetchData();
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Could not delete selected contacts.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  }

  async function handleAddSelectedToCircle(circleId: string) {
    if (selectedContacts.length === 0) {
      Alert.alert('No contacts selected', 'Select at least one contact first.');
      return;
    }

    setAddingToCircle(true);

    try {
      const ids = selectedContacts.map((contact) => contact.id);

      const { data, error } = await supabase.rpc('add_device_contacts_to_circle', {
        p_circle_id: circleId,
        p_contact_ids: ids,
      });

      if (error) throw error;

      setCircleModalVisible(false);
      setNewCircleName('');
      Alert.alert(
        'Added to circle',
        `${Number(data || 0)} ${Number(data || 0) === 1 ? 'contact was' : 'contacts were'} added.`
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not add contacts to circle.');
    } finally {
      setAddingToCircle(false);
    }
  }

  async function handleCreateCircleAndAdd() {
    const circleName = newCircleName.trim();

    if (!circleName) {
      Alert.alert('Circle name required', 'Enter a name for the new circle.');
      return;
    }

    if (selectedContacts.length === 0) {
      Alert.alert('No contacts selected', 'Select at least one contact first.');
      return;
    }

    setCreatingCircle(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const userId = session?.user?.id;
      if (!userId) {
        throw new Error('You must be signed in.');
      }

      const { data: insertedCircle, error: createError } = await supabase
        .from('social_circles')
        .insert({
          user_id: userId,
          circle_name: circleName,
          members: [],
        })
        .select('id, circle_name')
        .single();

      if (createError) throw createError;

      const newCircle = insertedCircle as CircleRow;

      setCircles((prev) => [newCircle, ...prev]);
      await handleAddSelectedToCircle(newCircle.id);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not create circle.');
    } finally {
      setCreatingCircle(false);
    }
  }

  useEffect(() => {
    void fetchData();
    void loadContactPermissionStatus();
  }, []);

  const renderContactRow = ({ item }: { item: DeviceContactRow }) => {
    const isSelected = selectedIds.includes(item.id);
    const name = fallbackName(item);
    const isMatched = Boolean(item.matched_user_id);

    return (
      <TouchableOpacity style={styles.contactRow} onPress={() => toggleSelect(item.id)}>
        <View style={styles.contactMain}>
          <View style={styles.contactHeaderRow}>
            <StyledText style={styles.contactName}>{name}</StyledText>
            {isMatched && (
              <View style={styles.matchBadge}>
                <StyledText style={styles.matchBadgeText}>On Pallinky</StyledText>
              </View>
            )}
          </View>

          {!!item.email_lc && <StyledText style={styles.contactMeta}>{item.email_lc}</StyledText>}
          {!!item.phone_e164 && (
            <StyledText style={styles.contactMeta}>{item.phone_e164}</StyledText>
          )}
        </View>

        <Ionicons
          name={isSelected ? 'checkbox' : 'square-outline'}
          size={22}
          color={isSelected ? COLORS.primary : COLORS.borderStrong}
        />
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.wrap}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <View style={styles.topSection}>
  <StyledText style={styles.summaryInlineText}>
    {contacts.length} uploaded • {matchedCount} on Pallinky
  </StyledText>
</View>

      <View style={styles.controlsBlock}>
        <TouchableOpacity
          style={[styles.primaryButton, uploadingContacts && styles.buttonDisabled]}
          onPress={importDeviceContacts}
          disabled={uploadingContacts}
        >
          {uploadingContacts ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={16} color="#fff" />
              <StyledText style={styles.primaryButtonText}>{uploadButtonLabel}</StyledText>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={COLORS.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search name, email, or number..."
            placeholderTextColor={COLORS.textMuted}
            style={styles.searchInput}
            returnKeyType="search"
          />
        </View>

        <View style={styles.bulkRow}>
          <TouchableOpacity
            style={[
              styles.bulkGhostButton,
              selectedContacts.length === 0 && styles.bulkGhostButtonDisabled,
            ]}
            onPress={() => setCircleModalVisible(true)}
            disabled={selectedContacts.length === 0}
          >
            <StyledText style={styles.bulkGhostButtonText}>Add to Circle</StyledText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.bulkDangerButton,
              (selectedContacts.length === 0 || deleting) && styles.bulkGhostButtonDisabled,
            ]}
            onPress={handleDeleteSelected}
            disabled={selectedContacts.length === 0 || deleting}
          >
            {deleting ? (
              <ActivityIndicator color={COLORS.danger} />
            ) : (
              <StyledText style={styles.bulkDangerButtonText}>Delete from Pallinky</StyledText>
            )}
          </TouchableOpacity>

          {selectedContacts.length > 0 && (
            <TouchableOpacity onPress={clearSelection} style={styles.clearButton}>
              <StyledText style={styles.clearText}>Clear</StyledText>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={COLORS.primary} />
      ) : (
        <FlatList
          data={filteredContacts}
          keyExtractor={(item) => item.id}
          renderItem={renderContactRow}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
         ListHeaderComponent={
  filteredContacts.length > 0 ? (
    <View style={styles.listHeaderRow}>
      <View style={styles.listHeaderTextWrap} />
      <TouchableOpacity onPress={handleToggleSelectAllVisible} style={styles.listHeaderCheckbox}>
        <Ionicons
          name={allVisibleSelected ? 'checkbox' : 'square-outline'}
          size={24}
          color={allVisibleSelected ? COLORS.primary : COLORS.borderStrong}
        />
      </TouchableOpacity>
    </View>
  ) : null
}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={28} color={COLORS.textMuted} />
              <StyledText style={styles.emptyTitle}>No contacts uploaded</StyledText>
              <StyledText style={styles.emptyText}>
                Upload contacts to review, select, add to circles, or delete them.
              </StyledText>
            </View>
          }
        />
      )}

      <Modal
        visible={circleModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCircleModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalScrim}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <StyledText style={styles.modalTitle}>Add to Circle</StyledText>
              <TouchableOpacity onPress={() => setCircleModalVisible(false)}>
                <Ionicons name="close" size={22} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <StyledText style={styles.modalSubtitle}>
              Add {selectedContacts.length} selected {selectedContacts.length === 1 ? 'contact' : 'contacts'}.
            </StyledText>

            <View style={styles.createCircleCard}>
              <StyledText style={styles.createCircleLabel}>Create new circle</StyledText>
              <TextInput
                value={newCircleName}
                onChangeText={setNewCircleName}
                placeholder="Circle name"
                placeholderTextColor={COLORS.textMuted}
                style={styles.createCircleInput}
              />
              <TouchableOpacity
                style={[
                  styles.createCircleButton,
                  (creatingCircle || addingToCircle) && styles.buttonDisabled,
                ]}
                onPress={handleCreateCircleAndAdd}
                disabled={creatingCircle || addingToCircle}
              >
                {creatingCircle ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <StyledText style={styles.createCircleButtonText}>
                    Create Circle + Add
                  </StyledText>
                )}
              </TouchableOpacity>
            </View>

            <StyledText style={styles.existingCirclesLabel}>Existing circles</StyledText>

            {circles.length === 0 ? (
              <View style={styles.emptyStateSmall}>
                <StyledText style={styles.emptyText}>No circles yet</StyledText>
              </View>
            ) : (
              <FlatList
                data={circles}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.circleRow}
                    onPress={() => handleAddSelectedToCircle(item.id)}
                    disabled={addingToCircle || creatingCircle}
                  >
                    <StyledText style={styles.circleName}>{item.circle_name}</StyledText>
                    <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
                  </TouchableOpacity>
                )}
                keyboardShouldPersistTaps="handled"
                style={styles.circlesList}
              />
            )}

            {(addingToCircle || creatingCircle) && (
              <ActivityIndicator style={styles.modalLoader} color={COLORS.primary} />
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  topSection: {
  paddingHorizontal: 20,
  paddingTop: 6,
  paddingBottom: 2,
  alignItems: 'center',
},
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.text,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  summaryInlineText: {
  marginTop: 2,
  fontSize: 12,
  color: COLORS.textMuted,
  fontWeight: '700',
  textAlign: 'center',
},

  controlsBlock: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 6,
  },
  primaryButton: {
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  searchWrap: {
    marginTop: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
  },
  bulkRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  bulkGhostButton: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    justifyContent: 'center',
  },
  bulkGhostButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
  },
  bulkGhostButtonDisabled: {
    opacity: 0.45,
  },
  bulkDangerButton: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#fff5f5',
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    justifyContent: 'center',
  },
  bulkDangerButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.danger,
  },
  clearButton: {
    height: 36,
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  clearText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.secondary,
  },
  loader: {
    marginTop: 48,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingTop: 2,
    paddingBottom: 8,
  },
  listHeaderTextWrap: {
  flex: 1,
},
  listHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textMuted,
  },
  listHeaderCount: {
    marginTop: 1,
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '700',
  },
  listHeaderCheckbox: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactRow: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  contactMain: {
    flex: 1,
    minWidth: 0,
  },
  contactHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  contactName: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  contactMeta: {
    marginTop: 2,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  matchBadge: {
    backgroundColor: COLORS.secondaryBg,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  matchBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.secondary,
  },
  emptyState: {
    marginTop: 30,
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 20,
    paddingVertical: 28,
    alignItems: 'center',
  },
  emptyStateSmall: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  emptyText: {
    marginTop: 6,
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  modalScrim: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    maxHeight: '82%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.text,
  },
  modalSubtitle: {
    marginTop: 6,
    marginBottom: 14,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  createCircleCard: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    marginBottom: 14,
  },
  createCircleLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 8,
  },
  createCircleInput: {
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    color: COLORS.text,
    fontSize: 14,
  },
  createCircleButton: {
    marginTop: 10,
    height: 42,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createCircleButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  existingCirclesLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textMuted,
    marginBottom: 10,
  },
  circlesList: {
    maxHeight: 240,
  },
  circleRow: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    marginBottom: 10,
    backgroundColor: COLORS.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  circleName: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  modalLoader: {
    marginTop: 8,
  },
});