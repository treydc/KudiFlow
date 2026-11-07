import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthScreen } from './components/AuthScreen';
import { DashboardLayout } from './components/DashboardLayout';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();

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
