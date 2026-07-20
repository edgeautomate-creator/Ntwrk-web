'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Dumbbell, Trophy } from 'lucide-react';

export default function SelectFormatPage() {
  const router = useRouter();
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);

    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  useEffect(() => {
    if (isDesktop) {
      router.push('/dashboard/tournaments/create');
    }
  }, [isDesktop, router]);

  const handleFormatSelection = (format: 'tournament' | 'round-robin') => {
    const formatValue = format === 'tournament' ? 'group_stage_playoffs' : 'round_robin_individual';
    router.push(`/dashboard/tournaments/create?format=${formatValue}`);
  };

  if (isDesktop) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white md:hidden">
      <div className="container max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">GAME TYPE</h1>

        <div className="space-y-4">
          <button
            onClick={() => handleFormatSelection('round-robin')}
            className="w-full bg-white border-2 border-black hover:border-[#84c225] transition-all group"
          >
            <div className="bg-black text-white px-4 py-3 flex items-center gap-3">
              <Dumbbell className="h-6 w-6" />
              <span className="font-bold text-lg">STANDARD GAME</span>
            </div>
            <div className="p-4 text-left">
              <p className="text-sm text-gray-700 mb-3">
                SCHEDULE GAMES, TRACK SCORES, AND BUILD OUT YOUR LEAGUE ON THE NTWRK APP
              </p>
              <p className="text-xs text-gray-500 mb-4">
                EX: TUESDAY NIGHT PICKUP, SATURDAY DRILL SESSION, WEEKEND PRIVATE LESSON
              </p>
              <button className="w-full bg-black text-white py-3 font-bold hover:bg-gray-800 transition-colors">
                CREATE GAME
              </button>
            </div>
          </button>

          <button
            onClick={() => handleFormatSelection('tournament')}
            className="w-full bg-white border-2 border-black hover:border-[#84c225] transition-all group"
          >
            <div className="bg-[#84c225] text-white px-4 py-3 flex items-center gap-3">
              <Trophy className="h-6 w-6" />
              <span className="font-bold text-lg">TOURNAMENT</span>
            </div>
            <div className="p-4 text-left">
              <p className="text-sm text-gray-700 mb-3">
                OFFICIAL LARGE-SCALE TOURNAMENTS. RUN EACH DIVISION AUTOMATICALLY ON THE NTWRK APP
              </p>
              <p className="text-xs text-gray-500 mb-4">
                EX: CUMBERLAND SENIOR TOURNAMENT
              </p>
              <button className="w-full bg-[#84c225] text-white py-3 font-bold hover:bg-[#6fa51e] transition-colors">
                CREATE TOURNAMENT
              </button>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
