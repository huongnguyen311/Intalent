import { useState } from 'react';
import type { DashboardMetrics } from '../../domain/metrics';
import { DEFAULT_PIPELINE, FIXED_START } from '../../domain/pipelineConfig';
import { stageLabel } from '../../domain/stages';
import type { Stage } from '../../domain/types';
import { useLang, useT } from '../../i18n/i18n';
import { CAPTION } from './DashboardWidgets';

type Step = { stage: Stage; reached: number; pass?: number };

const pct = (n: number, of: number) => (of ? Math.round((100 * n) / of) : 0);
const CORE = new Set<Stage>([...FIXED_START, ...DEFAULT_PIPELINE, 'hired']);
/**
 * Most tiers the funnel shape takes before they get too thin to read (each tier is a 44px row).
 * Past that (all optional stages on, or job-specific custom columns) the funnel switches to plain rows.
 */
export const MAX_BARS = 8;

/**
 * The steps worth drawing: the default pipeline always, an optional stage (AI Screening, Assessment)
 * only when someone actually stopped there. Skipping counts as passing through, so a stage nobody
 * stopped at carries the same count as the step after it and would only add a 100% step.
 */
function stepsOf(funnel: DashboardMetrics['recruitment']['funnel']): Step[] {
  const kept = funnel.filter((f, i) => CORE.has(f.stage) || f.reached !== funnel[i + 1]?.reached);
  return kept.map((f, i) => {
    const next = kept[i + 1];
    return { ...f, pass: next && f.reached ? pct(next.reached, f.reached) : undefined };
  });
}

/** Tier width in % of the track: never below a sliver, so the last stages stay visible. */
const MIN_WIDTH = 14;
const widthOf = (share: number) => MIN_WIDTH + (100 - MIN_WIDTH) * share;

type Rgb = [number, number, number];
/**
 * Soft coral at the top, easing to peach at the bottom: still the brand's warm family, but muted so a
 * large shape does not shout. Light tiers print their count in dark text instead of white (see inkOf).
 */
const FROM: Rgb = [232, 112, 78];
const TO: Rgb = [253, 214, 194];
/** White on the deeper tiers, a deep warm brown on the light ones, whichever reads better. */
function inkOf([r, g, b]: Rgb): string {
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum < 0.62 ? '#ffffff' : '#7c2d12';
}
function tierRgb(i: number, n: number): Rgb {
  const k = n > 1 ? i / (n - 1) : 0;
  return FROM.map((f, j) => Math.round(f + (TO[j] - f) * k)) as Rgb;
}
/** Mix towards black (amount < 0) or white (amount > 0). */
const shade = (c: Rgb, amount: number): Rgb =>
  c.map((v) => Math.round(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount)) as Rgb;
const rgb = ([r, g, b]: Rgb) => `rgb(${r},${g},${b})`;

/**
 * Conversion funnel: a summary line (overall hire rate, biggest drop), then the classic funnel shape.
 * One tier per stage, centred, each a trapezoid from its own width down to the next stage's width,
 * so the tiers join into one narrowing shape. Name and the share that moved on sit left;
 * count and share of the top sit right. The weakest step is called out in red.
 * Narrow screens, or more stages than fit, get the same data as a list of rows.
 */
export function Funnel({ funnel }: { funnel: DashboardMetrics['recruitment']['funnel'] }) {
  const t = useT();
  const [lang] = useLang();
  // Hovering a tier lifts it and fades the rest, so one stage can be read on its own.
  const [hover, setHover] = useState<number>();
  const steps = stepsOf(funnel);
  const top = steps[0]?.reached ?? 0;
  if (top === 0) return <p className={CAPTION}>{t('dashboard.noApplications')}</p>;

  const hired = steps[steps.length - 1].reached;
  const weakest = steps.reduce<Step | undefined>((low, s) => (s.pass !== undefined && (low?.pass === undefined || s.pass < low.pass) ? s : low), undefined);
  const after = (s: Step) => steps[steps.indexOf(s) + 1];
  const label = (s: Stage) => stageLabel(s, lang);
  const h = (n: number) => `${Math.max(2, (100 * n) / top)}%`;
  const bars = steps.length <= MAX_BARS;

  return (
    <div>
      {/* Two headline numbers on one line, split by a hairline: no boxes, so the chart stays the focus. */}
      <dl className="flex flex-wrap items-stretch gap-x-8 gap-y-3">
        <div>
          <dt className={CAPTION}>{t('dashboard.funnelOverall')}</dt>
          <dd className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold tabular-nums text-slate-900 dark:text-white">{pct(hired, top)}%</span>
            <span className="text-xs text-muted">{t('dashboard.funnelOverallHint', { hired, total: top })}</span>
          </dd>
        </div>
        {weakest && (
          <div className="border-l border-hairline pl-8 dark:border-white/10" data-testid="funnel-weakest">
            <dt className="flex items-center gap-1 text-xs text-red-700 dark:text-red-300">
              <span aria-hidden="true" className="material-symbols-outlined text-[16px]">trending_down</span>
              {t('dashboard.funnelDrop')}
            </dt>
            <dd className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold tabular-nums text-red-700 dark:text-red-300">{weakest.pass}%</span>
              <span className="truncate text-xs text-muted">
                {label(weakest.stage)} → {label(after(weakest).stage)}
              </span>
            </dd>
          </div>
        )}
      </dl>

      {/* Wide, up to MAX_BARS stages: the funnel shape, one tier per stage. */}
      {bars && (
        <ol data-testid="funnel-bars" className="mt-6 hidden space-y-1 sm:block" aria-label={t('dashboard.funnel')} onMouseLeave={() => setHover(undefined)}>
          {steps.map((s, i) => {
            const w = widthOf(s.reached / top);
            const next = steps[i + 1];
            // The last tier keeps its own width at the bottom instead of narrowing further.
            const wNext = next ? widthOf(next.reached / top) : w;
            const weak = s === weakest;
            const [r, g, b] = tierRgb(i, steps.length);
            const dim = hover !== undefined && hover !== i ? 'opacity-40' : '';
            return (
              <li
                key={s.stage}
                onMouseEnter={() => setHover(i)}
                className="grid h-12 grid-cols-[136px_minmax(0,1fr)_104px] items-center gap-4"
                title={`${label(s.stage)}: ${s.reached} (${pct(s.reached, top)}%)`}
              >
                <span className={`min-w-0 transition-opacity ${dim}`}>
                  <span className="block truncate text-sm font-semibold text-slate-800 dark:text-gray-100">{label(s.stage)}</span>
                  {s.pass !== undefined && (
                    <span
                      className={`block truncate text-[11px] tabular-nums ${weak ? 'font-semibold text-red-700 dark:text-red-300' : 'text-muted'}`}
                      title={t('dashboard.funnelStep', { pct: s.pass, from: label(s.stage), to: label(after(s).stage) })}
                    >
                      ↓ {t('dashboard.movedOn', { pct: s.pass })}
                    </span>
                  )}
                </span>

                {/* The shadow sits on a wrapper: a clip-path would cut off a shadow drawn by the tier itself. */}
                <span
                  className={`block h-full transition-[opacity,transform] duration-200 ${dim} ${hover === i ? 'scale-[1.03]' : ''}`}
                  style={{ filter: `drop-shadow(0 6px 10px rgba(${r},${g},${b},0.2))` }}
                >
                  <span
                    className="funnel-tier relative flex h-full items-center justify-center"
                    style={{
                      animationDelay: `${i * 70}ms`,
                      // A sheen across the tier (darker edges, lighter middle) gives it a little depth.
                      background: `linear-gradient(90deg, ${rgb(shade([r, g, b], -0.07))} 0%, ${rgb([r, g, b])} 28%, ${rgb(shade([r, g, b], 0.14))} 50%, ${rgb([r, g, b])} 72%, ${rgb(shade([r, g, b], -0.07))} 100%)`,
                      clipPath: `polygon(${50 - w / 2}% 0, ${50 + w / 2}% 0, ${50 + wNext / 2}% 100%, ${50 - wNext / 2}% 100%)`,
                    }}
                  >
                    <b className="text-base font-bold tabular-nums" style={{ color: inkOf([r, g, b]) }}>{s.reached}</b>
                  </span>
                </span>

                <span className={`text-right tabular-nums transition-opacity ${dim}`}>
                  <span className="block text-sm font-bold text-slate-900 dark:text-white">
                    {pct(s.reached, top)}% <span className="text-[11px] font-normal text-muted">{t('dashboard.ofTop')}</span>
                  </span>
                  {next && (
                    <span className={`block text-[11px] ${weak ? 'font-semibold text-red-700 dark:text-red-300' : 'text-muted'}`}>
                      {t('dashboard.dropped', { n: s.reached - next.reached })}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {/* Narrow screens, or more stages than the shape can hold: a row per stage, with the share that moved on to the next. */}
      <ol data-testid="funnel-rows" className={`mt-5 space-y-3 ${bars ? 'sm:hidden' : ''}`}>
        {steps.map((s) => (
          <li key={s.stage}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate text-slate-600 dark:text-gray-300">{label(s.stage)}</span>
              <span className="shrink-0 tabular-nums">
                <b className="text-slate-900 dark:text-white">{s.reached}</b>
                {s.pass !== undefined && (
                  <span className={`ml-2 text-xs ${s === weakest ? 'font-semibold text-red-700 dark:text-red-300' : 'text-muted'}`}>→ {s.pass}%</span>
                )}
              </span>
            </div>
            <div className="mt-1.5 h-2 rounded bg-slate-100 dark:bg-white/10">
              <div className="h-2 rounded bg-primary" style={{ width: h(s.reached) }} />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
