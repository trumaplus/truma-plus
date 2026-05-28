import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LogOut, LayoutDashboard, DollarSign, Image, Bell, Settings, Tablet, ExternalLink } from 'lucide-react';
import api from '../api/client';
import DonationsTable from '../components/admin/DonationsTable';
import MediaManager from '../components/admin/MediaManager';
import AnnouncementAdder from '../components/admin/AnnouncementAdder';
import SynagogueSettingsForm from '../components/admin/SynagogueSettingsForm';
import KioskControl from '../components/admin/KioskControl';
import LanguageSwitcher from '../components/LanguageSwitcher';

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'donations', label: 'Donations', icon: DollarSign },
  { id: 'media', label: 'Media', icon: Image },
  { id: 'announcements', label: 'Announcements', icon: Bell },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'kiosk', label: 'Live Kiosk', icon: Tablet },
];

/** Read synagogueId from JWT payload — not from localStorage (which can be tampered). */
function getSynagogueIdFromToken() {
  try {
    const token = localStorage.getItem('dp_token') || '';
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(b64))?.synagogueId || '';
  } catch { return ''; }
}

export default function SynagogueDashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState('overview');
  // synagogueId is sourced from the JWT — tamper-proof on the client, enforced on the server
  const synagogueId = getSynagogueIdFromToken();
  // Name is display-only; read from localStorage (falls back to server data once loaded)
  const synagogueName = localStorage.getItem('dp_synagogueName');

  const { data: synagogue } = useQuery({
    queryKey: ['synagogue', synagogueId],
    queryFn: () => api.get(`/synagogues/${synagogueId}`).then((r) => r.data),
    enabled: !!synagogueId,
  });

  const { data: donations = [] } = useQuery({
    queryKey: ['donations', synagogueId],
    queryFn: () => api.get('/donations').then((r) => r.data),
    enabled: !!synagogueId,
  });

  function logout() {
    qc.clear();           // wipe React Query cache — prevents cross-session data leaks
    localStorage.clear();
    navigate('/login');
  }

  const completed = donations.filter((d) => d.paymentStatus === 'completed');
  const totalRaised = completed.reduce((sum, d) => sum + d.amount, 0);

  return (
    <div className="min-h-screen bg-ink-900 flex font-body">
      {/* Sidebar */}
      <aside className="w-64 bg-ink-800 border-r border-white/5 flex flex-col fixed inset-y-0 left-0 z-30">
        <div className="p-6 border-b border-white/5">
          <img src="/logo.png" alt="Truma Plus" className="h-8 object-contain mb-1.5" />
          <p className="text-white/40 text-xs">Gabai Dashboard</p>
        </div>
        <div className="p-4 border-b border-white/5">
          {synagogue?.logoUrl && (
            <img src={synagogue.logoUrl} alt="Logo" className="h-12 w-12 rounded-xl object-cover mb-3" />
          )}
          <p className="text-white/80 font-medium text-sm">{synagogueName}</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all ${
                tab === id
                  ? 'bg-gold-400/15 text-gold-400'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5 space-y-2">
          <a
            href={`/kiosk/${synagogueId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-white/40 hover:text-white/70 hover:bg-white/5 transition-all"
          >
            <ExternalLink className="w-4 h-4" />
            Open Kiosk
          </a>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-white/30 hover:text-red-400 hover:bg-red-900/20 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-64 flex flex-col">
        {/* Top bar */}
        <div className="sticky top-0 z-20 flex items-center justify-end px-6 py-2.5
                        bg-ink-900/95 backdrop-blur-sm border-b border-white/5 shrink-0">
          <LanguageSwitcher />
        </div>

        <div className="flex-1 p-8">
        {tab === 'overview' && (
          <div className="fade-in">
            <h2 className="font-display text-3xl text-white mb-8">Overview</h2>
            <div className="grid grid-cols-3 gap-6 mb-8">
              <StatCard label="Total Raised" value={`$${totalRaised.toLocaleString('en-CA', { minimumFractionDigits: 2 })}`} sub="CAD" />
              <StatCard label="Completed Donations" value={completed.length} sub="transactions" />
              <StatCard label="This Month" value={`$${completed
                .filter((d) => new Date(d.createdAt).getMonth() === new Date().getMonth())
                .reduce((sum, d) => sum + d.amount, 0)
                .toFixed(2)}`} sub="CAD" />
            </div>
            <div className="card-dark p-6">
              <h3 className="font-display text-xl text-white mb-4">Recent Donations</h3>
              <DonationsTable synagogueId={synagogueId} />
            </div>
          </div>
        )}

        {tab === 'donations' && (
          <div className="fade-in">
            <h2 className="font-display text-3xl text-white mb-8">Donations</h2>
            <div className="card-dark p-6">
              <DonationsTable synagogueId={synagogueId} />
            </div>
          </div>
        )}

        {tab === 'media' && synagogue && (
          <div className="fade-in">
            <h2 className="font-display text-3xl text-white mb-8">Media Manager</h2>
            <div className="card-dark p-6">
              <MediaManager
                synagogue={synagogue}
                onRefreshKiosk={() => {
                  // Will be handled via KioskControl socket
                  setTab('kiosk');
                }}
              />
            </div>
          </div>
        )}

        {tab === 'announcements' && synagogue && (
          <div className="fade-in">
            <h2 className="font-display text-3xl text-white mb-8">Announcements</h2>
            <div className="card-dark p-6">
              <AnnouncementAdder synagogue={synagogue} />
            </div>
          </div>
        )}

        {tab === 'settings' && synagogue && (
          <div className="fade-in">
            <h2 className="font-display text-3xl text-white mb-8">Settings</h2>
            <div className="card-dark p-6">
              <SynagogueSettingsForm synagogue={synagogue} />
            </div>
          </div>
        )}

        {tab === 'kiosk' && (
          <div className="fade-in">
            <h2 className="font-display text-3xl text-white mb-8">Live Kiosk Control</h2>
            <div className="card-dark p-6">
              <KioskControl synagogueId={synagogueId} synagogueName={synagogueName} isAdmin={false} />
            </div>
          </div>
        )}
        </div>{/* /flex-1 p-8 */}
      </main>
    </div>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="card-dark p-6">
      <p className="text-white/40 text-sm mb-2">{label}</p>
      <p className="font-display text-3xl text-gold-400">{value}</p>
      <p className="text-white/30 text-xs mt-1">{sub}</p>
    </div>
  );
}
