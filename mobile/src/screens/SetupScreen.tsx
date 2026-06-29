import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { api } from '../api/client';

const DARK  = '#07131a';
const DARK2 = '#0d2030';
const GOLD  = '#ffd166';
const RED   = '#ef4444';
const WHITE = '#ffffff';

interface Props {
  onComplete: (synagogueId: string) => void;
}

export default function SetupScreen({ onComplete }: Props) {
  const [synagogueId, setSynagogueId] = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  async function handleVerify() {
    const id = synagogueId.trim();
    if (!id) { setError('הכנס מזהה בית כנסת'); return; }
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/synagogues/public/${id}`);
      if (data?.id) {
        onComplete(data.id);
      } else {
        setError('בית כנסת לא נמצא');
      }
    } catch {
      setError('מזהה לא נכון — בדוק עם מנהל המערכת');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.logo}>✡</Text>
        <Text style={styles.title}>Truma Plus Kiosk</Text>
        <Text style={styles.sub}>הגדרה ראשונית — הכנס את מזהה בית הכנסת</Text>

        <TextInput
          style={[styles.input, error ? styles.inputError : null]}
          placeholder="synagogue-id"
          placeholderTextColor="rgba(255,255,255,0.2)"
          value={synagogueId}
          onChangeText={(v) => { setSynagogueId(v); setError(''); }}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={handleVerify}
        />

        {!!error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleVerify}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color={DARK} />
            : <Text style={styles.btnText}>אמת והפעל קיוסק</Text>}
        </TouchableOpacity>

        <Text style={styles.hint}>
          המזהה נמצא בלוח הבקרה של הגבאי → הגדרות → מזהה קיוסק
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DARK, alignItems: 'center', justifyContent: 'center' },
  card: {
    width: 380, backgroundColor: DARK2,
    borderRadius: 24, padding: 36,
    alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,209,102,0.15)',
  },
  logo:  { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '700', color: GOLD, marginBottom: 6 },
  sub:   { fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginBottom: 28 },
  input: {
    width: '100%', backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, paddingHorizontal: 18, paddingVertical: 14,
    color: WHITE, fontSize: 15, textAlign: 'center', marginBottom: 8,
  },
  inputError: { borderColor: RED },
  error: { color: RED, fontSize: 12, marginBottom: 12 },
  btn: {
    width: '100%', backgroundColor: GOLD,
    borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 8,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: DARK, fontWeight: '800', fontSize: 15 },
  hint: { color: 'rgba(255,255,255,0.2)', fontSize: 11, textAlign: 'center', marginTop: 20 },
});
