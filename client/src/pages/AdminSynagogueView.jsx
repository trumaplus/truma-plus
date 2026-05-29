import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, LayoutDashboard, DollarSign, Image, Bell, Settings, Tablet, ExternalLink } from 'lucide-react';
import api from '../api/client';
import DonationsTable from '../components/admin/DonationsTable';
import MediaManager from '../components/admin/MediaManager';
import AnnouncementAdder from '../components/admin/AnnouncementAdder';
import SynagogueSettingsForm from '../components/admin/SynagogueSettingsForm';
import KioskControl from '../components/admin/KioskControl';
import LanguageSwitcher from '../components/LanguageSwitcher';

const TABS = [
  { id: 'overview',       label: 'Overview',       icon: LayoutDashboard },
  { id: 'donations',      label: 'Donations',       icon: DollarSign },
  { id: 'media',          label: 'Media',            icon: Image },
  { id: 'announcements',  label: 'Announcements',   icon: Bell },
  { id: 'settings',       label: 'Settings',         icon: Settings },
  { id: 'kiosk',          label: 'Live Kiosk',       icon: Tablet },
];

export default function AdminSynagogueView() {
  const navigate = useNavigate();
  const { synagogueId } = useParams();
  const [tab, setTab] = useState('overview');

  const { data: synagogue } = useQuery({
    queryKey: ['synagogue', synagogueId],
    queryFn: () => api.get(`/synagogues/${synagogueId}`).then((r) => r.data),
    enabled: !!synagogueId,
  });

  const { data: donations = [] } = useQuery({
    queryKey: ['donations', synagogueId],
    queryFn: () => api.get('/donations', { params: { synagogueId } }).then((r) => r.data),
    enabled: !!synagogueId,
  });

  const completed = donations.filter((d) => d.paymentStatus === 'completed');
  const totalRaised = completed.reduce((sum, d) => sum + d.amount, 0);
  const thisMonth = completed
    .filter((d) => new Date(d.createdAt).getMonth() === new Date().getMonth())
    .reduce((sum, d) => sum + d.amount, 0);

  return (
    <div className="min-h-screen bg-ink-900 flex font-body">
      {/* Sidebar */}
      <aside className="w-64 bg-ink-800 border-r border-white/5 flex flex-col fixed inset-y-0 left-0 z-30">
        {/* Back + logo */}
        <div className="p-5 border-b border-white/5">
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center gap-2 text-white/40 hover:text-gold-400 transition-colors text-sm mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Admin
          </button>
          <img src="/logo.png" alt="Truma Plus" className="h-8 object-contain mb-1" />
          <span className="text-xs text-amber-400/70 bg-amber-400/10 border border-amber-400/20 rounded-md px-2 py-0.5">
            Admin View
          </span>
        </div>

        {/* Synagogue info */}
        <div className="p-4 border-b border-white/5">
          {synagogue?.logoUrl && (
            <img src={synagogue.logoUrl} alt="Logo" className="h-12 w-12 rounded-xl object-cover mb-3" />
          )}
          <p className="text-white/90 font-medium text-sm leading-snug">{synagogue?.synagogueName}</p>
          {synagogue?.city && <p className="text-white/30 text-xs mt-0.5">{synagogue.city}</p>}
          <a
            href={`/kiosk/${synagogueId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 flex items-center gap-1.5 text-xs text-white/30 hover:text-gold-400 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Open Kiosk
          </a>
        </div>

        {/* Nav */}
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
            <h2 className="font-display text-3xl text-white mb-2">
              {synagogue?.synagogueName}
            </h2>
            <p className="text-white/30 text-sm mb-8">Viewing as Admin</p>

            <div className="grid grid-cols-3 gap-6 mb-8">
              <StatCard label="Total Raised" value={`$${totalRaised.toLocaleString('en-CA', { minimumFractionDigits: 2 })}`} sub="CAD" />
              <StatCard label="Completed Donations" value={completed.length} sub="transactions" />
              <StatCard label="This Month" value={`$${thisMonth.toLocaleString('en-CA', { minimumFractionDigits: 2 })}`} sub="CAD" />
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
              <MediaManager synagogue={synagogue} />
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
              <SynagogueSettingsForm key={synagogue.id} synagogue={synagogue} />
            </div>
          </div>
        )}

        {tab === 'kiosk' && (
          <div className="fade-in">
            <h2 className="font-display text-3xl text-white mb-8">Live Kiosk Control</h2>
            <div className="card-dark p-6">
              <KioskControl
                synagogueId={synagogueId}
                synagogueName={synagogue?.synagogueName}
                isAdmin={true}
              />
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
