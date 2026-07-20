'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import Image from 'next/image';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) {
        setError(resetError.message);
        setLoading(false);
        return;
      }

      setEmailSent(true);
      setLoading(false);
    } catch (err) {
      console.error('Password reset error:', err);
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white relative overflow-hidden">
      <div className="pointer-events-none absolute mt-20 md:mt-0 inset-x-0 bottom-0 h-[270px] block md:hidden">
        <svg
          viewBox="0 0 1000 300"
          className="absolute bottom-0 left-[-20px] w-[140%] h-[250px]"
          preserveAspectRatio="none"
        >
          <line
            x1="0"
            y1="280"
            x2="1000"
            y2="20"
            stroke="black"
            strokeWidth="20"
            strokeLinecap="square"
          />
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

      <div className="pointer-events-none absolute bottom-0 right-0 w-[500px] h-[200px] hidden md:block">
        <svg
          viewBox="0 0 1000 300"
          className="w-full h-full absolute"
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
            strokeLinecap="square"
          />
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
                className="w-[360px] h-auto"
                priority
              />
            </div>
          </div>
          <h1 className="text-[14px] font-extrabold tracking-[0.18em] uppercase text-black">
            Reset Your Password
          </h1>
        </div>

        {emailSent ? (
          <div className="space-y-8 text-center">
            <div className="w-16 h-16 border-2 border-[#84c225] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-[#84c225]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h3 className="text-sm font-extrabold uppercase text-black tracking-[0.18em]">
              Check Your Email
            </h3>
            <p className="text-xs text-[#8b8b8b]">
              We&apos;ve sent a password reset link to{' '}
              <span className="font-semibold text-black">{email}</span>
            </p>
            <p className="text-xs text-[#8b8b8b]">
              Please click the link in the email to reset your password. The link will expire in 60 minutes.
            </p>
            <div className="pt-4">
              <p className="text-[10px] text-[#b3b3b3] mb-4 uppercase tracking-[0.12em]">
                Didn&apos;t receive the email? Check your spam folder.
              </p>
              <Link href="/login">
                <Button
                  variant="outline"
                  className="w-full h-12 border-black text-black rounded-none text-[12px] tracking-[0.18em] uppercase hover:bg-black hover:text-white transition-colors"
                >
                  Back to Sign In
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-sm py-2 px-3 text-center uppercase tracking-wide">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <p className="text-[11px] text-[#8b8b8b] uppercase tracking-[0.12em] font-semibold mb-4">
                Enter your email address and we&apos;ll send you a link to reset your password.
              </p>
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
            </div>

            <div className="pt-6 space-y-4">
              <Button
                type="submit"
                className="group block mx-auto w-full h-14 text-[13px] tracking-[0.18em] bg-black hover:bg-black text-[#6f6f6f] font-bold uppercase rounded-none relative transition-colors"
                disabled={loading}
              >
                <span className="relative inline-block px-3 font-extrabold text-[#6f6f6f] group-hover:text-white transition-colors">
                  {loading ? 'Sending...' : 'Send Reset Link'}
                  <span className="absolute -bottom-[3px] left-1 right-1 h-[1px] bg-[#6f6f6f] group-hover:bg-white transition-colors" />
                </span>
              </Button>

              <Link href="/login" className="block">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 border-black text-black rounded-none text-[12px] tracking-[0.18em] uppercase hover:bg-black hover:text-white transition-colors"
                  disabled={loading}
                >
                  Back to Sign In
                </Button>
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
