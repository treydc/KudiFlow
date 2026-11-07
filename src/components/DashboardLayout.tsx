import React, { useState } from 'react';
import { Sidebar, NavTab } from './Sidebar';
import { InvoicesView } from './InvoicesView';
import { ClientsView } from './ClientsView';
import { SettingsView } from './SettingsView';
import { Menu } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const DashboardLayout: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTab>('invoices');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { user } = useAuth();

  const getBreadcrumbLabel = () => {
    switch (currentTab) {
      case 'invoices':
        return 'Invoices';
      case 'clients':
        return 'Clients';
      case 'settings':
        return 'Settings';
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col md:flex-row antialiased">
      {/* Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Header */}
        <header className="h-14 px-4 sm:px-6 border-b border-neutral-800 bg-neutral-950 sticky top-0 z-30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden p-1.5 text-neutral-400 hover:text-white rounded-md hover:bg-neutral-900 transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-4 h-4" />
            </button>

            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-neutral-500">KudiFlow</span>
              <span className="text-neutral-700">/</span>
              <span className="text-neutral-200 font-medium">{getBreadcrumbLabel()}</span>
            </div>
          </div>

          {/* Right header actions */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs">
              <div className="w-6 h-6 rounded-md bg-neutral-900 border border-neutral-700 flex items-center justify-center text-neutral-300 font-medium text-xs">
                {user?.email ? user.email.charAt(0).toUpperCase() : 'U'}
              </div>
              <span className="hidden sm:inline text-neutral-400 text-xs truncate max-w-[200px]">
                {user?.email}
              </span>
            </div>
          </div>
        </header>

        {/* Workspace Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto">
          {currentTab === 'invoices' && <InvoicesView />}
          {currentTab === 'clients' && <ClientsView />}
          {currentTab === 'settings' && <SettingsView />}
        </main>
      </div>
    </div>
  );
};
