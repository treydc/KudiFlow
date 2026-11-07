import React from 'react';
import { FileText, Users, Settings, LogOut, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type NavTab = 'invoices' | 'clients' | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  mobileOpen,
  onCloseMobile,
}) => {
  const { user, signOut } = useAuth();

  const navItems: { id: NavTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'invoices', label: 'Invoices', icon: FileText },
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-neutral-950 border-r border-neutral-800 text-neutral-300">
      {/* Brand header */}
      <div className="h-14 flex items-center justify-between px-5 border-b border-neutral-800">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-neutral-900 border border-neutral-700 flex items-center justify-center text-neutral-100 font-semibold text-sm">
            K
          </div>
          <span className="text-sm font-semibold tracking-tight text-white">
            KudiFlow
          </span>
        </div>
        {mobileOpen && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="md:hidden text-neutral-400 hover:text-white p-1 rounded-md"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navigation section */}
      <div className="flex-1 py-5 px-3 space-y-1 overflow-y-auto">
        <div className="px-2.5 mb-2 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
          Navigation
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectTab(item.id);
                onCloseMobile();
              }}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer text-left ${
                isActive
                  ? 'bg-neutral-900 text-white border border-neutral-800'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/60'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-500' : 'text-neutral-500'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Auth info & logout at bottom */}
      <div className="p-3 border-t border-neutral-800 bg-neutral-950 space-y-2">
        {/* User profile capsule */}
        <div className="px-2.5 py-2 rounded-md bg-neutral-900/60 border border-neutral-800/80">
          <div className="text-[10px] text-neutral-500 mb-0.5">
            Signed in as
          </div>
          <div className="text-xs text-neutral-200 truncate font-normal" title={user?.email || 'User'}>
            {user?.email || 'user@kudiflow.app'}
          </div>
        </div>

        {/* Sign out button */}
        <button
          type="button"
          onClick={() => signOut()}
          className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900 rounded-md transition-colors border border-transparent hover:border-neutral-800 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:block w-64 h-screen sticky top-0 shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Mobile drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-200 ease-in-out md:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </div>
    </>
  );
};
