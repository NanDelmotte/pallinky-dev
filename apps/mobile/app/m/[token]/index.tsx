/** * Path: app/m/[token]/index.tsx 
 * Description: Host Management Dashboard. 
 * Updated: Added "Invite" button to action grid to link back to the success/thanks page. */
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Share, Alert, TextInput, Platform, Modal, KeyboardAvoidingView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@tarti-flette/core'; 
import { StyledText } from '@tarti-flette/ui';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function ManageEventScreen() {
  const { token } = useLocalSearchParams();
  const router = useRouter();
  const [event, setEvent] = useState<any>(null);
  const [guests, setGuests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isEditing, setIsEditing] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageSubject, setMessageSubject] = useState('');
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    location: '',
    starts_at: new Date(),
    ends_at: new Date()
  });

  useEffect(() => {
    fetchData();
  }, [token]);

  async function fetchData() {
    const { data: ev } = await supabase.rpc('get_event_by_manage_token', { p_manage_token: token });
    if (ev && ev[0]) {
      setEvent(ev[0]);
      setEditForm({
        title: ev[0].title,
        description: ev[0].description || '',
        location: ev[0].location || '',
        starts_at: ev[0].starts_at ? new Date(ev[0].starts_at) : new Date(),
        ends_at: ev[0].ends_at ? new Date(ev[0].ends_at) : new Date(),
      });
      const { data: rsvps } = await supabase.from('rsvps').select('*').eq('event_id', ev[0].id).order('responded_at', { ascending: false });
      setGuests(rsvps || []);
    }
    setLoading(false);
  }

  const handleUpdate = async () => {
    try {
      const { error } = await supabase.rpc('update_event_by_manage_token', {
        p_manage_token: token,
        p_title: editForm.title,
        p_starts_at: editForm.starts_at.toISOString(),
        p_ends_at: editForm.ends_at.toISOString(),
        p_location: editForm.location,
        p_description: editForm.description,
        p_cover_image_url: event.cover_image_url,
        p_expires_at: event.expires_at,
        p_gif_key: event.gif_key
      });

      if (error) throw error;
      fetchData();
      setIsEditing(false);
      Alert.alert("Success", "Event updated!");
    } catch (err) {
      Alert.alert("Error", "Update failed.");
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !messageSubject.trim()) {
      Alert.alert("Missing Info", "Please provide both a subject and a message.");
      return;
    }
    
    setIsSending(true);
    try {
      const { error } = await supabase.rpc('send_host_message_by_manage_token', { 
        p_manage_token: token,
        p_subject: messageSubject.trim(),
        p_body: messageText.trim()
      });

      if (error) throw error;
      
      Alert.alert("Sent!", "Your message has been added to the outbox for all guests.");
      setMessageText('');
      setMessageSubject('');
      setShowMessageModal(false);
    } catch (err) {
      Alert.alert("Error", "Failed to queue messages.");
    } finally {
      setIsSending(false);
    }
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator color="#43691b" /></View>;
  if (!event) return <View style={styles.centered}><StyledText>Event not found.</StyledText></View>;

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={styles.headerNav}>
        <TouchableOpacity onPress={() => isEditing ? setIsEditing(false) : router.replace('/(tabs)')} style={styles.closeBtn}>
          <Ionicons name={isEditing ? "close" : "arrow-back"} size={24} color="#1a1a1a" />
          <StyledText style={styles.backText}>{isEditing ? "Cancel" : "My Social Hub"}</StyledText>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <StyledText style={styles.overline}></StyledText>
        
        {isEditing ? (
          <View style={styles.editForm}>
            <StyledText style={styles.label}>Title</StyledText>
            <TextInput style={styles.input} value={editForm.title} onChangeText={(t) => setEditForm({...editForm, title: t})} />
            
            <StyledText style={styles.label}>Description</StyledText>
            <TextInput style={[styles.input, { height: 80 }]} value={editForm.description} onChangeText={(t) => setEditForm({...editForm, description: t})} multiline />

            <StyledText style={styles.label}>Location</StyledText>
            <TextInput style={styles.input} value={editForm.location} onChangeText={(t) => setEditForm({...editForm, location: t})} />
            
            <View style={styles.timeRow}>
                <View style={{ flex: 1 }}>
                    <StyledText style={styles.label}>Starts</StyledText>
                    <TouchableOpacity style={styles.dateBox} onPress={() => setShowStartPicker(true)}>
                        <StyledText>{editForm.starts_at.toLocaleString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</StyledText>
                    </TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                    <StyledText style={styles.label}>Ends</StyledText>
                    <TouchableOpacity style={styles.dateBox} onPress={() => setShowEndPicker(true)}>
                        <StyledText>{editForm.ends_at.toLocaleString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</StyledText>
                    </TouchableOpacity>
                </View>
            </View>

            {(showStartPicker || showEndPicker) && (
              <DateTimePicker 
                value={showStartPicker ? editForm.starts_at : editForm.ends_at} 
                mode="datetime" 
                is24Hour={true}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(e, d) => {
                  setShowStartPicker(false);
                  setShowEndPicker(false);
                  if(d) {
                      if(showStartPicker) setEditForm({...editForm, starts_at: d});
                      else setEditForm({...editForm, ends_at: d});
                  }
                }} 
              />
            )}
            
            <TouchableOpacity style={styles.saveBtn} onPress={handleUpdate}>
              <StyledText style={styles.saveBtnText}>Save Changes</StyledText>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <StyledText style={styles.title}>{event.title}</StyledText>
            
            <View style={styles.actionGrid}>
              <TouchableOpacity style={styles.actionItem} onPress={() => setIsEditing(true)}>
                <View style={[styles.iconCircle, { backgroundColor: '#eef2ff' }]}><Ionicons name="create" size={24} color="#4338ca" /></View>
                <StyledText style={styles.actionLabel}>Edit Info</StyledText>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionItem} onPress={() => router.push(`/m/${token}/studio`)}>
                <View style={[styles.iconCircle, { backgroundColor: '#fff1f2' }]}><Ionicons name="color-palette" size={24} color="#be123c" /></View>
                <StyledText style={styles.actionLabel}>Studio</StyledText>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.actionItem} 
                onPress={() => router.push({
                  pathname: '/create/success',
                  params: { 
                    slug: event.slug, 
                    manage_token: token, 
                    title: event.title 
                  }
                })}
              >
                <View style={[styles.iconCircle, { backgroundColor: '#f0fdf4' }]}><Ionicons name="send" size={24} color="#15803d" /></View>
                <StyledText style={styles.actionLabel}>Invite</StyledText>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionItem} onPress={() => setShowMessageModal(true)}>
                <View style={[styles.iconCircle, { backgroundColor: '#fefce8' }]}><Ionicons name="mail" size={24} color="#a16207" /></View>
                <StyledText style={styles.actionLabel}>Message</StyledText>
              </TouchableOpacity>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <StyledText style={styles.statNum}>{guests.filter(g => g.status === 'yes').length}</StyledText>
                <StyledText style={styles.statLabel}>Going</StyledText>
              </View>
              <View style={styles.statCard}>
                <StyledText style={styles.statNum}>{guests.filter(g => g.status === 'maybe').length}</StyledText>
                <StyledText style={styles.statLabel}>Maybe</StyledText>
              </View>
            </View>

            <StyledText style={styles.sectionTitle}>Guest List ({guests.length})</StyledText>
            {guests.map((guest, i) => (
              <View key={i} style={styles.guestRow}>
                <View>
                  <StyledText style={styles.guestName}>{guest.name}</StyledText>
                  {guest.message && <StyledText style={styles.guestMsg}>"{guest.message}"</StyledText>}
                </View>
                <View style={[styles.statusBadge, { backgroundColor: guest.status === 'yes' ? '#e8f0e0' : '#f5f5f5' }]}>
                  <StyledText style={styles.statusText}>{guest.status}</StyledText>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <Modal visible={showMessageModal} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <StyledText style={styles.modalTitle}>Update Guests</StyledText>
              <TouchableOpacity onPress={() => setShowMessageModal(false)}>
                <Ionicons name="close-circle" size={28} color="#ccc" />
              </TouchableOpacity>
            </View>
            
            <TextInput 
              style={styles.subjectInput} 
              placeholder="Subject (e.g. Quick Update)" 
              value={messageSubject}
              onChangeText={setMessageSubject}
            />

            <TextInput 
              style={styles.messageInput} 
              placeholder="Your message to guests..." 
              multiline 
              value={messageText}
              onChangeText={setMessageText}
            />

            <TouchableOpacity 
              style={[styles.sendBtn, (!messageText.trim() || !messageSubject.trim() || isSending) && { opacity: 0.5 }]} 
              onPress={handleSendMessage}
              disabled={!messageText.trim() || !messageSubject.trim() || isSending}
            >
              {isSending ? <ActivityIndicator color="#fff" /> : (
                <>
                  <StyledText style={styles.sendBtnText}>Send to {guests.length} Guests</StyledText>
                  <Ionicons name="paper-plane" size={18} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  headerNav: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 10 },
  closeBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backText: { fontSize: 16, fontWeight: '600' },
  container: { flex: 1, padding: 24 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  overline: { fontSize: 12, textTransform: 'uppercase', color: '#43691b', fontWeight: '800', letterSpacing: 1 },
  title: { fontSize: 32, fontWeight: '900', marginBottom: 24, color: '#1a1a1a' },
  actionGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
  actionItem: { width: '22%', alignItems: 'center' },
  iconCircle: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  actionLabel: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  statCard: { flex: 1, padding: 16, backgroundColor: '#f9fbf7', borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#e8f0e0' },
  statNum: { fontSize: 22, fontWeight: '900', color: '#43691b' },
  statLabel: { fontSize: 10, color: '#666', fontWeight: '600' },
  sectionTitle: { fontSize: 14, fontWeight: '800', textTransform: 'uppercase', marginBottom: 16, color: '#43691b' },
  guestRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  guestName: { fontSize: 16, fontWeight: '600' },
  guestMsg: { fontSize: 13, color: '#666', fontStyle: 'italic', marginTop: 2 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '700' },
  editForm: { marginTop: 20 },
  label: { fontSize: 12, fontWeight: '800', color: '#43691b', marginBottom: 4, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderColor: '#d1d1f0', padding: 15, borderRadius: 12, marginBottom: 20, fontSize: 16 },
  timeRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  dateBox: { borderWidth: 1, borderColor: '#d1d1f0', padding: 15, borderRadius: 12, backgroundColor: '#fcfcff' },
  saveBtn: { backgroundColor: '#43691b', padding: 18, borderRadius: 15, alignItems: 'center', marginTop: 10 },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 60 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 24, fontWeight: '900', color: '#1a1a1a' },
  subjectInput: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 15, fontSize: 16, marginBottom: 12, fontWeight: '600' },
  messageInput: { backgroundColor: '#f5f5f5', borderRadius: 16, padding: 18, height: 140, fontSize: 16, textAlignVertical: 'top' },
  sendBtn: { backgroundColor: '#1a1a1a', padding: 20, borderRadius: 20, alignItems: 'center', marginTop: 20, flexDirection: 'row', justifyContent: 'center', gap: 12 },
  sendBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' }
});