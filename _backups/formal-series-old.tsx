/**
 * Path: apps/mobile/app/create/formal-series.tsx
 * Description: Dedicated route for selecting multiple formal event dates/times
 * and shared duration. Extracted from formal.tsx with minimal logic changes.
 */

import React, { useState } from 'react';
import {
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
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, {
  DateTimePickerAndroid,
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';

import { StyledText } from '@pallinky/ui';
import { useFormalDraft } from './_formalDraft';

const COLORS = {
  background: '#F6F7F9',
  surface: '#FFFFFF',
  text: '#1f2a1b',
  textMuted: '#66715f',
  primary: '#43691b',
  border: '#bac9ad',
  danger: '#e63946',
  overlay: 'rgba(31, 42, 27, 0.35)',
};

export default function FormalSeriesScreen() {
  const { form, setForm, updateForm } = useFormalDraft();

  const [showPicker, setShowPicker] = useState(false);
  const [showCustomDuration, setShowCustomDuration] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());
  const [customHrs, setCustomHrs] = useState(
    form.durationMins ? String(Math.floor(form.durationMins / 60)) : '1'
  );
  const [customMins, setCustomMins] = useState(
    form.durationMins ? String(form.durationMins % 60) : '0'
  );

  const sameMinute = (a: Date, b: Date) => a.getTime() === b.getTime();

  const addSeriesDate = (date: Date) => {
    setForm((prev) => {
      if (prev.seriesDates.some((d) => sameMinute(d, date))) {
        return prev;
      }

      return {
        ...prev,
        whenMode: 'series',
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

  const onIOSChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (selectedDate) setTempDate(selectedDate);
  };

  const confirmIOSDate = () => {
    addSeriesDate(tempDate);
    setShowPicker(false);
  };

  const openIOSPicker = (seedDate?: Date) => {
    setTempDate(seedDate ?? new Date());
    setShowPicker(true);
  };

  const showAndroidPicker = () => {
    DateTimePickerAndroid.open({
      value: new Date(),
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
                addSeriesDate(merged);
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

  const goBack = () => {
    if (showCustomDuration) {
      setShowCustomDuration(false);
      return;
    }

    if (showPicker) {
      setShowPicker(false);
      return;
    }

    router.push('/create/formal-when');
  };

  const continueToDetails = () => {
    updateForm('whenMode', 'series');
    router.push('/create/formal-details');
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
          <StyledText style={styles.stepTitle}>A series of dates</StyledText>

          <StyledText style={styles.modeSub}>
            I already know multiple dates and want to create them all now.
          </StyledText>

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

          <View style={styles.nav}>
            <TouchableOpacity style={styles.btn} onPress={goBack}>
              <Ionicons name="arrow-back" size={28} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.btn} onPress={continueToDetails}>
              <Ionicons name="arrow-forward" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
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
    marginBottom: 8,
  },

  modeSub: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textMuted,
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

  iosPickerModalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 16,
    width: '88%',
    borderWidth: 1,
    borderColor: COLORS.border,
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

  modalOverlayCenter: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },

  iosDeadlinePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
});