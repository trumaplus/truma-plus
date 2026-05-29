import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Save, Upload, Lock, KeyRound, Eye, EyeOff, Phone, Moon, Clock } from 'lucide-react';
import api from '../../api/client';
import StripeConnectCard from './StripeConnectCard';

// ── Prayer times helpers ───────────────────────────────────────────────────────

function parsePrayerTimes(raw) {
  try {
    const pt = typeof raw === 'string' ? JSON.parse(raw) : (raw || {});
    return {
      weekday_shacharit:       pt.weekday?.shacharit        || '',
      weekday_minchaGedola:    pt.weekday?.minchaGedola     || '',
      weekday_mincha:          pt.weekday?.mincha            || '',
      weekday_maariv:          pt.weekday?.maariv            || '',
      shabbat_kabbalatShabbat: pt.shabbat?.kabbalatShabbat  || '',
      shabbat_shacharit:       pt.shabbat?.shacharit         || '',
      shabbat_mincha:          pt.shabbat?.mincha            || '',
      shabbat_motzeiShabbat:   pt.shabbat?.motzeiShabbat    || '',
    };
  } catch {
    return {
      weekday_shacharit:'', weekday_minchaGedola:'', weekday_mincha:'', weekday_maariv:'',
      shabbat_kabbalatShabbat:'', shabbat_shacharit:'', shabbat_mincha:'', shabbat_motzeiShabbat:'',
    };
  }
}

function buildPrayerTimes(p) {
  const weekday = {};
  if (p.weekday_shacharit)      weekday.shacharit     = p.weekday_shacharit;
  if (p.weekday_minchaGedola)   weekday.minchaGedola  = p.weekday_minchaGedola;
  if (p.weekday_mincha)         weekday.mincha        = p.weekday_mincha;
  if (p.weekday_maariv)         weekday.maariv        = p.weekday_maariv;
  const shabbat = {};
  if (p.shabbat_kabbalatShabbat) shabbat.kabbalatShabbat = p.shabbat_kabbalatShabbat;
  if (p.shabbat_shacharit)      shabbat.shacharit     = p.shabbat_shacharit;
  if (p.shabbat_mincha)         shabbat.mincha        = p.shabbat_mincha;
  if (p.shabbat_motzeiShabbat)  shabbat.motzeiShabbat = p.shabbat_motzeiShabbat;
  return JSON.stringify({ weekday, shabbat });
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function TimeRow({ label, value, onChange, optional }) {
  return (
    <div>
      <label className="text-sm text-white/60 mb-1.5 block">
        {label}
        {optional && <span className="text-white/25 text-xs ml-2">(optional)</span>}
      </label>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full input-dark font-mono"
      />
    </div>
  );
}

function ChangePasswordSection({ synagogueId }) {
  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew,         setShowNew]         = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);

  const mut = useMutation({
    mutationFn: (password) => api.put(`/synagogues/${synagogueId}`, { password }),
    onSuccess: () => {
      toast.success('Password updated');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: () => toast.error('Failed to update password'),
  });

  function handleSubmit() {
    if (newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }
    mut.mutate(newPassword);
  }

  return (
    <div className="mt-10 pt-8 border-t border-white/10">
      <h3 className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-4 flex items-center gap-2">
        <KeyRound className="w-3.5 h-3.5" />
        Change Password
      </h3>
      <div className="grid grid-cols-2 gap-4 max-w-md">
        <div className="relative">
          <label className="text-sm text-white/60 mb-1.5 block">New Password</label>
          <input
            type={showNew ? 'text' : 'password'}
            className="w-full input-dark pr-10"
            placeholder="Min 6 characters"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <button type="button" onClick={() => setShowNew(!showNew)}
            className="absolute right-3 top-[38px] text-white/30 hover:text-white/60 transition-colors">
            {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <div className="relative">
          <label className="text-sm text-white/60 mb-1.5 block">Confirm Password</label>
          <input
            type={showConfirm ? 'text' : 'password'}
            className="w-full input-dark pr-10"
            placeholder="Repeat password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
          <button type="button" onClick={() => setShowConfirm(!showConfirm)}
            className="absolute right-3 top-[38px] text-white/30 hover:text-white/60 transition-colors">
            {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
      <button
        onClick={handleSubmit}
        disabled={mut.isPending || !newPassword || !confirmPassword}
        className="btn-outline mt-4 flex items-center gap-2 text-sm"
      >
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

  const [prayers, setPrayers] = useState(() => parsePrayerTimes(synagogue.prayerTimes));
  const [logoUploading, setLogoUploading] = useState(false);

  // Save general settings
  const saveMut = useMutation({
    mutationFn: ({ hatzalahNumber, ...rest }) => {
      const emergencyNumbers = JSON.stringify({ hatzalah: hatzalahNumber || null });
      return api.put(`/synagogues/${synagogue.id}`, { ...rest, emergencyNumbers });
    },
    onSuccess: () => {
      toast.success('Settings saved');
      qc.invalidateQueries(['synagogue', synagogue.id]);
    },
    onError: () => toast.error('Failed to save'),
  });

  // Save prayer times
  const prayerMut = useMutation({
    mutationFn: () =>
      api.put(`/synagogues/${synagogue.id}`, { prayerTimes: buildPrayerTimes(prayers) }),
    onSuccess: () => {
      toast.success('Prayer times saved');
      qc.invalidateQueries(['synagogue', synagogue.id]);
    },
    onError: () => toast.error('Failed to save prayer times'),
  });

  async function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post('/upload/logo', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await api.put(`/synagogues/${synagogue.id}`, { logoUrl: data.url });
      toast.success('Logo updated');
      qc.invalidateQueries(['synagogue', synagogue.id]);
    } catch {
      toast.error('Logo upload failed');
    } finally {
      setLogoUploading(false);
    }
  }

  return (
    <div className="max-w-2xl">

      {/* ── Tab switcher ── */}
      <div className="flex gap-1 mb-7 bg-ink-800 rounded-xl p-1">
        {SETTINGS_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSettingsTab(tab.id)}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
              settingsTab === tab.id
                ? 'bg-gold-400 text-ink-900'
                : 'text-white/50 hover:text-white/80'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════
          TAB: General
      ══════════════════════════════════════════════════ */}
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

            {/* Kiosk PIN */}
            <div className="col-span-2">
              <label className="text-sm text-white/60 mb-1.5 flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-gold-400/60" />
                Kiosk Exit PIN (4 digits)
              </label>
              <input
                type="text" inputMode="numeric" pattern="[0-9]{4}" maxLength={4}
                placeholder="e.g. 1234 — leave empty to disable PIN lock"
                className="w-full input-dark font-mono tracking-widest"
                value={form.kioskPin}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setForm({ ...form, kioskPin: v });
                }}
              />
              <p className="text-white/25 text-xs mt-1">
                Tablet users must enter this PIN to exit fullscreen kiosk mode. Leave empty to allow free exit.
              </p>
            </div>

            {/* Hatzalah */}
            <div className="col-span-2">
              <label className="text-sm text-white/60 mb-1.5 flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-red-400/70" />
                Hatzalah / Emergency Number (shown on Shabbat screen)
              </label>
              <input
                type="tel" placeholder="e.g. 514-738-3311 — leave empty to hide"
                className="w-full input-dark font-mono"
                value={form.hatzalahNumber}
                onChange={(e) => setForm({ ...form, hatzalahNumber: e.target.value })}
              />
              <p className="text-white/25 text-xs mt-1">
                Appears as a second emergency button next to 911 during Shabbat mode.
              </p>
            </div>

            {/* Theme */}
            <div className="col-span-2">
              <label className="text-sm text-white/60 mb-2 block">Kiosk Theme</label>
              <div className="flex gap-3">
                {['dark', 'light'].map((t) => (
                  <button key={t} onClick={() => setForm({ ...form, theme: t })}
                    className={`flex-1 py-3 rounded-xl capitalize font-medium text-sm transition-all ${
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
              <Moon className="w-4 h-4 text-gold-400" />
              Preview Shabbat Mode
            </a>
          </div>

          <ChangePasswordSection synagogueId={synagogue.id} />

          <div className="mt-10 pt-8 border-t border-white/10">
            <h3 className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-4">
              Payment Account
            </h3>
            <StripeConnectCard synagogueId={synagogue.id} synagogueName={synagogue.synagogueName} />
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════
          TAB: Prayer Times
      ══════════════════════════════════════════════════ */}
      {settingsTab === 'prayers' && (
        <div>
          <p className="text-white/40 text-sm mb-6">
            Empty fields will not be displayed in the kiosk. Times use 24-hour format.
          </p>

          <div className="grid grid-cols-2 gap-8">

            {/* ── Weekday column ── */}
            <div>
              <h3 className="text-gold-400 text-xs font-semibold uppercase tracking-widest mb-5 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" />
                חול / Weekday
              </h3>
              <div className="space-y-4">
                <TimeRow
                  label="שחרית / Shacharit"
                  value={prayers.weekday_shacharit}
                  onChange={(v) => setPrayers({ ...prayers, weekday_shacharit: v })}
                />
                <TimeRow
                  label="מנחה גדולה / Mincha Gedola"
                  value={prayers.weekday_minchaGedola}
                  onChange={(v) => setPrayers({ ...prayers, weekday_minchaGedola: v })}
                  optional
                />
                <TimeRow
                  label="מנחה / Mincha"
                  value={prayers.weekday_mincha}
                  onChange={(v) => setPrayers({ ...prayers, weekday_mincha: v })}
                />
                <TimeRow
                  label="ערבית / Maariv"
                  value={prayers.weekday_maariv}
                  onChange={(v) => setPrayers({ ...prayers, weekday_maariv: v })}
                />
              </div>
            </div>

            {/* ── Shabbat column ── */}
            <div>
              <h3 className="text-gold-400 text-xs font-semibold uppercase tracking-widest mb-5 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" />
                שבת / Shabbat
              </h3>
              <div className="space-y-4">
                <TimeRow
                  label="קבלת שבת / Kabbalat Shabbat"
                  value={prayers.shabbat_kabbalatShabbat}
                  onChange={(v) => setPrayers({ ...prayers, shabbat_kabbalatShabbat: v })}
                  optional
                />
                <TimeRow
                  label="שחרית / Shacharit"
                  value={prayers.shabbat_shacharit}
                  onChange={(v) => setPrayers({ ...prayers, shabbat_shacharit: v })}
                />
                <TimeRow
                  label="מנחה / Mincha"
                  value={prayers.shabbat_mincha}
                  onChange={(v) => setPrayers({ ...prayers, shabbat_mincha: v })}
                />
                <TimeRow
                  label='מוצ"ש / Motzei Shabbat'
                  value={prayers.shabbat_motzeiShabbat}
                  onChange={(v) => setPrayers({ ...prayers, shabbat_motzeiShabbat: v })}
                />
              </div>
            </div>
          </div>

          <button
            onClick={() => prayerMut.mutate()}
            disabled={prayerMut.isPending}
            className="btn-gold flex items-center gap-2 mt-8"
          >
            <Save className="w-4 h-4" />
            {prayerMut.isPending ? 'Saving…' : 'Save Prayer Times'}
          </button>
        </div>
      )}

    </div>
  );
}
