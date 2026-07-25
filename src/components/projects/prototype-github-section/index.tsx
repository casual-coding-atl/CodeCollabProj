// PROTOTYPE — GitHub-section variant switcher + floating bottom bar.
// Mounted on the existing project page; variants gated by `?ghproto=`.
// Hidden in production builds. Delete once a variant wins.
import React, { useEffect } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import VariantA from './VariantA';
import VariantB from './VariantB';
import VariantC from './VariantC';

const VARIANTS = [
  { key: 'A', name: 'Cards + merged feed', Component: VariantA },
  { key: 'B', name: 'Per-repo panels', Component: VariantB },
  { key: 'C', name: 'Activity-first', Component: VariantC },
] as const;

const PrototypeGithubSection: React.FC = () => {
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const navigate = useNavigate();

  const idx = Math.max(
    0,
    VARIANTS.findIndex((v) => v.key === search.ghproto),
  );
  const { name, Component } = VARIANTS[idx];

  const go = (delta: number): void => {
    const next = VARIANTS[(idx + delta + VARIANTS.length) % VARIANTS.length].key;
    void navigate({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      search: (prev: any) => ({ ...prev, ghproto: next }),
      replace: true,
    } as never);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (import.meta.env.PROD) return null;

  return (
    <>
      <div>
        <p className="mb-3 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          <span className="text-brand-amber">//</span> github
        </p>
        <Component />
      </div>

      <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-background/95 px-2 py-1 shadow-lg backdrop-blur">
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="Previous variant"
          className="rounded-full p-1.5 hover:bg-muted"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="min-w-44 text-center font-mono text-xs">
          <span className="text-brand-amber">PROTO</span> {VARIANTS[idx].key} — {name}
        </span>
        <button
          type="button"
          onClick={() => go(1)}
          aria-label="Next variant"
          className="rounded-full p-1.5 hover:bg-muted"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </>
  );
};

export default PrototypeGithubSection;
