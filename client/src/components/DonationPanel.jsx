import { useState } from 'react';
import { toast } from 'sonner';
import { Heart, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../api/client';

const DONATION_TYPES = [
  { id: 'general', en: 'General', he: 'כללי', fr: 'Général', yi: 'אַלגעמיין' },
  { id: 'neder', en: 'Neder', he: 'נדר', fr: 'Voeu', yi: 'נדר' },
  { id: 'aliyot', en: 'Aliyot', he: 'עליות', fr: 'Aliyot', yi: 'עליות' },
  { id: 'kiddush', en: 'Kiddush', he: 'קידוש', fr: 'Kiddouch', yi: 'קידוש' },
  { id: 'standing', en: 'Standing', he: 'עמידה', fr: 'Debout', yi: 'עמידה' },
  { id: 'yizkor', en: 'Yizkor', he: 'יזכור', fr: 'Yizkor', yi: 'יזכור' },
  { id: 'coffee', en: 'Coffee', he: "קפה", fr: 'Café', yi: 'קאַווע' },
  { id: 'seuda', en: 'Seuda', he: 'סעודה', fr: 'Seuda', yi: 'סעודה' },
];

const QUICK_AMOUNTS = [18, 36, 54, 72, 100, 180];

const T = {
  en: { title: 'Make a Donation', type: 'Donation Type', amount: 'Amount', name: 'Name (optional)', email: 'Email (optional)', phone: 'Phone (optional)', donate: 'Donate Now', firstName: 'First Name', lastName: 'Last Name', custom: 'Custom', details: 'Your Details', processing: 'Processing…' },
  he: { title: 'בצע תרומה', type: 'סוג תרומה', amount: 'סכום', name: 'שם (אופציונלי)', email: 'אימייל (אופציונלי)', phone: 'טלפון (אופציונלי)', donate: 'תרום עכשיו', firstName: 'שם פרטי', lastName: 'שם משפחה', custom: 'אחר', details: 'פרטיך', processing: 'מעבד…' },
  fr: { title: 'Faire un don', type: 'Type de don', amount: 'Montant', name: 'Nom (optionnel)', email: 'Email (optionnel)', phone: 'Téléphone (optionnel)', donate: 'Donner maintenant', firstName: 'Prénom', lastName: 'Nom', custom: 'Autre', details: 'Vos coordonnées', processing: 'Traitement…' },
  yi: { title: 'מאַך א נדבה', type: 'נדבה טיפ', amount: 'סומע', name: 'נאָמען (אָפּציאָנאַל)', email: 'עמעיל (אָפּציאָנאַל)', phone: 'טעלעפֿאָן (אָפּציאָנאַל)', donate: 'גיב איצט', firstName: 'פֿאָרנאָמען', lastName: 'פֿאַמיליע נאָמען', custom: 'אַנדערש', details: 'דיינע פּרטים', processing: 'פֿאַראַרבעטן…' },
};

export default function DonationPanel({ synagogue, lang = 'en' }) {
  const t = T[lang] || T.en;
  const [donationType, setDonationType] = useState('general');
  const [amount, setAmount] = useState(18);
  const [customAmount, setCustomAmount] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [donor, setDonor] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [loading, setLoading] = useState(false);

  const finalAmount = customAmount ? parseFloat(customAmount) : amount;

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
      });
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to initiate donation');
    } finally {
      setLoading(false);
    }
  }

  const typeLabel = (type) => {
    const found = DONATION_TYPES.find((d) => d.id === type);
    return found ? (found[lang] || found.en) : type;
  };

  return (
    <div className="h-full flex flex-col gap-3 overflow-hidden">
      {/* Form card — scrolls internally when donor details expand */}
      <div className="card-glass flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto p-5">
          <div className="flex items-center gap-2 mb-4">
            <Heart className="w-5 h-5 text-gold-400" />
            <h2 className="font-display text-xl text-gold-400">{t.title}</h2>
          </div>

          {/* Donation Type */}
          <div className="mb-4">
            <p className="text-white/50 text-xs mb-2 uppercase tracking-wide">{t.type}</p>
            <div className="grid grid-cols-2 gap-2">
              {DONATION_TYPES.map((dt) => (
                <button
                  key={dt.id}
                  onClick={() => setDonationType(dt.id)}
                  className={`py-2 px-3 rounded-xl text-sm font-medium transition-all ${
                    donationType === dt.id
                      ? 'bg-gold-400 text-ink-900'
                      : 'bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
                >
                  {dt[lang] || dt.en}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Amounts */}
          <div className="mb-4">
            <p className="text-white/50 text-xs mb-2 uppercase tracking-wide">{t.amount} (CAD)</p>
            <div className="grid grid-cols-3 gap-2 mb-2">
              {QUICK_AMOUNTS.map((a) => (
                <button
                  key={a}
                  onClick={() => { setAmount(a); setCustomAmount(''); }}
                  className={`py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    amount === a && !customAmount
                      ? 'bg-gold-400 text-ink-900 shadow-luxury-sm'
                      : 'bg-white/5 text-white/70 hover:bg-white/10'
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
              className="w-full input-dark text-center text-lg font-semibold"
            />
          </div>

          {/* Donor Details Toggle */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between text-white/40 text-sm py-2 hover:text-white/60 transition-colors"
          >
            <span>{t.details}</span>
            {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showDetails && (
            <div className="space-y-3 mt-3 fade-in">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder={t.firstName}
                  className="input-dark text-sm"
                  value={donor.firstName}
                  onChange={(e) => setDonor({ ...donor, firstName: e.target.value })}
                />
                <input
                  type="text"
                  placeholder={t.lastName}
                  className="input-dark text-sm"
                  value={donor.lastName}
                  onChange={(e) => setDonor({ ...donor, lastName: e.target.value })}
                />
              </div>
              <input
                type="email"
                placeholder={t.email}
                className="w-full input-dark text-sm"
                value={donor.email}
                onChange={(e) => setDonor({ ...donor, email: e.target.value })}
              />
              <input
                type="tel"
                placeholder={t.phone}
                className="w-full input-dark text-sm"
                value={donor.phone}
                onChange={(e) => setDonor({ ...donor, phone: e.target.value })}
              />
            </div>
          )}
        </div>
      </div>

      {/* Summary + Donate — always visible at bottom */}
      <div className="card-glass p-5 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-white/40 text-xs">Donation</p>
            <p className="text-white/70 text-sm">{typeLabel(donationType)}</p>
          </div>
          <div className="text-right">
            <p className="text-white/40 text-xs">Amount</p>
            <p className="text-2xl font-bold text-gold-400">
              ${finalAmount || '0'}
              <span className="text-sm font-normal text-white/40 ml-1">CAD</span>
            </p>
          </div>
        </div>

        <button
          onClick={handleDonate}
          disabled={loading || !finalAmount}
          className="btn-gold w-full text-base py-4"
        >
          {loading ? t.processing : `${t.donate} — $${finalAmount || 0}`}
        </button>

        <p className="text-center text-white/20 text-xs mt-3">
          Secure payment via Stripe · Tax receipt available
        </p>
      </div>
    </div>
  );
}
