import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { UserPlus, Loader2, AlertCircle, Laptop } from 'lucide-react';

const RegisterNew = ({ onSwitchToLogin }) => {
  const { register } = useAuth();
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    confirmPassword: '',
    manager_first_name: '',
    manager_last_name: '',
    manager_email: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    const manager_name = `${formData.manager_first_name} ${formData.manager_last_name}`.trim();

    const result = await register(
      formData.email,
      formData.password,
      formData.first_name,
      formData.last_name,
      manager_name,
      formData.manager_email
    );

    if (!result.success) {
      setError(result.error);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-lg">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-primary mb-4">
            <Laptop className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">KARS</h1>
          <p className="text-muted-foreground">KeyData Asset Registration System</p>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">Create an account</CardTitle>
            <CardDescription className="text-center">
              Enter your information to get started
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Personal Information */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground">Your Information</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">First Name</Label>
                    <Input
                      id="first_name"
                      name="first_name"
                      value={formData.first_name}
                      onChange={handleChange}
                      placeholder="John"
                      autoComplete="given-name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Last Name</Label>
                    <Input
                      id="last_name"
                      name="last_name"
                      value={formData.last_name}
                      onChange={handleChange}
                      placeholder="Doe"
                      autoComplete="family-name"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="you@company.com"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <Separator />

              {/* Manager Information */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground">Manager Information</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="manager_first_name">Manager First Name</Label>
                    <Input
                      id="manager_first_name"
                      name="manager_first_name"
                      value={formData.manager_first_name}
                      onChange={handleChange}
                      placeholder="Jane"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="manager_last_name">Manager Last Name</Label>
                    <Input
                      id="manager_last_name"
                      name="manager_last_name"
                      value={formData.manager_last_name}
                      onChange={handleChange}
                      placeholder="Smith"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manager_email">Manager Email</Label>
                  <Input
                    id="manager_email"
                    name="manager_email"
                    type="email"
                    value={formData.manager_email}
                    onChange={handleChange}
                    placeholder="manager@company.com"
                    required
                  />
                </div>
              </div>

              <Separator />

              {/* Password */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground">Set Password</h4>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="At least 6 characters"
                    autoComplete="new-password"
                    minLength={6}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    minLength={6}
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Create Account
                  </>
                )}
              </Button>
            </form>

            <Separator />

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <button
                type="button"
                onClick={onSwitchToLogin}
                className="font-semibold text-primary hover:underline"
              >
                Sign in here
              </button>
            </p>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          SOC2 Compliance - Track and manage company assets
        </p>
      </div>
    </div>
  );
};

export default RegisterNew;
