import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CreditCard, ExternalLink, CheckCircle2, Clock, AlertTriangle,
  Loader2, RefreshCw,
} from 'lucide-react';
import api from '../../api/client';

// ── Status display config ─────────────────────────────────────────────────────
const STATUS_CONFIG = {
  not_connected: {
    label:  'לא מחובר',
    icon:   AlertTriangle,
    color:  'text-red-400',
    bg:     'bg-red-950/40 border-red-500/20',
    dot:    'bg-red-500',
    desc:   'חבר חשבון בנק כדי לקבל תרומות ישירות לחשבון. תהליך הגדרה של כ-5 דקות.',
    btn:    'חבר חשבון Stripe',
    btnCls: 'bg-gold-400/15 text-gold-400 hover:bg-gold-400/25',
  },
  pending: {
    label:  'ממתין להשלמה',
    icon:   Clock,
    color:  'text-amber-400',
    bg:     'bg-amber-950/40 border-amber-500/20',
    dot:    'bg-amber-400',
    desc:   'כמעט שם — השלם את תהליך ההגדרה ב-Stripe כדי להתחיל לקבל תרומות.',
    btn:    'המשך הגדרה',
    btnCls: 'bg-amber-400/15 text-amber-400 hover:bg-amber-400/25',
  },
  restricted: {
    label:  'מוגבל',
    icon:   AlertTriangle,
    color:  'text-orange-400',
    bg:     'bg-orange-950/40 border-orange-500/20',
    dot:    'bg-orange-400',
    desc:   'לחשבון יש הגבלות. לחץ "המשך הגדרה" כדי להשלים את הדרישות הפתוחות.',
    btn:    'המשך הגדרה',
    btnCls: 'bg-orange-400/15 text-orange-400 hover:bg-orange-400/25',
  },
  active: {
    label:  'מחובר ופעיל',
    icon:   CheckCircle2,
    color:  'text-emerald-400',
    bg:     'bg-emerald-950/40 border-emerald-500/20',
    dot:    'bg-emerald-400',
    desc:   'תרומות מועברות ישירות לחשבון הבנק שלך. נהל משיכות ב-Stripe Dashboard.',
    btn:    'נהל חשבון Stripe',
    btnCls: 'bg-emerald-900/40 text-emerald-400 hover:bg-emerald-900/60',
  },
};

export default function StripeConnectCard({ synagogueId, synagogueName }) {
  const qc = useQueryClient();

  const { data: status, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['stripe-connect-status', synagogueId],
    queryFn:  () => api.get(`/stripe/connect/${synagogueId}/status`).then((r) => r.data),
    // Refetch when user returns to this tab (e.g. after Stripe onboarding)
    refetchOnWindowFocus: true,
  });

  // ── Connect / refresh onboarding link ────────────────────────────────────────
  const connectMut = useMutation({
    mutationFn: () => api.post(`/stripe/connect/${synagogueId}`),
    onSuccess: ({ data }) => {
      if (data.url) {
        // Navigate in the same tab — Stripe will redirect back with ?stripe_return=1
        window.location.href = data.url;
      }
    },
    onError: (err) => {
      if (err.response?.data?.configMissing) {
        toast.error('Stripe לא מוגדר — הגדר STRIPE_SECRET_KEY ב-Railway');
      } else {
        toast.error(err.response?.data?.error || 'שגיאה ביצירת קישור Stripe');
      }
    },
  });

  // ── Dashboard login link (active accounts only) ───────────────────────────────
  const loginMut = useMutation({
    mutationFn: () => api.get(`/stripe/connect/${synagogueId}/login`),
    onSuccess: ({ data }) => {
      if (data.url) window.open(data.url, '_blank', 'noopener,noreferrer');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'שגיאה בפתיחת Stripe Dashboard'),
  });

  // ── Loading skeleton ──────────────────────────────────────────────────────────
  if (isLoading) {
    return <div className="rounded-xl border border-white/10 bg-white/5 p-4 animate-pulse h-24" />;
  }

  const accountStatus = status?.status || 'not_connected';
  const cfg  = STATUS_CONFIG[accountStatus] || STATUS_CONFIG.not_connected;
  const Icon = cfg.icon;
  const isActive = accountStatus === 'active';

  return (
    <div className={`rounded-xl border p-5 ${cfg.bg}`}>

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
            <CreditCard className="w-5 h-5 text-gold-400" />
          </div>
          <div>
            <p className="text-white/80 text-sm font-semibold">Stripe Connect</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
              <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
              {status?.mock && (
                <span className="text-white/25 text-xs">(Stripe לא מוגדר)</span>
              )}
            </div>
          </div>
        </div>

        {/* ── Action buttons ── */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Refresh status */}
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            title="רענן סטטוס"
            className="p-1.5 rounded-lg text-white/25 hover:text-white/60 hover:bg-white/10 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
          </button>

          {/* Main action */}
          {isActive ? (
            <button
              onClick={() => loginMut.mutate()}
              disabled={loginMut.isPending}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${cfg.btnCls}`}
            >
              {loginMut.isPending
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <ExternalLink className="w-3.5 h-3.5" />}
              {cfg.btn}
            </button>
          ) : (
            <button
              onClick={() => connectMut.mutate()}
              disabled={connectMut.isPending || !!status?.mock}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                          disabled:opacity-40 disabled:cursor-not-allowed ${cfg.btnCls}`}
            >
              {connectMut.isPending
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <CreditCard className="w-3.5 h-3.5" />}
              {connectMut.isPending ? 'מעביר לـ Stripe…' : cfg.btn}
            </button>
          )}
        </div>
      </div>

      {/* ── Description ── */}
      <p className={`text-xs mt-3 leading-relaxed ${cfg.color} opacity-70`}>
        {cfg.desc}
      </p>

      {/* ── Account ID (dev/admin info) ── */}
      {status?.accountId && (
        <p className="text-white/15 text-xs mt-2 font-mono">{status.accountId}</p>
      )}
    </div>
  );
}
