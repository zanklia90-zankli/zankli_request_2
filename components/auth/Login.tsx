import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth.ts';
import { ShieldCheck } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, isAuthenticating } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const { error: loginError } = await login(email, password);
      
      if (loginError) {
        // If the login function returns an error, display it.
        // The isAuthenticating state is handled by the AuthContext.
        setError(loginError || 'Invalid email or password. Please check your credentials and try again.');
      }
      // On success, the onAuthStateChange listener in AuthContext will update the
      // state, and App.tsx will automatically render the Dashboard.

    } catch (err: any) {
        console.error("Login failed unexpectedly:", err);
        setError(err.message || "An unexpected error occurred during login.");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-zankli-cream-50">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-2xl shadow-2xl">
        <div className="text-center">
            <h1 className="text-3xl font-bold text-zankli-orange-800">Zankli Medical Centre</h1>
            <p className="mt-2 text-zankli-cream-900">Internal Portal</p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-zankli-orange-500 focus:border-zankli-orange-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-zankli-orange-500 focus:border-zankli-orange-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div>
            <button
              type="submit"
              disabled={isAuthenticating}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-zankli-orange-600 hover:bg-zankli-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zankli-orange-500 disabled:bg-zankli-orange-300"
            >
              <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                <ShieldCheck className="h-5 w-5 text-zankli-orange-500 group-hover:text-zankli-orange-400" aria-hidden="true" />
              </span>
              {isAuthenticating ? 'Signing In...' : 'Sign In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;