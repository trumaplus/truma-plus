import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Bell } from 'lucide-react';
import api from '../../api/client';

export default function AnnouncementAdder({ synagogue }) {
  const qc = useQueryClient();
  const [text, setText] = useState('');

  let announcements = [];
  try {
    const raw = synagogue?.announcements;
    announcements = typeof raw === 'string' ? JSON.parse(raw) : (raw || []);
  } catch {}

  const saveMut = useMutation({
    mutationFn: (items) =>
      api.put(`/synagogues/${synagogue.id}`, { announcements: JSON.stringify(items) }),
    onSuccess: () => {
      toast.success('Announcements saved');
      qc.invalidateQueries(['synagogue', synagogue.id]);
    },
    onError: () => toast.error('Failed to save'),
  });

  function addAnnouncement() {
    if (!text.trim()) return;
    const updated = [...announcements, { id: Date.now().toString(), text: text.trim(), active: true }];
    saveMut.mutate(updated);
    setText('');
  }

  function removeAnnouncement(id) {
    const updated = announcements.filter((a) => a.id !== id);
    saveMut.mutate(updated);
  }

  function toggleAnnouncement(id) {
    const updated = announcements.map((a) => a.id === id ? { ...a, active: !a.active } : a);
    saveMut.mutate(updated);
  }

  return (
    <div>
      <div className="flex gap-3 mb-6">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addAnnouncement()}
          placeholder="Enter announcement text…"
          className="flex-1 input-dark"
        />
        <button onClick={addAnnouncement} disabled={saveMut.isPending} className="btn-gold px-4">
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {announcements.length === 0 ? (
        <div className="text-center py-12 text-white/30">
          <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
          No announcements yet
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <div key={a.id} className="flex items-start gap-3 card-glass p-4">
              <button
                onClick={() => toggleAnnouncement(a.id)}
                className={`w-5 h-5 rounded border-2 flex-shrink-0 mt-0.5 transition-colors ${
                  a.active ? 'bg-gold-400 border-gold-400' : 'border-white/20'
                }`}
              />
              <span className={`flex-1 text-sm ${a.active ? 'text-white/80' : 'text-white/30 line-through'}`}>
                {a.text}
              </span>
              <button
                onClick={() => removeAnnouncement(a.id)}
                className="text-red-400/40 hover:text-red-400 transition-colors p-1"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
