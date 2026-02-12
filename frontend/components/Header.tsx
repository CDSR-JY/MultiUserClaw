'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquare, Activity, Clock } from 'lucide-react';
import { useChatStore } from '@/lib/store';

const NAV_ITEMS = [
  { name: 'Chat', href: '/', icon: MessageSquare },
  { name: 'Status', href: '/status', icon: Activity },
  { name: 'Cron', href: '/cron', icon: Clock },
];

function ConnectionDot() {
  const wsStatus = useChatStore((s) => s.wsStatus);

  const color =
    wsStatus === 'connected'
      ? 'bg-green-500'
      : wsStatus === 'connecting'
        ? 'bg-yellow-500'
        : 'bg-red-500';

  const label =
    wsStatus === 'connected'
      ? 'Connected'
      : wsStatus === 'connecting'
        ? 'Connecting'
        : 'Offline';

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={`w-2 h-2 rounded-full ${color}`} />
      <span>{label}</span>
    </div>
  );
}

const Header = () => {
  const pathname = usePathname();

  return (
    <header className="fixed top-0 left-0 right-0 bg-background border-b border-border z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-xl">🐈</span>
            <span className="text-lg font-bold">nanobot</span>
          </Link>

          <nav className="flex items-center space-x-1">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.name}
                </Link>
              );
            })}
            <div className="ml-3 pl-3 border-l border-border">
              <ConnectionDot />
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;
