import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { sendMagicLink } from '@pallinky/core';
import { useLocalSearchParams } from 'expo-router';

const PRODUCTION_DOMAIN = 'https://pallinky.com/auth/callback';

export default function AuthScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !email.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email.');
      return;
    }

    setLoading(true);
    try {
      const finalRedirect = `${PRODUCTION_DOMAIN}?next=${slug || 'hatchery'}`;
      await sendMagicLink(email.toLowerCase().trim(), finalRedirect, false); // false = is not web
      Alert.alert('Check your email', 'Login link sent to ' + email.toLowerCase().trim());
    } catch (error: any) {
      Alert.alert('Login Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Welcome to Pallinky</Text>
        <Text style={styles.subtitle}>First, We need to grab your RSVPs</Text>
        <TextInput
          style={styles.input}
          placeholder="your@email.com"
          placeholderTextColor="#94a3b8"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!loading}
        />
        <TouchableOpacity 
          style={[styles.button, loading && styles.buttonDisabled]} 
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Confirm E-mail</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#dcf4f8ff' },
  content: { width: '100%', maxWidth: 400, alignSelf: 'center' },
  title: { fontSize: 32, fontWeight: '900', color: '#1e3a8a', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#43691b', marginBottom: 32, textAlign: 'center', fontWeight: '500' },
  input: { backgroundColor: '#ffffff', padding: 18, borderRadius: 16, borderWidth: 2, borderColor: '#e2e8f0', fontSize: 16, marginBottom: 16, color: '#1e3a8a' },
  button: { backgroundColor: '#fb8500', padding: 18, borderRadius: 16, alignItems: 'center' },
  buttonDisabled: { backgroundColor: '#cbd5e1' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
});