'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { isLoggedIn, getMe } from '@/lib/api';
import { useChatStore } from '@/lib/store';

const PUBLIC_PATHS = ['/login', '/register'];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const setUser = useChatStore((s) => s.setUser);
  const setIsAuthLoading = useChatStore((s) => s.setIsAuthLoading);
  const isAuthLoading = useChatStore((s) => s.isAuthLoading);
  const user = useChatStore((s) => s.user);

  useEffect(() => {
    const check = async () => {
      if (PUBLIC_PATHS.includes(pathname)) {
        setIsAuthLoading(false);
        return;
      }

      if (!isLoggedIn()) {
        setIsAuthLoading(false);
        router.replace('/login');
        return;
      }

      if (!user) {
        try {
          const me = await getMe();
          setUser(me);
        } catch {
          router.replace('/login');
        }
      }
      setIsAuthLoading(false);
    };

    check();
  }, [pathname, router, setUser, setIsAuthLoading, user]);

  // Don't show loading for public paths
  if (PUBLIC_PATHS.includes(pathname)) {
    return <>{children}</>;
  }

  if (isAuthLoading) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user && !PUBLIC_PATHS.includes(pathname)) {
    return null; // will redirect
  }

  return <>{children}</>;
}
