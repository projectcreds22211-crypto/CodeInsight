import React from 'react';
import { NavLink } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { 
  Home, 
  FolderKanban, 
  Sparkles, 
  FileText, 
  Settings, 
  Terminal,
  Activity
} from 'lucide-react';

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { name: 'Home', path: '/', icon: Home },
  { name: 'Projects', path: '/projects', icon: FolderKanban },
  { name: 'Analyze', path: '/analyze', icon: Sparkles },
  { name: 'Reports', path: '/reports', icon: FileText },
  { name: 'Settings', path: '/settings', icon: Settings },
];

export const Sidebar: React.FC = () => {
  const { user } = useUser();
  const displayName = user?.fullName || user?.primaryEmailAddress?.emailAddress?.split('@')[0] || 'Builder';
  const displayEmail = user?.primaryEmailAddress?.emailAddress || 'Solo Builder Mode';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <aside
      className="bg-[var(--surface-sidebar)] text-white flex flex-col h-screen sticky top-0 z-30 select-none w-16 lg:w-64 transition-[width] duration-200"
      style={{ borderRight: '1px solid #2C2926' }}
    >
      {/* Brand Header */}
      <div className="p-3 lg:p-6 flex items-center justify-center lg:justify-between border-b border-[#2C2926]">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 shrink-0 flex items-center justify-center text-white"
            style={{
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, var(--thread-purple), var(--accent-coral))',
              boxShadow: '0 2px 8px rgba(107, 76, 230, 0.3)',
            }}
          >
            <Terminal className="w-5 h-5" />
          </div>
          <div className="hidden lg:block">
            <h1 className="font-bold text-lg leading-tight tracking-tight font-display text-white">
              CodeInsight
            </h1>
            <p className="text-[11px] text-[#A8A29E] font-medium tracking-wide">
              Engineering Intelligence
            </p>
          </div>
        </div>
        <span className="hidden lg:inline-flex text-[10px] font-semibold tracking-wider px-2 py-0.5 rounded-full bg-[#34302C] text-[var(--accent-coral)] border border-[#423D38]">
          MVP
        </span>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-2 lg:px-3 py-6 space-y-1.5 overflow-y-auto" aria-label="Main navigation">
        <div className="hidden lg:block px-3 pb-2 text-[11px] font-semibold tracking-wider uppercase text-[#78716C]">
          Menu
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }: { isActive: boolean }) =>
                `focus-ring-light flex items-center justify-center lg:justify-start gap-3 px-2 lg:px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-[#2C2926] text-white shadow-sm font-semibold'
                    : 'text-[#A8A29E] hover:text-white hover:bg-[#2A2724]'
                }`
              }
              style={{ borderRadius: 'var(--radius-sm)' }}
            >
              {({ isActive }: { isActive: boolean }) => (
                <>
                  <div className="relative shrink-0 flex items-center justify-center">
                    {isActive && (
                      <span
                        className="absolute -left-2 lg:-left-3 w-[3px] h-4 rounded-full"
                        style={{ backgroundColor: 'var(--accent-coral)' }}
                      />
                    )}
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="hidden lg:inline">{item.name}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer / Status Area */}
      <div className="p-2 lg:p-4 border-t border-[#2C2926] space-y-3 bg-[#1A1816]">
        <div className="hidden lg:flex items-center justify-between px-2 py-1.5 rounded-lg bg-[#24211E]">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-[var(--success)]" />
            <span className="text-xs text-[#D6D3D1]">API Status</span>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--success)] font-semibold">
            <span className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
            Online
          </span>
        </div>

        {/* Collapsed: just the avatar dot */}
        <div className="flex lg:hidden items-center justify-center py-1">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border border-[#4C3B9B]"
            style={{ backgroundColor: 'var(--thread-violet)', color: 'var(--accent-coral)' }}
          >
            {initial}
          </div>
        </div>

        {/* Expanded: full user info */}
        <div className="hidden lg:flex items-center gap-3 px-2 pt-1">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border border-[#4C3B9B] shrink-0"
            style={{ backgroundColor: 'var(--thread-violet)', color: 'var(--accent-coral)' }}
          >
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">{displayName}</p>
            <p className="text-[11px] text-[#A8A29E] truncate">{displayEmail}</p>
          </div>
        </div>
      </div>
    </aside>
  );
};
