import type { ReactNode } from 'react';

type SectionProps = {
  step: string;
  title: string;
  lede: string;
  children: ReactNode;
};

export function Section({ step, title, lede, children }: SectionProps) {
  return (
    <section className="scroll-mt-8">
      <div className="mb-4 border-b border-stone-200 pb-3">
        <p className="font-mono text-[11px] tracking-widest text-stone-400 uppercase">{step}</p>
        <h2 className="mt-1 text-lg font-semibold text-stone-900">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-stone-600">{lede}</p>
      </div>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}
