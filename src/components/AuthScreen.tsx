import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Lock, Mail, ArrowRight, Check, AlertCircle } from 'lucide-react';

export const AuthScreen: React.FC = () => {
  const { signIn, signUp, signInWithDemo } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'signin') {
        const { error: signInError } = await signIn(email, password);
        if (signInError) {
          setError("Couldn't sign in. Please check your email and password.");
        }
      } else {
        const { error: signUpError, message } = await signUp(email, password);
        if (signUpError) {
          setError(signUpError.message || 'Failed to create account.');
        } else if (message) {
          setInfoMessage(message);
        }
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-100 flex flex-col justify-center items-center px-4 py-12 relative">
      {/* Main card */}
      <div className="w-full max-w-sm relative z-10">
        {/* Brand header */}
        <div className="text-left mb-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-md bg-neutral-900 border border-neutral-700 flex items-center justify-center text-neutral-100 font-semibold text-sm">
              K
            </div>
            <span className="text-base font-semibold tracking-tight text-white">
              KudiFlow
            </span>
          </div>
          <p className="text-xs text-neutral-400">
            Professional invoicing for modern businesses
          </p>
        </div>

        {/* Auth form card */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 shadow-xs">
          {/* Mode Switch (Sign In / Sign Up) */}
          <div className="flex bg-neutral-950 p-0.5 rounded-md border border-neutral-800 mb-5">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError(null);
                setInfoMessage(null);
              }}
              className={`flex-1 py-1.5 text-xs font-medium rounded transition-all cursor-pointer ${
                mode === 'signin'
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError(null);
                setInfoMessage(null);
              }}
              className={`flex-1 py-1.5 text-xs font-medium rounded transition-all cursor-pointer ${
                mode === 'signup'
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Error & Info Alerts */}
          {error && (
            <div className="mb-4 p-2.5 bg-red-950/40 border border-red-900/60 rounded-md text-xs text-red-300 flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {infoMessage && (
            <div className="mb-4 p-2.5 bg-neutral-950 border border-neutral-700 rounded-md text-xs text-neutral-300 flex items-start gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
              <span>{infoMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-md pl-9 pr-3 py-2 text-xs text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600 transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-neutral-300">
                  Password
                </label>
                {mode === 'signin' && (
                  <span className="text-[11px] text-neutral-500">
                    Min. 6 characters
                  </span>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-md pl-9 pr-9 py-2 text-xs text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 p-0.5"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white font-medium text-xs py-2 px-3 rounded-md flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              {loading ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>{mode === 'signin' ? 'Sign In to KudiFlow' : 'Create Account'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Quick preview login */}
          <div className="mt-5 pt-4 border-t border-neutral-800 text-left">
            <button
              type="button"
              onClick={() => signInWithDemo('billing@kudiflow.app')}
              className="w-full py-2 px-3 rounded-md border border-neutral-800 hover:border-neutral-700 bg-neutral-950 hover:bg-neutral-900 text-xs text-neutral-300 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>Use Demo Account</span>
            </button>
          </div>
        </div>

        {/* Footnote */}
        <div className="mt-5 text-left text-[11px] text-neutral-500 flex items-center gap-2">
          <span>Private & Secure</span>
          <span>·</span>
          <span>Simple, Reliable Invoicing</span>
        </div>
      </div>
    </div>
  );
};
