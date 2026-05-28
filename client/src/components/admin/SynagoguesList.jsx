import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, ExternalLink, Building2, Edit2, LayoutDashboard, Check, X, CreditCard, Loader2, Copy } from 'lucide-react';
import api from '../../api/client';

// Stripe Connect status dot shown inline on each synagogue row
const STRIPE_STATUS = {
  active:        { dot: 'bg-emerald-400', label: 'Stripe Active',   text: 'text-emerald-400' },
  pending:       { dot: 'bg-amber-400',   label: 'Stripe Pending',  text: 'text-amber-400'   },
  restricted:    { dot: 'bg-orange-400',  label: 'Stripe Limited',  text: 'text-orange-400'  },
  not_connected: { dot: 'bg-red-500',     label: 'Not Connected',   text: 'text-red-400'     },
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

// Per-row connect link generator used by admin
function SendConnectLinkButton({ synagogueId }) {
  const [url, setUrl] = useState(null);
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
        title="Generate Stripe Connect onboarding link"
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium
                   bg-gold-400/10 text-gold-400 hover:bg-gold-400/20 transition-colors"
      >
        {mut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CreditCard className="w-3 h-3" />}
        Send Link
      </button>
      {url && (
        <button
          onClick={copyLink}
          title="Copy link"
          className="p-1 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/10 transition-colors"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
        </button>
      )}
    </div>
  );
}

export default function SynagoguesList({ onEnterDashboard }) {
  const qc = useQueryClient();
  const [showForm, setShowForm]   = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form,     setForm]       = useState({ synagogueName: '', email: '', password: '', city: '' });
  const [editForm, setEditForm]   = useState({});

  const { data: synagogues = [], isLoading } = useQuery({
    queryKey: ['synagogues-admin'],
    queryFn: () => api.get('/synagogues').then((r) => r.data),
  });

  const createMut = useMutation({
    mutationFn: (data) => api.post('/synagogues', data),
    onSuccess: () => {
      toast.success('Synagogue created');
      qc.invalidateQueries(['synagogues-admin']);
      setShowForm(false);
      setForm({ synagogueName: '', email: '', password: '', city: '' });
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to create'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => api.put(`/synagogues/${id}`, data),
    onSuccess: () => {
      toast.success('Updated');
      qc.invalidateQueries(['synagogues-admin']);
      setEditingId(null);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to update'),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/synagogues/${id}`),
    onSuccess: () => {
      toast.success('Synagogue deleted');
      qc.invalidateQueries(['synagogues-admin']);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to delete'),
  });

  function startEdit(s) {
    setEditingId(s.id);
    setEditForm({ synagogueName: s.synagogueName, email: s.email || '', city: s.city || '' });
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex justify-between items-center mb-6">
        <p className="text-white/50 text-sm">{synagogues.length} synagogue{synagogues.length !== 1 ? 's' : ''} registered</p>
        <button
          onClick={() => { setShowForm(!showForm); setEditingId(null); }}
          className="btn-gold text-sm py-2 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Synagogue
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="card-glass p-6 mb-6 fade-in">
          <h3 className="font-display text-lg text-gold-400 mb-4">New Synagogue</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-sm text-white/60 mb-1.5 block">Synagogue Name *</label>
              <input
                className="w-full input-dark"
                placeholder="Beth Shalom"
                value={form.synagogueName}
                onChange={(e) => setForm({ ...form, synagogueName: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm text-white/60 mb-1.5 block">Gabai Email *</label>
              <input
                type="email"
                className="w-full input-dark"
                placeholder="gabai@shul.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm text-white/60 mb-1.5 block">Initial Password *</label>
              <input
                type="password"
                className="w-full input-dark"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm text-white/60 mb-1.5 block">City</label>
              <input
                className="w-full input-dark"
                placeholder="Tel Aviv"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button
              onClick={() => createMut.mutate(form)}
              disabled={createMut.isPending || !form.synagogueName || !form.email || !form.password}
              className="btn-gold"
            >
              {createMut.isPending ? 'Creating…' : 'Create'}
            </button>
            <button onClick={() => setShowForm(false)} className="btn-outline">Cancel</button>
          </div>
        </div>
      )}

      {/* List */}
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
              <p>No synagogues yet — add the first one above.</p>
            </div>
          )}

          {synagogues.map((s) => (
            <div key={s.id} className="card-glass rounded-xl overflow-hidden">

              {/* ── Edit row ── */}
              {editingId === s.id ? (
                <div className="p-4 fade-in">
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <input
                      className="input-dark"
                      value={editForm.synagogueName}
                      placeholder="Name"
                      onChange={(e) => setEditForm({ ...editForm, synagogueName: e.target.value })}
                    />
                    <input
                      type="email"
                      className="input-dark"
                      value={editForm.email}
                      placeholder="Email"
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    />
                    <input
                      className="input-dark"
                      value={editForm.city}
                      placeholder="City"
                      onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateMut.mutate({ id: s.id, data: editForm })}
                      disabled={updateMut.isPending}
                      className="btn-gold text-sm py-1.5 px-4 flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {updateMut.isPending ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="btn-outline text-sm py-1.5 px-4 flex items-center gap-1.5"
                    >
                      <X className="w-3.5 h-3.5" />
                      Cancel
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
                    <p className="text-white/90 font-medium">{s.synagogueName}</p>
                    <p className="text-white/40 text-sm truncate">
                      {s.city || 'No city'} · {s.email}
                    </p>
                  </div>

                  {/* Stripe Connect status */}
                  <div className="shrink-0 hidden sm:block">
                    <StripeStatusBadge status={s.stripeAccountStatus || 'not_connected'} />
                  </div>

                  {/* Donation count */}
                  <span className="text-white/25 text-xs shrink-0 hidden lg:block">
                    {s._count?.donations ?? 0} donations
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Stripe Connect — only show when not active */}
                    {s.stripeAccountStatus !== 'active' && (
                      <SendConnectLinkButton synagogueId={s.id} />
                    )}

                    {/* Enter Dashboard */}
                    <button
                      onClick={() => onEnterDashboard(s.id)}
                      title="Enter Dashboard"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                                 bg-gold-400/10 text-gold-400 hover:bg-gold-400/20
                                 transition-colors text-xs font-medium"
                    >
                      <LayoutDashboard className="w-3.5 h-3.5" />
                      Dashboard
                    </button>

                    {/* Open Kiosk */}
                    <a
                      href={`/kiosk/${s.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open Kiosk"
                      className="p-2 rounded-lg text-white/30 hover:text-gold-400
                                 hover:bg-white/10 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>

                    {/* Edit */}
                    <button
                      onClick={() => { startEdit(s); setShowForm(false); }}
                      title="Edit"
                      className="p-2 rounded-lg text-white/30 hover:text-white/70
                                 hover:bg-white/10 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete "${s.synagogueName}"? This cannot be undone.`)) {
                          deleteMut.mutate(s.id);
                        }
                      }}
                      title="Delete"
                      className="p-2 rounded-lg text-red-400/30 hover:text-red-400
                                 hover:bg-red-900/30 transition-colors"
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
