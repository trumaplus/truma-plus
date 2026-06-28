import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Reader,
  useStripeTerminal,
} from '@stripe/stripe-terminal-react-native';
import { api } from '../api/client';

// ── Synagogue ID — change this to your synagogue's ID from the DB ─────────────
const SYNAGOGUE_ID = 'REPLACE_WITH_YOUR_SYNAGOGUE_ID';

const GOLD   = '#ffd166';
const DARK   = '#07131a';
const DARK2  = '#0d2030';
const DARK3  = '#1a3040';
const RED    = '#ef4444';
const GREEN  = '#4ade80';
const WHITE  = '#ffffff';

const QUICK_AMOUNTS = [18, 36, 54, 72, 100, 180];

const DONATION_TYPES = [
  { id: 'general',  label: 'תרומה כללית' },
  { id: 'neder',    label: 'נדרים ונדבות' },
  { id: 'aliyot',   label: 'עליות לתורה' },
  { id: 'kiddush',  label: 'תשלום קידוש' },
  { id: 'standing', label: 'הוראת קבע' },
  { id: 'coffee',   label: 'הוצאות קפה' },
  { id: 'seuda',    label: 'סעודה שלישית' },
];

type Step = 'select' | 'tap' | 'processing' | 'success' | 'error';

// ── Pulsing NFC ring animation ────────────────────────────────────────────────
function NfcRings() {
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 1,
            duration: 1600,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      ).start();

    pulse(ring1, 0);
    pulse(ring2, 400);
    pulse(ring3, 800);
  }, []);

  const ringStyle = (anim: Animated.Value, size: number) => ({
    position: 'absolute' as const,
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: 2,
    borderColor: GOLD,
    opacity: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.8, 0.4, 0] }),
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.5] }) }],
  });

  return (
    <View style={styles.nfcRingsContainer}>
      <Animated.View style={ringStyle(ring1, 160)} />
      <Animated.View style={ringStyle(ring2, 200)} />
      <Animated.View style={ringStyle(ring3, 240)} />
      <Text style={styles.nfcIcon}>📱</Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function KioskScreen() {
  const [step,          setStep]         = useState<Step>('select');
  const [readerStatus,  setReaderStatus] = useState<'connecting' | 'ready' | 'error'>('connecting');
  const [donationType,  setDonationType] = useState('general');
  const [amount,        setAmount]       = useState(18);
  const [customAmount,  setCustomAmount] = useState('');
  const [errorMsg,      setErrorMsg]     = useState('');

  const finalAmount = customAmount ? parseFloat(customAmount) : amount;

  const {
    discoverReaders,
    connectLocalMobileReader,
    collectPaymentMethod,
    processPayment,
    cancelCollectPaymentMethod,
    connectedReader,
  } = useStripeTerminal({
    onUpdateDiscoveredReaders: useCallback(async (readers: Reader.Type[]) => {
      if (readers.length > 0 && !connectedReader) {
        const { error } = await connectLocalMobileReader(readers[0]);
        if (error) {
          setReaderStatus('error');
        } else {
          setReaderStatus('ready');
        }
      }
    }, [connectedReader, connectLocalMobileReader]),
  });

  // Auto-discover local mobile reader (the device itself) on mount
  useEffect(() => {
    discoverReaders({
      discoveryMethod: 'localMobile',
      simulated: false, // set to true for testing without real NFC
    });
  }, [discoverReaders]);

  // Keep reader status in sync with connectedReader
  useEffect(() => {
    if (connectedReader) setReaderStatus('ready');
  }, [connectedReader]);

  // ── Donate flow ──────────────────────────────────────────────────────────────
  async function handleDonate() {
    if (!finalAmount || finalAmount < 1) return;
    if (!connectedReader) {
      setErrorMsg('מכשיר התשלום לא מחובר. נסה שוב.');
      setStep('error');
      return;
    }

    setStep('tap');

    try {
      // 1. Create PaymentIntent on server
      const { data } = await api.post('/stripe/terminal/payment-intent', {
        amount:       finalAmount,
        synagogueId:  SYNAGOGUE_ID,
        donationType,
      });

      // 2. Collect payment method — shows iOS/Android "Tap card here" UI
      const { paymentIntent, error: collectError } = await collectPaymentMethod({
        paymentIntentClientSecret: data.clientSecret,
        skipTipping: true,
      });

      if (collectError) {
        setErrorMsg(collectError.message || 'שגיאה באיסוף אמצעי תשלום');
        setStep('error');
        return;
      }

      setStep('processing');

      // 3. Process the payment (charge the card)
      const { paymentIntent: captured, error: processError } = await processPayment(paymentIntent!);

      if (processError) {
        setErrorMsg(processError.message || 'שגיאה בעיבוד התשלום');
        setStep('error');
        return;
      }

      // 4. Notify server so donation DB record is updated immediately
      try {
        await api.post(`/stripe/terminal/payment-intent/${captured!.id}/complete`);
      } catch { /* webhook will handle it as backup */ }

      setStep('success');
      setTimeout(() => resetFlow(), 6000);

    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error || 'שגיאה בלתי צפויה. נסה שוב.');
      setStep('error');
    }
  }

  function cancelTap() {
    cancelCollectPaymentMethod();
    setStep('select');
  }

  function resetFlow() {
    setStep('select');
    setAmount(18);
    setCustomAmount('');
    setErrorMsg('');
  }

  // ── Tap screen ───────────────────────────────────────────────────────────────
  if (step === 'tap') {
    return (
      <View style={[styles.full, styles.center, { backgroundColor: DARK }]}>
        <NfcRings />
        <Text style={styles.tapTitle}>הצמד כרטיס או טלפון</Text>
        <Text style={styles.tapAmount}>${finalAmount} CAD</Text>
        <Text style={styles.tapSub}>
          Apple Pay · Google Pay · כרטיס בנקאי
        </Text>
        <TouchableOpacity style={styles.cancelBtn} onPress={cancelTap}>
          <Text style={styles.cancelText}>ביטול</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Processing screen ────────────────────────────────────────────────────────
  if (step === 'processing') {
    return (
      <View style={[styles.full, styles.center, { backgroundColor: DARK }]}>
        <ActivityIndicator size="large" color={GOLD} />
        <Text style={[styles.tapTitle, { marginTop: 24 }]}>מעבד תשלום…</Text>
      </View>
    );
  }

  // ── Success screen ───────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <View style={[styles.full, styles.center, { backgroundColor: DARK }]}>
        <Text style={{ fontSize: 80 }}>✅</Text>
        <Text style={[styles.tapAmount, { color: GREEN, marginTop: 16 }]}>
          ${finalAmount} CAD
        </Text>
        <Text style={styles.tapTitle}>תודה על תרומתך!</Text>
        <Text style={styles.tapSub}>התשלום התקבל בהצלחה</Text>
      </View>
    );
  }

  // ── Error screen ─────────────────────────────────────────────────────────────
  if (step === 'error') {
    return (
      <View style={[styles.full, styles.center, { backgroundColor: DARK }]}>
        <Text style={{ fontSize: 64 }}>❌</Text>
        <Text style={[styles.tapTitle, { color: RED, marginTop: 16 }]}>
          התשלום נכשל
        </Text>
        <Text style={[styles.tapSub, { color: 'rgba(255,255,255,0.5)', marginBottom: 32 }]}>
          {errorMsg}
        </Text>
        <TouchableOpacity style={styles.retryBtn} onPress={resetFlow}>
          <Text style={styles.retryText}>נסה שנית</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Selection screen ─────────────────────────────────────────────────────────
  return (
    <View style={[styles.full, { backgroundColor: DARK, flexDirection: 'row' }]}>

      {/* ── Left: donation type ── */}
      <View style={styles.leftCol}>
        <Text style={styles.sectionLabel}>סוג תרומה</Text>
        {DONATION_TYPES.map((dt) => (
          <TouchableOpacity
            key={dt.id}
            style={[
              styles.typeBtn,
              donationType === dt.id && styles.typeBtnActive,
            ]}
            onPress={() => setDonationType(dt.id)}
          >
            <Text style={[
              styles.typeBtnText,
              donationType === dt.id && styles.typeBtnTextActive,
            ]}>
              {dt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Right: amount + pay ── */}
      <View style={styles.rightCol}>

        {/* Reader status pill */}
        <View style={styles.statusRow}>
          <View style={[
            styles.statusDot,
            { backgroundColor: readerStatus === 'ready' ? GREEN : readerStatus === 'error' ? RED : GOLD }
          ]} />
          <Text style={styles.statusText}>
            {readerStatus === 'ready'      ? 'מוכן לתשלום' :
             readerStatus === 'error'      ? 'שגיאת NFC'   :
                                            'מתחבר…'}
          </Text>
        </View>

        <Text style={styles.sectionLabel}>בחר סכום</Text>

        {/* Quick amounts */}
        <View style={styles.amountsGrid}>
          {QUICK_AMOUNTS.map((a) => (
            <TouchableOpacity
              key={a}
              style={[
                styles.amountBtn,
                amount === a && !customAmount && styles.amountBtnActive,
              ]}
              onPress={() => { setAmount(a); setCustomAmount(''); }}
            >
              <Text style={[
                styles.amountBtnText,
                amount === a && !customAmount && styles.amountBtnTextActive,
              ]}>
                ${a}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Custom amount */}
        <TextInput
          style={styles.customInput}
          keyboardType="numeric"
          placeholder="סכום אחר $"
          placeholderTextColor="rgba(255,255,255,0.25)"
          value={customAmount}
          onChangeText={setCustomAmount}
        />

        {/* Total + Pay button */}
        <View style={styles.footer}>
          <View>
            <Text style={styles.totalLabel}>סה״כ</Text>
            <Text style={styles.totalAmount}>${finalAmount || 0} CAD</Text>
          </View>

          <TouchableOpacity
            style={[
              styles.payBtn,
              (readerStatus !== 'ready' || !finalAmount || finalAmount < 1) && styles.payBtnDisabled,
            ]}
            onPress={handleDonate}
            disabled={readerStatus !== 'ready' || !finalAmount || finalAmount < 1}
          >
            <Text style={styles.payBtnText}>📲  הצמד לתשלום</Text>
          </TouchableOpacity>
        </View>

      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  full:   { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },

  // Tap / processing / success / error screens
  nfcRingsContainer: {
    width: 240, height: 240,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 32,
  },
  nfcIcon:    { fontSize: 72 },
  tapTitle:   { fontSize: 28, fontWeight: '700', color: WHITE,  marginBottom: 8 },
  tapAmount:  { fontSize: 48, fontWeight: '800', color: GOLD,   marginBottom: 8 },
  tapSub:     { fontSize: 15, color: 'rgba(255,255,255,0.4)', marginBottom: 40, textAlign: 'center' },
  cancelBtn:  { paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  cancelText: { color: 'rgba(255,255,255,0.5)', fontSize: 15 },
  retryBtn:   { backgroundColor: GOLD, paddingHorizontal: 40, paddingVertical: 14, borderRadius: 16 },
  retryText:  { color: DARK, fontWeight: '700', fontSize: 16 },

  // Selection screen — left column
  leftCol: {
    width: 200, borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 24, paddingHorizontal: 16,
  },
  sectionLabel: {
    fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12,
  },
  typeBtn: {
    paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: 12, marginBottom: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  typeBtnActive: { backgroundColor: `${GOLD}22` },
  typeBtnText:   { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '500', textAlign: 'right' },
  typeBtnTextActive: { color: GOLD, fontWeight: '700' },

  // Selection screen — right column
  rightCol: {
    flex: 1, paddingVertical: 24, paddingHorizontal: 24,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusText: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },

  amountsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12,
  },
  amountBtn: {
    width: '30%', paddingVertical: 16,
    borderRadius: 14, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  amountBtnActive: { backgroundColor: GOLD },
  amountBtnText:   { color: 'rgba(255,255,255,0.7)', fontSize: 18, fontWeight: '600' },
  amountBtnTextActive: { color: DARK, fontWeight: '700' },

  customInput: {
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    color: WHITE, fontSize: 18, textAlign: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginBottom: 20,
  },

  footer: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginTop: 'auto',
  },
  totalLabel:  { color: 'rgba(255,255,255,0.35)', fontSize: 12, marginBottom: 4 },
  totalAmount: { color: GOLD, fontSize: 32, fontWeight: '800' },

  payBtn: {
    backgroundColor: GOLD, paddingHorizontal: 36, paddingVertical: 18,
    borderRadius: 18, alignItems: 'center',
  },
  payBtnDisabled: { opacity: 0.4 },
  payBtnText: { color: DARK, fontSize: 18, fontWeight: '800', letterSpacing: 0.3 },
});
