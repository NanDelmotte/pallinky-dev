/** * Path: app/create/formal.tsx 
 * Version: v15
 * Description: Migrated to Safe-Area-Context, separated location field, and added GPS biasing + debounce.
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, StatusBar, Platform, ScrollView, KeyboardAvoidingView, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyledText, StyledInput } from '@tarti-flette/ui';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent, DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '@tarti-flette/core';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import * as Location from 'expo-location';

const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

export default function FormalCreateScreen() {
  const params = useLocalSearchParams();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const [showCustomDuration, setShowCustomDuration] = useState(false);
  const [userCoords, setUserCoords] = useState<{lat: number, lng: number} | null>(null);
  const googleRef = useRef<any>(null);
  
  const [tempDate, setTempDate] = useState(params.prefill_date ? new Date(params.prefill_date as string) : new Date());
  const [customHrs, setCustomHrs] = useState('1');
  const [customMins, setCustomMins] = useState('0');
  
  const [form, setForm] = useState({
    title: (params.prefill_title as string) || '',
    date: params.prefill_date ? new Date(params.prefill_date as string) : new Date(),
    durationMins: null as number | null,
    description: (params.prefill_desc as string) || '',
    location: '',
    host_name: '',
    host_email: '',
    keyword: 'event'
  });

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      const storedEmail = await SecureStore.getItemAsync('pallinky_user_email');
      const name = await SecureStore.getItemAsync('pallinky_user_name');
      const email = user?.email || storedEmail;

      if (email) {
        setForm(prev => ({ 
          ...prev, 
          host_email: email.toLowerCase().trim(), 
          host_name: name || user?.user_metadata?.full_name || email.split('@')[0] 
        }));
      }
    }
    loadUser();
  }, []);

  useEffect(() => {
    if (showLocation) {
      (async () => {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          let location = await Location.getCurrentPositionAsync({});
          setUserCoords({ lat: location.coords.latitude, lng: location.coords.longitude });
        }
      })();
    }
  }, [showLocation]);

  const handleUseCurrentLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("Permission denied", "We need location access to find where you are.");
      return;
    }
    const location = await Location.getCurrentPositionAsync({});
    const [address] = await Location.reverseGeocodeAsync({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude
    });
    if (address) {
      const formattedAddress = `${address.name || ''} ${address.street || ''}, ${address.city || ''}`.trim();
      setForm({...form, location: formattedAddress});
      setShowLocation(false);
    }
  };

  const saveFormal = async () => {
    if (!form.title) { Alert.alert("Required", "Please provide a title."); return; }
    setLoading(true);
    try {
      const endsAt = form.durationMins 
        ? new Date(form.date.getTime() + form.durationMins * 60 * 1000).toISOString()
        : null;
      
      const fullDescription = form.location 
        ? `${form.description}\n\nLocation: ${form.location}`.trim() 
        : form.description;

      const payload = {
        p_title: form.title.trim(),
        p_host_name: form.host_name.trim(),
        p_host_email: form.host_email,
        p_keyword: form.keyword,
        p_starts_at: form.date.toISOString(),
        p_ends_at: endsAt,
        p_location: form.location || null,
        p_description: fullDescription,
        p_event_type: 'formal',
        p_expires_in_days: 14
      };

      const { data, error } = await supabase.rpc('create_event_draft', payload);
      if (error) throw error;
      
      const row = Array.isArray(data) ? data[0] : data;
      router.push(`/create/success?slug=${row.slug}&manage_token=${row.manage_handle}&title=${encodeURIComponent(form.title)}`);
    } catch (e: any) {
      Alert.alert("Save Failed", e.message);
    } finally {
      setLoading(false);
    }
  };

  const onIOSChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (selectedDate) setTempDate(selectedDate);
  };

  const confirmIOSDate = () => {
    setForm({ ...form, date: tempDate });
    setShowPicker(false);
  };

  const showAndroidPicker = () => {
    DateTimePickerAndroid.open({
      value: form.date,
      mode: 'date',
      onChange: (event, date) => {
        if (event.type === 'set' && date) {
          DateTimePickerAndroid.open({
            value: date,
            mode: 'time',
            is24Hour: true,
            onChange: (tEvent, tDate) => {
              if (tEvent.type === 'set' && tDate) setForm({ ...form, date: tDate });
            }
          });
        }
      },
    });
  };

  const setDuration = (h: number, m: number) => {
    const total = (h * 60) + m;
    setForm({...form, durationMins: total > 0 ? total : null});
    setShowCustomDuration(false);
  };

  return (
    <SafeAreaView style={styles.wrapper} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => step > 1 ? setStep(step - 1) : router.back()}>
          <Ionicons name="arrow-back" size={26} color="#1f2a1b" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace('/(tabs)')}>
          <Ionicons name="close-circle" size={28} color="#1f2a1b" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          {step === 1 && (
            <View>
              <StyledText style={styles.stepTitle}>What's happening?</StyledText>
              <StyledText style={styles.progressText}>1/4</StyledText>
              <StyledInput placeholder="e.g. Dinner at 8" value={form.title} onChangeText={(t: string) => setForm({...form, title: t})} autoFocus style={styles.inputStyle} />
              <View style={[styles.navRow, { justifyContent: 'flex-end' }]}>
                <TouchableOpacity style={styles.circleBtn} onPress={() => setStep(2)}><Ionicons name="arrow-forward" size={24} color="#fff" /></TouchableOpacity>
              </View>
            </View>
          )}

          {step === 2 && (
            <View>
              <StyledText style={styles.stepTitle}>When is it?</StyledText>
              <StyledText style={styles.progressText}>2/4</StyledText>
              <StyledText style={styles.label}>START TIME</StyledText>
              <TouchableOpacity style={styles.pwaInput} onPress={() => Platform.OS === 'android' ? showAndroidPicker() : setShowPicker(true)}>
                <StyledText style={styles.pwaInputText}>{form.date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</StyledText>
              </TouchableOpacity>
              <StyledText style={styles.label}>DURATION</StyledText>
              <TouchableOpacity style={styles.pwaInput} onPress={() => setShowCustomDuration(true)}>
                <StyledText style={[styles.pwaInputText, !form.durationMins && { color: '#64748b' }]}>{form.durationMins ? `${Math.floor(form.durationMins/60)}h ${form.durationMins%60}m` : "No end time"}</StyledText>
                <Ionicons name="chevron-down" size={18} color="#64748b" />
              </TouchableOpacity>

              {showPicker && Platform.OS === 'ios' && (
                <View style={styles.iosPickerContainer}>
                  <View style={styles.iosPickerHeader}>
                    <TouchableOpacity onPress={() => setShowPicker(false)} style={{marginRight: 20}}><StyledText style={{color: '#64748b', fontWeight: '600'}}>Cancel</StyledText></TouchableOpacity>
                    <TouchableOpacity onPress={confirmIOSDate}><StyledText style={{color: '#43691b', fontWeight: '800'}}>Confirm</StyledText></TouchableOpacity>
                  </View>
                  <DateTimePicker value={tempDate} mode="datetime" display="inline" onChange={onIOSChange} accentColor="#43691b" />
                </View>
              )}

              <View style={styles.navRow}>
                <TouchableOpacity style={styles.circleBtn} onPress={() => setStep(1)}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
                <TouchableOpacity style={styles.circleBtn} onPress={() => setStep(3)}><Ionicons name="arrow-forward" size={24} color="#fff" /></TouchableOpacity>
              </View>
            </View>
          )}

          {step === 3 && (
            <View style={{ zIndex: 10 }}>
              <StyledText style={styles.stepTitle}>Details?</StyledText>
              <StyledText style={styles.progressText}>3/4</StyledText>
              <StyledInput placeholder="The plan is..." value={form.description} onChangeText={(t: string) => setForm({...form, description: t})} multiline style={[styles.inputStyle, {height: 120}]} />
              
              {form.location ? (
                <View style={styles.locationSelectionBadge}>
                   <Ionicons name="location" size={18} color="#43691b" />
                   <StyledText style={styles.locationSelectionText} numberOfLines={1}>{form.location}</StyledText>
                   <TouchableOpacity onPress={() => setForm({...form, location: ''})}><Ionicons name="close-circle" size={20} color="#64748b" /></TouchableOpacity>
                </View>
              ) : null}

              <TouchableOpacity style={styles.locationToggle} onPress={() => setShowLocation(!showLocation)}>
                <StyledText style={styles.locationToggleText}>{form.location ? "Change location?" : "Add a location?"}</StyledText>
                <Ionicons name={showLocation ? "chevron-up" : "chevron-forward"} size={18} color="#43691b" />
              </TouchableOpacity>

              {showLocation && (
                 <View style={{ zIndex: 2000 }}>
                   <TouchableOpacity style={styles.currentLocationBtn} onPress={handleUseCurrentLocation}>
                     <Ionicons name="locate" size={18} color="#43691b" /><StyledText style={styles.currentLocationBtnText}>Use My Current Location</StyledText>
                   </TouchableOpacity>
                   <GooglePlacesAutocomplete 
                    ref={googleRef}
                    placeholder='Search nearby...' 
                    onPress={(data) => { setForm({...form, location: data.description}); setShowLocation(false); }}
                    query={{ 
                      key: GOOGLE_MAPS_KEY, 
                      language: 'en',
                      location: userCoords ? `${userCoords.lat},${userCoords.lng}` : '52.3676,4.9041', 
                      radius: '15000', 
                    }} 
                    debounce={400}
                    styles={{ textInput: styles.inputStyle, container: { flex: 0 }, listView: styles.autocompleteListView }} 
                    enablePoweredByContainer={false} disableScroll={true} keyboardShouldPersistTaps="handled"
                  />
                 </View>
              )}
              <View style={styles.navRow}>
                <TouchableOpacity style={styles.circleBtn} onPress={() => setStep(2)}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
                <TouchableOpacity style={styles.circleBtn} onPress={() => setStep(4)}><Ionicons name="arrow-forward" size={24} color="#fff" /></TouchableOpacity>
              </View>
            </View>
          )}

          {step === 4 && (
            <View>
              <StyledText style={styles.stepTitle}>Host Name</StyledText>
              <StyledText style={styles.progressText}>4/4</StyledText>
              <StyledInput value={form.host_name} onChangeText={(t: string) => setForm({...form, host_name: t})} style={styles.inputStyle} />
              <TouchableOpacity style={styles.olivePill} onPress={saveFormal} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <StyledText style={styles.pillText}>Create Event</StyledText>}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showCustomDuration} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <StyledText style={styles.label}>Set Duration</StyledText>
            <View style={styles.durationInputRow}>
              <View style={styles.inputGroup}>
                <TextInput style={styles.modalInput} keyboardType="numeric" value={customHrs} onChangeText={(t: string) => setCustomHrs(t)} maxLength={2} />
                <StyledText>Hours</StyledText>
              </View>
              <View style={styles.inputGroup}>
                <TextInput style={styles.modalInput} keyboardType="numeric" value={customMins} onChangeText={(t: string) => setCustomMins(t)} maxLength={2} />
                <StyledText>Mins</StyledText>
              </View>
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setShowCustomDuration(false)}><StyledText style={{color: '#64748b'}}>Cancel</StyledText></TouchableOpacity>
              <TouchableOpacity onPress={() => setDuration(parseInt(customHrs || '0'), parseInt(customMins || '0'))}><StyledText style={{color: '#43691b', fontWeight: '800'}}>Set</StyledText></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#f5ebe0' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 10 },
  scrollContainer: { paddingHorizontal: 25, paddingBottom: 40 },
  stepTitle: { fontSize: 32, fontWeight: '900', color: '#1f2a1b' },
  progressText: { fontSize: 16, color: '#64748b', marginVertical: 5 },
  label: { fontSize: 12, fontWeight: '800', color: '#64748b', marginTop: 20, marginBottom: 8, letterSpacing: 1 },
  inputStyle: { fontSize: 16, backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#bae6fd', color: '#1f2a1b' },
  pwaInput: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#bae6fd' },
  pwaInputText: { fontSize: 18, color: '#1f2a1b', fontWeight: '600' },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 40 },
  circleBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#43691b', justifyContent: 'center', alignItems: 'center' },
  olivePill: { backgroundColor: '#43691b', paddingVertical: 18, borderRadius: 30, alignItems: 'center', marginTop: 30 },
  pillText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  locationToggle: { flexDirection: 'row', alignItems: 'center', marginTop: 15 },
  locationToggleText: { color: '#43691b', fontWeight: '700', marginRight: 5 },
  locationSelectionBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 12, marginTop: 15, borderWidth: 1, borderColor: '#bae6fd' },
  locationSelectionText: { flex: 1, color: '#43691b', fontWeight: '700', marginHorizontal: 8 },
  currentLocationBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#43691b', alignSelf: 'flex-start' },
  currentLocationBtnText: { color: '#43691b', fontWeight: '800', marginLeft: 8, fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', padding: 25, borderRadius: 20, width: '80%' },
  durationInputRow: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 20 },
  inputGroup: { alignItems: 'center' },
  modalInput: { borderBottomWidth: 2, borderBottomColor: '#43691b', fontSize: 32, textAlign: 'center', width: 60, marginBottom: 5, color: '#1f2a1b' },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  iosPickerContainer: { backgroundColor: '#fff', borderRadius: 15, padding: 10, marginBottom: 20, overflow: 'hidden' },
  iosPickerHeader: { flexDirection: 'row', justifyContent: 'flex-end', padding: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  autocompleteListView: { position: 'absolute', top: 60, left: 0, right: 0, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#bae6fd', zIndex: 3000, elevation: 10, maxHeight: 200 }
});