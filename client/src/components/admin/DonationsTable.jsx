import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Mail, RefreshCw, TrendingUp } from 'lucide-react';
import api from '../../api/client';

const STATUS_COLORS = {
  completed: 'bg-green-900/40 text-green-400 border-green-500/30',
  pending: 'bg-amber-900/40 text-amber-400 border-amber-500/30',
  failed: 'bg-red-900/40 text-red-400 border-red-500/30',
};

export default function DonationsTable({ synagogueId }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState('completed');

  const { data: donations = [], isLoading } = useQuery({
    queryKey: ['donations', synagogueId, filter],
    queryFn: () => {
      const params = filter !== 'all' ? `?status=${filter}` : '';
      return api.get(`/donations${params}`).then((r) => r.data);
    },
  });

  const filtered = synagogueId
    ? donations.filter((d) => d.synagogueId === synagogueId)
    : donations;

  const receiptMut = useMutation({
    mutationFn: (id) => api.post(`/donations/${id}/receipt`),
    onSuccess: () => {
      toast.success('Receipt sent');
      qc.invalidateQueries(['donations']);
    },
    onError: (err) => toast.error(err.response?.data?.error || 'Failed to send'),
  });

  const total = filtered
    .filter((d) => d.paymentStatus === 'completed')
    .reduce((sum, d) => sum + d.amount, 0);

  return (
    <div>
      {/* Stats bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-gold-400">
          <TrendingUp className="w-4 h-4" />
          <span className="font-semibold">
            ${total.toLocaleString('en-CA', { minimumFractionDigits: 2 })} CAD total
          </span>
          <span className="text-white/30 text-sm">({filtered.filter((d) => d.paymentStatus === 'completed').length} donations)</span>
        </div>
        <div className="flex gap-2">
          {['all', 'completed', 'pending', 'failed'].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-all ${
                filter === s ? 'bg-gold-400 text-ink-900' : 'bg-white/5 text-white/50 hover:bg-white/10'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-white/30">No donations found</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-white/40 text-xs uppercase">
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Donor</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-right px-4 py-3">Amount</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                  <td className="px-4 py-3 text-white/50">
                    {new Date(d.createdAt).toLocaleDateString('en-CA')}
                  </td>
                  <td className="px-4 py-3 text-white/80">
                    {[d.donorFirstName, d.donorLastName].filter(Boolean).join(' ') || '—'}
                    {d.donorEmail && <div className="text-white/30 text-xs">{d.donorEmail}</div>}
                  </td>
                  <td className="px-4 py-3 text-white/60 capitalize">{d.donationType}</td>
                  <td className="px-4 py-3 text-right font-semibold text-white">
                    ${d.amount.toFixed(2)}
                    <span className="text-white/30 text-xs ml-1">{d.currency}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-md text-xs border ${STATUS_COLORS[d.paymentStatus] || ''}`}>
                      {d.paymentStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {d.donorEmail && !d.receiptSent && d.paymentStatus === 'completed' && (
                      <button
                        onClick={() => receiptMut.mutate(d.id)}
                        disabled={receiptMut.isPending}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-gold-400 transition-colors"
                        title="Send receipt"
                      >
                        <Mail className="w-4 h-4" />
                      </button>
                    )}
                    {d.receiptSent && <span className="text-green-400/50 text-xs">✓ sent</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
