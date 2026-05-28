import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, ChevronRight, Star } from 'lucide-react';
import api from '../api/client';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function Home() {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const { data: synagogues = [], isLoading, isError } = useQuery({
    queryKey: ['synagogues-public'],
    queryFn: () => api.get('/synagogues/public').then((r) => r.data),
  });

  const filtered = synagogues.filter((s) =>
    !search ||
    s.synagogueName.toLowerCase().includes(search.toLowerCase()) ||
    (s.city || '').toLowerCase().includes(search.toLowerCase()) ||
    s.synagogueCode.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-ink-900 font-body">
      {/* Header */}
      <header className="border-b border-white/5 bg-ink-800/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <img src="/logo.png" alt="Truma Plus" className="h-10 object-contain" />
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <button
              onClick={() => navigate('/login')}
              className="text-sm text-white/50 hover:text-gold-400 transition-colors"
            >
              Gabai Login →
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative py-20 px-6 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-ink-600/20 to-transparent pointer-events-none" />
        <div className="relative max-w-2xl mx-auto">
          <img src="/logo.png" alt="Truma Plus" className="h-28 mx-auto mb-8 object-contain drop-shadow-[0_0_40px_rgba(212,175,55,0.3)]" />
          <p className="text-gold-400 text-sm font-medium tracking-widest uppercase mb-4">Choose Your Synagogue</p>
          <h2 className="font-display text-5xl text-white mb-6 leading-tight">
            Give with Meaning,<br />
            <span className="text-gold-400">Give with Heart</span>
          </h2>
          <p className="text-white/50 text-lg mb-10">
            Select your synagogue below to make a donation and support your community.
          </p>

          {/* Search */}
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name, city, or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full input-dark pl-12 py-3.5 text-base"
            />
          </div>
        </div>
      </section>

      {/* Grid */}
      <main className="max-w-6xl mx-auto px-6 pb-20">
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card-dark p-6 animate-pulse h-44" />
            ))}
          </div>
        )}

        {isError && (
          <div className="text-center py-20 text-white/40">
            <p className="text-lg">Unable to load synagogues.</p>
            <p className="text-sm mt-2">Please check your connection and try again.</p>
          </div>
        )}

        {!isLoading && !isError && filtered.length === 0 && (
          <div className="text-center py-20 text-white/40">
            <Star className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg">No synagogues found</p>
            {search && <p className="text-sm mt-2">Try a different search term</p>}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((synagogue) => (
            <SynagogueCard
              key={synagogue.id}
              synagogue={synagogue}
              onClick={() => navigate(`/kiosk/${synagogue.id}`)}
            />
          ))}
        </div>
      </main>
    </div>
  );
}

function SynagogueCard({ synagogue, onClick }) {
  return (
    <button
      onClick={onClick}
      className="card-dark p-6 text-left group hover:border-gold-400/30 hover:shadow-luxury
                 transition-all duration-300 hover:-translate-y-1 fade-in w-full"
    >
      <div className="flex items-start justify-between mb-4">
        {synagogue.logoUrl ? (
          <img
            src={synagogue.logoUrl}
            alt={synagogue.synagogueName}
            className="h-14 w-14 rounded-xl object-cover shadow-luxury-sm"
          />
        ) : (
          <div className="h-14 w-14 rounded-xl bg-ink-600 flex items-center justify-center">
            <span className="text-gold-400 font-display text-xl font-bold">
              {synagogue.synagogueName.charAt(0)}
            </span>
          </div>
        )}
        <ChevronRight className="w-5 h-5 text-white/20 group-hover:text-gold-400 transition-colors mt-1" />
      </div>

      <h3 className="font-display text-xl text-white mb-1 leading-snug">{synagogue.synagogueName}</h3>

      {synagogue.city && (
        <div className="flex items-center gap-1.5 text-white/40 text-sm">
          <MapPin className="w-3.5 h-3.5" />
          <span>{synagogue.city}</span>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-white/5">
        <span className="text-xs text-white/25 font-mono">{synagogue.synagogueCode}</span>
      </div>
    </button>
  );
}
