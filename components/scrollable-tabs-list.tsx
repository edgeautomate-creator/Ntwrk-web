'use client';

import { useCallback, useEffect, useRef, useState, Children, cloneElement, isValidElement } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { TabsList } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ScrollableTabsListProps {
  children: React.ReactNode;
  /** Grid classes applied at sm+ breakpoint, e.g. "sm:grid-cols-5" */
  desktopClassName?: string;
  className?: string;
}

export function ScrollableTabsList({ children, desktopClassName, className }: ScrollableTabsListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const childCount = Children.count(children);
  const isScrollable = childCount > 3;

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
  }, [childCount, updateScrollState]);

  const scrollByAmount = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const tabWidth = el.clientWidth / 3;
    el.scrollBy({ left: direction === 'left' ? -tabWidth : tabWidth, behavior: 'smooth' });
  };

  const tabsWithMobileWidth = Children.map(children, (child) => {
    if (!isValidElement(child)) return child;
    return cloneElement(child, {
      className: cn(
        child.props.className,
        isScrollable
          ? 'w-[calc(100%/var(--tab-count))] shrink-0 sm:w-auto sm:shrink'
          : 'flex-1 sm:flex-none'
      ),
    } as React.Attributes);
  });

  return (
    <div className={cn('relative flex w-full items-center gap-1 sm:block', className)}>
      {isScrollable && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0 sm:hidden"
          onClick={() => scrollByAmount('left')}
          disabled={!canScrollLeft}
          aria-label="Scroll tabs left"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}

      <div
        ref={scrollRef}
        className="min-w-0 flex-1 overflow-x-auto scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] sm:overflow-visible sm:w-full [&::-webkit-scrollbar]:hidden"
      >
        <TabsList
          className={cn(
            'inline-flex h-10 flex-nowrap justify-start p-1',
            isScrollable ? 'w-[calc(100%*var(--tab-count)/3)]' : 'w-full',
            'sm:grid sm:w-full',
            desktopClassName
          )}
          style={{ '--tab-count': childCount } as React.CSSProperties}
        >
          {tabsWithMobileWidth}
        </TabsList>
      </div>

      {isScrollable && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0 sm:hidden"
          onClick={() => scrollByAmount('right')}
          disabled={!canScrollRight}
          aria-label="Scroll tabs right"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
