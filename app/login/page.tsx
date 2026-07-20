'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import Image from 'next/image';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      if (!data.session) {
        setError('Login succeeded but no session was created. Please try again.');
        setLoading(false);
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      const { data: { session: verifiedSession } } = await supabase.auth.getSession();

      if (!verifiedSession) {
        setError('Session verification failed. Please try logging in again.');
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_deleted')
        .eq('id', verifiedSession.user.id)
        .maybeSingle();

      if (profile?.is_deleted) {
        await supabase.auth.signOut();
        setError('This account has been deleted.');
        setLoading(false);
        return;
      }

      router.push('/dashboard/profile');
    } catch (err: any) {
      console.error('Login error:', err);
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white relative overflow-hidden">
      {/* bottom diagonal bar - mobile */}
      <div className="pointer-events-none absolute mt-20 md:mt-0 inset-x-0 bottom-0 h-[270px] block md:hidden">
        <svg
          viewBox="0 0 1000 300"
          className="auth-accent-lines absolute bottom-0 left-[-20px] w-[140%] h-[250px]"
          preserveAspectRatio="none"
        >
          {/* Long diagonal */}
          <line
            x1="0"
            y1="280"
            x2="1000"
            y2="20"
            stroke="black"
            strokeWidth="20"
            strokeLinecap="square"
          />

          {/* Middle support line */}
          <line
            x1="600"
            y1="300"
            x2="450"
            y2="167"
            stroke="black"
            strokeWidth="20"
            strokeLinecap="square"
          />
        </svg>
      </div>

      {/* bottom diagonal bar - desktop */}
      <div className="pointer-events-none absolute bottom-0  right-0 w-[500px] h-[200px] hidden md:block">
        <svg
          viewBox="0 0 1000 300"
          className="auth-accent-lines w-full h-full absolute"
          preserveAspectRatio="none"
        >
          <line x1="0" y1="350" x2="1040" y2="40" stroke="black" strokeWidth="20" strokeLinecap="square" />
          <line  
           x1="1077"
            y1="328"
            x2="621"
            y2="168"
            stroke="black"
            strokeWidth="20"
            strokeLinecap="square" />
        </svg>
      </div>

      <div className="w-full max-w-md px-10 z-10">
        <div className="text-center mb-10">
          <div className="mb-6">
            <div className="flex justify-center">
              <Image
                src="/ntwrk_logo_black.png"
                alt="NTWRK"
                width={420}
                height={140}
                className="w-[360px] h-auto dark:invert"
                priority
              />
            </div>
          </div>
          <h1 className="text-[14px] font-extrabold tracking-[0.18em] uppercase text-black">
            Sign Into Your Account
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-sm py-2 px-3 text-center uppercase tracking-wide">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="h-12 bg-transparent border-0 border-b-[2px] border-black text-black placeholder:text-[#8b8b8b] placeholder:uppercase placeholder:tracking-[0.16em] placeholder:text-[10px] placeholder:font-extrabold focus:border-black focus:ring-0 rounded-none px-0 text-[14px] font-medium focus-visible:ring-0 focus-visible:ring-offset-0"
                placeholder="Enter Your Email"
              />
            </div>

            <div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="h-12 bg-transparent border-0 border-b-[2px] border-black text-black placeholder:text-[#8b8b8b] placeholder:uppercase placeholder:tracking-[0.16em] placeholder:text-[10px] placeholder:font-extrabold focus:border-black focus:ring-0 rounded-none px-0 text-[14px] font-medium focus-visible:ring-0 focus-visible:ring-offset-0"
                placeholder="Enter Your Password"
              />
              <div className="text-right mt-2">
                <Link
                  href="/forgot-password"
                  className="text-[10px] text-[#8b8b8b] hover:text-black uppercase tracking-[0.12em] font-extrabold transition-colors"
                >
                  Forgot Password?
                </Link>
              </div>
            </div>
          </div>

          <div className="pt-6">
            <Button
              type="submit"
              className="group block mx-auto w-full h-14 text-[13px] tracking-[0.18em] bg-black hover:bg-black text-[#6f6f6f] font-bold uppercase rounded-none relative transition-colors"
              disabled={loading}
            >
              <span className="relative inline-block px-3 font-extrabold text-[#6f6f6f] group-hover:text-white transition-colors">
                {loading ? 'Signing In...' : 'Sign In'}
                <span className="absolute -bottom-[3px] left-1 right-1 h-[1px] bg-[#6f6f6f] group-hover:bg-white transition-colors" />
              </span>
            </Button>
          </div>

          <p className="text-center text-[14px] text-[#8b8b8b] uppercase tracking-[0.08em] mt-10 font-extrabold">
            Don&apos;t have an account?{' '}
            <Link
              href="/signup"
              className="text-[#84c225] hover:text-[#6fa01d] font-extrabold uppercase tracking-[0.08em]"
            >
              Sign Up
            </Link>
          </p>
          <p className="text-center mt-4">
            <Link
              href="/privacy-policy"
              className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#8b8b8b] hover:text-black transition-colors"
            >
              Privacy Policy
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}