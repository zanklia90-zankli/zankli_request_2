
import React from 'react';
import { useAuth } from './hooks/useAuth.ts';
import Login from './components/auth/Login.tsx';
import Dashboard from './components/dashboard/Dashboard.tsx';

function App() {
  const { currentUser } = useAuth();

  return (
    <div className="bg-zankli-cream-100 min-h-screen font-sans">
      {currentUser ? <Dashboard /> : <Login />}
    </div>
  );
}

export default App;