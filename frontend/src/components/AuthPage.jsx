import { useState } from 'react';
import Login from './Login';
import Register from './Register';

const AuthPage = ({ initialMode = 'login' }) => {
  const [showLogin, setShowLogin] = useState(initialMode === 'login');

  return showLogin ? (
    <Login onSwitchToRegister={() => setShowLogin(false)} />
  ) : (
    <Register onSwitchToLogin={() => setShowLogin(true)} />
  );
};

export default AuthPage;
