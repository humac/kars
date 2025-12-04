import { useState } from 'react';
import { LogIn } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from '../ui/use-toast';

const SignIn = () => {
  const { login } = useAuth();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(formData.email, formData.password);
    if (!result.success) {
      setError(result.error || 'Unable to sign in');
    } else {
      toast({ title: 'Welcome back', description: 'Signed in successfully.' });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-xs font-semibold text-primary shadow-sm ring-1 ring-slate-200">
            Modern Asset Portal
          </div>
          <h1 className="text-4xl font-semibold leading-tight text-slate-900">
            Welcome back 👋
            <span className="block text-lg font-normal text-muted-foreground mt-3">
              Track every laptop, stay audit-ready, and keep your inventory healthy.
            </span>
          </h1>
          <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <p className="font-semibold text-slate-900">Real-time visibility</p>
              <p className="mt-1 text-sm">Monitor laptop availability and assignments instantly.</p>
            </div>
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <p className="font-semibold text-slate-900">Fast check-ins</p>
              <p className="mt-1 text-sm">Register and assign hardware without leaving the dashboard.</p>
            </div>
          </div>
        </div>

        <Card className="border-slate-200 shadow-xl backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Secure Access</p>
                <CardTitle className="mt-1 text-2xl">Sign in to your workspace</CardTitle>
                <CardDescription>Use your company credentials to continue.</CardDescription>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <LogIn className="h-5 w-5" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">Work email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@company.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
              </div>

              {error && (
                <div className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 border border-rose-100">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SignIn;
