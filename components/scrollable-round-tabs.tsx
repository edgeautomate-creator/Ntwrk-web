'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ScrollableRoundTabsProps {
  rounds: string[];
  labels?: Record<string, string>;
  ariaLabel?: string;
  /** Number of incomplete / empty games per round. Badge shows when count > 0. */
  emptyCounts?: Record<string, number>;
  className?: string;
}

export function ScrollableRoundTabs({
  rounds,
  labels = {},
  ariaLabel = 'rounds',
  emptyCounts = {},
  className,
}: ScrollableRoundTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 1);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });

    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(el);

    const mutationObserver = new MutationObserver(() => {
      updateScrollState();
      const active = el.querySelector<HTMLElement>('[data-state="active"]');
      active?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
    });
    mutationObserver.observe(el, {
      attributes: true,
      attributeFilter: ['data-state'],
      subtree: true,
    });

    const active = el.querySelector<HTMLElement>('[data-state="active"]');
    active?.scrollIntoView({ inline: 'nearest', block: 'nearest' });

    return () => {
      el.removeEventListener('scroll', updateScrollState);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [rounds, updateScrollState]);

  const scrollByAmount = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = Math.max(el.clientWidth * 0.6, 120);
    el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  const showArrows = canScrollLeft || canScrollRight;

  return (
    <div className={cn('relative flex items-center gap-1', className)}>
      {showArrows && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0 md:hidden"
          onClick={() => scrollByAmount('left')}
          disabled={!canScrollLeft}
          aria-label={`Scroll ${ariaLabel} left`}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}

      {/* overflow-x-auto also clips y/x overhang; pad so badges stay fully visible */}
      <div
        ref={scrollRef}
        className="min-w-0 flex-1 overflow-x-auto py-1.5 pr-1.5 scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <TabsList className="inline-flex h-auto w-max min-w-full flex-nowrap justify-start gap-0 overflow-visible rounded-none bg-transparent p-0">
          {rounds.map((round) => {
            const emptyCount = emptyCounts[round] ?? 0;
            return (
              <TabsTrigger
                key={round}
                value={round}
                className={cn(
                  'group relative shrink-0 overflow-visible rounded-none border-r border-white/80 px-4 py-2.5 text-xs font-bold uppercase tracking-wide last:border-r-0 sm:px-6 sm:text-sm',
                  'bg-zinc-500 text-white shadow-none',
                  'hover:bg-zinc-600 hover:text-white',
                  'data-[state=active]:bg-lime-500 data-[state=active]:text-white data-[state=active]:shadow-none',
                  'focus-visible:ring-offset-0'
                )}
              >
                {labels[round] || round}
                {emptyCount > 0 && (
                  <span
                    className="absolute -right-1 -top-1 z-10 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white group-data-[state=active]:hidden"
                    aria-label={`${emptyCount} incomplete ${emptyCount === 1 ? 'game' : 'games'}`}
                  >
                    {emptyCount}
                  </span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>

      {showArrows && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0 md:hidden"
          onClick={() => scrollByAmount('right')}
          disabled={!canScrollRight}
          aria-label={`Scroll ${ariaLabel} right`}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

/** Count matches that are not completed (empty / unfinished games). */
export function getEmptyGameCounts<T extends { status?: string }>(
  matchesByRound: Record<string, T[]>
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(matchesByRound).map(([round, roundMatches]) => [
      round,
      roundMatches.filter((m) => m.status !== 'completed').length,
    ])
  );
}
