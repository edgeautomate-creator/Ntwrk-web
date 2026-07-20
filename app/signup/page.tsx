'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import Image from 'next/image';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard/profile`
        }
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      if (!data.user) {
        setError('Failed to create user account');
        setLoading(false);
        return;
      }

      if (displayName.trim()) {
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: data.user.id,
            display_name: displayName.trim(),
            email: email
          }, {
            onConflict: 'id'
          });

        if (profileError) {
          console.error('Error creating profile:', profileError);
        }
      }

      if (data.user && !data.session) {
        setCheckEmail(true);
        setLoading(false);
      } else {
        router.push('/dashboard/profile');
      }
    } catch (err) {
      console.error('Signup error:', err);
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
     <div className="min-h-screen flex items-center justify-center bg-white relative overflow-hidden  ">
      {/* bottom diagonal bar - mobile */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[270px] block md:hidden">
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
      <div className="pointer-events-none absolute bottom-0 right-0 w-[500px] h-[200px] hidden md:block">
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
            strokeLinecap="square"
          />
        </svg>
      </div>

      <div className="w-full max-w-md px-10 z-10">
        <div className="text-center mb-8">
          <div className="mb-2">
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
            Create Your Account
          </h1>
        </div>

        {checkEmail ? (
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
              We&apos;ve sent a confirmation email to{' '}
              <span className="font-semibold text-black">{email}</span>
            </p>
            <p className="text-xs text-[#8b8b8b]">
              Please click the confirmation link in the email to verify your account and complete your
              registration.
            </p>
            <div className="pt-4">
              <p className="text-[10px] text-[#b3b3b3] mb-4">
                Didn&apos;t receive the email? Check your spam folder.
              </p>
              <Link href="/login">
                <Button
                  variant="outline"
                  className="w-full h-12 border-black text-black rounded-none text-[12px] tracking-[0.18em] uppercase"
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
              <div>
                <Input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  disabled={loading}
                  className="h-12 bg-transparent border-0 border-b-[2px] border-black text-black placeholder:text-[#8b8b8b] placeholder:uppercase placeholder:tracking-[0.16em] placeholder:text-[10px] placeholder:font-extrabold focus:border-black focus:ring-0 rounded-none px-0 text-[14px] font-medium focus-visible:ring-0 focus-visible:ring-offset-0"
                  placeholder="Display Name (Optional)"
                  maxLength={50}
                />
                <p className="text-[10px] text-[#b3b3b3] mt-1 uppercase tracking-[0.12em]">
                  This is how other players will see you
                </p>
              </div>

              <div>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
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
                  onChange={e => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength={6}
                  className="h-12 bg-transparent border-0 border-b-[2px] border-black text-black placeholder:text-[#8b8b8b] placeholder:uppercase placeholder:tracking-[0.16em] placeholder:text-[10px] placeholder:font-extrabold focus:border-black focus:ring-0 rounded-none px-0 text-[14px] font-medium focus-visible:ring-0 focus-visible:ring-offset-0"
                  placeholder="Create A Password"
                />
                <p className="text-[10px] text-[#b3b3b3] mt-1 uppercase tracking-[0.12em]">
                  Minimum 6 characters
                </p>
              </div>
            </div>

            <div className="pt-6">
              <Button
                type="submit"
                className="group block mx-auto w-full h-14 text-[13px] tracking-[0.18em] bg-black hover:bg-black text-[#6f6f6f] font-bold uppercase rounded-none relative transition-colors"
                disabled={loading}
              >
                <span className="relative inline-block px-3 font-extrabold text-[#6f6f6f] group-hover:text-white transition-colors">
                  {loading ? 'Creating Account...' : 'Create Account'}
                  <span className="absolute -bottom-[3px] left-1 right-1 h-[1px] bg-[#6f6f6f] group-hover:bg-white transition-colors" />
                </span>
              </Button>
            </div>

            <p className="text-center text-[14px] text-[#8b8b8b] uppercase tracking-[0.08em] mt-10 font-extrabold">
              Already have an account?{' '}
              <Link
                href="/login"
                className="text-[#84c225] hover:text-[#6fa01d] font-extrabold uppercase tracking-[0.08em]"
              >
                Sign In
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
        )}
      </div>
    </div>
  );
}
