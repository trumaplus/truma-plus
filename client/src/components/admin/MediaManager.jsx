import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Upload, Trash2, Eye, EyeOff, RefreshCw, GripVertical } from 'lucide-react';
import api from '../../api/client';

const INTERVALS = [5, 10, 15, 30];

export default function MediaManager({ synagogue, onRefreshKiosk }) {
  const qc = useQueryClient();
  const fileRef = useRef();
  const [uploading, setUploading] = useState(false);
  const [interval, setInterval] = useState(synagogue.slideshowInterval || 10);

  const { data: items = [] } = useQuery({
    queryKey: ['media', synagogue.id],
    queryFn: () => api.get(`/media/${synagogue.id}`).then((r) => r.data),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/media/${synagogue.id}/${id}`),
    onSuccess: () => { toast.success('Deleted'); qc.invalidateQueries(['media', synagogue.id]); },
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, active }) => api.put(`/media/${synagogue.id}/${id}`, { active }),
    onSuccess: () => qc.invalidateQueries(['media', synagogue.id]),
  });

  const intervalMut = useMutation({
    mutationFn: (val) => api.put(`/synagogues/${synagogue.id}`, { slideshowInterval: val }),
    onSuccess: () => toast.success('Slideshow interval updated'),
  });

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      await api.post(`/media/${synagogue.id}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Media uploaded');
      qc.invalidateQueries(['media', synagogue.id]);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-white/50 text-sm">Slideshow interval:</span>
          {INTERVALS.map((s) => (
            <button
              key={s}
              onClick={() => { setInterval(s); intervalMut.mutate(s); }}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                interval === s ? 'bg-gold-400 text-ink-900' : 'bg-white/5 text-white/50 hover:bg-white/10'
              }`}
            >
              {s}s
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onRefreshKiosk}
            className="flex items-center gap-2 btn-outline text-sm py-2 px-4"
          >
            <RefreshCw className="w-4 h-4" />
            Update Tablet
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="btn-gold text-sm py-2 px-4 flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            {uploading ? 'Uploading…' : 'Upload Media'}
          </button>
          <input ref={fileRef} type="file" accept="image/*,video/*,application/pdf" onChange={handleUpload} className="hidden" />
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-white/10 rounded-2xl">
          <Upload className="w-12 h-12 text-white/20 mx-auto mb-3" />
          <p className="text-white/40">No media files yet</p>
          <p className="text-white/25 text-sm mt-1">Upload images, videos, or PDFs</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-4 card-glass p-3 group">
              <GripVertical className="w-4 h-4 text-white/20 cursor-grab" />

              {/* Thumbnail */}
              <div className="w-16 h-12 rounded-lg overflow-hidden bg-ink-700 flex-shrink-0">
                {item.type === 'image' ? (
                  <img src={item.url} alt={item.filename} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/30 text-xs uppercase">
                    {item.type}
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-white/80 text-sm truncate">{item.filename}</p>
                <p className="text-white/30 text-xs capitalize">{item.type}</p>
              </div>

              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => toggleMut.mutate({ id: item.id, active: !item.active })}
                  className={`p-2 rounded-lg transition-colors ${item.active ? 'text-green-400 hover:bg-green-900/30' : 'text-white/30 hover:bg-white/10'}`}
                  title={item.active ? 'Disable' : 'Enable'}
                >
                  {item.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => deleteMut.mutate(item.id)}
                  className="p-2 rounded-lg text-red-400/50 hover:text-red-400 hover:bg-red-900/30 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {!item.active && (
                <span className="text-xs text-white/25 bg-white/5 px-2 py-0.5 rounded-md">Hidden</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
