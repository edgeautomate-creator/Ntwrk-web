import Image from 'next/image';
import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — NTWRK',
  description: 'Privacy Policy for the NTWRK pickleball platform.',
};

const sections = [
  {
    title: 'Information We Collect',
    content: [
      {
        heading: 'Account Information',
        body: 'When you create an account we collect your email address, display name, and password. If you connect your DUPR account we also store your DUPR ID, DUPR rating, singles rating, and doubles rating.',
      },
      {
        heading: 'Usage Data',
        body: 'We automatically collect information about how you interact with the platform, including tournament registrations, league participations, match scores, and session history. This data is used solely to operate the service.',
      },
      {
        heading: 'Device & Technical Data',
        body: 'We may collect browser type, operating system, IP address, and similar technical identifiers to ensure security and performance of the platform.',
      },
    ],
  },
  {
    title: 'How We Use Your Information',
    content: [
      {
        heading: 'Operating the Platform',
        body: 'Your information is used to provide and improve the NTWRK service — including scheduling matches, calculating standings, displaying ratings, and managing tournament and league registration.',
      },
      {
        heading: 'Communications',
        body: 'We may send you transactional emails such as password reset instructions and account notifications. We do not send unsolicited marketing emails.',
      },
      {
        heading: 'DUPR Integration',
        body: 'If you connect your DUPR account, your DUPR credentials are used only to fetch your rating data and submit match results on your behalf through the DUPR API. We do not store your DUPR password.',
      },
    ],
  },
  {
    title: 'Information Sharing',
    content: [
      {
        heading: 'Public Profile Data',
        body: 'Your display name and DUPR rating may be visible to other users of the platform within tournament and league contexts. We do not sell, rent, or trade your personal information to third parties.',
      },
      {
        heading: 'Service Providers',
        body: 'We use Supabase for database hosting and authentication. These providers process your data on our behalf under strict confidentiality obligations.',
      },
      {
        heading: 'Legal Requirements',
        body: 'We may disclose your information if required by law, court order, or to protect the rights, property, or safety of NTWRK, our users, or the public.',
      },
    ],
  },
  {
    title: 'Data Security',
    content: [
      {
        heading: 'Encryption',
        body: 'All data is transmitted over HTTPS. Passwords are hashed and never stored in plain text. Authentication is managed through Supabase Auth using industry-standard security practices.',
      },
      {
        heading: 'Access Controls',
        body: 'We use Row Level Security (RLS) policies on our database to ensure users can only access data they are authorized to view. Administrative access is strictly limited.',
      },
      {
        heading: 'Incident Response',
        body: 'In the event of a data breach we will notify affected users promptly and take all necessary steps to mitigate the impact.',
      },
    ],
  },
  {
    title: 'Your Rights',
    content: [
      {
        heading: 'Access & Correction',
        body: 'You can view and update your profile information at any time from your account settings page, including your display name and connected DUPR account.',
      },
      {
        heading: 'Account Deletion',
        body: 'You may delete your account at any time from the Account Settings section of your profile. When you delete your account, your profile is permanently deactivated and you will no longer be able to log in. Match history and standings data associated with your account may be retained in anonymized form for record-keeping purposes.',
      },
      {
        heading: 'Data Portability',
        body: 'You may request a copy of your personal data by contacting us at the email address below. We will provide your data in a machine-readable format within 30 days.',
      },
    ],
  },
  {
    title: 'Cookies & Tracking',
    content: [
      {
        heading: 'Session Cookies',
        body: 'We use essential session cookies to keep you logged in. These are strictly necessary for the platform to function and cannot be disabled while using the service.',
      },
      {
        heading: 'No Third-Party Tracking',
        body: 'We do not use third-party advertising cookies, cross-site tracking pixels, or analytics platforms that share your data with external advertisers.',
      },
    ],
  },
  {
    title: 'Changes to This Policy',
    content: [
      {
        heading: 'Updates',
        body: 'We may update this Privacy Policy from time to time. When we do, we will revise the "Last Updated" date at the top of this page. Continued use of the platform after changes constitutes acceptance of the revised policy.',
      },
    ],
  },
  {
    title: 'Contact Us',
    content: [
      {
        heading: 'Questions or Concerns',
        body: 'If you have any questions about this Privacy Policy or our data practices, please contact us at privacy@ntwrkpickleball.com. We will respond within 5 business days.',
      },
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      {/* Mobile bottom decoration */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[270px] block md:hidden">
        <svg
          viewBox="0 0 1000 300"
          className="absolute bottom-0 left-[-20px] w-[140%] h-[250px]"
          preserveAspectRatio="none"
        >
          <line x1="0" y1="280" x2="1000" y2="20" stroke="black" strokeWidth="20" strokeLinecap="square" />
          <line x1="600" y1="300" x2="450" y2="167" stroke="black" strokeWidth="20" strokeLinecap="square" />
        </svg>
      </div>

      {/* Desktop bottom-right decoration */}
      <div className="pointer-events-none absolute bottom-0 right-0 w-[500px] h-[200px] hidden md:block">
        <svg
          viewBox="0 0 1000 300"
          className="w-full h-full absolute"
          preserveAspectRatio="none"
        >
          <line x1="0" y1="350" x2="1040" y2="40" stroke="black" strokeWidth="20" strokeLinecap="square" />
          <line x1="1077" y1="328" x2="621" y2="168" stroke="black" strokeWidth="20" strokeLinecap="square" />
        </svg>
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-2xl mx-auto px-10 pb-40 pt-14">

        {/* Logo */}
        <div className="flex justify-center mb-10">
          <Image
            src="/ntwrk_logo_black.png"
            alt="NTWRK"
            width={420}
            height={140}
            className="w-[260px] md:w-[320px] h-auto"
            priority
          />
        </div>

        {/* Page heading */}
        <div className="mb-10 border-b-2 border-black pb-6">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#84c225] mb-2">
            Legal
          </p>
          <h1 className="text-[22px] md:text-[28px] font-extrabold uppercase tracking-[0.14em] text-black leading-tight">
            Privacy Policy
          </h1>
          <p className="text-[11px] text-[#8b8b8b] font-extrabold uppercase tracking-[0.12em] mt-3">
            Last Updated: May 31, 2026
          </p>
        </div>

        {/* Intro */}
        <p className="text-sm text-[#8b8b8b] leading-relaxed mb-10">
          NTWRK (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) operates the NTWRK pickleball platform. This Privacy Policy explains how we collect, use, and protect your personal information when you use our service. By creating an account or using the platform, you agree to the practices described in this policy.
        </p>

        {/* Sections */}
        <div className="space-y-10">
          {sections.map((section, i) => (
            <div key={section.title}>
              {/* Section header */}
              <div className="flex items-center gap-3 mb-5">
                <span className="text-[11px] font-extrabold text-[#84c225] uppercase tracking-[0.2em]">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="flex-1 h-[2px] bg-black" />
                <h2 className="text-[13px] font-extrabold uppercase tracking-[0.18em] text-black whitespace-nowrap">
                  {section.title}
                </h2>
              </div>

              {/* Sub-items */}
              <div className="space-y-5 pl-0">
                {section.content.map((item) => (
                  <div key={item.heading}>
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-black mb-1">
                      {item.heading}
                    </p>
                    <p className="text-sm text-[#8b8b8b] leading-relaxed">
                      {item.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer links */}
        <div className="mt-14 pt-6 border-t-2 border-black flex flex-col items-center gap-4">
          <Link
            href="/login"
            className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#84c225] hover:text-[#6fa01d] transition-colors"
          >
            Back to Sign In
          </Link>
          <p className="text-[10px] text-[#8b8b8b] font-extrabold uppercase tracking-[0.12em]">
            &copy; {new Date().getFullYear()} NTWRK. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
