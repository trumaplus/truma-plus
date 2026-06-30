import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { Reader, useStripeTerminal } from '@stripe/stripe-terminal-react-native';
import { io, Socket } from 'socket.io-client';
import { api, SERVER_ORIGIN } from '../api/client';

// ── Theme ─────────────────────────────────────────────────────────────────────
const GOLD  = '#ffd166';
const DARK  = '#07131a';
const DARK2 = '#0d2030';
const RED   = '#ef4444';
const GREEN = '#4ade80';
const WHITE = '#ffffff';

// ── Constants ─────────────────────────────────────────────────────────────────
const QUICK_AMOUNTS = [18, 36, 54, 72, 100, 180];
const IDLE_MS       = 30_000; // reset donation form after 30 s of inactivity

const DONATION_TYPES = [
  { id: 'general',  label: 'תרומה כללית' },
  { id: 'neder',    label: 'נדרים ונדבות' },
  { id: 'aliyot',   label: 'עליות לתורה' },
  { id: 'kiddush',  label: 'תשלום קידוש' },
  { id: 'standing', label: 'הוראת קבע' },
  { id: 'coffee',   label: 'הוצאות קפה' },
  { id: 'seuda',    label: 'סעודה שלישית' },
];

// ── Types ─────────────────────────────────────────────────────────────────────
type Step = 'select' | 'email' | 'tap' | 'processing' | 'success' | 'error';

interface Synagogue {
  id: string;
  synagogueName: string;
  city?: string;
  logoUrl?: string;
}

interface Props {
  synagogueId: string;
  onReset: () => void;
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
          Animated.timing(anim, { toValue: 1, duration: 1500, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      ).start();
    });
  }, []);
  const sizes = [130, 185, 240];
  return (
    <View style={s.nfcWrap}>
      {anims.map((anim, i) => (
        <Animated.View key={i} style={[s.nfcRing, {
          width: sizes[i], height: sizes[i], borderRadius: sizes[i] / 2,
          opacity:   anim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.85, 0.35, 0] }),
          transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1.45] }) }],
        }]} />
      ))}
      <Text style={s.nfcEmoji}>📱</Text>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function KioskScreen({ synagogueId, onReset }: Props) {
  // Keep screen permanently awake — essential for a kiosk
  useKeepAwake();

  // ── State ──────────────────────────────────────────────────────────────────
  const [synagogue,     setSynagogue]    = useState<Synagogue | null>(null);
  const [step,          setStep]         = useState<Step>('select');
  const [readerReady,   setReaderReady]  = useState(false);
  const [donationType,  setDonationType] = useState('general');
  const [amount,        setAmount]       = useState(18);
  const [customAmount,  setCustomAmount] = useState('');
  const [donorEmail,    setDonorEmail]   = useState('');
  const [errorMsg,      setErrorMsg]     = useState('');
  const [announcement,  setAnnouncement] = useState<string | null>(null);
  const [shabbatMode,   setShabbatMode]  = useState(false);

  const socketRef  = useRef<Socket | null>(null);
  const idleRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks the latest `step` for use inside the long-lived socket effect closure
  // (the effect only runs once on mount, so it would otherwise always see step==='select')
  const stepRef    = useRef<Step>('select');
  useEffect(() => { stepRef.current = step; }, [step]);
  const shabbatRef = useRef(false);
  useEffect(() => { shabbatRef.current = shabbatMode; }, [shabbatMode]);

  const finalAmount = customAmount ? parseFloat(customAmount) : amount;

  // ── Idle timer — resets form after 30 s of no interaction ─────────────────
  // Uses shabbatRef (not the shabbatMode state) so this stays stable and safe
  // to call from the long-lived socket effect's closures without going stale.
  const resetIdle = useCallback(() => {
    if (idleRef.current) clearTimeout(idleRef.current);
    if (shabbatRef.current) return;
    idleRef.current = setTimeout(() => {
      resetFlow();
    }, IDLE_MS);
  }, []);

  useEffect(() => {
    resetIdle();
    return () => { if (idleRef.current) clearTimeout(idleRef.current); };
  }, [resetIdle]);

  // ── Long-press header 5 s → reset synagogue setup ─────────────────────────
  const startHold = () => { holdRef.current = setTimeout(onReset, 5000); };
  const endHold   = () => { if (holdRef.current) clearTimeout(holdRef.current); };

  // ── Fetch synagogue branding ───────────────────────────────────────────────
  useEffect(() => {
    api.get(`/synagogues/public/${synagogueId}`)
      .then(({ data }) => setSynagogue(data))
      .catch(() => {});
  }, [synagogueId]);

  // ── Socket.io — admin commands, Shabbat, announcements ────────────────────
  useEffect(() => {
    const socket = io(SERVER_ORIGIN, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('kiosk:register', {
        synagogueId,
        synagogueName: synagogue?.synagogueName ?? null,
        deviceInfo: { platform: Platform.OS, version: Platform.Version },
      });
    });

    socket.on('admin:command', ({ type, payload }: { type: string; payload: any }) => {
      switch (type) {
        case 'SET_SHABBAT_MODE':
          setShabbatMode(!!payload);
          if (payload) resetFlow();
          break;
        case 'SHOW_ANNOUNCEMENT':
          setAnnouncement(payload?.text ?? '');
          setTimeout(() => setAnnouncement(null), 15_000);
          break;
        case 'RELOAD_PAGE':
          // On native we just reset to initial state
          resetFlow();
          break;
        case 'PING':
          socket.emit('kiosk:pong', { synagogueId });
          break;
      }
    });

    // Also receive real-time payment completion from webhook (recovery path —
    // the primary success path is the synchronous processPayment() call below).
    socket.on('donation:completed', () => {
      if (stepRef.current === 'tap' || stepRef.current === 'processing') {
        setStep('success');
        setTimeout(() => resetFlow(), 6000);
      }
    });

    const statusInterval = setInterval(() => {
      socket.emit('kiosk:status', { synagogueId, shabbatMode: shabbatRef.current, timestamp: new Date().toISOString() });
    }, 30_000);

    return () => {
      clearInterval(statusInterval);
      socket.disconnect();
    };
  }, [synagogueId, synagogue?.synagogueName]);

  // ── Stripe Terminal ────────────────────────────────────────────────────────
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

  useEffect(() => { if (connectedReader) setReaderReady(true); }, [connectedReader]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  function resetFlow() {
    setStep('select');
    setAmount(18);
    setCustomAmount('');
    setDonorEmail('');
    setErrorMsg('');
    resetIdle();
  }

  function handleInteraction() { resetIdle(); }

  // ── Donate flow ────────────────────────────────────────────────────────────
  async function startPayment(email: string) {
    setStep('tap');
    try {
      const { data } = await api.post('/stripe/terminal/payment-intent', {
        amount: finalAmount, synagogueId, donationType,
        donorEmail: email.trim() || undefined,
      });

      const { paymentIntent, error: collectErr } = await collectPaymentMethod({
        paymentIntentClientSecret: data.clientSecret,
        skipTipping: true,
      });
      if (collectErr) { setErrorMsg(collectErr.message || 'שגיאה'); setStep('error'); return; }

      setStep('processing');

      const { paymentIntent: captured, error: processErr } = await processPayment(paymentIntent!);
      if (processErr) { setErrorMsg(processErr.message || 'שגיאה'); setStep('error'); return; }

      // Notify server (fire-and-forget — webhook is backup)
      api.post(`/stripe/terminal/payment-intent/${captured!.id}/complete`).catch(() => {});

      setStep('success');
      setTimeout(() => resetFlow(), 6000);
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error || 'שגיאה בלתי צפויה');
      setStep('error');
    }
  }

  // ── Shabbat mode ───────────────────────────────────────────────────────────
  if (shabbatMode) {
    return (
      <View style={[s.full, s.center]}>
        <Text style={{ fontSize: 72, marginBottom: 20 }}>✡️</Text>
        <Text style={[s.h1, { fontSize: 32, color: GOLD }]}>שבת שלום</Text>
        <Text style={[s.muted, { textAlign: 'center', paddingHorizontal: 40 }]}>
          הקיוסק ינועל עד מוצאי שבת
        </Text>
      </View>
    );
  }

  // ── Tap screen ─────────────────────────────────────────────────────────────
  if (step === 'tap') {
    return (
      <Pressable style={[s.full, s.center]} onPress={handleInteraction}>
        <NfcRings />
        <Text style={s.h1}>הצמד כרטיס או טלפון</Text>
        <Text style={s.bigAmount}>${finalAmount} CAD</Text>
        <Text style={s.muted}>Apple Pay · Google Pay · כרטיס בנקאי</Text>
        <TouchableOpacity style={s.cancelBtn}
          onPress={() => { cancelCollectPaymentMethod(); setStep('select'); }}>
          <Text style={s.cancelText}>ביטול</Text>
        </TouchableOpacity>
      </Pressable>
    );
  }

  // ── Processing ─────────────────────────────────────────────────────────────
  if (step === 'processing') {
    return (
      <View style={[s.full, s.center]}>
        <ActivityIndicator size="large" color={GOLD} />
        <Text style={[s.h1, { marginTop: 24 }]}>מעבד תשלום…</Text>
      </View>
    );
  }

  // ── Success ────────────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <View style={[s.full, s.center]}>
        <Text style={{ fontSize: 80 }}>✅</Text>
        <Text style={[s.bigAmount, { color: GREEN, marginTop: 16 }]}>${finalAmount} CAD</Text>
        <Text style={s.h1}>תודה על תרומתך!</Text>
        <Text style={s.muted}>
          {donorEmail ? `קבלה תישלח ל-${donorEmail}` : 'התשלום התקבל בהצלחה'}
        </Text>
      </View>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (step === 'error') {
    return (
      <View style={[s.full, s.center]}>
        <Text style={{ fontSize: 64 }}>❌</Text>
        <Text style={[s.h1, { color: RED, marginTop: 16 }]}>התשלום נכשל</Text>
        <Text style={[s.muted, { paddingHorizontal: 40, textAlign: 'center', marginBottom: 32 }]}>
          {errorMsg}
        </Text>
        <TouchableOpacity style={s.retryBtn} onPress={resetFlow}>
          <Text style={s.retryText}>נסה שנית</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Email step — optional receipt email ────────────────────────────────────
  if (step === 'email') {
    return (
      <KeyboardAvoidingView
        style={[s.full, s.center]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={s.emailCard} onPress={Keyboard.dismiss}>
          <Text style={s.emailTitle}>קבלה לצורכי מס?</Text>
          <Text style={s.emailSub}>
            השאר ריק אם לא צריך. קבלה תישלח מיידית לאחר התשלום.
          </Text>
          <Text style={[s.emailSub, { color: GOLD, marginBottom: 12 }]}>
            ${finalAmount} CAD — {DONATION_TYPES.find(d => d.id === donationType)?.label}
          </Text>
          <TextInput
            style={s.emailInput}
            placeholder="אימייל (אופציונלי)"
            placeholderTextColor="rgba(255,255,255,0.2)"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={donorEmail}
            onChangeText={setDonorEmail}
            returnKeyType="done"
            onSubmitEditing={() => startPayment(donorEmail)}
          />
          <View style={s.emailBtns}>
            <TouchableOpacity style={s.skipBtn} onPress={() => startPayment('')}>
              <Text style={s.skipText}>דלג</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.sendBtn} onPress={() => startPayment(donorEmail)}>
              <Text style={s.sendText}>📲  הצמד לתשלום</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </KeyboardAvoidingView>
    );
  }

  // ── Selection screen ───────────────────────────────────────────────────────
  return (
    <Pressable style={s.full} onPress={handleInteraction}>

      {/* Announcement overlay */}
      {announcement && (
        <View style={s.announcement}>
          <Text style={s.announcementText}>{announcement}</Text>
        </View>
      )}

      {/* Header — long-press 5 s to reset synagogue */}
      <Pressable style={s.header} onPressIn={startHold} onPressOut={endHold}>
        {synagogue?.logoUrl && (
          <Image source={{ uri: synagogue.logoUrl }} style={s.logo} />
        )}
        <View style={{ flex: 1 }}>
          <Text style={s.syName}>{synagogue?.synagogueName ?? '…'}</Text>
          {synagogue?.city && <Text style={s.syCity}>{synagogue.city}</Text>}
        </View>
        <View style={s.pill}>
          <View style={[s.dot, { backgroundColor: readerReady ? GREEN : GOLD }]} />
          <Text style={s.pillText}>{readerReady ? 'מוכן לתשלום' : 'מתחבר…'}</Text>
        </View>
      </Pressable>

      {/* Body */}
      <View style={{ flex: 1, flexDirection: 'row' }}>

        {/* Left — donation types */}
        <View style={s.leftCol}>
          <Text style={s.label}>סוג תרומה</Text>
          {DONATION_TYPES.map((dt) => (
            <TouchableOpacity
              key={dt.id}
              style={[s.typeBtn, donationType === dt.id && s.typeBtnOn]}
              onPress={() => { setDonationType(dt.id); handleInteraction(); }}
            >
              <Text style={[s.typeTxt, donationType === dt.id && s.typeTxtOn]}>
                {dt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Right — amounts + pay */}
        <View style={s.rightCol}>
          <Text style={s.label}>בחר סכום</Text>

          <View style={s.grid}>
            {QUICK_AMOUNTS.map((a) => (
              <TouchableOpacity
                key={a}
                style={[s.amtBtn, amount === a && !customAmount && s.amtBtnOn]}
                onPress={() => { setAmount(a); setCustomAmount(''); handleInteraction(); }}
              >
                <Text style={[s.amtTxt, amount === a && !customAmount && s.amtTxtOn]}>
                  ${a}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={s.customInput}
            keyboardType="numeric"
            placeholder="סכום אחר $"
            placeholderTextColor="rgba(255,255,255,0.22)"
            value={customAmount}
            onChangeText={(v) => { setCustomAmount(v); handleInteraction(); }}
          />

          <View style={s.footer}>
            <View>
              <Text style={s.totalLbl}>סה״כ לתרומה</Text>
              <Text style={s.totalAmt}>${finalAmount || 0} CAD</Text>
            </View>
            <TouchableOpacity
              style={[s.payBtn, (!readerReady || !finalAmount || finalAmount < 1) && s.payBtnOff]}
              onPress={() => { handleInteraction(); setStep('email'); }}
              disabled={!readerReady || !finalAmount || finalAmount < 1}
            >
              <Text style={s.payTxt}>📲  הצמד לתשלום</Text>
            </TouchableOpacity>
          </View>
        </View>

      </View>
    </Pressable>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  full:   { flex: 1, backgroundColor: DARK },
  center: { flex: 1, backgroundColor: DARK, alignItems: 'center', justifyContent: 'center' },

  // Announcement banner
  announcement: {
    position: 'absolute', top: 60, left: 20, right: 20, zIndex: 99,
    backgroundColor: GOLD, borderRadius: 16,
    paddingHorizontal: 24, paddingVertical: 14,
  },
  announcementText: { color: DARK, fontWeight: '700', fontSize: 15, textAlign: 'center' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: DARK2, borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 20, paddingVertical: 10,
  },
  logo:   { width: 38, height: 38, borderRadius: 9 },
  syName: { color: GOLD, fontWeight: '700', fontSize: 14 },
  syCity: { color: 'rgba(255,255,255,0.3)', fontSize: 11 },
  pill:   { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  dot:    { width: 7, height: 7, borderRadius: 4 },
  pillText: { color: 'rgba(255,255,255,0.4)', fontSize: 11 },

  // Left col
  leftCol: { width: 185, borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.06)', paddingVertical: 16, paddingHorizontal: 12 },
  label:   { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.28)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
  typeBtn:   { paddingVertical: 10, paddingHorizontal: 11, borderRadius: 10, marginBottom: 5, backgroundColor: 'rgba(255,255,255,0.04)' },
  typeBtnOn: { backgroundColor: `${GOLD}20` },
  typeTxt:   { color: 'rgba(255,255,255,0.42)', fontSize: 12, fontWeight: '500', textAlign: 'right' },
  typeTxtOn: { color: GOLD, fontWeight: '700' },

  // Right col
  rightCol: { flex: 1, paddingVertical: 16, paddingHorizontal: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  amtBtn:   { width: '31%', paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)' },
  amtBtnOn: { backgroundColor: GOLD },
  amtTxt:   { color: 'rgba(255,255,255,0.6)', fontSize: 16, fontWeight: '600' },
  amtTxtOn: { color: DARK, fontWeight: '700' },
  customInput: {
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    color: WHITE, fontSize: 16, textAlign: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)', marginBottom: 14,
  },
  footer:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' },
  totalLbl: { color: 'rgba(255,255,255,0.28)', fontSize: 11, marginBottom: 3 },
  totalAmt: { color: GOLD, fontSize: 28, fontWeight: '800' },
  payBtn:   { backgroundColor: GOLD, paddingHorizontal: 28, paddingVertical: 16, borderRadius: 16 },
  payBtnOff: { opacity: 0.35 },
  payTxt:   { color: DARK, fontSize: 16, fontWeight: '800' },

  // NFC animation
  nfcWrap: { width: 240, height: 240, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  nfcRing: { position: 'absolute', borderWidth: 1.5, borderColor: GOLD },
  nfcEmoji: { fontSize: 70 },

  // Tap / success / error screens
  h1:       { fontSize: 25, fontWeight: '700', color: WHITE, marginBottom: 8 },
  bigAmount:{ fontSize: 44, fontWeight: '800', color: GOLD, marginBottom: 8 },
  muted:    { fontSize: 14, color: 'rgba(255,255,255,0.36)', marginBottom: 32 },
  cancelBtn:{ paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  cancelText:{ color: 'rgba(255,255,255,0.42)', fontSize: 13 },
  retryBtn: { backgroundColor: GOLD, paddingHorizontal: 34, paddingVertical: 14, borderRadius: 14 },
  retryText:{ color: DARK, fontWeight: '700', fontSize: 15 },

  // Email step
  emailCard: {
    width: 380, backgroundColor: DARK2,
    borderRadius: 22, padding: 30, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  emailTitle: { color: WHITE, fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emailSub:   { color: 'rgba(255,255,255,0.38)', fontSize: 12, textAlign: 'center', marginBottom: 6 },
  emailInput: {
    width: '100%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    color: WHITE, fontSize: 14, textAlign: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)', marginBottom: 16,
  },
  emailBtns: { flexDirection: 'row', gap: 12, width: '100%' },
  skipBtn:  { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center' },
  skipText: { color: 'rgba(255,255,255,0.45)', fontSize: 13 },
  sendBtn:  { flex: 2, paddingVertical: 14, borderRadius: 12, backgroundColor: GOLD, alignItems: 'center' },
  sendText: { color: DARK, fontWeight: '800', fontSize: 14 },
});
