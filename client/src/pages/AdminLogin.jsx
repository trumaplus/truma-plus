import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Shield } from 'lucide-react';
import api from '../api/client';

export default function AdminLogin() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/admin/login', form);
      localStorage.setItem('dp_token', data.token);
      localStorage.setItem('dp_role', 'admin');
      toast.success('Welcome, Admin');
      navigate('/admin');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-ink-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <Link to="/" className="font-display text-3xl text-gold-400 tracking-wide">Donation Plus</Link>
          <p className="text-white/40 mt-2 text-sm">System Administration</p>
        </div>

        <div className="card-dark p-8">
          <div className="flex items-center justify-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gold-400/10 flex items-center justify-center">
              <Shield className="w-7 h-7 text-gold-400" />
            </div>
          </div>
          <h2 className="font-display text-2xl text-white mb-8 text-center">Admin Login</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-sm text-white/60 mb-1.5 block">Admin Email</label>
              <input
                type="email"
                required
                className="w-full input-dark"
                placeholder="admin@donationplus.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm text-white/60 mb-1.5 block">Password</label>
              <input
                type="password"
                required
                className="w-full input-dark"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <button type="submit" disabled={loading} className="btn-gold w-full mt-2">
              {loading ? 'Signing in…' : 'Sign In as Admin'}
            </button>
          </form>
        </div>

        <div className="mt-6 text-center">
          <Link to="/" className="text-sm text-white/30 hover:text-white/60 transition-colors">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
