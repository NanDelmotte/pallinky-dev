/**
 * Path: apps/mobile/app/create/formal-details.tsx
 * Description: Final details + submit step for the formal create flow.
 * Uses the shared formal draft and preserves the existing submit payload/logic.
 * Supports series creation by linking created events with a shared series_id.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, {
  DateTimePickerAndroid,
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';

import { createVibeDraft, supabase } from '@pallinky/core';
import { StyledInput, StyledText } from '@pallinky/ui';

import LocationSearch from '../../components/LocationSearch';
import {
  ForwardingMode,
  ReminderDays,
  useFormalDraft,
  VisibilityMode,
  VisibilityText,
} from './_formalDraft';

type VisibilityDraft = {
  invite_list_visibility: VisibilityText;
  guest_list_visibility: VisibilityText;
  send_rsvp_reminders: boolean;
  remind_after_days: ReminderDays;
  rsvp_deadline: string | null;
  send_final_reminder_at_deadline: boolean;
  forwarding_mode: ForwardingMode;
};

const COLORS = {
  background: '#F6F7F9',
  surface: '#FFFFFF',
  text: '#1f2a1b',
  textMuted: '#66715f',
  primary: '#43691b',
  border: '#bac9ad',
  borderSoft: '#e7ede2',
  secondaryBg: '#efe9f7',
  overlay: 'rgba(31, 42, 27, 0.35)',
};

const REMINDER_OPTIONS: ReminderDays[] = [1, 2, 3, 5, 7];

function toDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatDeadlineLabel(value: string | null) {
  if (!value) return 'Select date';

  const date = new Date(`${value}T12:00:00`);
  const month = date.toLocaleString('en-US', { month: 'short' });
  const day = date.getDate();
  const year = date.getFullYear();

  const suffix =
    day % 10 === 1 && day !== 11
      ? 'st'
      : day % 10 === 2 && day !== 12
      ? 'nd'
      : day % 10 === 3 && day !== 13
      ? 'rd'
      : 'th';

  return `${month} ${day}${suffix} ${year}`;
}

function visibilitySummary(mode: VisibilityMode) {
  if (mode === 1) return 'Only people I invite';
  if (mode === 2) return 'Friends of friends';
  return 'Anyone connected to me';
}

function makeSeriesId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16);
    const value = char === 'x' ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

export default function FormalDetailsScreen() {
  const params = useLocalSearchParams<{
    prefill_title?: string;
    prefill_desc?: string;
    prefill_date?: string;
  }>();

  const { form, updateForm, initializeFromPrefill } = useFormalDraft();

  const [loading, setLoading] = useState(false);
  const submitLockRef = useRef(false);

  const [showVisibilityModal, setShowVisibilityModal] = useState(false);
  const [pendingVisibility, setPendingVisibility] = useState<VisibilityMode | null>(null);

  const [showDeadlinePicker, setShowDeadlinePicker] = useState(false);
  const [tempDeadlineDate, setTempDeadlineDate] = useState<Date>(new Date());
  const [showReminderDropdown, setShowReminderDropdown] = useState(false);

  const [visibilityDraft, setVisibilityDraft] = useState<VisibilityDraft>({
    invite_list_visibility: 'host_only',
    guest_list_visibility: 'guests_can_see',
    send_rsvp_reminders: false,
    remind_after_days: 3,
    rsvp_deadline: null,
    send_final_reminder_at_deadline: false,
    forwarding_mode: null,
  });

  useEffect(() => {
    initializeFromPrefill({
      prefill_title: params.prefill_title,
      prefill_desc: params.prefill_desc,
      prefill_date: params.prefill_date,
    });
  }, [
    initializeFromPrefill,
    params.prefill_title,
    params.prefill_desc,
    params.prefill_date,
  ]);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id || !user?.email) return;

      const cleanEmail = user.email.toLowerCase().trim();

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();

      updateForm('host_email', cleanEmail);
      updateForm(
        'host_name',
        profile?.full_name ||
          user?.user_metadata?.full_name ||
          cleanEmail.split('@')[0]
      );
    }

    void loadUser();
  }, [updateForm]);

  const updateVisibilityDraft = <K extends keyof VisibilityDraft>(
    key: K,
    value: VisibilityDraft[K]
  ) => {
    setVisibilityDraft((prev) => ({ ...prev, [key]: value }));
  };

  const goBack = () => {
    if (showVisibilityModal) {
      setShowVisibilityModal(false);
      setPendingVisibility(null);
      setShowDeadlinePicker(false);
      setShowReminderDropdown(false);
      return;
    }

    router.push('/create/formal-when');
  };

  const canSave =
    !!form.title.trim() &&
    !!form.host_name.trim() &&
    !!form.host_email.trim();

  const openVisibilityConfig = (mode: VisibilityMode) => {
    const draft: VisibilityDraft = {
      invite_list_visibility: form.invite_list_visibility,
      guest_list_visibility: form.guest_list_visibility,
      send_rsvp_reminders: form.send_rsvp_reminders,
      remind_after_days: form.remind_after_days,
      rsvp_deadline: form.rsvp_deadline,
      send_final_reminder_at_deadline: form.send_final_reminder_at_deadline,
      forwarding_mode: form.forwarding_mode,
    };

    if (mode === 1) {
      draft.forwarding_mode = null;
    } else if (mode === 2 && !draft.forwarding_mode) {
      draft.forwarding_mode = 'free';
    }

    setPendingVisibility(mode);
    setVisibilityDraft(draft);
    setShowVisibilityModal(true);
  };

  const selectPendingVisibility = (mode: VisibilityMode) => {
    const nextDraft: VisibilityDraft = {
      ...visibilityDraft,
      forwarding_mode:
        mode === 1 ? null : mode === 2 ? visibilityDraft.forwarding_mode || 'free' : null,
    };

    setPendingVisibility(mode);
    setVisibilityDraft(nextDraft);
  };

  const saveVisibilityConfig = () => {
    if (!pendingVisibility) return;

    if (pendingVisibility === 2 && !visibilityDraft.forwarding_mode) {
      Alert.alert('Missing setting', 'Please choose a forwarding option.');
      return;
    }

    updateForm('visibility', pendingVisibility);
    updateForm('invite_list_visibility', visibilityDraft.invite_list_visibility);
    updateForm('guest_list_visibility', visibilityDraft.guest_list_visibility);
    updateForm('send_rsvp_reminders', visibilityDraft.send_rsvp_reminders);
    updateForm('remind_after_days', visibilityDraft.remind_after_days);
    updateForm('rsvp_deadline', visibilityDraft.rsvp_deadline);
    updateForm(
      'send_final_reminder_at_deadline',
      visibilityDraft.send_final_reminder_at_deadline
    );
    updateForm(
      'forwarding_mode',
      pendingVisibility === 2 ? visibilityDraft.forwarding_mode : null
    );

    setShowVisibilityModal(false);
    setPendingVisibility(null);
    setShowDeadlinePicker(false);
    setShowReminderDropdown(false);
  };

  const onIOSDeadlineChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (selectedDate) {
      setTempDeadlineDate(selectedDate);
    }
  };

  const confirmIOSDeadline = () => {
    updateVisibilityDraft('rsvp_deadline', toDateOnly(tempDeadlineDate));
    setShowDeadlinePicker(false);
  };

  const openAndroidDeadlinePicker = () => {
    DateTimePickerAndroid.open({
      value: visibilityDraft.rsvp_deadline
        ? new Date(`${visibilityDraft.rsvp_deadline}T12:00:00`)
        : new Date(),
      mode: 'date',
      onChange: (event, date) => {
        if (event.type === 'set' && date) {
          updateVisibilityDraft('rsvp_deadline', toDateOnly(date));
        }
      },
    });
  };

  const saveUnified = async () => {
    if (submitLockRef.current) return;
    submitLockRef.current = true;
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const effectiveEmail = (user?.email || form.host_email || '').toLowerCase().trim();
      const effectiveHostName = form.host_name.trim() || effectiveEmail.split('@')[0];

      if (!effectiveEmail) {
        Alert.alert('Identity Error', 'We need an email to save your plan.');
        return;
      }

      if (!form.title.trim()) {
        Alert.alert('Required', 'Please provide a title.');
        return;
      }

      const description = form.description.trim() || null;
      const location = form.location || null;

      if (form.whenMode === 'specific' || form.whenMode === 'series') {
        const fullDescription = location
          ? `${description ?? ''}${description ? '\n\n' : ''}Location: ${location}`.trim()
          : description;

        const rawDatesToCreate =
          form.whenMode === 'series' ? form.seriesDates : [form.specificDate];

        const datesToCreate = rawDatesToCreate
          .filter((value: Date | null | undefined) => value instanceof Date)
          .filter((value: Date) => !Number.isNaN(value.getTime()))
          .sort((a: Date, b: Date) => a.getTime() - b.getTime());

        if (datesToCreate.length === 0) {
          Alert.alert(
            'Missing date',
            form.whenMode === 'series'
              ? 'Please add at least one date to the series.'
              : 'Please choose a date.'
          );
          return;
        }

        const seriesId =
          form.whenMode === 'series' && datesToCreate.length > 1
            ? makeSeriesId()
            : null;

        const createdRows: Array<{ id: string; slug: string; manage_handle: string }> = [];

        for (const startDate of datesToCreate) {
          const endsAt = form.durationMins
            ? new Date(startDate.getTime() + form.durationMins * 60 * 1000).toISOString()
            : null;

          const payload = {
            p_title: form.title.trim(),
            p_host_name: effectiveHostName,
            p_host_email: effectiveEmail,
            p_keyword: 'event',
            p_starts_at: startDate.toISOString(),
            p_ends_at: endsAt,
            p_location: location,
            p_description: fullDescription || null,
            p_event_type: 'formal',
            p_visibility: form.visibility,
            p_expires_in_days: 14,
            p_invite_list_visibility: form.invite_list_visibility,
            p_guest_list_visibility: form.guest_list_visibility,
            p_send_rsvp_reminders: form.send_rsvp_reminders,
            p_remind_after_days: form.remind_after_days,
            p_rsvp_deadline: form.rsvp_deadline,
            p_send_final_reminder_at_deadline: form.send_final_reminder_at_deadline,
            p_forwarding_mode: form.forwarding_mode,
          };

          const { data, error } = await supabase.rpc('create_event_draft', payload);
          if (error) throw error;

          const row = Array.isArray(data) ? data[0] : data;
          if (!row?.id) {
            throw new Error('Event was created without an id.');
          }

          if (seriesId) {
            const { error: seriesError } = await supabase
              .from('events')
              .update({ series_id: seriesId })
              .eq('id', row.id);

            if (seriesError) throw seriesError;
          }

          createdRows.push(row);
        }

        const firstRow = createdRows[0];
        if (!firstRow?.slug || !firstRow?.manage_handle) {
          throw new Error('Could not open the success page for the new event.');
        }

        router.push({
          pathname: '/create/success',
          params: {
            slug: firstRow.slug,
            manage_handle: firstRow.manage_handle,
            title: form.title,
            email: effectiveEmail,
            visibility: String(form.visibility),
          },
        });

        return;
      }

      const result = await createVibeDraft({
        title: form.title.trim(),
        description: description ?? undefined,
        location,
        hostName: effectiveHostName,
        hostEmail: effectiveEmail,
        keyword: `vibe-${Math.random().toString(36).substring(2, 7)}`,
        gifKey: 'waves',
        eventType: 'vibe',
        proposedDates:
          form.whenMode === 'options'
            ? form.pollOptions.map((d) => d.toISOString())
            : [],
        visibility: form.visibility,
        inviteListVisibility: form.invite_list_visibility,
        guestListVisibility: form.guest_list_visibility,
        sendRsvpReminders: form.send_rsvp_reminders,
        remindAfterDays: form.remind_after_days,
        rsvpDeadline: form.rsvp_deadline,
        sendFinalReminderAtDeadline: form.send_final_reminder_at_deadline,
        forwardingMode: form.forwarding_mode,
      });

      router.push({
        pathname: '/create/success-vibe',
        params: {
          slug: result.slug,
          manage_handle: result.manage_handle,
          title: form.title,
          email: effectiveEmail,
          visibility: String(form.visibility),
        },
      });
    } catch (e: any) {
      Alert.alert('Save Failed', e?.message ?? 'Could not save your plan.');
    } finally {
      submitLockRef.current = false;
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.wrapper} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" />
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topBar}>
        <TouchableOpacity onPress={goBack} style={styles.navIconBtn}>
          <Ionicons name="arrow-back" size={28} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View>
            <StyledText style={styles.stepTitle}>Finish it off</StyledText>

            <StyledInput
              placeholder="Add a note..."
              value={form.description}
              onChangeText={(t: string) => updateForm('description', t)}
              multiline
              style={[styles.inputStyle, styles.detailsInput]}
            />

            <StyledText style={styles.sectionLabel}>Where</StyledText>

            <View style={styles.locationWrap}>
              <LocationSearch
                value={form.location}
                onChange={(nextValue) => updateForm('location', nextValue)}
              />
            </View>

            <TouchableOpacity
              style={styles.pwaInput}
              onPress={() => openVisibilityConfig(form.visibility)}
            >
              <View>
                <StyledText style={styles.label}>WHO CAN JOIN?</StyledText>
                <StyledText style={styles.pwaInputText}>
                  {visibilitySummary(form.visibility)}
                </StyledText>
              </View>
              <Ionicons name="settings-outline" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>

            <StyledText style={styles.sectionLabel}>Who&apos;s this from?</StyledText>

            <StyledInput
              placeholder="Your Name"
              value={form.host_name}
              onChangeText={(t: string) => updateForm('host_name', t)}
              style={styles.inputStyle}
            />

            <StyledInput
              placeholder="Your Email"
              value={form.host_email}
              onChangeText={(t: string) => updateForm('host_email', t)}
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.inputStyle}
            />

            <View style={styles.nav}>
              <TouchableOpacity style={styles.btn} onPress={goBack}>
                <Ionicons name="arrow-back" size={28} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btn, styles.saveBtn, (!canSave || loading) && styles.disabledBtn]}
                onPress={saveUnified}
                disabled={loading || !canSave}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Ionicons name="checkmark" size={30} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showVisibilityModal} transparent animationType="slide">
        <View style={styles.modalOverlayBottom}>
          <View style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={styles.compactSection}>
                <StyledText style={styles.compactHeading}>Who can join?</StyledText>

                <TouchableOpacity
                  style={styles.radioRow}
                  onPress={() => selectPendingVisibility(1)}
                >
                  <Ionicons
                    name={pendingVisibility === 1 ? 'radio-button-on' : 'radio-button-off'}
                    size={22}
                    color={COLORS.primary}
                  />
                  <StyledText style={styles.radioRowText}>Only people I invite</StyledText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.radioRow}
                  onPress={() => selectPendingVisibility(2)}
                >
                  <Ionicons
                    name={pendingVisibility === 2 ? 'radio-button-on' : 'radio-button-off'}
                    size={22}
                    color={COLORS.primary}
                  />
                  <StyledText style={styles.radioRowText}>Friends of friends</StyledText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.radioRow}
                  onPress={() => selectPendingVisibility(3)}
                >
                  <Ionicons
                    name={pendingVisibility === 3 ? 'radio-button-on' : 'radio-button-off'}
                    size={22}
                    color={COLORS.primary}
                  />
                  <StyledText style={styles.radioRowText}>Anyone in my larger social circle</StyledText>
                </TouchableOpacity>
              </View>

              {pendingVisibility === 2 && (
                <View style={styles.compactSection}>
                  <StyledText style={styles.compactHeading}>Forwarding</StyledText>

                  <TouchableOpacity
                    style={styles.radioRow}
                    onPress={() => updateVisibilityDraft('forwarding_mode', 'free')}
                  >
                    <Ionicons
                      name={
                        visibilityDraft.forwarding_mode === 'free'
                          ? 'radio-button-on'
                          : 'radio-button-off'
                      }
                      size={22}
                      color={COLORS.primary}
                    />
                    <StyledText style={styles.radioRowText}>
                      Friends of friends can RSVP directly
                    </StyledText>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.radioRow}
                    onPress={() => updateVisibilityDraft('forwarding_mode', 'host_approval')}
                  >
                    <Ionicons
                      name={
                        visibilityDraft.forwarding_mode === 'host_approval'
                          ? 'radio-button-on'
                          : 'radio-button-off'
                      }
                      size={22}
                      color={COLORS.primary}
                    />
                    <StyledText style={styles.radioRowText}>
                      Friends of friends need my approval
                    </StyledText>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.compactSection}>
                <StyledText style={styles.compactHeading}>Who sees the invite list?</StyledText>

                <TouchableOpacity
                  style={styles.radioRow}
                  onPress={() => updateVisibilityDraft('invite_list_visibility', 'guests_can_see')}
                >
                  <Ionicons
                    name={
                      visibilityDraft.invite_list_visibility === 'guests_can_see'
                        ? 'radio-button-on'
                        : 'radio-button-off'
                    }
                    size={22}
                    color={COLORS.primary}
                  />
                  <StyledText style={styles.radioRowText}>Guests can see who was invited</StyledText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.radioRow}
                  onPress={() => updateVisibilityDraft('invite_list_visibility', 'host_only')}
                >
                  <Ionicons
                    name={
                      visibilityDraft.invite_list_visibility === 'host_only'
                        ? 'radio-button-on'
                        : 'radio-button-off'
                    }
                    size={22}
                    color={COLORS.primary}
                  />
                  <StyledText style={styles.radioRowText}>Only me</StyledText>
                </TouchableOpacity>
              </View>

              <View style={styles.compactSection}>
                <StyledText style={styles.compactHeading}>Who sees the RSVP list?</StyledText>

                <TouchableOpacity
                  style={styles.radioRow}
                  onPress={() => updateVisibilityDraft('guest_list_visibility', 'guests_can_see')}
                >
                  <Ionicons
                    name={
                      visibilityDraft.guest_list_visibility === 'guests_can_see'
                        ? 'radio-button-on'
                        : 'radio-button-off'
                    }
                    size={22}
                    color={COLORS.primary}
                  />
                  <StyledText style={styles.radioRowText}>Guests can see responses</StyledText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.radioRow}
                  onPress={() => updateVisibilityDraft('guest_list_visibility', 'host_only')}
                >
                  <Ionicons
                    name={
                      visibilityDraft.guest_list_visibility === 'host_only'
                        ? 'radio-button-on'
                        : 'radio-button-off'
                    }
                    size={22}
                    color={COLORS.primary}
                  />
                  <StyledText style={styles.radioRowText}>Only me</StyledText>
                </TouchableOpacity>
              </View>

              <View style={styles.compactSection}>
                <StyledText style={styles.compactHeading}>RSVP management</StyledText>

                <View style={styles.reminderInlineRow}>
                  <TouchableOpacity
                    style={styles.checkboxInline}
                    onPress={() =>
                      updateVisibilityDraft(
                        'send_rsvp_reminders',
                        !visibilityDraft.send_rsvp_reminders
                      )
                    }
                  >
                    <Ionicons
                      name={
                        visibilityDraft.send_rsvp_reminders
                          ? 'checkbox-outline'
                          : 'square-outline'
                      }
                      size={22}
                      color={COLORS.primary}
                    />
                    <StyledText style={styles.checkboxInlineText}>Send reminders after</StyledText>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.reminderDropdown}
                    onPress={() => setShowReminderDropdown((prev) => !prev)}
                  >
                    <StyledText style={styles.reminderDropdownText}>
                      {visibilityDraft.remind_after_days} day
                      {visibilityDraft.remind_after_days > 1 ? 's' : ''}
                    </StyledText>
                    <Ionicons
                      name={showReminderDropdown ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={COLORS.textMuted}
                    />
                  </TouchableOpacity>
                </View>

                {showReminderDropdown && (
                  <View style={styles.reminderDropdownMenu}>
                    {REMINDER_OPTIONS.map((days) => (
                      <TouchableOpacity
                        key={days}
                        style={styles.reminderDropdownItem}
                        onPress={() => {
                          updateVisibilityDraft('remind_after_days', days);
                          setShowReminderDropdown(false);
                        }}
                      >
                        <StyledText style={styles.reminderDropdownItemText}>
                          {days} day{days > 1 ? 's' : ''}
                        </StyledText>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <StyledText style={styles.inlineLabel}>RSVP deadline</StyledText>

                <TouchableOpacity
                  style={styles.deadlineField}
                  onPress={() => {
                    if (Platform.OS === 'android') {
                      openAndroidDeadlinePicker();
                    } else {
                      setTempDeadlineDate(
                        visibilityDraft.rsvp_deadline
                          ? new Date(`${visibilityDraft.rsvp_deadline}T12:00:00`)
                          : new Date()
                      );
                      setShowDeadlinePicker(true);
                    }
                  }}
                >
                  <StyledText style={styles.deadlineFieldText}>
                    {formatDeadlineLabel(visibilityDraft.rsvp_deadline)}
                  </StyledText>
                  <Ionicons name="chevron-down" size={18} color={COLORS.textMuted} />
                </TouchableOpacity>

                {!!visibilityDraft.rsvp_deadline && (
                  <TouchableOpacity
                    style={styles.clearDeadlineBtn}
                    onPress={() => updateVisibilityDraft('rsvp_deadline', null)}
                  >
                    <StyledText style={styles.clearDeadlineText}>Clear date</StyledText>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() =>
                    updateVisibilityDraft(
                      'send_final_reminder_at_deadline',
                      !visibilityDraft.send_final_reminder_at_deadline
                    )
                  }
                >
                  <Ionicons
                    name={
                      visibilityDraft.send_final_reminder_at_deadline
                        ? 'checkbox-outline'
                        : 'square-outline'
                    }
                    size={22}
                    color={COLORS.primary}
                  />
                  <StyledText style={styles.radioRowText}>
                    Send final reminder at the RSVP deadline
                  </StyledText>
                </TouchableOpacity>
              </View>

              <View style={styles.modalActionsBottom}>
                <TouchableOpacity
                  style={styles.modalSecondaryBtn}
                  onPress={() => {
                    setShowVisibilityModal(false);
                    setPendingVisibility(null);
                    setShowDeadlinePicker(false);
                    setShowReminderDropdown(false);
                  }}
                >
                  <StyledText style={styles.modalSecondaryText}>Cancel</StyledText>
                </TouchableOpacity>

                <TouchableOpacity style={styles.modalPrimaryBtn} onPress={saveVisibilityConfig}>
                  <StyledText style={styles.modalPrimaryText}>Save</StyledText>
                </TouchableOpacity>
              </View>
            </ScrollView>

            {showDeadlinePicker && Platform.OS === 'ios' && (
              <View style={styles.iosDeadlinePickerWrap}>
                <View style={styles.iosDeadlinePickerHeader}>
                  <TouchableOpacity onPress={() => setShowDeadlinePicker(false)}>
                    <StyledText style={styles.iosCancelText}>Cancel</StyledText>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={confirmIOSDeadline}>
                    <StyledText style={styles.iosConfirmText}>Confirm</StyledText>
                  </TouchableOpacity>
                </View>

                <DateTimePicker
                  value={tempDeadlineDate}
                  mode="date"
                  display="inline"
                  onChange={onIOSDeadlineChange}
                  accentColor={COLORS.primary}
                />
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  wrapper: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },

  navIconBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },

  container: {
    padding: 25,
    paddingTop: 10,
    paddingBottom: 40,
  },

  stepTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.text,
    marginBottom: 20,
  },

  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },

  label: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textMuted,
    marginTop: 20,
    marginBottom: 8,
    letterSpacing: 1,
  },

  inputStyle: {
    fontSize: 18,
    backgroundColor: COLORS.surface,
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.text,
  },

  detailsInput: {
    height: 120,
  },

  locationWrap: {
    marginBottom: 18,
  },

  pwaInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 8,
  },

  pwaInputText: {
    fontSize: 18,
    color: COLORS.text,
    fontWeight: '600',
  },

  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },

  btn: {
    backgroundColor: COLORS.primary,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },

  saveBtn: {
    backgroundColor: COLORS.primary,
  },

  disabledBtn: {
    opacity: 0.45,
  },

  modalOverlayBottom: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },

  modalCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '88%',
    borderTopWidth: 1,
    borderColor: COLORS.border,
  },

  compactSection: {
    marginBottom: 22,
  },

  compactHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 4,
  },

  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },

  radioRowText: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
    marginLeft: 10,
  },

  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },

  reminderInlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 12,
    gap: 10,
  },

  checkboxInline: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  checkboxInlineText: {
    fontSize: 16,
    color: COLORS.text,
    marginLeft: 10,
  },

  reminderDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },

  reminderDropdownText: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '600',
    marginRight: 6,
  },

  reminderDropdownMenu: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    marginBottom: 12,
    overflow: 'hidden',
  },

  reminderDropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },

  reminderDropdownItemText: {
    fontSize: 15,
    color: COLORS.text,
  },

  inlineLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 8,
    marginBottom: 8,
  },

  deadlineField: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  deadlineFieldText: {
    fontSize: 16,
    color: COLORS.text,
  },

  clearDeadlineBtn: {
    alignSelf: 'flex-start',
    marginBottom: 12,
  },

  clearDeadlineText: {
    color: COLORS.primary,
    fontWeight: '700',
  },

  modalActionsBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 6,
  },

  modalSecondaryBtn: {
    paddingVertical: 14,
    paddingHorizontal: 18,
  },

  modalSecondaryText: {
    color: COLORS.textMuted,
    fontWeight: '700',
  },

  modalPrimaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 22,
  },

  modalPrimaryText: {
    color: '#fff',
    fontWeight: '800',
  },

  iosDeadlinePickerWrap: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderSoft,
    paddingTop: 12,
  },

  iosDeadlinePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  iosCancelText: {
    color: COLORS.textMuted,
    fontWeight: '600',
  },

  iosConfirmText: {
    color: COLORS.primary,
    fontWeight: '800',
  },
});