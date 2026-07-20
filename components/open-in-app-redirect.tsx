'use client';

import { useEffect } from 'react';

const IOS_STORE_URL = 'https://apps.apple.com/app/id6778045802';
const ANDROID_PACKAGE = 'com.ntwrkapp.android';
const ANDROID_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;

function redirectToStore(tournamentId: string) {
  if (typeof navigator === 'undefined') return;
  const ua = navigator.userAgent || (navigator as any).vendor || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isAndroid = /android/i.test(ua);

  if (isAndroid) {
    const path = `/dashboard/tournaments/${tournamentId}`;
    const fallback = encodeURIComponent(
      `${ANDROID_STORE_URL}&referrer=${encodeURIComponent(path)}`
    );
    window.location.href =
      `intent://ntwrk.bolt.host${path}#Intent;scheme=https;` +
      `package=${ANDROID_PACKAGE};S.browser_fallback_url=${fallback};end`;
    return;
  }

  if (isIOS) {
    window.location.href = IOS_STORE_URL;
  }
}

export function OpenInAppRedirect({ tournamentId }: { tournamentId: string }) {
  useEffect(() => {
    redirectToStore(tournamentId);
  }, [tournamentId]);
  return null;
}
