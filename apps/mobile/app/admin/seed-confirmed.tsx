import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  Alert, ScrollView, KeyboardAvoidingView, Platform 
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '@tarti-flette/core';

export default function SeedConfirmedScreen() {
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [form, setForm] = useState({
    title: '',
    host_name: 'Admin',
    host_email: 'nanbowles@gmail.com',
    location: '',
    guestNames: '',
    eventDate: new Date(),
  });

  const handleSeed = async () => {
    if (!form.title.trim() || !form.guestNames.trim()) {
      Alert.alert("Error", "Title and Guest Names are required.");
      return;
    }

    setLoading(true);

    try {
      const { data, error: eventError } = await supabase.rpc('create_event_draft', {
        p_title: form.title.trim(),
        p_host_name: form.host_name,
        p_host_email: form.host_email.toLowerCase().trim(),
        p_keyword: 'archive',
        p_starts_at: form.eventDate.toISOString(),
        p_location: form.location.trim() || 'Archive',
        p_description: 'Historical import.',
        p_event_type: 'formal',
        p_expires_in_days: 3650 
      });

      if (eventError) throw eventError;

      const eventId = data[0].id;
      const names = form.guestNames.split(',').map(n => n.trim()).filter(n => n !== '');

      const rsvpData = names.map(name => ({
        event_id: eventId,
        name: name,
        email: `${name.toLowerCase().replace(/\s+/g, '.')}@archive.local`,
        status: 'yes',
        message: 'Archived attendee',
        responded_at: form.eventDate.toISOString()
      }));

      const { error: rsvpError } = await supabase.from('rsvps').insert(rsvpData);
      if (rsvpError) throw rsvpError;

      Alert.alert("Success", `Created "${form.title}" with ${names.length} guests.`);
      setForm({ ...form, title: '', location: '', guestNames: '' });

    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={{ flex: 1 }}
    >
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.header}>Archive Seeder</Text>
        
        <Text style={styles.label}>Event Title</Text>
        <TextInput 
          style={styles.input} 
          value={form.title} 
          onChangeText={(t) => setForm({...form, title: t})} 
        />

        <Text style={styles.label}>Event Date</Text>
        <TouchableOpacity style={styles.dateButton} onPress={() => setShowPicker(true)}>
          <Text>{form.eventDate.toDateString()}</Text>
        </TouchableOpacity>

        {showPicker && (
          <DateTimePicker
            value={form.eventDate}
            mode="date"
            display="default"
            onChange={(event, date) => {
              setShowPicker(false);
              if (date) setForm({ ...form, eventDate: date });
            }}
          />
        )}

        <Text style={styles.label}>Location</Text>
        <TextInput 
          style={styles.input} 
          value={form.location} 
          onChangeText={(t) => setForm({...form, location: t})} 
        />

        <Text style={styles.label}>Guest Names (Comma Separated)</Text>
        <TextInput 
          style={[styles.input, { height: 100 }]} 
          value={form.guestNames} 
          onChangeText={(t) => setForm({...form, guestNames: t})} 
          multiline
          placeholder="Name 1, Name 2..."
        />

        <TouchableOpacity 
          style={[styles.button, loading && { opacity: 0.5 }]} 
          onPress={handleSeed}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? "Processing..." : "Run Seed"}</Text>
        </TouchableOpacity>
        
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  header: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, marginTop: 40 },
  label: { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 12, borderRadius: 6, marginBottom: 16 },
  dateButton: { borderWidth: 1, borderColor: '#ccc', padding: 12, borderRadius: 6, marginBottom: 16, justifyContent: 'center' },
  button: { backgroundColor: '#000', padding: 16, borderRadius: 6, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: 'bold' }
});