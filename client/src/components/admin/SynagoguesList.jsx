import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, ExternalLink, Building2 } from 'lucide-react';
import api from '../../api/client';

export default function SynagoguesList() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ synagogueName: '', email: '', password: '', city: '' });

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

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/synagogues/${id}`),
    onSuccess: () => {
      toast.success('Synagogue deleted');
      qc.invalidateQueries(['synagogues-admin']);
    },
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <p className="text-white/50 text-sm">{synagogues.length} synagogues registered</p>
        <button onClick={() => setShowForm(!showForm)} className="btn-gold text-sm py-2 flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Synagogue
        </button>
      </div>

      {showForm && (
        <div className="card-glass p-6 mb-6 fade-in">
          <h3 className="font-display text-lg text-gold-400 mb-4">New Synagogue</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-sm text-white/60 mb-1.5 block">Synagogue Name *</label>
              <input className="w-full input-dark" value={form.synagogueName}
                onChange={(e) => setForm({ ...form, synagogueName: e.target.value })} />
            </div>
            <div>
              <label className="text-sm text-white/60 mb-1.5 block">Email *</label>
              <input type="email" className="w-full input-dark" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="text-sm text-white/60 mb-1.5 block">Password *</label>
              <input type="password" className="w-full input-dark" value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div>
              <label className="text-sm text-white/60 mb-1.5 block">City</label>
              <input className="w-full input-dark" value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button onClick={() => createMut.mutate(form)} disabled={createMut.isPending} className="btn-gold">
              {createMut.isPending ? 'Creating…' : 'Create'}
            </button>
            <button onClick={() => setShowForm(false)} className="btn-outline">Cancel</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {synagogues.map((s) => (
            <div key={s.id} className="flex items-center gap-4 card-glass p-4 group">
              <div className="w-10 h-10 rounded-xl bg-ink-700 flex items-center justify-center flex-shrink-0">
                {s.logoUrl
                  ? <img src={s.logoUrl} className="w-full h-full rounded-xl object-cover" alt="" />
                  : <Building2 className="w-5 h-5 text-white/30" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white/90 font-medium">{s.synagogueName}</p>
                <p className="text-white/40 text-sm">{s.city || 'No city'} · {s.email}</p>
              </div>
              <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-white/25 text-xs">{s._count?.donations || 0} donations</span>
                <a
                  href={`/kiosk/${s.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg text-white/30 hover:text-gold-400 hover:bg-white/10 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  onClick={() => {
                    if (confirm(`Delete ${s.synagogueName}?`)) deleteMut.mutate(s.id);
                  }}
                  className="p-2 rounded-lg text-red-400/30 hover:text-red-400 hover:bg-red-900/30 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
