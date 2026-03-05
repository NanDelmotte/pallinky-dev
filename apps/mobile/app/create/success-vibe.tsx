import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Share, TextInput, Alert, SafeAreaView, Keyboard, TouchableWithoutFeedback, ScrollView, Animated, Dimensions, StatusBar, Platform } from 'react-native';
import { StyledText } from '@pallinky/ui';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

const { width, height } = Dimensions.get('window');

const ConfettiPiece = ({ delay, color }: { delay: number, color: string }) => {
  const fallAnim = useRef(new Animated.Value(-20)).current;
  const horizontalAnim = useRef(new Animated.Value(Math.random() * width)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.timing(fallAnim, {
        toValue: height,
        duration: 2500 + Math.random() * 1000,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  return (
    <Animated.View 
      style={[
        styles.confettiPiece, 
        { 
          backgroundColor: color,
          transform: [
            { translateY: fallAnim },
            { translateX: horizontalAnim },
            { rotate: '45deg' }
          ] 
        }
      ]} 
    />
  );
};

export default function VibeSuccessScreen() {
  const { slug, title, default_message, manage_token } = useLocalSearchParams<{ 
    slug: string; 
    title: string; 
    default_message: string;
    manage_token: string;
  }>();

  const [showConfetti, setShowConfetti] = useState(true);
  
  // WIRING: Using the production URL for Universal Linking in APK
  const shareLink = `https://pallinky.com/event/${slug}`;

  const [customMessage, setCustomMessage] = useState(default_message || `Thinking about ${title || 'this'}... who's in?`);
  const colors = ['#0077b6', '#00b4d8', '#90e0ef', '#003049', '#ffd700'];

  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  const onShare = async () => {
    try {
      await Share.share({ message: `${customMessage}\n\n${shareLink}` });
    } catch (error: any) {
      alert(error.message);
    }
  };

  const copyToClipboard = async () => {
    await Clipboard.setStringAsync(shareLink);
    Alert.alert("Link Copied!", "Paste this into your browser or chat.");
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        
        {showConfetti && colors.map((color, i) => (
          <ConfettiPiece key={i} delay={i * 100} color={colors[i % colors.length]} />
        ))}

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          <View style={styles.centerAlign}>
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons name="waves" size={50} color="#fff" />
            </View>
            <StyledText style={styles.title}>Line Thrown!</StyledText>
          </View>

          <View style={styles.card}>
            <StyledText style={styles.label}>Your Fishing Pitch</StyledText>
            <View style={styles.previewBox}>
              <TextInput
                style={styles.messageInput}
                value={customMessage}
                onChangeText={setCustomMessage}
                multiline
                placeholder="Hook them with a message..."
              />
              <StyledText style={styles.linkTextPreview}>{shareLink}</StyledText>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.shareBtn} onPress={onShare}>
                <Ionicons name="logo-whatsapp" size={20} color="#fff" />
                <StyledText style={styles.btnText}>WhatsApp</StyledText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.copyBtn} onPress={copyToClipboard}>
                <Ionicons name="copy-outline" size={22} color="#0077b6" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.popCard}>
             <View style={styles.popHeader}>
                <Ionicons name="flash" size={18} color="#0077b6" />
                <StyledText style={styles.popTitle}>Make it pop?</StyledText>
             </View>
             <StyledText style={styles.popSub}>Add colors and a vibe to delight your guests!</StyledText>
             
             <TouchableOpacity 
                style={styles.popBtn} 
                onPress={() => manage_token ? router.push(`/m/${manage_token}/studio` as any) : router.replace('/(tabs)')}
              >
                <StyledText style={styles.popBtnText}>Open Design Studio</StyledText>
                <Ionicons name="chevron-forward" size={20} color="#fff" />
              </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.homeBtn} onPress={() => router.replace('/(tabs)')}>
            <StyledText style={styles.homeBtnText}>Back to Hub</StyledText>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e0f2fe' },
  confettiPiece: { position: 'absolute', width: 8, height: 8, zIndex: 100, top: 0 },
  scrollContent: { padding: 25, alignItems: 'center' },
  centerAlign: { alignItems: 'center', marginBottom: 20, marginTop: 20 },
  iconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#0077b6', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  title: { fontSize: 28, fontWeight: '900', color: '#003049' },
  card: { backgroundColor: '#fff', width: '100%', padding: 20, borderRadius: 24, elevation: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
  label: { fontSize: 11, fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 12, letterSpacing: 1 },
  previewBox: { backgroundColor: '#f0f9ff', borderRadius: 12, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#bae6fd' },
  messageInput: { fontSize: 16, color: '#1e293b', minHeight: 60, textAlignVertical: 'top' },
  linkTextPreview: { fontSize: 14, color: '#0077b6', fontWeight: '700', marginTop: 10 },
  buttonRow: { flexDirection: 'row', gap: 10 },
  shareBtn: { flex: 1, backgroundColor: '#25D366', height: 50, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  copyBtn: { width: 50, height: 50, borderRadius: 14, borderWidth: 2, borderColor: '#0077b6', alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  popCard: { width: '100%', marginTop: 25, padding: 20, backgroundColor: '#fff', borderRadius: 24, borderStyle: 'dashed', borderWidth: 2, borderColor: '#0077b650' },
  popHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  popTitle: { fontSize: 16, fontWeight: '900', color: '#003049' },
  popSub: { fontSize: 13, color: '#1e293b', opacity: 0.7, marginBottom: 15 },
  popBtn: { backgroundColor: '#0077b6', padding: 15, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  popBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  homeBtn: { marginTop: 20, padding: 15 },
  homeBtnText: { color: '#003049', fontWeight: '700', textDecorationLine: 'underline', opacity: 0.4 }
});