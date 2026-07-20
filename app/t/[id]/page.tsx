'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/contexts/auth-context';

const IOS_STORE_URL = 'https://apps.apple.com/app/id6778045802';
const ANDROID_PACKAGE = 'com.ntwrkapp.android';
const PREFER_WEB_KEY = 'ntwrk_prefer_web';

function getMobileOS(): 'ios' | 'android' | 'other' {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent || (navigator as any).vendor || '';
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  if (/android/i.test(ua)) return 'android';
  return 'other';
}

function prefersWebBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(PREFER_WEB_KEY) === '1';
  } catch {
    return false;
  }
}

function setPreferWebBrowser() {
  try {
    sessionStorage.setItem(PREFER_WEB_KEY, '1');
  } catch {
    // ignore
  }
}

function TournamentRedirectContent({ tournamentId }: { tournamentId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const [os] = useState(() => getMobileOS());
  const webUrl = `/dashboard/tournaments/${tournamentId}`;
  const forceWeb = searchParams.get('web') === '1' || prefersWebBrowser();

  useEffect(() => {
    if (loading) return;

    // Already signed in, desktop, or chose browser — go to the web tournament
    if (user || os === 'other' || forceWeb) {
      if (forceWeb) setPreferWebBrowser();
      router.replace(webUrl);
      return;
    }

    if (os === 'android') {
      const path = `/dashboard/tournaments/${tournamentId}`;
      const fallback = encodeURIComponent(`${window.location.origin}${webUrl}?web=1`);
      window.location.href =
        `intent://ntwrk.bolt.host${path}#Intent;scheme=https;` +
        `package=${ANDROID_PACKAGE};S.browser_fallback_url=${fallback};end`;
      return;
    }

    if (os === 'ios') {
      const timer = setTimeout(() => {
        window.location.href = IOS_STORE_URL;
      }, 1500);

      const handleVisibilityChange = () => {
        if (document.hidden) clearTimeout(timer);
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => {
        clearTimeout(timer);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [os, tournamentId, router, webUrl, forceWeb, user, loading]);

  const continueInBrowser = (e: React.MouseEvent) => {
    e.preventDefault();
    setPreferWebBrowser();
    router.replace(webUrl);
  };

  if (loading || user || os === 'other' || forceWeb) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#84c225] border-t-transparent" />
      </div>
    );
  }

  if (os === 'ios') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white px-6 text-center gap-6">
        <div className="w-20 h-20 rounded-2xl bg-[#84c225] flex items-center justify-center shadow-lg">
          <span className="text-white text-3xl font-bold">N</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Opening in NTWRK</h1>
          <p className="text-gray-500 text-sm">
            If the app is not installed, you&apos;ll be taken to the App Store.
          </p>
        </div>
        <Link
          href={webUrl}
          onClick={continueInBrowser}
          className="text-sm text-[#84c225] underline underline-offset-2"
        >
          Continue in browser instead
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-4 px-6 text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#84c225] border-t-transparent" />
      <Link
        href={`${webUrl}?web=1`}
        onClick={continueInBrowser}
        className="text-sm text-[#84c225] underline underline-offset-2"
      >
        Continue in browser instead
      </Link>
    </div>
  );
}

export default function TournamentRedirectPage({ params }: { params: { id: string } }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#84c225] border-t-transparent" />
        </div>
      }
    >
      <TournamentRedirectContent tournamentId={params.id} />
    </Suspense>
  );
}
