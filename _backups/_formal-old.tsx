/**
 * Path: apps/mobile/app/create/formal.tsx
 * Description: Unified create flow using the app palette.
 * This is now the canonical create UI for both fixed plans and looser checks.
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
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

import DateOptionPicker from '../../components/DateOptionPicker';
import LocationSearch from '../../components/LocationSearch';

type VisibilityMode = 1 | 2 | 3;
type VisibilityText = 'host_only' | 'guests_can_see';
type ForwardingMode = 'free' | 'host_approval' | null;
type ReminderDays = 1 | 2 | 3 | 5 | 7;

type WhenMode = 'specific' | 'series' | 'options' | 'unsure';

type FormState = {
  title: string;
  whenMode: WhenMode;
  specificDate: Date;
  seriesDates: Date[];
  pollOptions: Date[];
  durationMins: number | null;
  description: string;
  location: string;
  host_name: string;
  host_email: string;
  visibility: VisibilityMode;

  invite_list_visibility: VisibilityText;
  guest_list_visibility: VisibilityText;
  send_rsvp_reminders: boolean;
  remind_after_days: ReminderDays;
  rsvp_deadline: string | null;
  send_final_reminder_at_deadline: boolean;
  forwarding_mode: ForwardingMode;
};

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
  danger: '#e63946',
  dangerBorder: '#ffd6d6',
  secondary: '#6A4C93',
  secondaryBg: '#efe9f7',
  inputBg: '#f9faf7',
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

export default function FormalCreateScreen() {
  const params = useLocalSearchParams<{
    prefill_title?: string;
    prefill_desc?: string;
    prefill_date?: string;
  }>();

  const initialDate = params.prefill_date
    ? new Date(params.prefill_date)
    : new Date();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [showPicker, setShowPicker] = useState(false);
  const [showCustomDuration, setShowCustomDuration] = useState(false);

  const [showVisibilityModal, setShowVisibilityModal] = useState(false);
  const [pendingVisibility, setPendingVisibility] = useState<VisibilityMode | null>(null);

  const [showDeadlinePicker, setShowDeadlinePicker] = useState(false);
  const [tempDeadlineDate, setTempDeadlineDate] = useState<Date>(new Date());

  const [showReminderDropdown, setShowReminderDropdown] = useState(false);

  const [tempDate, setTempDate] = useState(initialDate);
  const [customHrs, setCustomHrs] = useState('1');
  const [customMins, setCustomMins] = useState('0');

  const [form, setForm] = useState<FormState>({
    title: params.prefill_title || '',
    whenMode: params.prefill_date ? 'specific' : 'unsure',
    specificDate: initialDate,
    seriesDates: params.prefill_date ? [initialDate] : [],
    pollOptions: [],
    durationMins: null,
    description: params.prefill_desc || '',
    location: '',
    host_name: '',
    host_email: '',
    visibility: 3,

    invite_list_visibility: 'host_only',
    guest_list_visibility: 'guests_can_see',
    send_rsvp_reminders: false,
    remind_after_days: 3,
    rsvp_deadline: null,
    send_final_reminder_at_deadline: false,
    forwarding_mode: null,
  });

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

      setForm((prev) => ({
        ...prev,
        host_email: cleanEmail,
        host_name:
          profile?.full_name ||
          user?.user_metadata?.full_name ||
          cleanEmail.split('@')[0],
      }));
    }

    void loadUser();
  }, []);

  const updateForm = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateVisibilityDraft = <K extends keyof VisibilityDraft>(
    key: K,
    value: VisibilityDraft[K]
  ) => {
    setVisibilityDraft((prev) => ({ ...prev, [key]: value }));
  };

  const sameMinute = (a: Date, b: Date) => a.getTime() === b.getTime();

  const addSeriesDate = (date: Date) => {
    setForm((prev) => {
      if (prev.seriesDates.some((d) => sameMinute(d, date))) {
        return prev;
      }

      return {
        ...prev,
        seriesDates: [...prev.seriesDates, date].sort(
          (a, b) => a.getTime() - b.getTime()
        ),
      };
    });
  };

  const removeSeriesDate = (date: Date) => {
    setForm((prev) => ({
      ...prev,
      seriesDates: prev.seriesDates.filter((d) => !sameMinute(d, date)),
    }));
  };

  const goBack = () => {
    if (showVisibilityModal) {
      setShowVisibilityModal(false);
      setPendingVisibility(null);
      setShowDeadlinePicker(false);
      setShowReminderDropdown(false);
      return;
    }

    if (showCustomDuration) {
      setShowCustomDuration(false);
      return;
    }

    if (showPicker) {
      setShowPicker(false);
      return;
    }

    if (step > 1) {
      setStep((prev) => prev - 1);
      return;
    }

    router.back();
  };

  const canMoveFromStep1 = !!form.title.trim();
  const canSave =
    !!form.title.trim() &&
    !!form.host_name.trim() &&
    !!form.host_email.trim();

  const onIOSChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (selectedDate) setTempDate(selectedDate);
  };

  const confirmIOSDate = () => {
    if (form.whenMode === 'series') {
      addSeriesDate(tempDate);
    } else {
      updateForm('specificDate', tempDate);
    }

    setShowPicker(false);
  };

  const openIOSPicker = (seedDate?: Date) => {
    setTempDate(seedDate ?? new Date());
    setShowPicker(true);
  };

  const showAndroidPicker = () => {
    const baseDate =
      form.whenMode === 'series'
        ? new Date()
        : form.specificDate || new Date();

    DateTimePickerAndroid.open({
      value: baseDate,
      mode: 'date',
      onChange: (event, date) => {
        if (event.type === 'set' && date) {
          DateTimePickerAndroid.open({
            value: date,
            mode: 'time',
            is24Hour: true,
            onChange: (timeEvent, timeDate) => {
              if (timeEvent.type === 'set' && timeDate) {
                const merged = new Date(date);
                merged.setHours(timeDate.getHours(), timeDate.getMinutes(), 0, 0);

                if (form.whenMode === 'series') {
                  addSeriesDate(merged);
                } else {
                  updateForm('specificDate', merged);
                }
              }
            },
          });
        }
      },
    });
  };

  const setDuration = (hours: number, mins: number) => {
    const total = hours * 60 + mins;
    updateForm('durationMins', total > 0 ? total : null);
    setShowCustomDuration(false);
  };

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

    setForm((prev) => ({
      ...prev,
      visibility: pendingVisibility,
      invite_list_visibility: visibilityDraft.invite_list_visibility,
      guest_list_visibility: visibilityDraft.guest_list_visibility,
      send_rsvp_reminders: visibilityDraft.send_rsvp_reminders,
      remind_after_days: visibilityDraft.remind_after_days,
      rsvp_deadline: visibilityDraft.rsvp_deadline,
      send_final_reminder_at_deadline: visibilityDraft.send_final_reminder_at_deadline,
      forwarding_mode: pendingVisibility === 2 ? visibilityDraft.forwarding_mode : null,
    }));

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

    setLoading(true);

    try {
      const description = form.description.trim() || null;
      const location = form.location || null;

      if (form.whenMode === 'specific') {
        const endsAt = form.durationMins
          ? new Date(form.specificDate.getTime() + form.durationMins * 60 * 1000).toISOString()
          : null;

        const fullDescription = location
          ? `${description ?? ''}${description ? '\n\n' : ''}Location: ${location}`.trim()
          : description;

        const payload = {
          p_title: form.title.trim(),
          p_host_name: effectiveHostName,
          p_host_email: effectiveEmail,
          p_keyword: 'event',
          p_starts_at: form.specificDate.toISOString(),
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

        router.push({
          pathname: '/create/success',
          params: {
            slug: row.slug,
            manage_handle: row.manage_handle,
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
          {step === 1 && (
            <View>
              <StyledText style={styles.stepTitle}>What&apos;s the plan?</StyledText>

              <StyledInput
                placeholder="e.g. Dinner at 8"
                value={form.title}
                onChangeText={(t: string) => updateForm('title', t)}
                style={styles.inputStyle}
              />

              <View style={styles.navSpacer} />

              <View style={[styles.nav, { justifyContent: 'flex-end' }]}>
                <TouchableOpacity
                  style={[styles.btn, !canMoveFromStep1 && styles.disabledBtn]}
                  onPress={() => setStep(2)}
                  disabled={!canMoveFromStep1}
                >
                  <Ionicons name="arrow-forward" size={28} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {step === 2 && (
            <View>
              <StyledText style={styles.stepTitle}>When?</StyledText>

              <TouchableOpacity
                style={[
                  styles.modeCard,
                  form.whenMode === 'specific' && styles.modeCardSelected,
                ]}
                onPress={() => updateForm('whenMode', 'specific')}
              >
                <StyledText style={styles.modeTitle}>A specific time</StyledText>
                <StyledText style={styles.modeSub}>
                  I already know when this is happening.
                </StyledText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modeCard,
                  form.whenMode === 'series' && styles.modeCardSelected,
                ]}
                onPress={() => updateForm('whenMode', 'series')}
              >
                <StyledText style={styles.modeTitle}>A series of dates</StyledText>
                <StyledText style={styles.modeSub}>
                  I already know multiple dates and want to create them all now.
                </StyledText>
              </TouchableOpacity>

              {form.whenMode === 'specific' && (
                <>
                  <StyledText style={styles.label}>START TIME</StyledText>
                  <TouchableOpacity
                    style={styles.pwaInput}
                    onPress={() =>
                      Platform.OS === 'android'
                        ? showAndroidPicker()
                        : openIOSPicker(form.specificDate)
                    }
                  >
                    <StyledText style={styles.pwaInputText}>
                      {form.specificDate.toLocaleString('en-GB', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </StyledText>
                  </TouchableOpacity>

                  <StyledText style={styles.label}>DURATION</StyledText>
                  <TouchableOpacity
                    style={styles.pwaInput}
                    onPress={() => setShowCustomDuration(true)}
                  >
                    <StyledText
                      style={[
                        styles.pwaInputText,
                        !form.durationMins && styles.placeholderText,
                      ]}
                    >
                      {form.durationMins
                        ? `${Math.floor(form.durationMins / 60)}h ${form.durationMins % 60}m`
                        : 'No end time'}
                    </StyledText>
                    <Ionicons name="chevron-down" size={18} color={COLORS.textMuted} />
                  </TouchableOpacity>
                </>
              )}

              {form.whenMode === 'series' && (
                <>
                  <StyledText style={styles.label}>DATES IN THE SERIES</StyledText>

                  <TouchableOpacity
                    style={styles.pwaInput}
                    onPress={() =>
                      Platform.OS === 'android'
                        ? showAndroidPicker()
                        : openIOSPicker(new Date())
                    }
                  >
                    <StyledText style={styles.pwaInputText}>Add a date + time</StyledText>
                    <Ionicons name="add" size={18} color={COLORS.textMuted} />
                  </TouchableOpacity>

                  {form.seriesDates.length > 0 && (
                    <View style={{ marginTop: 8 }}>
                      {form.seriesDates.map((date) => {
                        const key = date.toISOString();

                        return (
                          <View
                            key={key}
                            style={[
                              styles.pwaInput,
                              { marginBottom: 10, paddingVertical: 14 },
                            ]}
                          >
                            <StyledText style={[styles.pwaInputText, { flex: 1 }]}>
                              {date.toLocaleString('en-GB', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })}
                            </StyledText>

                            <TouchableOpacity onPress={() => removeSeriesDate(date)}>
                              <Ionicons
                                name="close-circle"
                                size={22}
                                color={COLORS.danger}
                              />
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  <StyledText style={styles.label}>DURATION</StyledText>
                  <TouchableOpacity
                    style={styles.pwaInput}
                    onPress={() => setShowCustomDuration(true)}
                  >
                    <StyledText
                      style={[
                        styles.pwaInputText,
                        !form.durationMins && styles.placeholderText,
                      ]}
                    >
                      {form.durationMins
                        ? `${Math.floor(form.durationMins / 60)}h ${form.durationMins % 60}m`
                        : 'No end time'}
                    </StyledText>
                    <Ionicons name="chevron-down" size={18} color={COLORS.textMuted} />
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity
                style={[
                  styles.modeCard,
                  form.whenMode === 'options' && styles.modeCardSelected,
                ]}
                onPress={() => updateForm('whenMode', 'options')}
              >
                <StyledText style={styles.modeTitle}>A few options</StyledText>
                <StyledText style={styles.modeSub}>
                  I want to suggest some dates and see.
                </StyledText>
              </TouchableOpacity>

              {form.whenMode === 'options' && (
                <View style={styles.dateOptionsWrap}>
                  <DateOptionPicker
                    value={form.pollOptions}
                    onChange={(dates) => updateForm('pollOptions', dates)}
                  />
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.modeCard,
                  form.whenMode === 'unsure' && styles.modeCardSelected,
                ]}
                onPress={() => updateForm('whenMode', 'unsure')}
              >
                <StyledText style={styles.modeTitle}>Not sure yet</StyledText>
                <StyledText style={styles.modeSub}>
                  I just want to open the plan for now.
                </StyledText>
              </TouchableOpacity>

              <View style={styles.nav}>
                <TouchableOpacity style={styles.btn} onPress={() => setStep(1)}>
                  <Ionicons name="arrow-back" size={28} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.btn} onPress={() => setStep(3)}>
                  <Ionicons name="arrow-forward" size={28} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {step === 3 && (
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
                <TouchableOpacity style={styles.btn} onPress={() => setStep(2)}>
                  <Ionicons name="arrow-back" size={28} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btn, styles.saveBtn, !canSave && styles.disabledBtn]}
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
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {Platform.OS === 'ios' && (
        <Modal
          visible={showPicker}
          transparent
          animationType="fade"
          presentationStyle="overFullScreen"
          onRequestClose={() => setShowPicker(false)}
        >
          <View style={styles.modalOverlayCenter}>
            <View style={styles.iosPickerModalCard}>
              <View style={styles.iosDeadlinePickerHeader}>
                <TouchableOpacity onPress={() => setShowPicker(false)}>
                  <StyledText style={styles.iosCancelText}>Cancel</StyledText>
                </TouchableOpacity>

                <TouchableOpacity onPress={confirmIOSDate}>
                  <StyledText style={styles.iosConfirmText}>Confirm</StyledText>
                </TouchableOpacity>
              </View>

              <DateTimePicker
                value={tempDate}
                mode="datetime"
                display="spinner"
                onChange={onIOSChange}
                minuteInterval={15}
                style={{ width: '100%' }}
              />
            </View>
          </View>
        </Modal>
      )}

      <Modal visible={showCustomDuration} transparent animationType="fade">
        <View style={styles.modalOverlayCenter}>
          <View style={styles.durationModalContent}>
            <StyledText style={styles.durationModalLabel}>Set Duration</StyledText>

            <View style={styles.durationInputRow}>
              <View style={styles.inputGroup}>
                <TextInput
                  style={styles.modalInput}
                  keyboardType="numeric"
                  value={customHrs}
                  onChangeText={(t: string) => setCustomHrs(t)}
                  maxLength={2}
                />
                <StyledText style={styles.inlineFieldLabel}>Hours</StyledText>
              </View>

              <View style={styles.inputGroup}>
                <TextInput
                  style={styles.modalInput}
                  keyboardType="numeric"
                  value={customMins}
                  onChangeText={(t: string) => setCustomMins(t)}
                  maxLength={2}
                />
                <StyledText style={styles.inlineFieldLabel}>Mins</StyledText>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setShowCustomDuration(false)}>
                <StyledText style={styles.modalCancelText}>Cancel</StyledText>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() =>
                  setDuration(
                    parseInt(customHrs || '0', 10),
                    parseInt(customMins || '0', 10)
                  )
                }
              >
                <StyledText style={styles.modalSetText}>Set</StyledText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
                  <StyledText style={styles.radioRowText}>Anyone with the link</StyledText>
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

  sectionHint: {
    fontSize: 15,
    color: COLORS.textMuted,
    lineHeight: 22,
    marginBottom: 18,
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

  placeholderText: {
    color: COLORS.textMuted,
  },

  modeCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },

  modeCardSelected: {
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: '#fbfcfa',
  },

  modeTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 4,
  },

  modeSub: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textMuted,
  },

  dateOptionsWrap: {
    marginTop: 8,
  },

  locationWrap: {
    marginBottom: 18,
  },

  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },

  navSpacer: {
    height: 10,
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

  iosPickerModalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 16,
    width: '88%',
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  iosPickerContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 15,
    padding: 10,
    marginBottom: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  iosPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },

  iosHeaderBtn: {
    marginRight: 20,
  },

  iosCancelText: {
    color: COLORS.textMuted,
    fontWeight: '600',
  },

  iosConfirmText: {
    color: COLORS.primary,
    fontWeight: '800',
  },

  durationModalContent: {
    backgroundColor: COLORS.surface,
    padding: 25,
    borderRadius: 20,
    width: '80%',
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  durationModalLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 1,
  },

  durationInputRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 20,
  },

  inputGroup: {
    alignItems: 'center',
  },

  inlineFieldLabel: {
    color: COLORS.text,
  },

  modalInput: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
    fontSize: 32,
    textAlign: 'center',
    width: 60,
    marginBottom: 5,
    color: COLORS.text,
  },

  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },

  modalCancelText: {
    color: COLORS.textMuted,
  },

  modalSetText: {
    color: COLORS.primary,
    fontWeight: '800',
  },

  settingsCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 16,
    marginTop: 6,
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },

  settingsCopy: {
    flex: 1,
  },

  settingsTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 4,
  },

  settingsValue: {
    fontSize: 15,
    color: COLORS.textMuted,
  },

  settingsBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: COLORS.secondaryBg,
  },

  settingsBtnText: {
    color: COLORS.secondary,
    fontWeight: '800',
  },

  modalOverlayCenter: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
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
});