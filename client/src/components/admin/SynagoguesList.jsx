import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Plus, Trash2, ExternalLink, Building2, Edit2, LayoutDashboard,
  Check, X, CreditCard, Loader2, Copy, AlertTriangle, ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import api from '../../api/client';

// ── Email validation ──────────────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateForm(form) {
  const errs = {};
  if (!form.synagogueName.trim())       errs.synagogueName = 'שם בית הכנסת חובה';
  if (!form.email.trim())               errs.email         = 'אימייל חובה';
  else if (!EMAIL_RE.test(form.email))  errs.email         = 'פורמט אימייל לא תקין';
  if (!form.password)                   errs.password      = 'סיסמה חובה';
  else if (form.password.length < 6)   errs.password      = 'סיסמה חייבת להכיל לפחות 6 תווים';
  return errs;
}

// ── Stripe status badge ───────────────────────────────────────────────────────
const STRIPE_STATUS = {
  active:        { dot: 'bg-emerald-400', label: 'Stripe Active',  text: 'text-emerald-400' },
  pending:       { dot: 'bg-amber-400',   label: 'Stripe Pending', text: 'text-amber-400'   },
  restricted:    { dot: 'bg-orange-400',  label: 'Stripe Limited', text: 'text-orange-400'  },
  not_connected: { dot: 'bg-red-500',     label: 'Not Connected',  text: 'text-red-400'     },
};

function StripeStatusBadge({ status }) {
  const cfg = STRIPE_STATUS[status] || STRIPE_STATUS.not_connected;
  return (
    <span className={`flex items-center gap-1 text-xs ${cfg.text} shrink-0`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ── Stripe Connect link generator ─────────────────────────────────────────────
function SendConnectLinkButton({ synagogueId }) {
  const [url, setUrl]       = useState(null);
  const [copied, setCopied] = useState(false);

  const mut = useMutation({
    mutationFn: () => api.post(`/stripe/connect/${synagogueId}`),
    onSuccess: ({ data }) => {
      setUrl(data.url);
      window.open(data.url, '_blank', 'noopener,noreferrer');
    },
    onError: (err) => {
      const e = err.response?.data;
      if (e?.configMissing) toast.error('Set STRIPE_SECRET_KEY in Railway env vars first');
      else toast.error(e?.error || 'Failed to generate link');
    },
  });

  async function copyLink() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Link copied — send it to the gabai');
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => mut.mutate()}
        disabled={mut.isPending}
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium
                   bg-gold-400/10 text-gold-400 hover:bg-gold-400/20 transition-colors"
      >
        {mut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CreditCard className="w-3 h-3" />}
        Send Link
      </button>
      {url && (
        <button onClick={copyLink} className="p-1 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/10 transition-colors">
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
        </button>
      )}
    </div>
  );
}

// ── Field with error ──────────────────────────────────────────────────────────
function Field({ label, error, children }) {
  return (
    <div>
      <label className="text-sm text-white/60 mb-1.5 block">{label}</label>
      {children}
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}

// ── Created-credentials card ──────────────────────────────────────────────────
function CreatedCard({ created, loginVerified, onClose }) {
  const [copied, setCopied] = useState(false);

  function copyCredentials() {
    const text =
      `כניסה לדשבורד גבאי:\n` +
      `אתר: ${window.location.origin}/login\n` +
      `אימייל: ${created.email}\n` +
      `סיסמה: ${created.password}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('פרטי הכניסה הועתקו');
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="card-glass p-6 mb-6 border border-emerald-400/25 fade-in">
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Check className="w-5 h-5 text-emerald-400 shrink-0" />
        <h3 className="font-display text-lg text-emerald-400">בית הכנסת נוצר בהצלחה</h3>

        {/* Login-verification badge */}
        {loginVerified === true && (
          <span className="ml-auto flex items-center gap-1 text-xs bg-emerald-400/10 text-emerald-400
                           border border-emerald-400/20 px-2 py-0.5 rounded-full">
            <ShieldCheck className="w-3 h-3" /> כניסה אומתה
          </span>
        )}
        {loginVerified === false && (
          <span className="ml-auto flex items-center gap-1 text-xs bg-red-400/10 text-red-400
                           border border-red-400/20 px-2 py-0.5 rounded-full">
            <ShieldAlert className="w-3 h-3" /> בדיקת כניסה נכשלה — פנה לתמיכה
          </span>
        )}
        {loginVerified === null && (
          <span className="ml-auto text-xs text-white/30">בודק כניסה…</span>
        )}
      </div>

      {/* Credentials box */}
      <div className="bg-ink-900/60 rounded-xl p-4 font-mono text-sm space-y-2 mb-5 border border-white/5">
        <div className="flex gap-2">
          <span className="text-white/40 w-20 shrink-0">בית כנסת</span>
          <span className="text-white/90">{created.synagogueName}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-white/40 w-20 shrink-0">אימייל</span>
          <span className="text-gold-400">{created.email}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-white/40 w-20 shrink-0">סיסמה</span>
          <span className="text-gold-400">{created.password}</span>
        </div>
        <div className="flex gap-2 pt-1 border-t border-white/5">
          <span className="text-white/40 w-20 shrink-0">קישור</span>
          <span className="text-white/50 text-xs">{window.location.origin}/login</span>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={copyCredentials}
          className="btn-gold text-sm py-2 flex items-center gap-2">
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? 'הועתק!' : 'העתק פרטי כניסה'}
        </button>
        <button onClick={onClose}
          className="text-white/30 hover:text-white/60 text-sm transition-colors">
          סגור
        </button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
const EMPTY_FORM = { synagogueName: '', email: '', password: '', city: '' };

export default function SynagoguesList({ onEnterDashboard }) {
  const qc = useQueryClient();
  const [showForm,   setShowForm]   = useState(false);
  const [editingId,  setEditingId]  = useState(null);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [errors,     setErrors]     = useState({});
  const [editForm,   setEditForm]   = useState({});
  const [editErrors, setEditErrors] = useState({});
  const [created,    setCreated]    = useState(null);  // { synagogueName, email, password }
  const [loginVerified, setLoginVerified] = useState(undefined); // true | false | null | undefined

  const { data: synagogues = [], isLoading } = useQuery({
    queryKey: ['synagogues-admin'],
    queryFn: () => api.get('/synagogues').then((r) => r.data),
  });

  // Synagogues with invalid or missing email
  const invalidEmailRows = synagogues.filter((s) => !s.email || !EMAIL_RE.test(s.email));

  // ── Create mutation ──────────────────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: async (data) => {
      const r = await api.post('/synagogues', data);
      return { synagogue: r.data, password: data.password };
    },
    onSuccess: async ({ synagogue, password }) => {
      toast.success('בית הכנסת נוצר');
      qc.invalidateQueries(['synagogues-admin']);
      setShowForm(false);
      setForm(EMPTY_FORM);
      setErrors({});
      setLoginVerified(null); // "checking…"
      setCreated({ synagogueName: synagogue.synagogueName, email: synagogue.email, password });

      // Immediately verify login works with the new credentials
      try {
        await api.post('/auth/login', { email: synagogue.email, password });
        setLoginVerified(true);
      } catch {
        setLoginVerified(false);
      }
    },
    onError: (err) => {
      const body = err.response?.data || {};
      if (body.field) {
        // Server returned a field-specific error
        setErrors((prev) => ({ ...prev, [body.field]: body.error }));
      } else if (err.response?.status === 409) {
        setErrors((prev) => ({ ...prev, email: 'אימייל זה כבר רשום במערכת' }));
      } else {
        toast.error(body.error || 'שגיאה ביצירת בית הכנסת');
      }
    },
  });

  // ── Update mutation ──────────────────────────────────────────────────────────
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => api.put(`/synagogues/${id}`, data),
    onSuccess: () => {
      toast.success('עודכן בהצלחה');
      qc.invalidateQueries(['synagogues-admin']);
      setEditingId(null);
      setEditErrors({});
    },
    onError: (err) => {
      const body = err.response?.data || {};
      if (body.field) {
        setEditErrors({ [body.field]: body.error });
      } else if (err.response?.status === 409) {
        setEditErrors({ email: 'אימייל זה כבר רשום במערכת' });
      } else {
        toast.error(body.error || 'שגיאה בעדכון');
      }
    },
  });

  // ── Delete mutation ──────────────────────────────────────────────────────────
  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/synagogues/${id}`),
    onSuccess: () => { toast.success('נמחק'); qc.invalidateQueries(['synagogues-admin']); },
    onError:   (err) => toast.error(err.response?.data?.error || 'שגיאה במחיקה'),
  });

  // ── Submit create ────────────────────────────────────────────────────────────
  function handleCreate() {
    const errs = validateForm(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    createMut.mutate(form);
  }

  // ── Submit edit ──────────────────────────────────────────────────────────────
  function handleUpdate(id) {
    const errs = {};
    if (!editForm.email?.trim())              errs.email = 'אימייל חובה';
    else if (!EMAIL_RE.test(editForm.email))  errs.email = 'פורמט אימייל לא תקין';
    setEditErrors(errs);
    if (Object.keys(errs).length > 0) return;
    updateMut.mutate({ id, data: editForm });
  }

  function startEdit(s) {
    setEditingId(s.id);
    setEditErrors({});
    setEditForm({ synagogueName: s.synagogueName, email: s.email || '', city: s.city || '' });
  }

  function openForm() {
    setShowForm(true);
    setEditingId(null);
    setErrors({});
    setCreated(null);
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Toolbar */}
      <div className="flex justify-between items-center mb-6">
        <p className="text-white/50 text-sm">
          {synagogues.length} בית{synagogues.length !== 1 ? '' : ''} כנסת רשום
        </p>
        <button onClick={openForm} className="btn-gold text-sm py-2 flex items-center gap-2">
          <Plus className="w-4 h-4" />
          הוסף בית כנסת
        </button>
      </div>

      {/* ── Invalid-email warning section ──────────────────────────────────── */}
      {invalidEmailRows.length > 0 && (
        <div className="mb-5 p-4 rounded-xl bg-amber-400/8 border border-amber-400/20">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span className="text-amber-400 text-sm font-semibold">
              {invalidEmailRows.length} בית כנסת עם אימייל חסר / לא תקין
            </span>
          </div>
          <div className="space-y-1.5">
            {invalidEmailRows.map((s) => (
              <div key={s.id} className="flex items-center gap-3 text-sm">
                <span className="text-white/70 min-w-0 truncate">{s.synagogueName}</span>
                <span className="text-red-400/70 font-mono text-xs shrink-0">
                  {s.email || '(ריק)'}
                </span>
                <button
                  onClick={() => startEdit(s)}
                  className="shrink-0 text-xs text-gold-400 hover:text-gold-300 transition-colors"
                >
                  תקן אימייל →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Created-credentials summary ─────────────────────────────────────── */}
      {created && (
        <CreatedCard
          created={created}
          loginVerified={loginVerified}
          onClose={() => { setCreated(null); setLoginVerified(undefined); }}
        />
      )}

      {/* ── Create form ─────────────────────────────────────────────────────── */}
      {showForm && (
        <div className="card-glass p-6 mb-6 fade-in">
          <h3 className="font-display text-lg text-gold-400 mb-5">בית כנסת חדש</h3>
          <div className="grid grid-cols-2 gap-4">

            <div className="col-span-2">
              <Field label="שם בית הכנסת *" error={errors.synagogueName}>
                <input
                  className={`w-full input-dark ${errors.synagogueName ? 'border-red-400/50' : ''}`}
                  placeholder="בית כנסת עטרת ישראל"
                  value={form.synagogueName}
                  onChange={(e) => { setForm({ ...form, synagogueName: e.target.value }); setErrors((p) => ({ ...p, synagogueName: '' })); }}
                />
              </Field>
            </div>

            <Field label="אימייל גבאי *" error={errors.email}>
              <input
                type="email"
                className={`w-full input-dark ${errors.email ? 'border-red-400/50' : ''}`}
                placeholder="gabai@shul.com"
                value={form.email}
                onChange={(e) => { setForm({ ...form, email: e.target.value }); setErrors((p) => ({ ...p, email: '' })); }}
              />
            </Field>

            <Field label="סיסמה ראשונית *" error={errors.password}>
              <input
                type="password"
                className={`w-full input-dark ${errors.password ? 'border-red-400/50' : ''}`}
                placeholder="מינימום 6 תווים"
                value={form.password}
                onChange={(e) => { setForm({ ...form, password: e.target.value }); setErrors((p) => ({ ...p, password: '' })); }}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </Field>

            <div>
              <label className="text-sm text-white/60 mb-1.5 block">עיר (אופציונלי)</label>
              <input
                className="w-full input-dark"
                placeholder="תל אביב"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </div>
          </div>

          <div className="flex gap-3 mt-5">
            <button
              onClick={handleCreate}
              disabled={createMut.isPending}
              className="btn-gold flex items-center gap-2"
            >
              {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {createMut.isPending ? 'יוצר…' : 'צור בית כנסת'}
            </button>
            <button onClick={() => { setShowForm(false); setErrors({}); }} className="btn-outline">
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* ── Synagogue list ───────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {synagogues.length === 0 && (
            <div className="text-center py-16 text-white/30">
              <Building2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>אין בתי כנסת עדיין — הוסף את הראשון למעלה.</p>
            </div>
          )}

          {synagogues.map((s) => (
            <div key={s.id} className="card-glass rounded-xl overflow-hidden">

              {/* ── Edit row ── */}
              {editingId === s.id ? (
                <div className="p-4 fade-in">
                  <div className="grid grid-cols-3 gap-3 mb-1">
                    <input
                      className="input-dark"
                      value={editForm.synagogueName}
                      placeholder="שם"
                      onChange={(e) => setEditForm({ ...editForm, synagogueName: e.target.value })}
                    />
                    <div>
                      <input
                        type="email"
                        className={`w-full input-dark ${editErrors.email ? 'border-red-400/50' : ''}`}
                        value={editForm.email}
                        placeholder="אימייל"
                        onChange={(e) => { setEditForm({ ...editForm, email: e.target.value }); setEditErrors({}); }}
                      />
                      {editErrors.email && <p className="text-red-400 text-xs mt-1">{editErrors.email}</p>}
                    </div>
                    <input
                      className="input-dark"
                      value={editForm.city}
                      placeholder="עיר"
                      onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleUpdate(s.id)}
                      disabled={updateMut.isPending}
                      className="btn-gold text-sm py-1.5 px-4 flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {updateMut.isPending ? 'שומר…' : 'שמור'}
                    </button>
                    <button onClick={() => { setEditingId(null); setEditErrors({}); }}
                      className="btn-outline text-sm py-1.5 px-4 flex items-center gap-1.5">
                      <X className="w-3.5 h-3.5" /> ביטול
                    </button>
                  </div>
                </div>
              ) : (

              /* ── Normal row ── */
                <div className="flex items-center gap-4 p-4 group">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-xl bg-ink-700 flex items-center justify-center flex-shrink-0">
                    {s.logoUrl
                      ? <img src={s.logoUrl} className="w-full h-full rounded-xl object-cover" alt="" />
                      : <span className="text-gold-400 font-display text-lg">{s.synagogueName.charAt(0)}</span>
                    }
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-white/90 font-medium">{s.synagogueName}</p>
                      {/* Warn if email is missing/invalid */}
                      {(!s.email || !EMAIL_RE.test(s.email)) && (
                        <span title="אימייל לא תקין" className="text-amber-400">
                          <AlertTriangle className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                    <p className="text-white/40 text-sm truncate">
                      {s.city || 'ללא עיר'} · {s.email || <span className="text-red-400/70">אין אימייל</span>}
                    </p>
                  </div>

                  {/* Stripe status */}
                  <div className="shrink-0 hidden sm:block">
                    <StripeStatusBadge status={s.stripeAccountStatus || 'not_connected'} />
                  </div>

                  {/* Donation count */}
                  <span className="text-white/25 text-xs shrink-0 hidden lg:block">
                    {s._count?.donations ?? 0} תרומות
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {s.stripeAccountStatus !== 'active' && (
                      <SendConnectLinkButton synagogueId={s.id} />
                    )}
                    <button
                      onClick={() => onEnterDashboard(s.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                                 bg-gold-400/10 text-gold-400 hover:bg-gold-400/20
                                 transition-colors text-xs font-medium"
                    >
                      <LayoutDashboard className="w-3.5 h-3.5" />
                      דשבורד
                    </button>
                    <a
                      href={`/kiosk/${s.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg text-white/30 hover:text-gold-400 hover:bg-white/10 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => { startEdit(s); setShowForm(false); }}
                      className="p-2 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/10 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`למחוק את "${s.synagogueName}"? לא ניתן לבטל פעולה זו.`)) {
                          deleteMut.mutate(s.id);
                        }
                      }}
                      className="p-2 rounded-lg text-red-400/30 hover:text-red-400 hover:bg-red-900/30 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
