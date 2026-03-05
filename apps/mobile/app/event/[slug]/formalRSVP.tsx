/** * Path: app/event/[slug]/formalRSVP.tsx 
 * Description: Formal RSVP page for 'Seal a Deal' plans. 
 * Updated: Adjusted layout for better SafeAreaView notch clearance and improved visual hierarchy. */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, ScrollView, TouchableOpacity, Modal, TextInput, Image, SafeAreaView, Platform, Linking, StatusBar } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '@tarti-flette/core';
import { CalendarButton } from '@tarti-flette/ui';
import { Ionicons } from '@expo/vector-icons';

const PALETTES: Record<string, { bg: string; accent: string; text: string; isDark: boolean }> = {
  "zen": { bg: "#f8e9dc", accent: "#43691b", text: "#1f2a1b", isDark: false },
  "girly": { bg: "#f4bbd3", accent: "#fe5d9f", text: "#2b1f24", isDark: false },
  "fiesta": { bg: "#1729ae", accent: "#fe20e8", text: "#ffffff", isDark: true },
  "classy": { bg: "#03172f", accent: "#efd466", text: "#fff7b6", isDark: true },
  "spicy": { bg: "#656c12", accent: "#ecc216", text: "#ffffff", isDark: true },
};

const FONT_MAP: Record<string, string> = {
  'Sans': Platform.OS === 'ios' ? 'Arial-BoldMT' : 'sans-serif-condensed',
  'Serif': Platform.OS === 'ios' ? 'Times New Roman' : 'serif',
  'Cursive': Platform.OS === 'ios' ? 'SnellRoundhand-Bold' : 'cursive',
  'Gothic': Platform.OS === 'ios' ? 'Copperplate-Bold' : 'monospace'
};

export default function FormalRSVP() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<any>(null);
  const [guests, setGuests] = useState<any[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [existingStatus, setExistingStatus] = useState<string | null>(null);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<'yes' | 'maybe' | 'no' | null>(null);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [message, setMessage] = useState('');

  const themeKey = event?.gif_key && PALETTES[event.gif_key] ? event.gif_key : "zen";
  const theme = PALETTES[themeKey];
  const customFont = { fontFamily: FONT_MAP[event?.font_family] || (Platform.OS === 'ios' ? 'Arial-BoldMT' : 'sans-serif') };
  
  const badgeBg = theme.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)';
  const badgeText = theme.isDark ? '#ffffff' : '#333333';

  const hasLocationInDesc = event?.description?.includes('Location: ');
  const displayDescription = hasLocationInDesc 
    ? event.description.split('Location: ')[0].trim() 
    : event?.description;
  const locationText = hasLocationInDesc 
    ? event.description.split('Location: ')[1].trim() 
    : event?.location;

  const openInMaps = () => {
    if (!locationText) return;
    const url = Platform.select({
      ios: `maps:0,0?q=${encodeURIComponent(locationText)}`,
      android: `geo:0,0?q=${encodeURIComponent(locationText)}`
    });
    if (url) Linking.openURL(url);
  };

  useEffect(() => { fetchData(); }, [slug]);

  const fetchData = async () => {
    try {
      const { data: eventData } = await supabase.from('events').select('*').eq('slug', slug).single();
      setEvent(eventData);

      const savedEmail = await SecureStore.getItemAsync('pallinky_user_email');
      if (savedEmail && eventData) {
        const emailLower = savedEmail.toLowerCase().trim();
        setUserEmail(emailLower);
        setGuestEmail(emailLower);
        setConfirmEmail(emailLower);

        const { data: profile } = await supabase.from('profiles').select('display_name').eq('email_lc', emailLower).maybeSingle();
        const { data: existingRsvp } = await supabase
          .from('rsvps')
          .select('id, status, name, message')
          .eq('event_id', eventData.id)
          .eq('email_lc', emailLower)
          .maybeSingle();

        const knownName = existingRsvp?.name || profile?.display_name || emailLower.split('@')[0];
        setGuestName(knownName);
        
        if (existingRsvp?.status && existingRsvp.status !== 'pending') {
          setExistingStatus(existingRsvp.status);
          setSelectedStatus(existingRsvp.status);
          setMessage(existingRsvp.message || '');
        }
      }

      const { data: guestData } = await supabase.rpc('get_guest_list', { p_slug: slug });
      if (guestData) setGuests(guestData);
    } catch (err) { 
      console.error(err); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleSwitchUser = async () => {
    setUserEmail(null);
    setGuestName('');
    setGuestEmail('');
    setConfirmEmail('');
    setExistingStatus(null);
  };

  const submitRSVP = async () => {
    if (!guestName.trim() || !guestEmail.trim()) return Alert.alert("Wait", "Please enter your name and email.");
    if (!userEmail && guestEmail.toLowerCase().trim() !== confirmEmail.toLowerCase().trim()) {
      return Alert.alert("Check Email", "The emails don't match.");
    }
    
    try {
      const { error } = await supabase.rpc('submit_rsvp', {
        p_slug: slug, p_name: guestName, p_email: guestEmail.toLowerCase().trim(),
        p_status: selectedStatus, p_message: message.trim() || null
      });
      if (error) throw error;
      
      if (!userEmail) {
        await SecureStore.setItemAsync('pallinky_user_email', guestEmail.toLowerCase().trim());
      }

      setModalVisible(false);
      router.push({ 
        pathname: `/event/${slug}/thanks` as any, 
        params: { status: selectedStatus, theme: themeKey } 
      });
    } catch (err) { Alert.alert("Error", "Submission failed."); }
  };

  if (loading || !event) return <ActivityIndicator color={theme?.accent || "#000"} style={{ flex: 1, backgroundColor: theme?.bg || '#fff' }} />;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.isDark ? "light-content" : "dark-content"} />
      
      {/* Header Container for Notch Clearance */}
      <View style={styles.headerContainer}>
        <TouchableOpacity 
          style={[styles.backBtn, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]} 
          onPress={() => router.push('/(tabs)')} 
        >
          <Ionicons name="arrow-back" size={20} color={theme.text} />
          <Text style={[styles.backBtnText, { color: theme.text }, customFont]}>Planning</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {event.cover_image_url && (
          <View style={styles.imageWrapper}>
            <Image source={{ uri: event.cover_image_url }} style={styles.coverImage} />
          </View>
        )}
        
        <View style={styles.content}>
          <Text style={[styles.title, { color: theme.text }, customFont]}>{event.title}</Text>
          <Text style={[styles.host, { color: theme.text, opacity: 0.7 }, customFont]}>Hosted by {event.host_name}</Text>
          
          <View style={styles.infoBox}>
            <Text style={[styles.infoText, { color: theme.text }, customFont]}>
              {new Date(event.starts_at).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
            </Text>
            
            {locationText && (
              <TouchableOpacity onPress={openInMaps} style={styles.locationLink}>
                <Text style={[styles.infoText, { color: theme.accent, marginTop: 8 }, customFont]}>
                  📍 {locationText}
                </Text>
                <Text style={{ fontSize: 11, color: theme.accent, opacity: 0.8, marginLeft: 24, fontWeight: '700' }}>
                  Open in Maps
                </Text>
              </TouchableOpacity>
            )}
            
            <View style={{ marginTop: 15 }}>
              <CalendarButton event={event} theme={theme} />
            </View>
          </View>

          {displayDescription && (
            <View style={styles.descriptionContainer}>
               <Text style={[styles.descriptionText, { color: theme.text, opacity: 0.9 }, customFont]}>
                {displayDescription}
               </Text>
            </View>
          )}

          <View style={styles.btnStack}>
            {existingStatus ? (
              <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: theme.accent }]} onPress={() => setModalVisible(true)}>
                <Text style={[styles.primaryBtnText, { color: theme.bg }]}>Change RSVP</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: theme.accent }]} onPress={() => { setSelectedStatus('yes'); setModalVisible(true); }}>
                  <Text style={[styles.primaryBtnText, { color: theme.bg }]}>I'm Going</Text>
                </TouchableOpacity>
                <View style={styles.secondaryRow}>
                  <TouchableOpacity style={[styles.secondaryBtn, { borderColor: theme.accent }]} onPress={() => { setSelectedStatus('maybe'); setModalVisible(true); }}>
                    <Text style={[styles.secondaryBtnText, { color: theme.accent }]}>Maybe</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.secondaryBtn, { borderColor: theme.accent }]} onPress={() => { setSelectedStatus('no'); setModalVisible(true); }}>
                    <Text style={[styles.secondaryBtnText, { color: theme.accent }]}>No</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>

          <Text style={[styles.sectionTitle, { color: theme.text, borderBottomColor: theme.accent + '30' }, customFont]}>Guest List</Text>
          <View style={styles.guestList}>
            {guests.map((guest, i) => (
              <View key={i} style={[styles.guestCard, { backgroundColor: badgeBg }]}>
                <Text style={[styles.statusIcon, { color: badgeText }]}>
                  {guest.status === 'yes' ? '✓' : guest.status === 'maybe' ? '?' : '✕'}
                </Text>
                <Text style={[styles.guestName, { color: badgeText }, customFont]}>{guest.name?.split(' ')[0] || "Guest"}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Modal remains unchanged for logic, but inherits theme better */}
        <Modal visible={modalVisible} animationType="slide" transparent={true}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.bg }]}>
              <Text style={[styles.modalTitle, { color: theme.text }, customFont]}>RSVP</Text>
              
              {!userEmail ? (
                <>
                  <TextInput style={[styles.input, { color: theme.text, borderColor: theme.accent + '30' }, customFont]} placeholder="Full Name" placeholderTextColor={theme.text + '50'} value={guestName} onChangeText={setGuestName} />
                  <TextInput style={[styles.input, { color: theme.text, borderColor: theme.accent + '30' }]} placeholder="Email Address" placeholderTextColor={theme.text + '50'} value={guestEmail} onChangeText={setGuestEmail} keyboardType="email-address" autoCapitalize="none" />
                  <TextInput style={[styles.input, { color: theme.text, borderColor: theme.accent + '30' }]} placeholder="Confirm Email" placeholderTextColor={theme.text + '50'} value={confirmEmail} onChangeText={setConfirmEmail} keyboardType="email-address" autoCapitalize="none" />
                </>
              ) : (
                <View style={styles.knownUserBox}>
                  <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                    <View>
                      <Text style={[styles.knownUserText, { color: theme.text }, customFont]}>Going as {guestName}</Text>
                      <Text style={[styles.knownUserSub, { color: theme.text, opacity: 0.6 }]}>{userEmail}</Text>
                    </View>
                    <TouchableOpacity onPress={handleSwitchUser}>
                      <Text style={{color: theme.accent, fontWeight: 'bold', fontSize: 12, textDecorationLine: 'underline'}}>Not you?</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <View style={styles.statusToggleRow}>
                {(['yes', 'maybe', 'no'] as const).map((s) => (
                  <TouchableOpacity 
                    key={s} 
                    onPress={() => setSelectedStatus(s)}
                    style={[styles.statusTab, selectedStatus === s && { backgroundColor: theme.accent }]}
                  >
                    <Text style={[styles.statusTabText, { color: selectedStatus === s ? theme.bg : theme.text }]}>
                      {s.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              <TextInput style={[styles.input, { color: theme.text, borderColor: theme.accent + '30', height: 80 }]} placeholder="Note for the host..." placeholderTextColor={theme.text + '50'} value={message} onChangeText={setMessage} multiline />
              <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: theme.accent, marginTop: 10 }]} onPress={submitRSVP}>
                <Text style={[styles.primaryBtnText, { color: theme.bg }]}>Confirm {selectedStatus?.toUpperCase()}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={{marginTop:25, alignItems:'center'}}>
                <Text style={{color: theme.text, opacity: 0.6, fontWeight: '700'}}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  headerContainer: { paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 10 : 0, paddingBottom: 10 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  backBtnText: { fontSize: 14, fontWeight: '700' },
  container: { flex: 1 },
  imageWrapper: { width: '100%', paddingHorizontal: 20, marginTop: 5 },
  coverImage: { width: '100%', height: 220, borderRadius: 24 },
  content: { padding: 25, paddingTop: 15 },
  title: { fontSize: 34, fontWeight: '900', letterSpacing: -1, marginBottom: 4 },
  host: { fontSize: 18, marginBottom: 25 },
  infoBox: { marginBottom: 30 },
  infoText: { fontSize: 18, fontWeight: '600' },
  locationLink: { marginTop: 4, marginBottom: 5 },
  descriptionContainer: { marginBottom: 35, padding: 5 },
  descriptionText: { fontSize: 17, lineHeight: 26 },
  btnStack: { gap: 10, marginBottom: 50 },
  primaryBtn: { height: 60, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  primaryBtnText: { fontSize: 19, fontWeight: '800' },
  secondaryRow: { flexDirection: 'row', gap: 10 },
  secondaryBtn: { flex: 1, height: 55, borderRadius: 16, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  secondaryBtnText: { fontSize: 15, fontWeight: '700' },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 15, paddingBottom: 8, borderBottomWidth: 1 },
  guestList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 40 },
  guestCard: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  statusIcon: { fontSize: 13, fontWeight: '900', marginRight: 6 },
  guestName: { fontSize: 14, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { padding: 25, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingBottom: 60 },
  modalTitle: { fontSize: 24, fontWeight: '900', marginBottom: 20 },
  input: { borderWidth: 1, borderRadius: 12, padding: 15, marginBottom: 12, fontSize: 16 },
  knownUserBox: { marginBottom: 20, paddingHorizontal: 5 },
  knownUserText: { fontSize: 18, fontWeight: '800' },
  knownUserSub: { fontSize: 14, marginTop: 2 },
  statusToggleRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statusTab: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)', justifyContent: 'center', alignItems: 'center' },
  statusTabText: { fontSize: 12, fontWeight: 'bold' }
});