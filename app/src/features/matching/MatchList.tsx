import { pageItems } from '../../components/Pagination';
import type { ReactNode } from 'react';
import { Popover } from '../../components/Popover';
import { shortDate } from '../../domain/hiring';
import { seniorityRank } from '../../domain/filters';
import { englishRank, WEIGHTS } from '../../domain/scoring';
import { stageLabel } from '../../domain/stages';
import type { MatchRow } from '../../domain/types';
import { useLang, useT } from '../../i18n/i18n';

/**
 * Four looks, loudest first:
 * missing must-have (solid red) › missing (red outline) › has must-have (green outline, ★) › has (plain text, green ✓).
 */
function SkillChip({ label, ok, critical }: { label: string; ok: boolean; critical?: boolean }) {
  const t = useT();
  const base = 'inline-flex items-center gap-1 h-6 px-2 rounded-md text-xs whitespace-nowrap';
  const status = (
    <span className="sr-only">
      {ok ? t('matching.has') : t('matching.missing')}
      {critical ? `, ${t('matching.critical')}` : ''}:{' '}
    </span>
  );
  if (!ok && critical) {
    return (
      <span title={t('matching.missingCritical')} className={`${base} font-bold bg-red-600 text-white dark:bg-red-500`}>
        {status}
        <span aria-hidden="true" className="material-symbols-outlined text-[14px]">priority_high</span>
        {label}
      </span>
    );
  }
  if (!ok) {
    return (
      <span title={t('matching.missing')} className={`${base} font-medium border border-red-200 text-red-700 dark:border-red-500/40 dark:text-red-300`}>
        {status}
        <span aria-hidden="true">✕</span>
        {label}
      </span>
    );
  }
  if (critical) {
    return (
      <span title={t('matching.critical')} className={`${base} font-semibold border border-emerald-500 text-ink dark:border-emerald-400/70 dark:text-gray-100`}>
        {status}
        <span aria-hidden="true" className="text-amber-500">★</span>
        {label}
      </span>
    );
  }
  return (
    <span className={`${base} px-1.5 text-ink-muted`}>
      {status}
      <span aria-hidden="true" className="text-emerald-600 dark:text-emerald-400">✓</span>
      {label}
    </span>
  );
}

function DomainChip({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span className={`inline-flex items-center h-6 px-2 text-xs font-medium rounded-md whitespace-nowrap ${ok ? 'px-1.5 text-ink-muted' : 'border border-dashed border-line text-ink-muted dark:border-white/15 line-through'}`}>
      {ok && <span aria-hidden="true" className="text-emerald-600 dark:text-emerald-400">✓ </span>}
      {label}
    </span>
  );
}

export const BADGE = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap';

/** The score badge; its ⓘ opens why the candidate got this score (AI reason + points per criterion). */
function ScoreBadge({ row }: { row: MatchRow }) {
  const t = useT();
  const parts = row.breakdown
    ? ([
        ['matching.w.stack', row.breakdown.stack, WEIGHTS.stack],
        ['matching.w.exp', row.breakdown.experience, WEIGHTS.experience],
        ['matching.w.domain', row.breakdown.domain, WEIGHTS.domain],
        ['matching.w.english', row.breakdown.english, WEIGHTS.english],
      ] as const)
    : [];
  return (
    <div className="flex items-center gap-1">
      <div className="text-center leading-none">
        <div className={`text-[32px] font-black tracking-tight ${row.score >= 70 ? 'text-primary' : 'text-ink-muted'}`}><span data-testid="match-score">{row.score}</span>%</div>
        <div className="mt-1 text-2xs font-bold uppercase tracking-wide text-primary/80">{t('matching.matchScore')}</div>
      </div>
      <Popover
        align="right"
        trigger={({ toggle, open }) => (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-label={t('matching.whyScore')}
            title={t('matching.whyScore')}
            className="size-8 rounded-full flex items-center justify-center text-primary hover:bg-orange-50 dark:hover:bg-orange-500/10"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[20px]">info</span>
          </button>
        )}
      >
        {() => (
          <div className="w-72 px-4 py-3 space-y-3 text-sm">
            <p className="text-slate-700 dark:text-gray-200">
              <span aria-hidden="true" className="material-symbols-outlined text-[14px] text-primary align-middle mr-1">auto_awesome</span>
              {row.reason}
            </p>
            {parts.length > 0 && (
              <ul className="space-y-1.5">
                {parts.map(([k, got, max]) => (
                  <li key={k} className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-ink-muted">{t(k)}</span>
                    <span className="font-bold text-ink dark:text-gray-100 tabular-nums">{got}/{max}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Popover>
    </div>
  );
}

/** What the JD asks for; a card value below it is flagged. */
export interface MatchNeed {
  seniority?: string;
  years?: number;
  english?: string;
}

export const SOON_DAYS = 30;
export const STALE_DAYS = 180;
const daysFrom = (today: string, iso: string) => Math.round((Date.parse(iso.slice(0, 10)) - Date.parse(today)) / 86_400_000);

/** What on a row needs a look: values below the JD, a late start, a stale profile. */
export function flagsOf(row: MatchRow, need: MatchNeed | undefined, today: string) {
  return {
    lowSeniority: !!need?.seniority && seniorityRank(row.seniority) < seniorityRank(need.seniority),
    lowYears: !!need?.years && row.years < need.years,
    lowEnglish: !!need?.english && englishRank(row.english) < englishRank(need.english),
    startIn: row.availableFrom ? daysFrom(today, row.availableFrom) : undefined,
    staleDays: row.updatedAt ? -daysFrom(today, row.updatedAt) : 0,
  };
}

/** One cell of the info bar: small label, bold value; amber text with ⚠ when it needs a look. */
function Stat({ label, value, sub, warn, hint, muted }: { label: string; value: ReactNode; sub?: string; warn?: boolean; hint?: string; muted?: boolean }) {
  return (
    <div className="min-w-0 px-4 py-2.5" title={hint}>
      <div className={`text-2xs font-bold uppercase tracking-wider ${warn ? 'text-amber-700 dark:text-amber-400' : 'text-ink-muted'}`}>{label}</div>
      <div className={`mt-0.5 flex items-start gap-1 text-sm leading-snug ${warn ? 'font-bold text-amber-800 dark:text-amber-300' : muted ? 'text-ink-muted' : 'font-bold text-ink dark:text-gray-100'}`}>
        {warn && <span aria-hidden="true" className="material-symbols-outlined text-[16px]">warning</span>}
        <span className="min-w-0 break-words">{value}</span>
      </div>
      {sub && <div className="text-xs text-amber-700 dark:text-amber-400">{sub}</div>}
      {warn && hint && <span className="sr-only"> ({hint})</span>}
    </div>
  );
}

/** Section heading inside the card: label plus a matched/total count. */
function FitHead({ label, have, total }: { label: string; have: number; total: number }) {
  return (
    <p className="mb-2 flex items-baseline gap-2">
      <span className="text-2xs font-bold uppercase tracking-wider text-ink-muted">{label}</span>
      <span className="text-xs font-bold tabular-nums text-ink dark:text-gray-100">{have}/{total}</span>
    </p>
  );
}

/** Every skill, loudest first: missing must-have › missing › has must-have › has. */
function SkillsFit({ row }: { row: MatchRow }) {
  const t = useT();
  const crit = new Set((row.critical ?? []).map((s) => s.toLowerCase()));
  const isCrit = (s: string) => crit.has(s.toLowerCase());
  const ordered = [
    ...row.miss.filter(isCrit).map((s) => ({ s, ok: false, c: true })),
    ...row.miss.filter((s) => !isCrit(s)).map((s) => ({ s, ok: false, c: false })),
    ...row.have.filter(isCrit).map((s) => ({ s, ok: true, c: true })),
    ...row.have.filter((s) => !isCrit(s)).map((s) => ({ s, ok: true, c: false })),
  ];
  return (
    <section aria-label={t('matching.skillsCol')} className="min-w-0">
      <FitHead label={t('matching.skillsCol')} have={row.have.length} total={ordered.length} />
      <div className="flex flex-wrap gap-1.5">
        {ordered.map(({ s, ok, c }) => <SkillChip key={`${ok ? 'h' : 'm'}${s}`} label={s} ok={ok} critical={c} />)}
      </div>
    </section>
  );
}

function DomainFit({ row }: { row: MatchRow }) {
  const t = useT();
  const have = row.domainHave ?? [];
  const miss = row.domainMiss ?? [];
  return (
    <section aria-label={t('matching.domains')} className="min-w-0">
      <FitHead label={t('matching.domains')} have={have.length} total={have.length + miss.length} />
      <div className="flex flex-wrap gap-1.5">
        {have.map((d) => <DomainChip key={`h${d}`} label={d} ok />)}
        {miss.map((d) => <DomainChip key={`m${d}`} label={d} ok={false} />)}
      </div>
    </section>
  );
}

interface CardProps {
  row: MatchRow;
  onOpen: () => void;
  onAdd?: () => void;
  /** Present when the list supports bulk selection. */
  selected?: boolean;
  onSelect?: (on: boolean) => void;
  need?: MatchNeed;
  /** YYYY-MM-DD. */
  today?: string;
}

export function MatchCard({ row, onOpen, onAdd, selected, onSelect, need, today = new Date().toISOString().slice(0, 10) }: CardProps) {
  const t = useT();
  const [lang] = useLang();
  const stage = row.pipeline ? stageLabel(row.pipeline.stage, lang) : '';
  // Flagged do-not-hire or already in this JD's pipeline: nothing to add.
  const blocked = !!row.doNotHire || !!row.pipeline;
  const modes = row.workModes?.map((m) => t(`profile.workMode.${m}`)).join(' / ');
  const where = [row.location, modes, row.willingToRelocate ? t('matching.relocate') : ''].filter(Boolean).join(' · ');

  // Only values that fall short of the JD (or need a follow-up) get colour.
  const { lowSeniority, lowYears, lowEnglish, startIn, staleDays } = flagsOf(row, need, today);
  const late = startIn !== undefined && startIn > SOON_DAYS;
  const hasSkills = row.have.length + row.miss.length > 0;
  const hasDomains = (row.domainHave?.length ?? 0) + (row.domainMiss?.length ?? 0) > 0;

  return (
    <article
      data-testid="match-card"
      aria-label={row.name}
      className={`relative overflow-hidden bg-white dark:bg-dark-surface rounded-2xl border shadow-[0_1px_2px_rgba(16,24,40,0.06),0_2px_8px_rgba(16,24,40,0.06)] transition-shadow hover:shadow-[0_4px_16px_rgba(16,24,40,0.10)] ${selected ? 'border-primary ring-2 ring-primary/30' : row.doNotHire ? 'border-red-200 dark:border-red-500/30' : 'border-gray-200 dark:border-white/10'}`}
    >
      {row.doNotHire && <span aria-hidden="true" className="absolute left-0 inset-y-0 w-1 bg-red-500" />}

      <div className="px-6 py-5 grid gap-5 lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto] lg:items-center">
        {/* Who */}
        <div className="flex items-start gap-3 min-w-0">
          {onSelect && (
            <input
              type="checkbox"
              checked={!!selected}
              disabled={blocked}
              onChange={(e) => onSelect(e.target.checked)}
              aria-label={t('matching.select', { name: row.name })}
              className="mt-1.5 size-4 shrink-0 accent-[var(--color-primary,#ea580c)] disabled:opacity-40"
            />
          )}
          <div className="min-w-0 space-y-0.5">
            <button type="button" onClick={onOpen} className="block text-left text-lg font-bold leading-tight text-ink dark:text-white hover:text-primary truncate max-w-full">{row.name}</button>
            <p className="text-sm text-ink-muted truncate">{row.title}</p>
            {where && <p className="text-xs text-ink-muted truncate" title={where}>{where}</p>}
            {(row.doNotHire || row.pipeline || row.openToWork === false || staleDays > STALE_DAYS) && (
              <div className="flex flex-wrap gap-1 pt-1">
                {row.doNotHire && (
                  <span title={t('matching.dnhReason', { r: row.doNotHire })} className={`${BADGE} bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300`}>
                    <span aria-hidden="true" className="material-symbols-outlined text-[14px]">block</span>
                    {t('matching.dnh')}
                  </span>
                )}
                {row.pipeline && (
                  <span title={t('matching.inPipelineJob', { job: row.pipeline.jobTitle, stage })} className={`${BADGE} bg-blue-50 text-blue-800 dark:bg-blue-500/10 dark:text-blue-300`}>
                    {t('matching.inPipeline', { stage })}
                  </span>
                )}
                {row.openToWork === false && <span className={`${BADGE} bg-gray-100 text-ink-muted dark:bg-white/10`}>{t('matching.notOpen')}</span>}
                {staleDays > STALE_DAYS && row.updatedAt && (
                  <span title={t('matching.updated', { date: shortDate(row.updatedAt) })} className={`${BADGE} bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300`}>
                    {t('matching.stale', { n: Math.floor(staleDays / 30) })}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Info bar: four cells, divided */}
        <div className="grid grid-cols-2 sm:grid-cols-4 rounded-xl border border-hairline dark:border-white/10 overflow-hidden divide-x divide-hairline dark:divide-white/10 bg-white dark:bg-white/[0.03]">
          <Stat
            label={t('matching.stat.exp')}
            value={`${row.seniority} · ${t('matching.yrs', { n: row.years })}`}
            warn={lowSeniority || lowYears}
            hint={lowSeniority || lowYears ? t('matching.belowJd', { v: [need?.seniority, need?.years && t('matching.yrs', { n: need.years })].filter(Boolean).join(' · ') }) : undefined}
          />
          <Stat
            label={t('matching.stat.english')}
            value={row.english && row.english !== '—' ? row.english : t('matching.notStated')}
            muted={!row.english || row.english === '—'}
            warn={lowEnglish}
            hint={lowEnglish ? t('matching.belowJd', { v: need!.english! }) : undefined}
          />
          <Stat
            label={t('matching.stat.rate')}
            value={row.rate ? t('matching.rateShort', { n: row.rate.toLocaleString('en-US') }) : t('matching.contactRate')}
            muted={!row.rate}
          />
          <Stat
            label={t('matching.stat.start')}
            value={startIn === undefined ? t('matching.notStated') : startIn <= 0 ? t('matching.startNow') : shortDate(row.availableFrom!)}
            sub={late ? t('matching.inDays', { n: startIn! }) : undefined}
            muted={startIn === undefined}
            warn={late}
            hint={late ? t('matching.startLate', { n: startIn! }) : undefined}
          />
        </div>

        {/* Score and actions */}
        <div className="flex flex-wrap items-center gap-3 lg:justify-end">
          <ScoreBadge row={row} />
          <div className="flex flex-col items-stretch gap-1.5">
            <button type="button" onClick={onOpen} className="px-5 h-10 rounded-xl bg-primary text-white text-sm font-bold shadow-sm hover:brightness-110 whitespace-nowrap">
              {t('matching.viewProfile')}
            </button>
            {onAdd && !blocked && (
              <button type="button" onClick={onAdd} className="text-xs font-bold text-primary hover:underline whitespace-nowrap">
                + {t('matching.addToJob')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Fit: skills and domains, side by side and kept apart */}
      {(hasSkills || hasDomains) && (
        <div className="px-6 py-4 border-t border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/[0.02] grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)] lg:divide-x lg:divide-gray-200 dark:lg:divide-white/10">
          {hasSkills && <SkillsFit row={row} />}
          {hasDomains && <div className="lg:pl-5"><DomainFit row={row} /></div>}
        </div>
      )}
    </article>
  );
}

const NAV = 'size-8 flex items-center justify-center rounded-lg border border-line aria-disabled:opacity-40 aria-disabled:cursor-not-allowed';

export function MatchPager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const t = useT();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  return (
    <div className="px-6 py-4 flex items-center justify-between text-sm text-ink-muted border-t border-hairline">
      <span>
        {t('matching.showing')} <b className="text-ink">{from}-{Math.min(page * pageSize, total)}</b> {t('matching.of')} <b className="text-ink">{total}</b> {t('matching.matches')}
      </span>
      <div className="flex items-center gap-1">
        <button aria-label="Previous page" aria-disabled={page <= 1} onClick={() => page > 1 && onPage(page - 1)} className={NAV}>
          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">chevron_left</span>
        </button>
        {pageItems(page, pages).map((p, i) =>
          p === '...' ? (
            <span key={`gap${i}`} aria-hidden="true" className="size-8 flex items-center justify-center">…</span>
          ) : (
            <button key={p} onClick={() => onPage(p)} aria-current={p === page ? 'page' : undefined} className={p === page ? 'size-8 flex items-center justify-center rounded-lg bg-primary text-white font-bold' : NAV}>{p}</button>
          ),
        )}
        <button aria-label="Next page" aria-disabled={page >= pages} onClick={() => page < pages && onPage(page + 1)} className={NAV}>
          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">chevron_right</span>
        </button>
      </div>
    </div>
  );
}
