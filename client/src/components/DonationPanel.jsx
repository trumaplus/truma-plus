import { useState } from 'react';
import { toast } from 'sonner';
import { Heart, ArrowLeft } from 'lucide-react';
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
    title: 'Make a Donation', type: 'Choose Donation Type',
    amount: 'Choose Amount', details: 'Your Details (optional)',
    donate: 'Donate Now', firstName: 'First Name', lastName: 'Last Name',
    email: 'Email (optional)', phone: 'Phone (optional)',
    custom: 'Custom', processing: 'Processing…',
    back: 'Back', continue: 'Continue',
    secure: 'Secure payment via Stripe · Tax receipt available',
  },
  he: {
    title: 'בצע תרומה', type: 'בחר סוג תרומה',
    amount: 'בחר סכום', details: 'פרטיך (אופציונלי)',
    donate: 'תרום עכשיו', firstName: 'שם פרטי', lastName: 'שם משפחה',
    email: 'אימייל (אופציונלי)', phone: 'טלפון (אופציונלי)',
    custom: 'אחר', processing: 'מעבד…',
    back: 'חזרה', continue: 'המשך',
    secure: 'תשלום מאובטח · קבלה לצורכי מס',
  },
  fr: {
    title: 'Faire un don', type: 'Choisir le type de don',
    amount: 'Choisir le montant', details: 'Vos coordonnées (optionnel)',
    donate: 'Donner maintenant', firstName: 'Prénom', lastName: 'Nom',
    email: 'Email (optionnel)', phone: 'Téléphone (optionnel)',
    custom: 'Autre', processing: 'Traitement…',
    back: 'Retour', continue: 'Continuer',
    secure: 'Paiement sécurisé · Reçu fiscal disponible',
  },
  yi: {
    title: 'מאַך א נדבה', type: 'קלייַב נדבה טיפ',
    amount: 'קלייַב סומע', details: 'דיינע פּרטים (אָפּציאָנאַל)',
    donate: 'גיב איצט', firstName: 'פֿאָרנאָמען', lastName: 'פֿאַמיליע נאָמען',
    email: 'עמעיל (אָפּציאָנאַל)', phone: 'טעלעפֿאָן (אָפּציאָנאַל)',
    custom: 'אַנדערש', processing: 'פֿאַראַרבעטן…',
    back: 'צוריק', continue: 'ווייַטער',
    secure: 'זיכערע צאָלונג · שטייַער קווית',
  },
};

export default function DonationPanel({ synagogue, lang = 'en' }) {
  const t      = T[lang] || T.en;
  const isDark = synagogue?.theme !== 'light';

  // Theme-aware classes
  const card       = isDark ? 'card-glass'    : 'card-light';
  const inputCls   = isDark ? 'input-dark'    : 'input-light';
  const textMuted  = isDark ? 'text-white/50' : 'text-gray-500';
  const textLabel  = isDark ? 'text-white/40' : 'text-gray-400';
  const textBody   = isDark ? 'text-white/70' : 'text-gray-700';
  const textFooter = isDark ? 'text-white/20' : 'text-gray-400';
  const btnInact   = isDark
    ? 'bg-white/5 text-white/60 hover:bg-white/10'
    : 'bg-gray-100 text-gray-600 hover:bg-gray-200';
  const divider    = isDark ? 'border-white/5' : 'border-gray-100';
  const backCls    = isDark
    ? 'text-white/40 hover:text-white/70'
    : 'text-gray-400 hover:text-gray-700';

  // ── State ──────────────────────────────────────────────────────────────────
  const [step,         setStep]         = useState(1); // 1 | 2 | 3
  const [donationType, setDonationType] = useState('general');
  const [amount,       setAmount]       = useState(18);
  const [customAmount, setCustomAmount] = useState('');
  const [donor,        setDonor]        = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [loading,      setLoading]      = useState(false);

  const finalAmount = customAmount ? parseFloat(customAmount) : amount;

  const typeLabel = (id) => {
    const found = DONATION_TYPES.find((d) => d.id === id);
    return found ? (found[lang] || found.en) : id;
  };

  // ── Donate ─────────────────────────────────────────────────────────────────
  async function handleDonate() {
    if (!finalAmount || finalAmount < 1) {
      toast.error('Please enter a valid amount');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/stripe/checkout', {
        amount: finalAmount,
        donationType,
        donorInfo: { ...donor },
        synagogueId: synagogue.id,
        lang,
      });
      if (data.url) window.location.href = data.url;
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to initiate donation');
    } finally {
      setLoading(false);
    }
  }

  // ── Back button ────────────────────────────────────────────────────────────
  const BackButton = (
    <button
      onClick={() => setStep((s) => Math.max(1, s - 1))}
      className={`flex items-center gap-1.5 text-sm mb-4 transition-colors ${backCls}`}
    >
      <ArrowLeft className="w-4 h-4" />
      {t.back}
    </button>
  );

  // ── Step indicator ─────────────────────────────────────────────────────────
  const StepBar = (
    <div className="flex gap-1.5 mb-5">
      {[1, 2, 3].map((n) => (
        <div
          key={n}
          className={`h-1 flex-1 rounded-full transition-all duration-300 ${
            n <= step
              ? 'bg-gold-400'
              : isDark ? 'bg-white/10' : 'bg-gray-200'
          }`}
        />
      ))}
    </div>
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col gap-3 overflow-hidden">

      {/* Main content card */}
      <div className={`${card} flex-1 min-h-0 flex flex-col overflow-hidden`}>
        <div className="flex-1 min-h-0 overflow-y-auto p-5">

          {/* ── Step 1: Donation type ────────────────────────────────────── */}
          {step === 1 && (
            <>
              {StepBar}
              <div className="flex items-center gap-2 mb-4">
                <Heart className="w-5 h-5 text-gold-400" />
                <h2 className="font-display text-xl text-gold-400">{t.title}</h2>
              </div>
              <p className={`${textMuted} text-xs mb-3 uppercase tracking-wide`}>{t.type}</p>
              <div className="grid grid-cols-2 gap-2">
                {DONATION_TYPES.map((dt) => (
                  <button
                    key={dt.id}
                    onClick={() => setDonationType(dt.id)}
                    className={`py-3 px-3 rounded-xl text-sm font-medium transition-all ${
                      donationType === dt.id ? 'bg-gold-400 text-ink-900' : btnInact
                    }`}
                  >
                    {dt[lang] || dt.en}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ── Step 2: Amount ───────────────────────────────────────────── */}
          {step === 2 && (
            <>
              {StepBar}
              {BackButton}
              <div className="flex items-center justify-between mb-4">
                <h2 className={`font-display text-lg text-gold-400`}>{t.amount}</h2>
                <span className={`${textMuted} text-xs px-2 py-0.5 rounded-lg
                                  ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
                  {typeLabel(donationType)}
                </span>
              </div>
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
              <input
                type="number"
                min="1"
                placeholder={`${t.custom} $`}
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className={`w-full ${inputCls} text-center text-lg font-semibold`}
              />
            </>
          )}

          {/* ── Step 3: Donor details ────────────────────────────────────── */}
          {step === 3 && (
            <>
              {StepBar}
              {BackButton}
              <div className="flex items-center justify-between mb-1">
                <h2 className={`font-display text-lg text-gold-400`}>{t.details}</h2>
                <span className="text-gold-400 font-bold text-2xl">
                  ${finalAmount || 0}
                  <span className={`text-sm font-normal ${textLabel} ml-1`}>CAD</span>
                </span>
              </div>
              <p className={`${textMuted} text-xs mb-4`}>{typeLabel(donationType)}</p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder={t.firstName}
                    className={`${inputCls} text-sm`}
                    value={donor.firstName}
                    onChange={(e) => setDonor({ ...donor, firstName: e.target.value })}
                  />
                  <input
                    type="text"
                    placeholder={t.lastName}
                    className={`${inputCls} text-sm`}
                    value={donor.lastName}
                    onChange={(e) => setDonor({ ...donor, lastName: e.target.value })}
                  />
                </div>
                <input
                  type="email"
                  placeholder={t.email}
                  className={`w-full ${inputCls} text-sm`}
                  value={donor.email}
                  onChange={(e) => setDonor({ ...donor, email: e.target.value })}
                />
                <input
                  type="tel"
                  placeholder={t.phone}
                  className={`w-full ${inputCls} text-sm`}
                  value={donor.phone}
                  onChange={(e) => setDonor({ ...donor, phone: e.target.value })}
                />
              </div>
            </>
          )}
        </div>

        {/* ── Bottom action bar ──────────────────────────────────────────────── */}
        <div className={`p-4 border-t ${divider} shrink-0`}>
          {step < 3 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="btn-gold w-full py-3.5 text-base"
            >
              {t.continue} →
            </button>
          ) : (
            <>
              <div className={`flex justify-between ${textBody} text-sm mb-3`}>
                <span className={textMuted}>{typeLabel(donationType)}</span>
                <span className="text-gold-400 font-bold text-xl">
                  ${finalAmount || 0}
                  <span className={`text-xs font-normal ${textLabel} ml-1`}>CAD</span>
                </span>
              </div>
              <button
                onClick={handleDonate}
                disabled={loading || !finalAmount}
                className="btn-gold w-full text-base py-4"
              >
                {loading ? t.processing : `${t.donate} — $${finalAmount || 0}`}
              </button>
              <p className={`text-center ${textFooter} text-xs mt-3`}>{t.secure}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
