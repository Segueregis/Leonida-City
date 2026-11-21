"use client";

import { useState } from "react";
import { brl, hostEarningPerHourBRL } from "@/lib/pricing";

export function EarningsCalculator({
  locale,
  t,
}: {
  locale: string;
  t: { calcTitle: string; calcHours: string; calcPerMonth: string; calcNote: string };
}) {
  const [hours, setHours] = useState(4);
  const monthly = hours * 30 * hostEarningPerHourBRL;

  return (
    <div className="rounded-3xl border border-line bg-panel/80 p-6 sm:p-8">
      <h3 className="font-display text-lg font-semibold text-fg">{t.calcTitle}</h3>
      <div className="mt-6 flex items-baseline justify-between gap-4">
        <label htmlFor="calc-hours" className="text-sm text-muted">
          {t.calcHours}
        </label>
        <output htmlFor="calc-hours" className="font-display text-2xl font-bold text-cyan tabular-nums">
          {hours}h
        </output>
      </div>
      <input
        id="calc-hours"
        type="range"
        min={1}
        max={16}
        value={hours}
        onChange={(e) => setHours(Number(e.target.value))}
        className="mt-3 w-full accent-pink"
      />
      <p className="mt-8 font-display text-4xl font-extrabold tabular-nums sm:text-5xl">
        <span className="bg-gradient-to-r from-sun via-pink to-purple bg-clip-text text-transparent">{brl(monthly, locale)}</span>
      </p>
      <p className="mt-1 text-sm text-muted">{t.calcPerMonth}</p>
      <p className="mt-6 text-xs text-muted/70">{t.calcNote}</p>
    </div>
  );
}
