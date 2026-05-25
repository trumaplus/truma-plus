import { useState } from 'react';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import api from '../api/client';

export default function Login() {
  const [form, setForm]       = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Already logged in → go straight to the right dashboard
  const existingToken = localStorage.getItem('dp_token');
  const existingRole  = localStorage.getItem('dp_role');
  if (existingToken && existingRole === 'synagogue') return <Navigate to="/dashboard" replace />;
  if (existingToken && existingRole === 'admin')     return <Navigate to="/admin"     replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      // Single unified endpoint — server decides admin vs. gabai
      const { data } = await api.post('/auth/login', form);

      localStorage.setItem('dp_token', data.token);
      localStorage.setItem('dp_role',  data.role);

      if (data.role === 'admin') {
        toast.success('Welcome, Admin');
        navigate('/admin');
      } else {
        localStorage.setItem('dp_synagogueId',   data.synagogueId);
        localStorage.setItem('dp_synagogueName', data.synagogueName);
        toast.success(`Welcome, ${data.synagogueName}`);
        navigate('/dashboard');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-ink-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-10">
          <Link to="/" className="inline-block">
            <img src="/logo.png" alt="Truma Plus" className="h-20 mx-auto object-contain" />
          </Link>
          <p className="text-white/40 mt-3 text-sm">כניסה לפאנל ניהול</p>
        </div>

        {/* Card */}
        <div className="card-dark p-8">
          <h2 className="font-display text-2xl text-white mb-8 text-center">Sign In</h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-sm text-white/60 mb-1.5 block">Email</label>
              <input
                type="email"
                required
                autoComplete="email"
                className="w-full input-dark"
                placeholder="your@email.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm text-white/60 mb-1.5 block">Password</label>
              <input
                type="password"
                required
                autoComplete="current-password"
                className="w-full input-dark"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <button type="submit" disabled={loading} className="btn-gold w-full mt-2">
              {loading ? 'Signing in…' : 'Sign In'}
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
