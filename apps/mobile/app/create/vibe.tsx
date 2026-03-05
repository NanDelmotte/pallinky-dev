/** * Path: app/create/vibe.tsx 
 * Version: v14
 * Description: Removed deprecated SafeAreaView and migrated to react-native-safe-area-context.
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, ActivityIndicator, StatusBar, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyledText, StyledInput } from '@tarti-flette/ui';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '@tarti-flette/core';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import * as Location from 'expo-location';

const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

export default function VibeCreateScreen() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());
  const [userCoords, setUserCoords] = useState<{lat: number, lng: number} | null>(null);
  const googleRef = useRef<any>(null);
  
  const [form, setForm] = useState({
    title: '',
    pollOptions: [] as Date[],
    description: '',
    location: '',
    host_name: '',
    host_email: ''
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

  const getRoundedDate = () => {
    const d = new Date();
    const ms = 1000 * 60 * 15; 
    return new Date(Math.round(d.getTime() / ms) * ms);
  };

  const confirmAddDate = () => {
    const alreadyExists = form.pollOptions.some(d => d.getTime() === tempDate.getTime());
    if (!alreadyExists) {
      setForm(prev => ({ ...prev, pollOptions: [...prev.pollOptions, tempDate] }));
    }
    setShowPicker(false);
  };

  const onIOSChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (selectedDate) setTempDate(selectedDate);
  };

  const saveVibe = async () => {
    if (!form.host_email) {
      Alert.alert("Identity Error", "Please ensure you are logged in.");
      return;
    }
    setLoading(true);
    const fullDescription = form.location 
      ? `${form.description}\n\nLocation: ${form.location}`.trim() 
      : form.description;

    try {
      const { data, error } = await supabase.rpc("create_event_draft", {
        p_title: form.title.trim(),
        p_host_name: form.host_name.trim(),
        p_host_email: form.host_email.toLowerCase().trim(),
        p_description: fullDescription,
        p_keyword: "vibe-" + Math.random().toString(36).substring(2, 7),
        p_gif_key: "waves",
        p_event_type: 'vibe', 
        p_proposed_dates: form.pollOptions.map(d => d.toISOString()) 
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      router.push(`/create/success-vibe?slug=${row.slug}&manage_token=${row.manage_handle}&title=${encodeURIComponent(form.title)}`);
    } catch (e: any) {
      Alert.alert("Save Failed", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.wrapper} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => step > 1 ? setStep(step - 1) : router.back()} style={styles.navIconBtn}>
          <Ionicons name="arrow-back" size={28} color="#003049" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={styles.navIconBtn}>
          <Ionicons name="close-circle" size={32} color="#003049" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {step === 1 && (
            <View>
              <StyledText style={styles.stepTitle}>What's the idea?</StyledText>
              <StyledInput placeholder="e.g. Sunday Roast?" value={form.title} onChangeText={(t: string) => setForm({...form, title: t})} autoFocus style={styles.inputStyle} />
              <View style={styles.navSpacer} />
              <View style={[styles.nav, { justifyContent: 'flex-end' }]}>
                <TouchableOpacity style={[styles.btn, !form.title && {opacity: 0.5}]} onPress={() => setStep(2)} disabled={!form.title}>
                  <Ionicons name="arrow-forward" size={28} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {step === 2 && (
            <View>
              <StyledText style={styles.stepTitle}>Suggest some dates</StyledText>
              <View style={{marginBottom: 10}}>
                {form.pollOptions.map((opt, i) => (
                  <View key={i} style={styles.pollBadge}>
                    <StyledText style={{color: '#0077b6', flex: 1, fontWeight: '700'}}>
                      {opt.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </StyledText>
                    <TouchableOpacity onPress={() => setForm({ ...form, pollOptions: form.pollOptions.filter((_, idx) => idx !== i) })}>
                      <Ionicons name="close-circle" size={22} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              {!showPicker ? (
                <TouchableOpacity 
                  style={styles.dateAdd} 
                  onPress={() => { setTempDate(getRoundedDate()); setShowPicker(true); }}
                >
                  <Ionicons name="calendar" size={20} color="#0077b6" style={{marginBottom: 5}} />
                  <StyledText style={{color: '#0077b6', fontWeight: '800'}}>+ Add Date Option</StyledText>
                </TouchableOpacity>
              ) : (
                <View style={styles.iosPickerContainer}>
                  <DateTimePicker value={tempDate} mode="datetime" display="inline" onChange={onIOSChange} accentColor="#0077b6" minuteInterval={15} />
                  <View style={styles.iosPickerFooter}>
                    <TouchableOpacity onPress={() => setShowPicker(false)} style={styles.cancelBtn}><StyledText style={{color: '#64748b', fontWeight: '600'}}>Cancel</StyledText></TouchableOpacity>
                    <TouchableOpacity onPress={confirmAddDate} style={styles.confirmBtn}><StyledText style={{color: '#fff', fontWeight: '800'}}>Confirm Date</StyledText></TouchableOpacity>
                  </View>
                </View>
              )}

              <View style={styles.nav}>
                <TouchableOpacity style={styles.btn} onPress={() => setStep(1)}><Ionicons name="arrow-back" size={28} color="#fff" /></TouchableOpacity>
                <TouchableOpacity style={[styles.btn, showPicker && {opacity: 0.3}]} onPress={() => setStep(3)} disabled={showPicker}><Ionicons name="arrow-forward" size={28} color="#fff" /></TouchableOpacity>
              </View>
            </View>
          )}

          {step === 3 && (
            <View style={{ zIndex: 10 }}>
              <StyledText style={styles.stepTitle}>Add details</StyledText>
              <StyledInput placeholder="The plan is..." value={form.description} onChangeText={(t: string) => setForm({...form, description: t})} multiline style={[styles.inputStyle, {height: 120}]} />
              
              {form.location ? (
                <View style={styles.locationSelectionBadge}>
                   <Ionicons name="location" size={18} color="#0077b6" />
                   <StyledText style={styles.locationSelectionText} numberOfLines={1}>{form.location}</StyledText>
                   <TouchableOpacity onPress={() => setForm({...form, location: ''})}>
                     <Ionicons name="close-circle" size={20} color="#64748b" />
                   </TouchableOpacity>
                </View>
              ) : null}

              <TouchableOpacity style={styles.locationToggle} onPress={() => setShowLocation(!showLocation)}>
                <StyledText style={styles.locationToggleText}>{form.location ? "Change location?" : "Add a location?"}</StyledText>
                <Ionicons name={showLocation ? "chevron-up" : "chevron-forward"} size={18} color="#0077b6" />
              </TouchableOpacity>
              
              {showLocation && (
                 <View style={{ zIndex: 2000 }}>
                   <TouchableOpacity style={styles.currentLocationBtn} onPress={handleUseCurrentLocation}>
                     <Ionicons name="locate" size={18} color="#0077b6" />
                     <StyledText style={styles.currentLocationBtnText}>Use My Current Location</StyledText>
                   </TouchableOpacity>

                   <GooglePlacesAutocomplete 
                    ref={googleRef}
                    placeholder='Search nearby...' 
                    onPress={(data) => { 
                      setForm({...form, location: data.description}); 
                      setShowLocation(false); 
                    }}
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
              <View style={styles.nav}>
                <TouchableOpacity style={styles.btn} onPress={() => setStep(2)}><Ionicons name="arrow-back" size={28} color="#fff" /></TouchableOpacity>
                <TouchableOpacity style={styles.btn} onPress={() => setStep(4)}><Ionicons name="arrow-forward" size={28} color="#fff" /></TouchableOpacity>
              </View>
            </View>
          )}

          {step === 4 && (
            <View>
              <StyledText style={styles.stepTitle}>Who's fishing?</StyledText>
              <StyledInput placeholder="Your Name" value={form.host_name} onChangeText={(t: string) => setForm({...form, host_name: t})} style={styles.inputStyle} />
              <View style={styles.nav}>
                <TouchableOpacity style={styles.btn} onPress={() => setStep(3)}><Ionicons name="arrow-back" size={28} color="#fff" /></TouchableOpacity>
                <TouchableOpacity style={[styles.btn, {backgroundColor: '#0077b6'}]} onPress={saveVibe} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <MaterialCommunityIcons name="waves" size={32} color="#fff" />}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#e0f2fe' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10 },
  navIconBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  container: { padding: 25, paddingTop: 10 },
  stepTitle: { fontSize: 28, fontWeight: '900', color: '#003049', marginBottom: 20 },
  inputStyle: { fontSize: 18, backgroundColor: '#fff', borderRadius: 15, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#bae6fd', color: '#003049' },
  locationToggle: { flexDirection: 'row', alignItems: 'center', marginTop: 5, marginBottom: 15 },
  locationToggleText: { color: '#0077b6', fontWeight: '700', marginRight: 5 },
  locationSelectionBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#bae6fd' },
  locationSelectionText: { flex: 1, color: '#0077b6', fontWeight: '700', marginHorizontal: 8 },
  currentLocationBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 12, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#0077b6', alignSelf: 'flex-start' },
  currentLocationBtnText: { color: '#0077b6', fontWeight: '800', marginLeft: 8, fontSize: 14 },
  dateAdd: { padding: 25, borderRadius: 15, borderStyle: 'dashed', borderWidth: 2, borderColor: '#0077b6', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.5)', marginBottom: 20 },
  pollBadge: { backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 10, borderLeftWidth: 5, borderLeftColor: '#0077b6', flexDirection: 'row', alignItems: 'center' },
  nav: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  navSpacer: { height: 10 },
  btn: { backgroundColor: '#003049', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  iosPickerContainer: { backgroundColor: '#fff', borderRadius: 20, padding: 10, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  iosPickerFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10, marginTop: 5, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  cancelBtn: { padding: 10 },
  confirmBtn: { backgroundColor: '#0077b6', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  autocompleteListView: { position: 'absolute', top: 60, left: 0, right: 0, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#bae6fd', zIndex: 3000, elevation: 10, maxHeight: 200 }
});