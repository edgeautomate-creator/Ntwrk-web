'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === 'dark';

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={!mounted}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="text-black hover:bg-[#76af1f] dark:text-white md:hover:bg-gray-100 md:dark:hover:bg-zinc-800"
      aria-label={mounted ? `Switch to ${isDark ? 'light' : 'dark'} mode` : 'Toggle color mode'}
      title={mounted ? `Switch to ${isDark ? 'light' : 'dark'} mode` : 'Toggle color mode'}
    >
      {mounted && isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  );
}
