import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LogOut, LayoutDashboard, Building2, DollarSign, Tablet } from 'lucide-react';
import api from '../api/client';
import SynagoguesList from '../components/admin/SynagoguesList';
import DonationsTable from '../components/admin/DonationsTable';
import KioskControl from '../components/admin/KioskControl';

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'synagogues', label: 'Synagogues', icon: Building2 },
  { id: 'donations', label: 'All Donations', icon: DollarSign },
  { id: 'kiosks', label: 'Live Kiosks', icon: Tablet },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');

  const { data: synagogues = [] } = useQuery({
    queryKey: ['synagogues-admin'],
    queryFn: () => api.get('/synagogues').then((r) => r.data),
  });

  const { data: donations = [] } = useQuery({
    queryKey: ['donations'],
    queryFn: () => api.get('/donations').then((r) => r.data),
  });

  function logout() {
    localStorage.clear();
    navigate('/admin/login');
  }

  const completed = donations.filter((d) => d.paymentStatus === 'completed');
  const totalRaised = completed.reduce((sum, d) => sum + d.amount, 0);

  return (
    <div className="min-h-screen bg-ink-900 flex font-body">
      {/* Sidebar */}
      <aside className="w-64 bg-ink-800 border-r border-white/5 flex flex-col fixed inset-y-0 left-0 z-30">
        <div className="p-6 border-b border-white/5">
          <p className="font-display text-gold-400 text-lg">Donation Plus</p>
          <p className="text-white/40 text-xs mt-0.5">Admin Panel</p>
        </div>

        <nav className="flex-1 p-3 space-y-1 mt-2">
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

        <div className="p-4 border-t border-white/5">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-white/30 hover:text-red-400 hover:bg-red-900/20 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 ml-64 p-8">
        {tab === 'overview' && (
          <div className="fade-in">
            <h2 className="font-display text-3xl text-white mb-8">System Overview</h2>
            <div className="grid grid-cols-3 gap-6 mb-8">
              <StatCard label="Total Synagogues" value={synagogues.length} sub="registered" color="blue" />
              <StatCard label="Total Raised" value={`$${totalRaised.toLocaleString('en-CA', { minimumFractionDigits: 2 })}`} sub="CAD all time" />
              <StatCard label="Completed Donations" value={completed.length} sub="transactions" />
            </div>

            {/* Recent activity */}
            <div className="card-dark p-6">
              <h3 className="font-display text-xl text-white mb-4">Recent Donations</h3>
              <DonationsTable />
            </div>
          </div>
        )}

        {tab === 'synagogues' && (
          <div className="fade-in">
            <h2 className="font-display text-3xl text-white mb-8">Synagogues</h2>
            <div className="card-dark p-6">
              <SynagoguesList />
            </div>
          </div>
        )}

        {tab === 'donations' && (
          <div className="fade-in">
            <h2 className="font-display text-3xl text-white mb-8">All Donations</h2>
            <div className="card-dark p-6">
              <DonationsTable />
            </div>
          </div>
        )}

        {tab === 'kiosks' && (
          <div className="fade-in">
            <h2 className="font-display text-3xl text-white mb-8">Live Kiosks</h2>
            <div className="card-dark p-6">
              <KioskControl isAdmin={true} />
            </div>
          </div>
        )}
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
