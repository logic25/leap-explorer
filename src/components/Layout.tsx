import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTheme } from 'next-themes';
import {
  LayoutDashboard,
  Briefcase,
  BarChart3,
  Target,
  Settings,
  ChevronLeft,
  ChevronRight,
  Activity,
  Menu,
  X,
  ScrollText,
  LogOut,
  Sun,
  Moon,
} from 'lucide-react';
import { RegimeIndicator } from './RegimeIndicator';
import { mockRegime } from '@/lib/mock-data';
import { useAuth } from '@/hooks/useAuth';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Scanner' },
  { to: '/portfolio', icon: Briefcase, label: 'Portfolio' },
  { to: '/wealth-builder', icon: Target, label: 'Wealth Builder' },
  { to: '/backtester', icon: BarChart3, label: 'Backtester' },
  { to: '/audit', icon: ScrollText, label: 'Audit Log' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed z-50 lg:static flex flex-col border-r border-border bg-sidebar h-full
          transition-all duration-300 ease-in-out
          ${collapsed ? 'w-16' : 'w-56'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 h-14 border-b border-border">
          <Activity className="h-6 w-6 text-primary shrink-0" />
          {!collapsed && (
            <span className="font-semibold text-foreground tracking-tight text-sm">
              LEAPS Trader
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 space-y-1 px-2">
          {navItems.map(({ to, icon: Icon, label }) => {
            const active = location.pathname === to;
            return (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMobileOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors
                  ${active
                    ? 'bg-accent text-primary'
                    : 'text-sidebar-foreground hover:bg-accent hover:text-foreground'
                  }
                `}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Regime */}
        <div className={`px-3 pb-3 ${collapsed ? 'px-1' : ''}`}>
          {collapsed ? (
            <div className={`flex items-center justify-center py-2 rounded-md text-xs font-bold ${
              mockRegime.status === 'GREEN' ? 'bg-bullish/15 text-bullish' :
              mockRegime.status === 'YELLOW' ? 'bg-warning/15 text-warning' :
              'bg-bearish/15 text-bearish'
            }`}>
              {mockRegime.status[0]}
            </div>
          ) : (
            <RegimeIndicator regime={mockRegime} />
          )}
        </div>

        {/* Theme toggle + Sign out */}
        <div className="px-2 pb-2 space-y-1">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex items-center gap-2 px-3 py-2 w-full rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            {theme === 'dark' ? (
              <Sun className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <Moon className="h-3.5 w-3.5 shrink-0" />
            )}
            {!collapsed && <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>
          <button
            onClick={signOut}
            className="flex items-center gap-2 px-3 py-2 w-full rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>

        {/* Collapse */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex items-center justify-center h-10 border-t border-border text-muted-foreground hover:text-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 border-b border-border flex items-center px-4 gap-4 bg-surface-1 shrink-0">
          <button
            className="lg:hidden text-muted-foreground hover:text-foreground"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">
              {navItems.find(n => n.to === location.pathname)?.label || 'Dashboard'}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs font-mono text-muted-foreground">
              Paper Mode
            </span>
            <div className="h-2 w-2 rounded-full bg-warning animate-pulse-glow" />
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 md:p-6 scrollbar-thin">
          {children}
        </div>
      </main>
    </div>
  );
}
