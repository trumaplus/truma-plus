import { useState } from 'react';
import { toast } from 'sonner';
import { Heart, QrCode, X, Smartphone, CreditCard, Loader2, CheckCircle2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import api from '../api/client';

const DONATION_TYPES = [
  { id: 'general',  en: 'General Donation',    he: 'תרומה כללית',    fr: 'Don général',              yi: 'כללית נדבה'              },
  { id: 'neder',    en: 'Pledges & Donations', he: 'נדרים ונדבות',   fr: 'Vœux et dons',             yi: 'נדרים און נדבות'         },
  { id: 'aliyot',   en: 'Torah Aliyot',        he: 'עליות לתורה',    fr: 'Montées à la Torah',       yi: 'עליות צו דער תורה'       },
  { id: 'kiddush',  en: 'Kiddush Payment',     he: 'תשלום קידוש',    fr: 'Paiement du Kiddouch',     yi: 'קידוש צאלונג'            },
  { id: 'standing', en: 'Standing Order',      he: 'הוראת קבע',      fr: 'Prélèvement automatique',  yi: 'שטייענדיקע אָנווייזונג'  },
  { id: 'coffee',   en: 'Coffee Expenses',     he: 'הוצאות קפה',     fr: 'Frais de café',            yi: 'קאווע הוצאות'            },
  { id: 'seuda',    en: 'Seuda Shlishit',      he: 'סעודה שלישית',   fr: 'Séouda Shlishit',          yi: 'סעודה שלישית'            },
];

const QUICK_AMOUNTS = [18, 36, 54, 72, 100, 180];

const T = {
  en: {
    title: 'Make a Donation', type: 'Donation Type', amount: 'Choose Amount',
    donate: 'Donate Now', custom: 'Other amount $',
    processing: 'Processing…', secure: 'Secure payment via Stripe · Tax receipt available',
    qrTitle: 'Scan to Pay',
    qrSub: 'Use Apple Pay, Google Pay, or card on your phone',
    qrWaiting: 'Waiting for payment…',
    payHere: 'Pay on this screen',
    cancel: 'Cancel',
  },
  he: {
    title: 'בצע תרומה', type: 'סוג תרומה', amount: 'בחר סכום',
    donate: 'תרום עכשיו', custom: 'סכום אחר $',
    processing: 'מעבד…', secure: 'תשלום מאובטח · קבלה לצורכי מס',
    qrTitle: 'סרוק לתשלום',
    qrSub: 'Apple Pay, Google Pay או כרטיס בטלפון שלך',
    qrWaiting: 'ממתין לתשלום…',
    payHere: 'שלם כאן במסך',
    cancel: 'ביטול',
  },
  fr: {
    title: 'Faire un don', type: 'Type de don', amount: 'Choisir le montant',
    donate: 'Donner maintenant', custom: 'Autre montant $',
    processing: 'Traitement…', secure: 'Paiement sécurisé · Reçu fiscal disponible',
    qrTitle: 'Scanner pour payer',
    qrSub: 'Apple Pay, Google Pay ou carte sur votre téléphone',
    qrWaiting: 'En attente du paiement…',
    payHere: 'Payer sur cet écran',
    cancel: 'Annuler',
  },
  yi: {
    title: 'מאַך א נדבה', type: 'נדבה טיפ', amount: 'קלייַב סומע',
    donate: 'גיב איצט', custom: 'אַנדערע סומע $',
    processing: 'פֿאַראַרבעטן…', secure: 'זיכערע צאָלונג · שטייַער קווית',
    qrTitle: 'סקאַן צו באַצאָלן',
    qrSub: 'Apple Pay, Google Pay אָדער קאַרטל אויף דיין טעלעפאָן',
    qrWaiting: 'ווארטן אויף צאָלונג…',
    payHere: 'באַצאָל דאָ אויפן עקראַן',
    cancel: 'אָפּזאָגן',
  },
};

export default function DonationPanel({ synagogue, lang = 'en' }) {
  const t      = T[lang] || T.en;
  const isDark = synagogue?.theme !== 'light';

  // ── Theme classes ──────────────────────────────────────────────────────────
  const card       = isDark ? 'card-glass'    : 'card-light';
  const inputCls   = isDark ? 'input-dark'    : 'input-light';
  const textMuted  = isDark ? 'text-white/50' : 'text-gray-500';
  const textLabel  = isDark ? 'text-white/40' : 'text-gray-400';
  const textFooter = isDark ? 'text-white/20' : 'text-gray-400';
  const btnInact   = isDark
    ? 'bg-white/5 text-white/60 hover:bg-white/10'
    : 'bg-gray-100 text-gray-600 hover:bg-gray-200';
  const divider    = isDark ? 'border-white/5' : 'border-gray-100';

  // ── State ──────────────────────────────────────────────────────────────────
  const [donationType, setDonationType] = useState('general');
  const [amount,       setAmount]       = useState(18);
  const [customAmount, setCustomAmount] = useState('');
  const [loading,      setLoading]      = useState(false);
  const [qrData,       setQrData]       = useState(null); // { url, donationId }

  const finalAmount = customAmount ? parseFloat(customAmount) : amount;

  const typeLabel = (id) => {
    const found = DONATION_TYPES.find((d) => d.id === id);
    return found ? (found[lang] || found.en) : id;
  };

  // ── Donate ─────────────────────────────────────────────────────────────────
  async function handleDonate() {
    if (!finalAmount || finalAmount < 1) {
      toast.error(lang === 'he' ? 'הכנס סכום תקין' : 'Please enter a valid amount');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/stripe/checkout', {
        amount:       finalAmount,
        donationType,
        donorInfo:    {},
        synagogueId:  synagogue.id,
        lang,
      });
      if (data.url) {
        if (data.mock) {
          // Dev mode — no real Stripe, redirect directly
          window.location.href = data.url;
        } else {
          // Show QR modal so donor can scan with their phone
          setQrData({ url: data.url, donationId: data.donationId });
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to initiate donation');
    } finally {
      setLoading(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── QR Payment Modal ────────────────────────────────────────────────── */}
      {qrData && (
        <QRModal
          url={qrData.url}
          amount={finalAmount}
          isDark={isDark}
          lang={lang}
          t={t}
          onPayHere={() => {
            setQrData(null);
            window.location.href = qrData.url;
          }}
          onClose={() => setQrData(null)}
        />
      )}

      <div className="h-full flex flex-col overflow-hidden">
        <div className={`${card} flex-1 min-h-0 flex flex-col overflow-hidden`}>

          {/* ── Scrollable content ── */}
          <div className="flex-1 min-h-0 overflow-y-auto p-5">

            {/* Header */}
            <div className="flex items-center gap-2 mb-5">
              <Heart className="w-5 h-5 text-gold-400" />
              <h2 className="font-display text-xl text-gold-400">{t.title}</h2>
            </div>

            {/* Donation type */}
            <p className={`${textMuted} text-xs mb-2.5 uppercase tracking-wide`}>{t.type}</p>
            <div className="grid grid-cols-2 gap-2 mb-6">
              {DONATION_TYPES.map((dt) => (
                <button
                  key={dt.id}
                  onClick={() => setDonationType(dt.id)}
                  className={`py-3 px-3 rounded-xl text-sm font-medium transition-all ${
                    donationType === dt.id
                      ? 'bg-gold-400 text-ink-900 shadow-luxury-sm'
                      : btnInact
                  }`}
                >
                  {dt[lang] || dt.en}
                </button>
              ))}
            </div>

            {/* Quick amounts */}
            <p className={`${textMuted} text-xs mb-2.5 uppercase tracking-wide`}>{t.amount}</p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {QUICK_AMOUNTS.map((a) => (
                <button
                  key={a}
                  onClick={() => { setAmount(a); setCustomAmount(''); }}
                  className={`py-3 rounded-xl text-sm font-semibold transition-all ${
                    amount === a && !customAmount
                      ? 'bg-gold-400 text-ink-900 shadow-luxury-sm'
                      : btnInact
                  }`}
                >
                  ${a}
                </button>
              ))}
            </div>

            {/* Custom amount */}
            <input
              type="number"
              min="1"
              placeholder={t.custom}
              value={customAmount}
              onChange={(e) => { setCustomAmount(e.target.value); }}
              className={`w-full ${inputCls} text-center text-lg font-semibold`}
            />
          </div>

          {/* ── Sticky bottom bar ── */}
          <div className={`p-4 border-t ${divider} shrink-0`}>
            {/* Summary line */}
            <div className="flex items-center justify-between mb-3">
              <span className={`${textMuted} text-sm`}>{typeLabel(donationType)}</span>
              <span className="text-gold-400 font-bold text-2xl">
                ${finalAmount || 0}
                <span className={`text-xs font-normal ${textLabel} ml-1`}>CAD</span>
              </span>
            </div>

            {/* QR hint + Donate button */}
            <button
              onClick={handleDonate}
              disabled={loading || !finalAmount || finalAmount < 1}
              className="btn-gold w-full text-base py-4 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" />{t.processing}</>
                : <><QrCode className="w-4 h-4" />{t.donate} — ${finalAmount || 0}</>
              }
            </button>

            <p className={`text-center ${textFooter} text-xs mt-3`}>{t.secure}</p>
          </div>

        </div>
      </div>
    </>
  );
}

// ── QR Payment Modal ──────────────────────────────────────────────────────────
function QRModal({ url, amount, isDark, lang, t, onPayHere, onClose }) {
  const isRTL = lang === 'he' || lang === 'yi';

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 backdrop-blur-md"
         dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="relative flex flex-col items-center gap-5 p-8 rounded-3xl
                      bg-ink-800 border border-white/10 shadow-2xl max-w-xs w-full mx-4">

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-white/30 hover:text-white/70
                     hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Amount */}
        <p className="font-display text-5xl text-gold-400 font-bold tracking-tight">
          ${amount}
          <span className="text-base font-normal text-white/30 ml-1">CAD</span>
        </p>

        {/* QR code with pulse ring */}
        <div className="relative">
          <div className="absolute -inset-3 rounded-2xl border-2 border-gold-400/20 animate-ping" />
          <div className="relative p-4 bg-white rounded-2xl shadow-luxury">
            <QRCodeSVG
              value={url}
              size={200}
              bgColor="#ffffff"
              fgColor="#07131a"
              level="M"
            />
          </div>
        </div>

        {/* Instructions */}
        <div className="text-center space-y-1">
          <p className="text-white font-semibold text-lg">{t.qrTitle}</p>
          <p className="text-white/45 text-sm leading-snug">{t.qrSub}</p>
        </div>

        {/* Phone icons row */}
        <div className="flex items-center gap-3 text-white/25">
          <Smartphone className="w-5 h-5" />
          <span className="text-xs">Apple Pay · Google Pay · כרטיס</span>
          <CreditCard className="w-5 h-5" />
        </div>

        {/* Waiting indicator */}
        <div className="flex items-center gap-2 text-white/30 text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-gold-400 animate-pulse" />
          {t.qrWaiting}
        </div>

        {/* Pay on screen fallback */}
        <button
          onClick={onPayHere}
          className="w-full py-3 rounded-xl border border-white/10 text-white/50
                     hover:text-white/80 hover:border-white/20 text-sm transition-colors"
        >
          {t.payHere}
        </button>
      </div>
    </div>
  );
}
