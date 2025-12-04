import { Routes, Route } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import SignIn from './components/auth/SignIn';
import Dashboard from './components/dashboard/Dashboard';
import OIDCCallback from './components/OIDCCallback';
import { Toaster } from './components/ui/toast';

function App() {
  const { loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 rounded-full border bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Loading workspace...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Routes>
        <Route path="/auth/callback" element={<OIDCCallback />} />
        <Route path="/*" element={isAuthenticated ? <Dashboard /> : <SignIn />} />
      </Routes>
      <Toaster />
    </div>
  );
}

export default App;
