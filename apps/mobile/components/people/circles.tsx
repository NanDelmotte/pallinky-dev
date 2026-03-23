/**
 * Path: apps/mobile/components/people/circles.tsx
 * Description: Clean circles management tab.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { supabase } from '@pallinky/core';
import { StyledText } from '@pallinky/ui';

type CircleRow = {
  id: string;
  circle_name: string;
  created_at?: string | null;
};

type CircleMemberRow = {
  id: string;
  circle_id: string;
  member_name: string | null;
  member_email_lc: string | null;
  member_phone_e164: string | null;
  sort_order: number | null;
  created_at?: string | null;
};

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

function fallbackName(
  item: Pick<DeviceContactRow, 'display_name' | 'email_lc' | 'phone_e164'>,
) {
  if (item.display_name?.trim()) return item.display_name.trim();
  if (item.email_lc?.trim()) return item.email_lc.trim().split('@')[0] || item.email_lc.trim();
  if (item.phone_e164?.trim()) return item.phone_e164.trim();
  return 'Contact';
}

export default function CirclesTab() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [circles, setCircles] = useState<CircleRow[]>([]);
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});

  const [newCircleName, setNewCircleName] = useState('');

  const [activeCircle, setActiveCircle] = useState<CircleRow | null>(null);
  const [manageVisible, setManageVisible] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [members, setMembers] = useState<CircleMemberRow[]>([]);

  const [renameValue, setRenameValue] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('');

  const [contactPickerVisible, setContactPickerVisible] = useState(false);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsSearch, setContactsSearch] = useState('');
  const [deviceContacts, setDeviceContacts] = useState<DeviceContactRow[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);

  const sortedCircles = useMemo(
    () =>
      [...circles].sort((a, b) =>
        (a.circle_name || '').localeCompare(b.circle_name || '', undefined, {
          sensitivity: 'base',
        }),
      ),
    [circles],
  );

  const filteredDeviceContacts = useMemo(() => {
    const q = contactsSearch.trim().toLowerCase();
    if (!q) return deviceContacts;

    return deviceContacts.filter((contact) => {
      const name = fallbackName(contact).toLowerCase();
      const email = (contact.email_lc || '').toLowerCase();
      const phone = (contact.phone_e164 || '').toLowerCase();
      return name.includes(q) || email.includes(q) || phone.includes(q);
    });
  }, [contactsSearch, deviceContacts]);

  const loadCircles = useCallback(async () => {
    setLoading(true);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setCircles([]);
      setMemberCounts({});
      setLoading(false);
      return;
    }

    const { data: circleRows, error: circlesError } = await supabase
      .from('social_circles')
      .select('id, circle_name, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (circlesError) {
      console.error('[circles] load circles error', circlesError);
      Alert.alert('Could not load circles');
      setCircles([]);
      setMemberCounts({});
      setLoading(false);
      return;
    }

    const nextCircles = (circleRows ?? []) as CircleRow[];
    setCircles(nextCircles);

    if (!nextCircles.length) {
      setMemberCounts({});
      setLoading(false);
      return;
    }

    const circleIds = nextCircles.map((circle) => circle.id);

    const { data: memberRows, error: membersError } = await supabase
      .from('social_circle_members')
      .select('id, circle_id')
      .in('circle_id', circleIds);

    if (membersError) {
      console.error('[circles] load member counts error', membersError);
      setMemberCounts({});
      setLoading(false);
      return;
    }

    const counts: Record<string, number> = {};
    for (const circle of nextCircles) counts[circle.id] = 0;
    for (const row of memberRows ?? []) {
      const circleId = row.circle_id as string;
      counts[circleId] = (counts[circleId] ?? 0) + 1;
    }

    setMemberCounts(counts);
    setLoading(false);
  }, []);

  const loadMembers = useCallback(async (circle: CircleRow) => {
    setMembersLoading(true);

    const { data, error } = await supabase
      .from('social_circle_members')
      .select(
        'id, circle_id, member_name, member_email_lc, member_phone_e164, sort_order, created_at',
      )
      .eq('circle_id', circle.id)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[circles] load members error', error);
      Alert.alert('Could not load members');
      setMembers([]);
      setMembersLoading(false);
      return;
    }

    setMembers((data ?? []) as CircleMemberRow[]);
    setMembersLoading(false);
  }, []);

  const loadDeviceContacts = useCallback(async () => {
    setContactsLoading(true);

    const { data, error } = await supabase.rpc('get_my_device_contacts');

    if (error) {
      console.error('[circles] load device contacts error', error);
      Alert.alert('Could not load contacts');
      setDeviceContacts([]);
      setContactsLoading(false);
      return;
    }

    const rows = ((data as DeviceContactRow[]) || []).filter(
      (contact) => Boolean(contact?.id) && Boolean(contact.email_lc || contact.phone_e164),
    );

    setDeviceContacts(rows);
    setContactsLoading(false);
  }, []);

  useEffect(() => {
    loadCircles();
  }, [loadCircles]);

  const handleCreateCircle = useCallback(async () => {
    const name = newCircleName.trim();
    if (!name) {
      Alert.alert('Enter a circle name');
      return;
    }

    setSaving(true);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setSaving(false);
      Alert.alert('You need to be signed in');
      return;
    }

    const { error } = await supabase.from('social_circles').insert({
      user_id: user.id,
      circle_name: name,
      members: [],
    });

    setSaving(false);

    if (error) {
      console.error('[circles] create circle error', error);
      Alert.alert('Could not create circle');
      return;
    }

    setNewCircleName('');
    loadCircles();
  }, [loadCircles, newCircleName]);

  const openManageCircle = useCallback(
    async (circle: CircleRow) => {
      setActiveCircle(circle);
      setRenameValue(circle.circle_name ?? '');
      setNewMemberName('');
      setNewMemberEmail('');
      setNewMemberPhone('');
      setManageVisible(true);
      await loadMembers(circle);
    },
    [loadMembers],
  );

  const closeManageCircle = useCallback(() => {
    setManageVisible(false);
    setActiveCircle(null);
    setMembers([]);
    setRenameValue('');
    setNewMemberName('');
    setNewMemberEmail('');
    setNewMemberPhone('');
  }, []);

  const handleRenameCircle = useCallback(async () => {
    if (!activeCircle) return;

    const nextName = renameValue.trim();
    if (!nextName) {
      Alert.alert('Enter a circle name');
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from('social_circles')
      .update({ circle_name: nextName })
      .eq('id', activeCircle.id);

    setSaving(false);

    if (error) {
      console.error('[circles] rename circle error', error);
      Alert.alert('Could not rename circle');
      return;
    }

    const nextCircle = { ...activeCircle, circle_name: nextName };
    setActiveCircle(nextCircle);
    setCircles((prev) =>
      prev.map((circle) => (circle.id === nextCircle.id ? nextCircle : circle)),
    );
  }, [activeCircle, renameValue]);

  const handleDeleteCircle = useCallback(
    (circle: CircleRow) => {
      Alert.alert('Delete circle', `Delete "${circle.circle_name}" and all its members?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);

            const { error: membersError } = await supabase
              .from('social_circle_members')
              .delete()
              .eq('circle_id', circle.id);

            if (membersError) {
              setSaving(false);
              console.error('[circles] delete circle members error', membersError);
              Alert.alert('Could not delete circle');
              return;
            }

            const { error: circleError } = await supabase
              .from('social_circles')
              .delete()
              .eq('id', circle.id);

            setSaving(false);

            if (circleError) {
              console.error('[circles] delete circle error', circleError);
              Alert.alert('Could not delete circle');
              return;
            }

            if (activeCircle?.id === circle.id) {
              closeManageCircle();
            }

            loadCircles();
          },
        },
      ]);
    },
    [activeCircle?.id, closeManageCircle, loadCircles],
  );

  const handleAddMember = useCallback(async () => {
  if (!activeCircle) return;

  const member_name = newMemberName.trim() || null;
  const member_email_lc = newMemberEmail.trim().toLowerCase() || null;
  const member_phone_e164 = newMemberPhone.trim() || null;

  if (!member_name && !member_email_lc && !member_phone_e164) {
    Alert.alert('Add at least a name, email, or phone');
    return;
  }

  setSaving(true);

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
      }
    );

    if (personError) throw personError;

    const nextSortOrder =
      members.reduce((max, item) => Math.max(max, item.sort_order ?? 0), 0) + 1;

    const { error } = await supabase.from('social_circle_members').insert({
      circle_id: activeCircle.id,
      member_name,
      member_email_lc,
      member_phone_e164,
      member_user_id,
      person_id: personId,
      sort_order: nextSortOrder,
    });

    if (error) throw error;

    setNewMemberName('');
    setNewMemberEmail('');
    setNewMemberPhone('');

    await loadMembers(activeCircle);
    loadCircles();
  } catch (error) {
    console.error('[circles] add member error', error);
    Alert.alert('Could not add member');
  } finally {
    setSaving(false);
  }
}, [
  activeCircle,
  loadCircles,
  loadMembers,
  members,
  newMemberEmail,
  newMemberName,
  newMemberPhone,
]);

  const handleRemoveMember = useCallback(
    (member: CircleMemberRow) => {
      Alert.alert(
        'Remove member',
        `Remove ${member.member_name || member.member_email_lc || member.member_phone_e164 || 'this member'} from the circle?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              setSaving(true);

              const { error } = await supabase
                .from('social_circle_members')
                .delete()
                .eq('id', member.id);

              setSaving(false);

              if (error) {
                console.error('[circles] remove member error', error);
                Alert.alert('Could not remove member');
                return;
              }

              if (activeCircle) {
                await loadMembers(activeCircle);
              }
              loadCircles();
            },
          },
        ],
      );
    },
    [activeCircle, loadCircles, loadMembers],
  );

  const handleInviteCircle = useCallback(
    (circle: CircleRow) => {
      router.push({
        pathname: '/create/formal',
        params: {
          circleId: circle.id,
          circleName: circle.circle_name,
        },
      });
    },
    [router],
  );

  const openContactPicker = useCallback(async () => {
  if (!activeCircle) return;

  setSelectedContactIds([]);
  setContactsSearch('');

  setManageVisible(false);
  setContactPickerVisible(true);

  await loadDeviceContacts();
}, [activeCircle, loadDeviceContacts]);

  const closeContactPicker = useCallback(() => {
  setContactPickerVisible(false);
  setSelectedContactIds([]);
  setContactsSearch('');
  setManageVisible(true);
}, []);

  const toggleContactSelect = useCallback((contactId: string) => {
    setSelectedContactIds((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
        : [...prev, contactId],
    );
  }, []);

  const handleAddSelectedContactsToCircle = useCallback(async () => {
    if (!activeCircle) return;

    if (!selectedContactIds.length) {
      Alert.alert('Select at least one contact');
      return;
    }

    setSaving(true);

    const { data, error } = await supabase.rpc('add_device_contacts_to_circle', {
      p_circle_id: activeCircle.id,
      p_contact_ids: selectedContactIds,
    });

    setSaving(false);

    if (error) {
      console.error('[circles] add selected contacts error', error);
      Alert.alert('Could not add contacts to circle');
      return;
    }

    closeContactPicker();
    await loadMembers(activeCircle);
    loadCircles();

    const count = Number(data || 0);
    Alert.alert(
      'Added to circle',
      `${count} ${count === 1 ? 'contact was' : 'contacts were'} added.`,
    );
  }, [activeCircle, closeContactPicker, loadCircles, loadMembers, selectedContactIds]);

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
      
        {loading ? <ActivityIndicator size="small" /> : null}
      </View>

            <View style={styles.createCard}>
        <StyledText style={styles.sectionTitle}>Create a circle</StyledText>
        <TextInput
          value={newCircleName}
          onChangeText={setNewCircleName}
          placeholder="Velvet Vixens, Book club, Work colleagues"
          placeholderTextColor="#7f8a7a"
          style={styles.input}
        />
        <TouchableOpacity
          style={[styles.primaryButton, saving && styles.buttonDisabled]}
          onPress={handleCreateCircle}
          disabled={saving}
        >
          <StyledText style={styles.primaryButtonText}>
            {saving ? 'Saving…' : 'Add circle'}
          </StyledText>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.stateWrap}>
          <ActivityIndicator />
        </View>
      ) : !sortedCircles.length ? (
        <View style={styles.emptyCard}>
          <Ionicons name="people-outline" size={28} color="#44513d" />
          <StyledText style={styles.emptyTitle}>No circles yet</StyledText>
          <StyledText style={styles.emptyText}>
            Create your first circle to group people for faster invites.
          </StyledText>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {sortedCircles.map((circle) => {
            const count = memberCounts[circle.id] ?? 0;

            return (
              <View key={circle.id} style={styles.circleCard}>
                <View style={styles.circleTopRow}>
                  <View style={styles.circleTitleWrap}>
                    <StyledText style={styles.circleName}>{circle.circle_name}</StyledText>
                    <StyledText style={styles.circleMeta}>
                      {count} {count === 1 ? 'member' : 'members'}
                    </StyledText>
                  </View>

                  <TouchableOpacity
                    style={styles.iconButton}
                    onPress={() => openManageCircle(circle)}
                  >
                    <Ionicons name="settings-outline" size={18} color="#1f2a1b" />
                  </TouchableOpacity>
                </View>

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => openManageCircle(circle)}
                  >
                    <StyledText style={styles.secondaryButtonText}>Edit members</StyledText>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => handleInviteCircle(circle)}
                  >
                    <StyledText style={styles.secondaryButtonText}>Invite this circle</StyledText>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryDangerButton}
                    onPress={() => handleDeleteCircle(circle)}
                  >
                    <StyledText style={styles.secondaryDangerButtonText}>Delete</StyledText>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      <Modal
        visible={manageVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeManageCircle}
      >
        <View style={styles.modalWrap}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeManageCircle}>
              <StyledText style={styles.modalHeaderAction}>Close</StyledText>
            </TouchableOpacity>
            <StyledText style={styles.modalTitle}>Manage circle</StyledText>
            <View style={styles.modalHeaderSpacer} />
          </View>

          <ScrollView
            contentContainerStyle={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.modalCard}>
              <StyledText style={styles.sectionTitle}>Rename</StyledText>
              <TextInput
                value={renameValue}
                onChangeText={setRenameValue}
                placeholder="Circle name"
                placeholderTextColor="#7f8a7a"
                style={styles.input}
              />
              <TouchableOpacity
                style={[styles.primaryButton, saving && styles.buttonDisabled]}
                onPress={handleRenameCircle}
                disabled={saving}
              >
                <StyledText style={styles.primaryButtonText}>Save name</StyledText>
              </TouchableOpacity>
            </View>

            <View style={styles.modalCard}>
              <StyledText style={styles.sectionTitle}>Add member manually</StyledText>

              <TextInput
                value={newMemberName}
                onChangeText={setNewMemberName}
                placeholder="Name"
                placeholderTextColor="#7f8a7a"
                style={styles.input}
              />
              <TextInput
                value={newMemberEmail}
                onChangeText={setNewMemberEmail}
                placeholder="Email"
                placeholderTextColor="#7f8a7a"
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.input}
              />
              <TextInput
                value={newMemberPhone}
                onChangeText={setNewMemberPhone}
                placeholder="Phone"
                placeholderTextColor="#7f8a7a"
                keyboardType="phone-pad"
                style={styles.input}
              />

              <TouchableOpacity
                style={[styles.primaryButton, saving && styles.buttonDisabled]}
                onPress={handleAddMember}
                disabled={saving}
              >
                <StyledText style={styles.primaryButtonText}>Add member</StyledText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryButtonFull, saving && styles.buttonDisabled]}
                onPress={() => {
  console.log('choose from contacts pressed');
  openContactPicker();
}}
                disabled={saving}
              >
                <StyledText style={styles.secondaryButtonText}>Choose from Contacts</StyledText>
              </TouchableOpacity>
            </View>

            <View style={styles.modalCard}>
              <StyledText style={styles.sectionTitle}>Members</StyledText>

              {membersLoading ? (
                <View style={styles.stateWrap}>
                  <ActivityIndicator />
                </View>
              ) : !members.length ? (
                <StyledText style={styles.emptyText}>
                  No members in this circle yet.
                </StyledText>
              ) : (
                members.map((member) => (
                  <View key={member.id} style={styles.memberRow}>
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
                      onPress={() => handleRemoveMember(member)}
                    >
                      <Ionicons name="trash-outline" size={18} color="#9d2f2f" />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>

            {activeCircle ? (
              <View style={styles.modalCard}>
                <StyledText style={styles.sectionTitle}>Use this circle</StyledText>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => handleInviteCircle(activeCircle)}
                >
                  <StyledText style={styles.primaryButtonText}>Invite this circle</StyledText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryDangerButtonFull}
                  onPress={() => handleDeleteCircle(activeCircle)}
                >
                  <StyledText style={styles.secondaryDangerButtonText}>Delete circle</StyledText>
                </TouchableOpacity>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={contactPickerVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeContactPicker}
      >
        <View style={styles.modalWrap}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeContactPicker}>
              <StyledText style={styles.modalHeaderAction}>Cancel</StyledText>
            </TouchableOpacity>
            <StyledText style={styles.modalTitle}>Choose from Contacts</StyledText>
            <TouchableOpacity
              onPress={handleAddSelectedContactsToCircle}
              disabled={saving || !selectedContactIds.length}
            >
              <StyledText
                style={[
                  styles.modalHeaderAction,
                  (!selectedContactIds.length || saving) && styles.headerActionDisabled,
                ]}
              >
                Add
              </StyledText>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <TextInput
              value={contactsSearch}
              onChangeText={setContactsSearch}
              placeholder="Search contacts"
              placeholderTextColor="#7f8a7a"
              style={styles.input}
            />

            <StyledText style={styles.contactsSummary}>
              {selectedContactIds.length} selected
            </StyledText>

            {contactsLoading ? (
              <View style={styles.stateWrap}>
                <ActivityIndicator />
              </View>
            ) : !filteredDeviceContacts.length ? (
              <View style={styles.emptyCard}>
                <Ionicons name="people-outline" size={28} color="#44513d" />
                <StyledText style={styles.emptyTitle}>No uploaded contacts</StyledText>
                <StyledText style={styles.emptyText}>
                  Upload contacts in the Contacts tab first, then come back here.
                </StyledText>
              </View>
            ) : (
              <ScrollView
                style={styles.contactsList}
                contentContainerStyle={styles.contactsListContent}
                showsVerticalScrollIndicator={false}
              >
                {filteredDeviceContacts.map((contact) => {
                  const isSelected = selectedContactIds.includes(contact.id);
                  const name = fallbackName(contact);

                  return (
                    <TouchableOpacity
                      key={contact.id}
                      style={styles.contactRow}
                      onPress={() => toggleContactSelect(contact.id)}
                    >
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
                        color={isSelected ? '#1f2a1b' : '#9aa58f'}
                      />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f7f4ec',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1f2a1b',
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 16,
    fontSize: 14,
    lineHeight: 20,
    color: '#44513d',
  },
  createCard: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#fffdf8',
    borderWidth: 1,
    borderColor: '#e7e1d2',
    marginBottom: 16,
  },
  modalCard: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#fffdf8',
    borderWidth: 1,
    borderColor: '#e7e1d2',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1f2a1b',
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d8d2c2',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: '#1f2a1b',
    backgroundColor: '#ffffff',
    marginBottom: 10,
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#1f2a1b',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    marginTop: 2,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
  secondaryButtonFull: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d8d2c2',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 24,
  },
  circleCard: {
    backgroundColor: '#fffdf8',
    borderWidth: 1,
    borderColor: '#e7e1d2',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  circleTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  circleTitleWrap: {
    flex: 1,
    paddingRight: 10,
  },
  circleName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1f2a1b',
  },
  circleMeta: {
    marginTop: 4,
    fontSize: 13,
    color: '#66725f',
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f1eddf',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  secondaryButton: {
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d8d2c2',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1f2a1b',
  },
  secondaryDangerButton: {
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#efc9c9',
    backgroundColor: '#fff7f7',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryDangerButtonFull: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#efc9c9',
    backgroundColor: '#fff7f7',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  secondaryDangerButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9d2f2f',
  },
  emptyCard: {
    marginTop: 24,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#fffdf8',
    borderWidth: 1,
    borderColor: '#e7e1d2',
    alignItems: 'center',
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '800',
    color: '#1f2a1b',
  },
  emptyText: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: '#66725f',
    textAlign: 'center',
  },
  stateWrap: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalWrap: {
    flex: 1,
    backgroundColor: '#f7f4ec',
  },
  modalHeader: {
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalHeaderAction: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2a1b',
  },
  headerActionDisabled: {
    opacity: 0.4,
  },
  modalHeaderSpacer: {
    width: 44,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1f2a1b',
  },
  modalContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#efe9da',
  },
  memberTextWrap: {
    flex: 1,
    paddingRight: 10,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2a1b',
  },
  memberMeta: {
    marginTop: 2,
    fontSize: 12,
    color: '#66725f',
  },
  memberRemoveButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#fff2f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactsSummary: {
    marginBottom: 10,
    fontSize: 13,
    fontWeight: '700',
    color: '#66725f',
  },
  contactsList: {
    flex: 1,
  },
  contactsListContent: {
    paddingBottom: 24,
  },
  contactRow: {
    backgroundColor: '#fffdf8',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e7e1d2',
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
  contactName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1f2a1b',
  },
  contactMeta: {
    marginTop: 2,
    fontSize: 12,
    color: '#66725f',
  },
});