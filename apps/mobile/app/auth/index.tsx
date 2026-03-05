import React, { useState } from 'react';
import { 
  View, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert, 
  KeyboardAvoidingView, 
  Platform, 
  TouchableWithoutFeedback, 
  Keyboard 
} from 'react-native';
import { supabase } from '@pallinky/core';
import { StyledText } from '@pallinky/ui';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail.includes('@')) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }
    setLoading(true);
    
    // The redirect URL must match the 'scheme' in app.json
    const { error } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: { 
        emailRedirectTo: 'pallinky://auth' 
      }
    });

    if (error) {
      Alert.alert("Error", error.message);
    } else {
      Alert.alert("Check your email", "Tap the link in your email to log in automatically.");
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={{ flex: 1 }}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          <StyledText style={styles.title}>Welcome to Pallinky</StyledText>
          
          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />

          <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <StyledText style={styles.buttonText}>Send Magic Link</StyledText>}
          </TouchableOpacity>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 40, backgroundColor: '#f8e9dc' },
  title: { fontSize: 32, fontWeight: '900', color: '#1f2a1b', marginBottom: 40, textAlign: 'center' },
  input: { backgroundColor: '#fff', padding: 20, borderRadius: 15, marginBottom: 20, fontSize: 16, borderWidth: 1, borderColor: '#bac9ad' },
  button: { backgroundColor: '#43691b', padding: 20, borderRadius: 15, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});