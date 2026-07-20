'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/contexts/auth-context';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';
import { Trophy, User, Plus } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);
 
  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#84c225] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-[#84c225] shadow-sm dark:border-zinc-800 md:bg-background">
        <div className="flex h-20 items-center justify-between md:justify-between px-6 max-w-7xl mx-auto">
          <Link href="/dashboard/profile" className="flex items-center py-2 md:flex-none flex-1 justify-center md:justify-start">
            <Image
              src="/ntwrk_logo_black copy.png"
              alt="NTWRK"
              width={400}
              height={120}
              className="h-12 md:h-16 w-auto object-contain dark:invert"
              priority
            />
          </Link>

          <div className="flex items-center gap-2 md:relative absolute right-6">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="pb-20">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-black shadow-lg">
        <div className="flex items-center justify-around h-20 max-w-7xl mx-auto px-4">
          <Link href="/dashboard/tournaments" className="flex-1">
            <Button
              variant="ghost"
              className="flex flex-col items-center gap-1 h-16 w-full hover:bg-gray-900 relative"
            >
              {pathname === '/dashboard/tournaments' && (
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#84c225]" />
              )}
              <Trophy className={`h-6 w-6 ${pathname === '/dashboard/tournaments' ? 'text-[#84c225]' : 'text-white'}`} />
              <span className={`text-xs font-medium ${pathname === '/dashboard/tournaments' ? 'text-[#84c225]' : 'text-white'}`}>Find Games</span>
            </Button>
          </Link>
          <Link href="/dashboard/tournaments/create" className="flex-1">
            <Button
              variant="ghost"
              className="flex flex-col items-center gap-1 h-16 w-full hover:bg-gray-900 relative"
            >
              {pathname?.startsWith('/dashboard/tournaments/create') && (
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#84c225]" />
              )}
              <Plus className={`h-6 w-6 ${pathname?.startsWith('/dashboard/tournaments/create') ? 'text-[#84c225]' : 'text-white'}`} />
              <span className={`text-xs font-medium ${pathname?.startsWith('/dashboard/tournaments/create') ? 'text-[#84c225]' : 'text-white'}`}>Create Game</span>
            </Button>
          </Link>
          <Link href="/dashboard/profile" className="flex-1">
            <Button
              variant="ghost"
              className="flex flex-col items-center gap-1 h-16 w-full hover:bg-gray-900 relative"
            >
              {pathname === '/dashboard/profile' && (
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#84c225]" />
              )}
              <User className={`h-6 w-6 ${pathname === '/dashboard/profile' ? 'text-[#84c225]' : 'text-white'}`} />
              <span className={`text-xs font-medium ${pathname === '/dashboard/profile' ? 'text-[#84c225]' : 'text-white'}`}>Profile</span>
            </Button>
          </Link>
        </div>
      </nav>
    </div>
  );
}
