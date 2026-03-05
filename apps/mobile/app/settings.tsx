/** * Path: app/settings.tsx 
 * Description: Profile settings. Restricted admin features to nanbowles@gmail.com. */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView, Image, ActivityIndicator } from 'react-native';
import { StyledText } from '@pallinky/ui';
import { supabase } from '@pallinky/core';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

export default function SettingsFinal() {
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [defaultView, setDefaultView] = useState('circles');
  const router = useRouter();

  const isAdmin = email.toLowerCase().trim() === 'nanbowles@gmail.com';

  useEffect(() => {
    loadCurrentProfile();
  }, []);

  async function loadCurrentProfile() {
    const userEmail = await SecureStore.getItemAsync('pallinky_user_email');
    const savedView = await SecureStore.getItemAsync('pallinky_default_view');
    
    if (userEmail) setEmail(userEmail);
    if (savedView) setDefaultView(savedView);

    if (userEmail) {
      const { data } = await supabase.from('profiles').select('avatar_url').eq('email_lc', userEmail.toLowerCase()).single();
      setAvatarUrl(data?.avatar_url || '');
    }
  }

  const saveEmailChange = async () => {
    if (!email.includes('@')) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }
    setSaveLoading(true);
    try {
      const cleanEmail = email.toLowerCase().trim();
      await SecureStore.setItemAsync('pallinky_user_email', cleanEmail);
      await supabase.from('profiles').upsert({ 
        email_lc: cleanEmail,
        updated_at: new Date() 
      }, { onConflict: 'email_lc' });
      Alert.alert("Success", "Identity updated.");
    } catch (err) {
      Alert.alert("Error", "Could not save email.");
    } finally {
      setSaveLoading(false);
    }
  };

  const resetDismissedCards = async () => {
    Alert.alert(
      "Restore Cards",
      "Bring back all the Hatchery ideas and Plans you closed?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Yes, Restore", 
          onPress: async () => {
            try {
              // 1. Clear local cache
              await SecureStore.deleteItemAsync('dismissed_vibes');
              await SecureStore.deleteItemAsync('hidden_friend_activities');
              
              if (email) {
                const cleanEmail = email.toLowerCase().trim();
                // 2. Clear the specific hidden cards table
                await supabase.from('closed_cards').delete().eq('user_email_lc', cleanEmail);
                // 3. Keep your existing profiles update for safety
                await supabase.from('profiles').update({ dismissed_cards: null }).eq('email_lc', cleanEmail);
              }

              Alert.alert("Success", "Cards restored! Restart the app to see them.");
            } catch (e) {
              Alert.alert("Error", "Could not restore cards.");
            }
          } 
        }
      ]
    );
  };

  const saveViewPreference = async (view: string) => {
    setDefaultView(view);
    await SecureStore.setItemAsync('pallinky_default_view', view);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled) {
      uploadImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string) => {
    setLoading(true);
    try {
      const fileName = `${email.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.jpg`;
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      await supabase.from('profiles').upsert({ 
        email_lc: email.toLowerCase(), 
        avatar_url: publicUrl, 
        updated_at: new Date() 
      }, { onConflict: 'email_lc' });
      setAvatarUrl(publicUrl);
      Alert.alert("Success", "Photo uploaded!");
    } catch (err: any) {
      Alert.alert("Upload Error", err.message);
    } finally {
      setLoading(false);
    }
  };

 const handleSwitchIdentity = async () => {
    await SecureStore.deleteItemAsync('pallinky_user_email');
    // Force a hard redirect to the auth page
    router.replace('/auth');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <StyledText style={styles.headerTitle}>Profile Settings</StyledText>
      
      <View style={styles.avatarContainer}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.preview} />
        ) : (
          <View style={[styles.preview, { backgroundColor: '#ddd', justifyContent: 'center', alignItems: 'center' }]}>
            <Ionicons name="person" size={60} color="#999" />
          </View>
        )}
        <TouchableOpacity style={styles.uploadBtn} onPress={pickImage} disabled={loading}>
          <StyledText style={styles.uploadBtnText}>{loading ? "Uploading..." : "Change Photo"}</StyledText>
        </TouchableOpacity>
      </View>

      <StyledText style={styles.label}>Acting as Email:</StyledText>
      <View style={styles.inputWrapper}>
        <TextInput 
          style={styles.input} 
          value={email} 
          onChangeText={setEmail} 
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TouchableOpacity style={styles.saveBtn} onPress={saveEmailChange} disabled={saveLoading}>
          {saveLoading ? <ActivityIndicator size="small" color="#fff" /> : <StyledText style={styles.saveBtnText}>Save</StyledText>}
        </TouchableOpacity>
      </View>

      <StyledText style={styles.label}>Default View:</StyledText>
      <View style={styles.viewToggleContainer}>
        <TouchableOpacity style={[styles.viewOption, defaultView === 'circles' && styles.viewOptionActive]} onPress={() => saveViewPreference('circles')}>
          <Ionicons name="layers" size={20} color={defaultView === 'circles' ? "#fff" : "#43691b"} />
          <StyledText style={[styles.viewOptionText, defaultView === 'circles' && styles.viewOptionTextActive]}>Groups</StyledText>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.viewOption, defaultView === 'friends' && styles.viewOptionActive]} onPress={() => saveViewPreference('friends')}>
          <Ionicons name="people" size={20} color={defaultView === 'friends' ? "#fff" : "#43691b"} />
          <StyledText style={[styles.viewOptionText, defaultView === 'friends' && styles.viewOptionTextActive]}>Friends</StyledText>
        </TouchableOpacity>
      </View>

      {isAdmin && (
        <View style={styles.dataSection}>
          <StyledText style={styles.dataLabel}>Admin Tools</StyledText>
          <TouchableOpacity style={styles.dataBtn} onPress={() => router.push('/admin/seed-confirmed')}>
            <Ionicons name="server-outline" size={24} color="#43691b" />
            <StyledText style={styles.dataBtnText}>Archive Event Seeder</StyledText>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.dataBtn, { marginTop: 10 }]} 
            onPress={() => router.push('/admin/users')}
          >
            <Ionicons name="people-circle-outline" size={24} color="#43691b" />
            <StyledText style={styles.dataBtnText}>Manage Tester Photos</StyledText>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.dataSection}>
        <StyledText style={styles.dataLabel}>Data Management</StyledText>
        <TouchableOpacity style={styles.dataBtn} onPress={resetDismissedCards}>
          <Ionicons name="refresh-circle-outline" size={24} color="#43691b" />
          <StyledText style={styles.dataBtnText}>Restore Hidden Cards</StyledText>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.signOutBtn} onPress={() => {
        Alert.alert("Sign Out", "Clear identity and exit?", [
          { text: "Cancel", style: "cancel" },
          { text: "Sign Out", style: "destructive", onPress: handleSwitchIdentity }
        ]);
      }}>
        <Ionicons name="log-out-outline" size={20} color="#e63946" />
        <StyledText style={styles.signOutBtnText}>Sign Out / Switch User</StyledText>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.back()} style={{marginTop: 40, marginBottom: 40}}>
        <StyledText style={{color: '#43691b', textAlign: 'center', fontWeight: 'bold'}}>← Back to Hub</StyledText>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#f8e9dc', padding: 30, paddingTop: 80 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#1f2a1b', marginBottom: 30, textAlign: 'center' },
  avatarContainer: { alignItems: 'center', marginBottom: 30 },
  preview: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: '#fff' },
  uploadBtn: { marginTop: 15, backgroundColor: '#43691b', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20 },
  uploadBtnText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  label: { fontSize: 14, fontWeight: 'bold', color: '#43691b', marginBottom: 8 },
  inputWrapper: { flexDirection: 'row', gap: 10, marginBottom: 25 },
  input: { flex: 1, backgroundColor: '#fff', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#bac9ad', color: '#1f2a1b' },
  saveBtn: { backgroundColor: '#1f2a1b', paddingHorizontal: 20, borderRadius: 12, justifyContent: 'center' },
  saveBtnText: { color: '#fff', fontWeight: 'bold' },
  viewToggleContainer: { flexDirection: 'row', gap: 10 },
  viewOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#bac9ad' },
  viewOptionActive: { backgroundColor: '#43691b', borderColor: '#43691b' },
  viewOptionText: { color: '#43691b', fontWeight: 'bold', fontSize: 14 },
  viewOptionTextActive: { color: '#fff' },
  dataSection: { marginTop: 30, borderTopWidth: 1, borderTopColor: '#bac9ad', paddingTop: 20 },
  dataLabel: { fontSize: 12, fontWeight: 'bold', color: '#43691b', opacity: 0.6, marginBottom: 10, textTransform: 'uppercase' },
  dataBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#43691b' },
  dataBtnText: { color: '#43691b', fontWeight: 'bold' },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 20, backgroundColor: '#fff', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#ffd6d6' },
  signOutBtnText: { color: '#e63946', fontWeight: 'bold', fontSize: 16 }
});