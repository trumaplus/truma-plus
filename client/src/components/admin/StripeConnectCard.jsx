import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CreditCard, ExternalLink, CheckCircle2, Clock, AlertTriangle,
  Loader2, RefreshCw, Copy, Check,
} from 'lucide-react';
import api from '../../api/client';

const STATUS_CONFIG = {
  not_connected: {
    label:  'Not Connected',
    icon:   AlertTriangle,
    color:  'text-red-400',
    bg:     'bg-red-950/40 border-red-500/20',
    dot:    'bg-red-500',
  },
  pending: {
    label:  'Pending Setup',
    icon:   Clock,
    color:  'text-amber-400',
    bg:     'bg-amber-950/40 border-amber-500/20',
    dot:    'bg-amber-400',
  },
  restricted: {
    label:  'Restricted',
    icon:   AlertTriangle,
    color:  'text-orange-400',
    bg:     'bg-orange-950/40 border-orange-500/20',
    dot:    'bg-orange-400',
  },
  active: {
    label:  'Active',
    icon:   CheckCircle2,
    color:  'text-emerald-400',
    bg:     'bg-emerald-950/40 border-emerald-500/20',
    dot:    'bg-emerald-400',
  },
};

export default function StripeConnectCard({ synagogueId, synagogueName }) {
  const [copied, setCopied] = useState(false);
  const [pendingUrl, setPendingUrl] = useState(null);

  const { data: status, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['stripe-connect-status', synagogueId],
    queryFn:  () => api.get(`/stripe/connect/${synagogueId}/status`).then((r) => r.data),
    refetchOnWindowFocus: true,
  });

  const connectMut = useMutation({
    mutationFn: () => api.post(`/stripe/connect/${synagogueId}`),
    onSuccess: ({ data }) => {
      if (data.url) {
        setPendingUrl(data.url);
        window.open(data.url, '_blank', 'noopener,noreferrer');
      }
    },
    onError: (err) => {
      const msg = err.response?.data?.error || 'Failed to create Connect link';
      if (err.response?.data?.configMissing) {
        toast.error('Stripe not configured — set STRIPE_SECRET_KEY in Railway env vars');
      } else {
        toast.error(msg);
      }
    },
  });

  const loginMut = useMutation({
    mutationFn: () => api.get(`/stripe/connect/${synagogueId}/login`),
    onSuccess: ({ data }) => {
      if (data.url) window.open(data.url, '_blank', 'noopener,noreferrer');
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to get login link'),
  });

  async function handleCopy() {
    if (!pendingUrl) return;
    await navigator.clipboard.writeText(pendingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Link copied to clipboard');
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 animate-pulse h-24" />
    );
  }

  const accountStatus = status?.status || 'not_connected';
  const cfg = STATUS_CONFIG[accountStatus] || STATUS_CONFIG.not_connected;
  const Icon = cfg.icon;

  return (
    <div className={`rounded-xl border p-5 ${cfg.bg}`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
            <CreditCard className="w-5 h-5 text-gold-400" />
          </div>
          <div>
            <p className="text-white/80 text-sm font-semibold">Stripe Connect</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
              <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
              {status?.mock && (
                <span className="text-white/25 text-xs">(Stripe not configured)</span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Refresh button */}
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            title="Refresh status"
            className="p-1.5 rounded-lg text-white/25 hover:text-white/60 hover:bg-white/10 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
          </button>

          {accountStatus === 'active' ? (
            <button
              onClick={() => loginMut.mutate()}
              disabled={loginMut.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                         bg-emerald-900/40 text-emerald-400 hover:bg-emerald-900/60
                         text-xs font-medium transition-colors"
            >
              {loginMut.isPending
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <ExternalLink className="w-3.5 h-3.5" />}
              Manage Account
            </button>
          ) : (
            <button
              onClick={() => connectMut.mutate()}
              disabled={connectMut.isPending || !!status?.mock}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                         bg-gold-400/15 text-gold-400 hover:bg-gold-400/25
                         disabled:opacity-40 disabled:cursor-not-allowed
                         text-xs font-medium transition-colors"
            >
              {connectMut.isPending
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <CreditCard className="w-3.5 h-3.5" />}
              {accountStatus === 'pending' ? 'Continue Setup' : 'Connect Stripe'}
            </button>
          )}
        </div>
      </div>

      {/* Description */}
      <p className={`text-xs mt-3 ${cfg.color} opacity-70`}>
        {accountStatus === 'active' &&
          'Donations go directly to your bank account. Payouts managed via Stripe Dashboard.'}
        {accountStatus === 'pending' &&
          'Almost there — complete Stripe onboarding to start receiving donations directly.'}
        {accountStatus === 'restricted' &&
          'Your account has restrictions. Click "Continue Setup" to resolve outstanding requirements.'}
        {accountStatus === 'not_connected' &&
          'Connect a bank account to receive donations directly. Takes ~5 minutes to set up.'}
      </p>

      {/* Copy link panel (shown after link is generated) */}
      {pendingUrl && accountStatus !== 'active' && (
        <div className="mt-3 flex items-center gap-2 bg-black/20 rounded-lg p-2 fade-in">
          <input
            readOnly
            value={pendingUrl}
            className="flex-1 text-xs text-white/40 bg-transparent outline-none truncate"
          />
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-white/60
                       hover:text-white/90 hover:bg-white/10 transition-colors shrink-0"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}

      {/* Account ID (for admins to see) */}
      {status?.accountId && (
        <p className="text-white/15 text-xs mt-2 font-mono">
          {status.accountId}
        </p>
      )}
    </div>
  );
}
