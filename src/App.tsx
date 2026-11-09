import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthScreen } from './components/AuthScreen';
import { DashboardLayout } from './components/DashboardLayout';

const AppContent: React.FC = () => {
  const { user, loading, isConfigured } = useAuth();

  // If Supabase environment variables are missing, show friendly App not configured message
  if (!isConfigured) {
    return (
      <div className="min-h-screen w-full bg-neutral-950 text-neutral-100 flex flex-col justify-center items-center px-4 py-12">
        <div className="w-full max-w-sm text-center">
          <div className="w-10 h-10 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-white font-semibold text-base mx-auto mb-4">
            K
          </div>
          <h1 className="text-base font-semibold text-white mb-2">App not configured</h1>
          <p className="text-xs text-neutral-400 leading-relaxed mb-6">
            Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables to connect KudiFlow.
          </p>
          <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-md text-left text-xs text-neutral-400 space-y-1.5">
            <div className="text-[11px] font-medium text-neutral-300">Required environment variables:</div>
            <div className="font-mono text-[11px] text-neutral-300">• VITE_SUPABASE_URL</div>
            <div className="font-mono text-[11px] text-neutral-300">• VITE_SUPABASE_ANON_KEY</div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-neutral-950 flex flex-col items-center justify-center text-neutral-400">
        <div className="w-8 h-8 rounded-md bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-200 font-semibold text-sm mb-3">
          K
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <div className="w-3.5 h-3.5 border-2 border-neutral-500 border-t-transparent rounded-full animate-spin" />
          <span>Loading KudiFlow...</span>
        </div>
      </div>
    );
  }

  // Only logged-in users can access the dashboard
  if (!user) {
    return <AuthScreen />;
  }

  return <DashboardLayout />;
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
