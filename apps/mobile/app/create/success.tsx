import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Share, TextInput, Alert, Keyboard, TouchableWithoutFeedback, ScrollView, Animated, Dimensions, StatusBar, Platform } from 'react-native';
import { StyledText } from '@pallinky/ui';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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

export default function SuccessScreen() {
  const { slug, manage_token, title } = useLocalSearchParams<{ 
    slug: string; 
    manage_token: string; 
    title: string; 
  }>();

  const [showConfetti, setShowConfetti] = useState(true);
  
  // WIRING: Production URL for Universal Linking in the APK
  const shareLink = `https://pallinky.com/event/${slug}`;
  
  const [customMessage, setCustomMessage] = useState(``);

  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  const onShare = async () => {
    try {
      // UX: Sending only the link to ensure deep-link integrity on WhatsApp
      await Share.share({ message: shareLink });
    } catch (error: any) {
      alert(error.message);
    }
  };

  const copyToClipboard = async () => {
    await Clipboard.setStringAsync(shareLink);
    if (Platform.OS !== 'web') {
      Alert.alert("Link Copied!", "Paste this into your browser or chat.");
    } else {
      alert("Link copied to clipboard!");
    }
  };

  const colors = ['#fe20e8', '#43691b', '#1729ae', '#ffd700', '#ff4500'];

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        
        <View style={styles.topBar}>
          <View style={{width: 44}} />
          <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={styles.navIconBtn}>
            <Ionicons name="home" size={28} color="#1f2a1b" />
          </TouchableOpacity>
        </View>

        {showConfetti && colors.map((color, i) => (
          <React.Fragment key={i}>
            <ConfettiPiece delay={i * 100} color={colors[i % colors.length]} />
          </React.Fragment>
        ))}
        
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.centerAlign}>
            <Ionicons name="checkmark-circle" size={60} color="#43691b" />
            <StyledText style={styles.title}>Invite Created!</StyledText>
          </View>
          
          <View style={styles.card}>
            <StyledText style={styles.label}>Your Invite Link</StyledText>
            <View style={styles.previewBox}>
              <TextInput
                style={styles.messageInput}
                value={customMessage}
                onChangeText={setCustomMessage}
                multiline
                placeholder="Add a note for yourself..."
              />
              <StyledText style={styles.linkTextPreview}>{shareLink}</StyledText>
            </View>
            
            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.shareBtn} onPress={onShare}>
                <Ionicons name="logo-whatsapp" size={20} color="#fff" />
                <StyledText style={styles.btnText}>WhatsApp Link</StyledText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.copyBtn} onPress={copyToClipboard}>
                <Ionicons name="copy-outline" size={20} color="#43691b" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.guestPreviewLink} 
              onPress={() => router.push(`/event/${slug}`)}
            >
              <StyledText style={styles.guestPreviewText}>View as Guest</StyledText>
              <Ionicons name="eye-outline" size={16} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.temptationCard}>
             <View style={styles.temptationHeader}>
                <Ionicons name="sparkles" size={18} color="#fe20e8" />
                <StyledText style={styles.temptationTitle}>Make it pop?</StyledText>
             </View>
             <StyledText style={styles.temptationSub}>Add a GIF and colors to delight your guests!</StyledText>
             
             <TouchableOpacity 
                style={styles.studioBtn} 
                onPress={() => {
                  if (manage_token) {
                    router.push(`/m/${manage_token}/studio`);
                  } else {
                    router.replace('/(tabs)');
                  }
                }}
              >
                <View style={styles.studioContent}>
                  <View style={styles.miniPreviewFiesta}>
                    <StyledText style={styles.miniText}>Fiesta!</StyledText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <StyledText style={styles.studioBtnTitle}>Open Design Studio</StyledText>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#43691b" />
                </View>
              </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.homeBtn} onPress={() => router.replace('/(tabs)')}>
            <StyledText style={styles.homeBtnText}>Back to My Hub</StyledText>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8e9dc' },
  topBar: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingTop: Platform.OS === 'ios' ? 60 : 20, 
    paddingBottom: 10,
    backgroundColor: '#f8e9dc'
  },
  navIconBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  confettiPiece: { position: 'absolute', width: 8, height: 8, zIndex: 100, top: 0 },
  scrollContent: { padding: 25, paddingTop: 10, alignItems: 'center' },
  centerAlign: { alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '900', color: '#1f2a1b', marginTop: 10 },
  card: { backgroundColor: '#fff', width: '100%', padding: 20, borderRadius: 24, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  label: { fontSize: 11, fontWeight: '900', color: '#999', textTransform: 'uppercase', marginBottom: 12 },
  previewBox: { backgroundColor: '#f9f9f9', borderRadius: 12, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#eee' },
  messageInput: { fontSize: 16, color: '#1f2a1b', minHeight: 40, textAlignVertical: 'top' },
  linkTextPreview: { fontSize: 14, color: '#43691b', fontWeight: '700', marginTop: 10, opacity: 0.8 },
  buttonRow: { flexDirection: 'row', gap: 10 },
  shareBtn: { flex: 1, backgroundColor: '#43691b', height: 50, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  copyBtn: { width: 50, height: 50, borderRadius: 14, borderWidth: 1.5, borderColor: '#43691b', alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  guestPreviewLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 15 },
  guestPreviewText: { fontSize: 13, fontWeight: '700', color: '#666', textDecorationLine: 'underline' },
  temptationCard: { width: '100%', marginTop: 25, padding: 20, backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 24, borderStyle: 'dashed', borderWidth: 2, borderColor: '#fe20e850' },
  temptationHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  temptationTitle: { fontSize: 16, fontWeight: '900', color: '#fe20e8' },
  temptationSub: { fontSize: 13, color: '#1f2a1b', opacity: 0.7, marginBottom: 15, lineHeight: 18 },
  studioBtn: { backgroundColor: '#fff', padding: 12, borderRadius: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  studioContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  miniPreviewFiesta: { width: 40, height: 40, backgroundColor: '#1729ae', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  miniText: { color: '#fe20e8', fontSize: 8, fontWeight: '900' },
  studioBtnTitle: { fontSize: 15, fontWeight: '800', color: '#1f2a1b' },
  homeBtn: { marginTop: 30, padding: 15 },
  homeBtnText: { color: '#1f2a1b', fontWeight: '700', textDecorationLine: 'underline', opacity: 0.4 }
});