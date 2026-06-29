import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Save, Upload, Lock, KeyRound, Eye, EyeOff, Phone, Moon,
  Clock, Trash2, Plus,
} from 'lucide-react';
import api from '../../api/client';
import StripeConnectCard from './StripeConnectCard';

// ── Prayer-list helpers ────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 9); }

const DEFAULT_PRAYER_LIST = () => [
  { id: uid(), label: 'שחרית',    weekday: '', shabbat: '' },
  { id: uid(), label: 'מנחה',     weekday: '', shabbat: '' },
  { id: uid(), label: 'ערבית',    weekday: '', shabbat: '' },
];

/** Convert any stored format → flat array */
function parsePrayerList(raw) {
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : (raw || null);
    if (!data) return DEFAULT_PRAYER_LIST();

    // ── New format: array ──────────────────────────────────────────────────
    if (Array.isArray(data)) {
      return data.map((p) => ({
        id:      p.id      || uid(),
        label:   p.label   || '',
        weekday: p.weekday || '',
        shabbat: p.shabbat || '',
      }));
    }

    // ── Legacy format: { weekday: {...}, shabbat: {...} } ──────────────────
    const OLD_LABELS = {
      kabbalatShabbat: 'קבלת שבת', shacharit: 'שחרית',
      minchaGedola: 'מנחה גדולה',  mincha: 'מנחה',
      maariv: 'ערבית',             motzeiShabbat: 'מוצ"ש',
    };
    const ORDER = ['kabbalatShabbat','shacharit','minchaGedola','mincha','maariv','motzeiShabbat'];
    const keys = new Set([...Object.keys(data.weekday || {}), ...Object.keys(data.shabbat || {})]);
    if (keys.size === 0) return DEFAULT_PRAYER_LIST();
    return ORDER.filter((k) => keys.has(k)).map((k) => ({
      id:      uid(),
      label:   OLD_LABELS[k] || k,
      weekday: data.weekday?.[k] || '',
      shabbat: data.shabbat?.[k] || '',
    }));
  } catch {
    return DEFAULT_PRAYER_LIST();
  }
}

/** Serialise for DB — drop rows with no label */
function buildPrayerList(prayers) {
  return JSON.stringify(prayers.filter((p) => p.label.trim()));
}

// ── Change-password section ────────────────────────────────────────────────────

function ChangePasswordSection({ synagogueId }) {
  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew,         setShowNew]         = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);

  const mut = useMutation({
    mutationFn: (password) => api.put(`/synagogues/${synagogueId}`, { password }),
    onSuccess: () => { toast.success('Password updated'); setNewPassword(''); setConfirmPassword(''); },
    onError:   () => toast.error('Failed to update password'),
  });

  function handleSubmit() {
    if (newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }
    mut.mutate(newPassword);
  }

  return (
    <div className="mt-10 pt-8 border-t border-white/10">
      <h3 className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-4 flex items-center gap-2">
        <KeyRound className="w-3.5 h-3.5" /> Change Password
      </h3>
      <div className="grid grid-cols-2 gap-4 max-w-md">
        {[
          { label: 'New Password',     val: newPassword,     set: setNewPassword,     show: showNew,     toggle: () => setShowNew(!showNew) },
          { label: 'Confirm Password', val: confirmPassword, set: setConfirmPassword, show: showConfirm, toggle: () => setShowConfirm(!showConfirm) },
        ].map(({ label, val, set, show, toggle }) => (
          <div key={label} className="relative">
            <label className="text-sm text-white/60 mb-1.5 block">{label}</label>
            <input type={show ? 'text' : 'password'} className="w-full input-dark pr-10"
              placeholder={label === 'New Password' ? 'Min 6 characters' : 'Repeat password'}
              value={val} onChange={(e) => set(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()} />
            <button type="button" onClick={toggle}
              className="absolute right-3 top-[38px] text-white/30 hover:text-white/60 transition-colors">
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        ))}
      </div>
      <button onClick={handleSubmit} disabled={mut.isPending || !newPassword || !confirmPassword}
        className="btn-outline mt-4 flex items-center gap-2 text-sm">
        <KeyRound className="w-4 h-4" />
        {mut.isPending ? 'Updating…' : 'Update Password'}
      </button>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

const SETTINGS_TABS = [
  { id: 'general', label: 'General' },
  { id: 'prayers', label: '🕍 Prayer Times' },
];

export default function SynagogueSettingsForm({ synagogue }) {
  const qc = useQueryClient();
  const [settingsTab, setSettingsTab] = useState('general');

  const existingEmergency = (() => {
    try {
      return typeof synagogue.emergencyNumbers === 'string'
        ? JSON.parse(synagogue.emergencyNumbers)
        : (synagogue.emergencyNumbers || {});
    } catch { return {}; }
  })();

  const [form, setForm] = useState({
    synagogueName:        synagogue.synagogueName        || '',
    city:                 synagogue.city                 || '',
    email:                synagogue.email                || '',
    latitude:             synagogue.latitude             || 45.5017,
    longitude:            synagogue.longitude            || -73.5673,
    candleLightingOffset: synagogue.candleLightingOffset || 18,
    theme:                synagogue.theme                || 'light',
    slideshowInterval:    synagogue.slideshowInterval    || 10,
    kioskPin:             synagogue.kioskPin             || '',
    hatzalahNumber:       existingEmergency.hatzalah     || '',
  });

  const [prayers, setPrayers] = useState(() => parsePrayerList(synagogue.prayerTimes));
  const [logoUploading, setLogoUploading] = useState(false);

  // ── Mutations ──────────────────────────────────────────────────────────────

  const saveMut = useMutation({
    mutationFn: ({ hatzalahNumber, ...rest }) => {
      const emergencyNumbers = JSON.stringify({ hatzalah: hatzalahNumber || null });
      return api.put(`/synagogues/${synagogue.id}`, { ...rest, emergencyNumbers });
    },
    onSuccess: () => { toast.success('Settings saved'); qc.invalidateQueries(['synagogue', synagogue.id]); },
    onError:   () => toast.error('Failed to save'),
  });

  const prayerMut = useMutation({
    mutationFn: () =>
      api.put(`/synagogues/${synagogue.id}`, { prayerTimes: buildPrayerList(prayers) }),
    onSuccess: () => { toast.success('Prayer times saved'); qc.invalidateQueries(['synagogue', synagogue.id]); },
    onError:   () => toast.error('Failed to save prayer times'),
  });

  async function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post('/upload/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      await api.put(`/synagogues/${synagogue.id}`, { logoUrl: data.url });
      toast.success('Logo updated');
      qc.invalidateQueries(['synagogue', synagogue.id]);
    } catch { toast.error('Logo upload failed'); }
    finally { setLogoUploading(false); }
  }

  // ── Prayer list helpers ────────────────────────────────────────────────────

  function addPrayer() {
    setPrayers((prev) => [...prev, { id: uid(), label: '', weekday: '', shabbat: '' }]);
  }
  function removePrayer(id) {
    setPrayers((prev) => prev.filter((p) => p.id !== id));
  }
  function updatePrayer(id, field, value) {
    setPrayers((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl">

      {/* Tab switcher */}
      <div className="flex gap-1 mb-7 bg-ink-800 rounded-xl p-1">
        {SETTINGS_TABS.map((tab) => (
          <button key={tab.id} onClick={() => setSettingsTab(tab.id)}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
              settingsTab === tab.id ? 'bg-gold-400 text-ink-900' : 'text-white/50 hover:text-white/80'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════
          TAB: General
      ═══════════════════════════════════════ */}
      {settingsTab === 'general' && (
        <>
          {/* Logo */}
          <div className="mb-8 flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-ink-700 overflow-hidden flex items-center justify-center">
              {synagogue.logoUrl
                ? <img src={synagogue.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                : <span className="text-white/20 text-3xl font-display">{synagogue.synagogueName?.charAt(0)}</span>
              }
            </div>
            <label className="btn-outline text-sm cursor-pointer flex items-center gap-2">
              <Upload className="w-4 h-4" />
              {logoUploading ? 'Uploading…' : 'Upload Logo'}
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="col-span-2">
              <label className="text-sm text-white/60 mb-1.5 block">Synagogue Name</label>
              <input type="text" className="w-full input-dark" value={form.synagogueName}
                onChange={(e) => setForm({ ...form, synagogueName: e.target.value })} />
            </div>
            <div>
              <label className="text-sm text-white/60 mb-1.5 block">City</label>
              <input type="text" className="w-full input-dark" value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div>
              <label className="text-sm text-white/60 mb-1.5 block">Email</label>
              <input type="email" className="w-full input-dark" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="text-sm text-white/60 mb-1.5 block">Latitude</label>
              <input type="number" step="0.0001" className="w-full input-dark" value={form.latitude}
                onChange={(e) => setForm({ ...form, latitude: parseFloat(e.target.value) })} />
            </div>
            <div>
              <label className="text-sm text-white/60 mb-1.5 block">Longitude</label>
              <input type="number" step="0.0001" className="w-full input-dark" value={form.longitude}
                onChange={(e) => setForm({ ...form, longitude: parseFloat(e.target.value) })} />
            </div>
            <div>
              <label className="text-sm text-white/60 mb-1.5 block">Candle Lighting Offset (min)</label>
              <input type="number" className="w-full input-dark" value={form.candleLightingOffset}
                onChange={(e) => setForm({ ...form, candleLightingOffset: parseInt(e.target.value) })} />
            </div>
            <div>
              <label className="text-sm text-white/60 mb-1.5 block">Slideshow Interval (sec)</label>
              <select className="w-full input-dark" value={form.slideshowInterval}
                onChange={(e) => setForm({ ...form, slideshowInterval: parseInt(e.target.value) })}>
                {[5, 10, 15, 30].map((s) => <option key={s} value={s}>{s} seconds</option>)}
              </select>
            </div>

            <div className="col-span-2">
              <label className="text-sm text-white/60 mb-1.5 flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-gold-400/60" /> Kiosk Exit PIN (4 digits)
              </label>
              <input type="text" inputMode="numeric" pattern="[0-9]{4}" maxLength={4}
                placeholder="e.g. 1234 — leave empty to disable PIN lock"
                className="w-full input-dark font-mono tracking-widest"
                value={form.kioskPin}
                onChange={(e) => setForm({ ...form, kioskPin: e.target.value.replace(/\D/g, '').slice(0, 4) })} />
              <p className="text-white/25 text-xs mt-1">Leave empty to allow free exit.</p>
            </div>

            <div className="col-span-2">
              <label className="text-sm text-white/60 mb-1.5 flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-red-400/70" /> Hatzalah / Emergency Number
              </label>
              <input type="tel" placeholder="e.g. 514-738-3311 — leave empty to hide"
                className="w-full input-dark font-mono"
                value={form.hatzalahNumber}
                onChange={(e) => setForm({ ...form, hatzalahNumber: e.target.value })} />
              <p className="text-white/25 text-xs mt-1">Appears next to 911 during Shabbat mode.</p>
            </div>

            <div className="col-span-2">
              <label className="text-sm text-white/60 mb-2 block">Kiosk Theme</label>
              <div className="flex gap-3">
                {['dark', 'light'].map((t) => (
                  <button key={t} onClick={() => setForm({ ...form, theme: t })}
                    className={`flex-1 py-3 rounded-xl font-medium text-sm transition-all ${
                      form.theme === t ? 'bg-gold-400 text-ink-900' : 'bg-white/5 text-white/50 hover:bg-white/10'
                    }`}>
                    {t === 'dark' ? '🌙 Dark' : '☀️ Light'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-8">
            <button onClick={() => saveMut.mutate(form)} disabled={saveMut.isPending}
              className="btn-gold flex items-center gap-2">
              <Save className="w-4 h-4" />
              {saveMut.isPending ? 'Saving…' : 'Save Settings'}
            </button>
            <a href={`/kiosk/${synagogue.id}?preview_shabbat=1`} target="_blank" rel="noopener noreferrer"
              className="btn-outline flex items-center gap-2 text-sm">
              <Moon className="w-4 h-4 text-gold-400" /> Preview Shabbat Mode
            </a>
          </div>

          <ChangePasswordSection synagogueId={synagogue.id} />

          {/* Kiosk ID — for the mobile Tap to Pay app */}
          <div className="mt-10 pt-8 border-t border-white/10">
            <h3 className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-4">
              מזהה קיוסק (Tap to Pay App)
            </h3>
            <div className="flex items-center gap-3 bg-white/4 border border-white/10 rounded-xl px-4 py-3">
              <code className="text-gold-400 text-sm font-mono flex-1 select-all">{synagogue.id}</code>
              <button
                onClick={() => { navigator.clipboard.writeText(synagogue.id); }}
                className="text-white/30 hover:text-gold-400 transition-colors text-xs"
              >
                העתק
              </button>
            </div>
            <p className="text-white/25 text-xs mt-2">
              הכנס מזהה זה במסך ההגדרה של אפליקציית Truma Plus Kiosk בטאבלט.
            </p>
          </div>

          <div className="mt-8 pt-8 border-t border-white/10">
            <h3 className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-4">Payment Account</h3>
            <StripeConnectCard synagogueId={synagogue.id} synagogueName={synagogue.synagogueName} />
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════
          TAB: Prayer Times
      ═══════════════════════════════════════ */}
      {settingsTab === 'prayers' && (
        <div>
          <p className="text-white/35 text-sm mb-5 flex items-center gap-2">
            <Clock className="w-4 h-4 text-gold-400/50 shrink-0" />
            רק תפילות עם שעה מוגדרת יוצגו בקיוסק. שדה ריק = לא מוצג.
          </p>

          {/* Column headers */}
          <div className="grid grid-cols-[1fr_120px_120px_36px] gap-3 mb-2 px-1">
            <span className="text-xs text-white/30 uppercase tracking-widest">תפילה</span>
            <span className="text-xs text-white/30 uppercase tracking-widest text-center">חול</span>
            <span className="text-xs text-white/30 uppercase tracking-widest text-center">שבת</span>
            <span />
          </div>

          {/* Prayer rows */}
          <div className="space-y-2">
            {prayers.map((prayer) => (
              <div key={prayer.id}
                className="grid grid-cols-[1fr_120px_120px_36px] gap-3 items-center
                           bg-ink-800/50 rounded-xl px-3 py-2 border border-white/5
                           hover:border-white/10 transition-colors">

                {/* Editable name */}
                <input
                  type="text"
                  placeholder="שם התפילה..."
                  dir="auto"
                  className="bg-transparent text-white/80 text-sm placeholder:text-white/20
                             outline-none border-b border-transparent focus:border-gold-400/40
                             transition-colors pb-0.5 w-full"
                  value={prayer.label}
                  onChange={(e) => updatePrayer(prayer.id, 'label', e.target.value)}
                />

                {/* Weekday time */}
                <input
                  type="time"
                  className="input-dark font-mono text-sm text-center py-1.5"
                  value={prayer.weekday}
                  onChange={(e) => updatePrayer(prayer.id, 'weekday', e.target.value)}
                />

                {/* Shabbat time */}
                <input
                  type="time"
                  className="input-dark font-mono text-sm text-center py-1.5"
                  value={prayer.shabbat}
                  onChange={(e) => updatePrayer(prayer.id, 'shabbat', e.target.value)}
                />

                {/* Delete */}
                <button
                  onClick={() => removePrayer(prayer.id)}
                  className="text-white/15 hover:text-red-400 transition-colors p-1 rounded-lg
                             hover:bg-red-900/20 flex items-center justify-center"
                  title="הסר תפילה"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Add prayer */}
          <button
            onClick={addPrayer}
            className="mt-4 flex items-center gap-2 text-sm text-white/40 hover:text-gold-400
                       transition-colors px-3 py-2 rounded-xl hover:bg-white/5 border border-dashed
                       border-white/10 hover:border-gold-400/30 w-full justify-center"
          >
            <Plus className="w-4 h-4" />
            הוסף תפילה
          </button>

          {/* Save */}
          <button
            onClick={() => prayerMut.mutate()}
            disabled={prayerMut.isPending}
            className="btn-gold flex items-center gap-2 mt-6"
          >
            <Save className="w-4 h-4" />
            {prayerMut.isPending ? 'Saving…' : 'Save Prayer Times'}
          </button>
        </div>
      )}
    </div>
  );
}
