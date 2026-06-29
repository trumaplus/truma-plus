import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Reader, useStripeTerminal } from '@stripe/stripe-terminal-react-native';
import { api } from '../api/client';

const GOLD  = '#ffd166';
const DARK  = '#07131a';
const DARK2 = '#0d2030';
const DARK3 = '#1a3040';
const RED   = '#ef4444';
const GREEN = '#4ade80';
const WHITE = '#ffffff';

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

interface Synagogue {
  id: string;
  synagogueName: string;
  city?: string;
  logoUrl?: string;
}

// ── Pulsing NFC rings ─────────────────────────────────────────────────────────
function NfcRings() {
  const anims = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    anims.forEach((anim, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 380),
          Animated.timing(anim, {
            toValue: 1, duration: 1500,
            easing: Easing.out(Easing.ease), useNativeDriver: true,
          }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      ).start();
    });
  }, []);

  const sizes = [140, 190, 240];
  return (
    <View style={styles.nfcContainer}>
      {anims.map((anim, i) => (
        <Animated.View
          key={i}
          style={[
            styles.nfcRing,
            {
              width: sizes[i], height: sizes[i], borderRadius: sizes[i] / 2,
              opacity: anim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.9, 0.4, 0] }),
              transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.4] }) }],
            },
          ]}
        />
      ))}
      <Text style={styles.nfcEmoji}>📱</Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
interface Props {
  synagogueId: string;
  onReset: () => void;
}

export default function KioskScreen({ synagogueId, onReset }: Props) {
  const [synagogue,    setSynagogue]   = useState<Synagogue | null>(null);
  const [step,         setStep]        = useState<Step>('select');
  const [readerReady,  setReaderReady] = useState(false);
  const [donationType, setDonationType] = useState('general');
  const [amount,       setAmount]      = useState(18);
  const [customAmount, setCustomAmount] = useState('');
  const [errorMsg,     setErrorMsg]    = useState('');

  // Long-press header (5 s) to reset synagogue setup
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function startHold() { holdTimer.current = setTimeout(onReset, 5000); }
  function endHold()   { if (holdTimer.current) clearTimeout(holdTimer.current); }

  const finalAmount = customAmount ? parseFloat(customAmount) : amount;

  // Fetch synagogue branding
  useEffect(() => {
    api.get(`/synagogues/public/${synagogueId}`)
      .then(({ data }) => setSynagogue(data))
      .catch(() => {});
  }, [synagogueId]);

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
        if (!error) setReaderReady(true);
      }
    }, [connectedReader, connectLocalMobileReader]),
  });

  useEffect(() => {
    discoverReaders({ discoveryMethod: 'localMobile', simulated: false });
  }, [discoverReaders]);

  useEffect(() => {
    if (connectedReader) setReaderReady(true);
  }, [connectedReader]);

  // ── Donate ──────────────────────────────────────────────────────────────────
  async function handleDonate() {
    if (!finalAmount || finalAmount < 1 || !readerReady) return;
    setStep('tap');
    try {
      const { data } = await api.post('/stripe/terminal/payment-intent', {
        amount: finalAmount, synagogueId, donationType,
      });

      const { paymentIntent, error: collectErr } = await collectPaymentMethod({
        paymentIntentClientSecret: data.clientSecret,
        skipTipping: true,
      });

      if (collectErr) {
        setErrorMsg(collectErr.message || 'שגיאה באיסוף תשלום');
        setStep('error');
        return;
      }

      setStep('processing');

      const { paymentIntent: captured, error: processErr } = await processPayment(paymentIntent!);
      if (processErr) {
        setErrorMsg(processErr.message || 'שגיאה בעיבוד התשלום');
        setStep('error');
        return;
      }

      // Notify server (fire-and-forget — webhook is the reliable backup)
      api.post(`/stripe/terminal/payment-intent/${captured!.id}/complete`).catch(() => {});

      setStep('success');
      setTimeout(() => resetFlow(), 6000);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error || 'שגיאה בלתי צפויה');
      setStep('error');
    }
  }

  function resetFlow() {
    setStep('select');
    setAmount(18);
    setCustomAmount('');
    setErrorMsg('');
  }

  // ── Tap screen ──────────────────────────────────────────────────────────────
  if (step === 'tap') {
    return (
      <View style={[styles.full, styles.center]}>
        <NfcRings />
        <Text style={styles.h1}>הצמד כרטיס או טלפון</Text>
        <Text style={styles.bigAmount}>${finalAmount} CAD</Text>
        <Text style={styles.muted}>Apple Pay · Google Pay · כרטיס בנקאי</Text>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => { cancelCollectPaymentMethod(); setStep('select'); }}>
          <Text style={styles.cancelText}>ביטול</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (step === 'processing') {
    return (
      <View style={[styles.full, styles.center]}>
        <ActivityIndicator size="large" color={GOLD} />
        <Text style={[styles.h1, { marginTop: 24 }]}>מעבד תשלום…</Text>
      </View>
    );
  }

  if (step === 'success') {
    return (
      <View style={[styles.full, styles.center]}>
        <Text style={{ fontSize: 80 }}>✅</Text>
        <Text style={[styles.bigAmount, { color: GREEN, marginTop: 16 }]}>${finalAmount} CAD</Text>
        <Text style={styles.h1}>תודה על תרומתך!</Text>
        <Text style={styles.muted}>התשלום התקבל בהצלחה</Text>
      </View>
    );
  }

  if (step === 'error') {
    return (
      <View style={[styles.full, styles.center]}>
        <Text style={{ fontSize: 64 }}>❌</Text>
        <Text style={[styles.h1, { color: RED, marginTop: 16 }]}>התשלום נכשל</Text>
        <Text style={[styles.muted, { marginBottom: 32, paddingHorizontal: 40, textAlign: 'center' }]}>{errorMsg}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={resetFlow}>
          <Text style={styles.retryText}>נסה שנית</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Selection screen ────────────────────────────────────────────────────────
  return (
    <View style={[styles.full, { flexDirection: 'column' }]}>

      {/* Header — long-press 5 s to reset */}
      <Pressable
        style={styles.header}
        onPressIn={startHold}
        onPressOut={endHold}
      >
        {synagogue?.logoUrl && (
          <Image source={{ uri: synagogue.logoUrl }} style={styles.logo} />
        )}
        <View>
          <Text style={styles.synagogueName}>{synagogue?.synagogueName ?? '…'}</Text>
          {synagogue?.city && <Text style={styles.synagogueCity}>{synagogue.city}</Text>}
        </View>

        {/* Reader status */}
        <View style={styles.statusPill}>
          <View style={[styles.dot, { backgroundColor: readerReady ? GREEN : GOLD }]} />
          <Text style={styles.statusText}>
            {readerReady ? 'מוכן לתשלום' : 'מתחבר…'}
          </Text>
        </View>
      </Pressable>

      {/* Body — two columns */}
      <View style={{ flex: 1, flexDirection: 'row' }}>

        {/* Left: donation types */}
        <View style={styles.leftCol}>
          <Text style={styles.label}>סוג תרומה</Text>
          {DONATION_TYPES.map((dt) => (
            <TouchableOpacity
              key={dt.id}
              style={[styles.typeBtn, donationType === dt.id && styles.typeBtnOn]}
              onPress={() => setDonationType(dt.id)}
            >
              <Text style={[styles.typeTxt, donationType === dt.id && styles.typeTxtOn]}>
                {dt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Right: amounts + pay */}
        <View style={styles.rightCol}>
          <Text style={styles.label}>בחר סכום</Text>

          <View style={styles.grid}>
            {QUICK_AMOUNTS.map((a) => (
              <TouchableOpacity
                key={a}
                style={[styles.amtBtn, amount === a && !customAmount && styles.amtBtnOn]}
                onPress={() => { setAmount(a); setCustomAmount(''); }}
              >
                <Text style={[styles.amtTxt, amount === a && !customAmount && styles.amtTxtOn]}>
                  ${a}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.customInput}
            keyboardType="numeric"
            placeholder="סכום אחר $"
            placeholderTextColor="rgba(255,255,255,0.22)"
            value={customAmount}
            onChangeText={setCustomAmount}
          />

          <View style={styles.footer}>
            <View>
              <Text style={styles.totalLbl}>סה״כ לתרומה</Text>
              <Text style={styles.totalAmt}>${finalAmount || 0} CAD</Text>
            </View>

            <TouchableOpacity
              style={[styles.payBtn, (!readerReady || !finalAmount || finalAmount < 1) && styles.payBtnOff]}
              onPress={handleDonate}
              disabled={!readerReady || !finalAmount || finalAmount < 1}
            >
              <Text style={styles.payTxt}>📲  הצמד לתשלום</Text>
            </TouchableOpacity>
          </View>
        </View>

      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  full:   { flex: 1, backgroundColor: DARK },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: DARK },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: DARK2, borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 20, paddingVertical: 10,
  },
  logo:          { width: 40, height: 40, borderRadius: 10 },
  synagogueName: { color: GOLD, fontWeight: '700', fontSize: 15 },
  synagogueCity: { color: 'rgba(255,255,255,0.35)', fontSize: 11 },
  statusPill: {
    marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  dot:        { width: 7, height: 7, borderRadius: 4 },
  statusText: { color: 'rgba(255,255,255,0.45)', fontSize: 11 },

  // Left column
  leftCol: {
    width: 188, borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 18, paddingHorizontal: 14,
  },
  label:    { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
  typeBtn:  { paddingVertical: 11, paddingHorizontal: 12, borderRadius: 11, marginBottom: 5, backgroundColor: 'rgba(255,255,255,0.04)' },
  typeBtnOn: { backgroundColor: `${GOLD}22` },
  typeTxt:  { color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '500', textAlign: 'right' },
  typeTxtOn: { color: GOLD, fontWeight: '700' },

  // Right column
  rightCol: { flex: 1, paddingVertical: 18, paddingHorizontal: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 12 },
  amtBtn:  { width: '31%', paddingVertical: 15, borderRadius: 13, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)' },
  amtBtnOn: { backgroundColor: GOLD },
  amtTxt:  { color: 'rgba(255,255,255,0.65)', fontSize: 17, fontWeight: '600' },
  amtTxtOn: { color: DARK, fontWeight: '700' },
  customInput: {
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', borderRadius: 13,
    paddingHorizontal: 14, paddingVertical: 13,
    color: WHITE, fontSize: 17, textAlign: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)', marginBottom: 16,
  },

  // Footer
  footer:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' },
  totalLbl: { color: 'rgba(255,255,255,0.3)', fontSize: 11, marginBottom: 3 },
  totalAmt: { color: GOLD, fontSize: 30, fontWeight: '800' },
  payBtn:   { backgroundColor: GOLD, paddingHorizontal: 32, paddingVertical: 17, borderRadius: 17 },
  payBtnOff: { opacity: 0.35 },
  payTxt:   { color: DARK, fontSize: 17, fontWeight: '800' },

  // Tap / success / error screens
  nfcContainer: { width: 240, height: 240, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  nfcRing:      { position: 'absolute', borderWidth: 1.5, borderColor: GOLD },
  nfcEmoji:     { fontSize: 72 },
  h1:       { fontSize: 26, fontWeight: '700', color: WHITE, marginBottom: 8 },
  bigAmount:{ fontSize: 46, fontWeight: '800', color: GOLD, marginBottom: 8 },
  muted:    { fontSize: 14, color: 'rgba(255,255,255,0.38)', marginBottom: 36 },
  cancelBtn:{ paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  cancelText:{ color: 'rgba(255,255,255,0.45)', fontSize: 14 },
  retryBtn: { backgroundColor: GOLD, paddingHorizontal: 36, paddingVertical: 14, borderRadius: 15 },
  retryText:{ color: DARK, fontWeight: '700', fontSize: 15 },
});
