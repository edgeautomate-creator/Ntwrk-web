'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

export function DUPRLoginButton() {
  const router = useRouter();

  const handleConnect = () => {
    router.push('/dupr-login');
  };

  return (
    <Button
      onClick={handleConnect}
      className="w-full"
      size="lg"
      data-dupr-login-button
    >
      <ExternalLink className="h-4 w-4 mr-2" />
      Connect with DUPR
    </Button>
  );
}
