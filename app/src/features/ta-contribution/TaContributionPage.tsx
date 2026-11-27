import { useMemo, useState } from 'react';
import { AppLayout } from '../../components/AppLayout';
import { BTN_GHOST } from '../../components/ui';
import { downloadCsv } from '../../components/download';
import { toast } from '../../components/Toast';
import { toCsv } from '../../domain/csv';
import { taContribution, UNATTRIBUTED, type Period, type Preset, type TaRow } from '../../domain/taContribution';
import { localStamp } from '../../domain/hiring';
import { useT, type TKey } from '../../i18n/i18n';
import { useStore } from '../../store/store';
import { TransfersTab } from './TransfersTab';

type Tab = 'contribution' | 'transfers';

const RANGES: Array<{ id: Preset | 'custom'; label: TKey }> = [
  { id: 'day', label: 'ta.range.day' },
  { id: 'week', label: 'ta.range.week' },
  { id: '3m', label: 'ta.range.3m' },
  { id: '6m', label: 'ta.range.6m' },
  { id: 'all', label: 'ta.range.all' },
  { id: 'custom', label: 'ta.range.custom' },
];
const RANGE_SELECT = 'h-9 rounded-lg border border-gray-200 dark:border-dark-line bg-white dark:bg-dark-surface pl-3 pr-9 text-sm text-gray-700 dark:text-gray-300';
const TAB_ON = 'ui-tab px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors border-primary text-primary';
const TAB_OFF = 'ui-tab px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200';
const TH = 'px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-300';

const plus = (n: number) => (n > 0 ? `+${n}` : '0');
const minus = (n: number) => (n > 0 ? `−${n}` : '0');
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');


export function TaContributionPage() {
  const t = useT();
  const users = useStore((s) => s.users);
  const activities = useStore((s) => s.activities);
  const fixture = useStore((s) => s.meta?.totals?.taContribution);
  const [period, setPeriod] = useState<Period>('all');
  const [tab, setTab] = useState<Tab>('contribution');

  // The mockup's figures (hundreds of CVs) cannot come from the 10 listed candidates, so the fixture carries them.
  const { rows, totals } = useMemo((): { rows: TaRow[]; totals: TaRow } => {
    if (fixture) {
      const map = (r: (typeof fixture.rows)[number]): TaRow => ({
        ta: r.name, newCv: r.newCv, duplicate: r.duplicateUploads, parseError: r.parseFailed,
        processing: r.processing, transferIn: r.received, transferOut: r.transferredOut, total: r.total,
      });
      return { rows: fixture.rows.map(map), totals: map(fixture.totals) };
    }
    return taContribution({ users, activities }, period);
  }, [fixture, users, activities, period]);

  const exportCsv = () => {
    const header = (r: TaRow) => ({
      [t('ta.col.ta')]: r.ta,
      [t('ta.col.newCv')]: r.newCv,
      [t('ta.col.duplicate')]: r.duplicate,
      [t('ta.col.parseError')]: r.parseError,
      [t('ta.col.processing')]: r.processing,
      [t('ta.col.transferIn')]: r.transferIn,
      [t('ta.col.transferOut')]: r.transferOut,
      [t('ta.col.total')]: r.total,
    });
    downloadCsv('cv-theo-ta.csv', toCsv([...rows, totals].map(header)));
    toast(t('ta.exported'));
  };

  return (
    <AppLayout title={t('nav.cvByTa')} subtitle={t('ta.subtitle')}>
      <div className="p-8 max-w-[1400px] mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-end gap-4">
          <div className="flex items-center gap-3">
            <select
              aria-label={t('ta.period')}
              data-testid="ta-contribution-range"
              className={RANGE_SELECT}
              value={typeof period === 'object' ? 'custom' : period}
              onChange={(e) => {
                const v = e.target.value as Preset | 'custom';
                const today = localStamp(new Date()).slice(0, 10);
                setPeriod(v === 'custom' ? { from: today, to: today } : v);
              }}
            >
              {RANGES.map((r) => <option key={r.id} value={r.id}>{t(r.label)}</option>)}
            </select>
            {typeof period === 'object' && (
              <div className="flex items-center gap-2">
                <input type="date" data-testid="ta-contribution-range-from" aria-label={t('ta.range.from')} className={RANGE_SELECT} value={period.from} max={period.to || undefined}
                  onChange={(e) => setPeriod({ ...period, from: e.target.value })} />
                <span aria-hidden="true" className="text-sm text-gray-400 dark:text-gray-500">–</span>
                <input type="date" data-testid="ta-contribution-range-to" aria-label={t('ta.range.to')} className={RANGE_SELECT} value={period.to} min={period.from || undefined}
                  onChange={(e) => setPeriod({ ...period, to: e.target.value })} />
              </div>
            )}
            <button data-testid="ta-contribution-export-button" disabled={rows.length === 0} onClick={exportCsv} className={`${BTN_GHOST} inline-flex items-center gap-1.5`}>
              {t('ta.export')}
            </button>
          </div>
        </div>
        <div role="tablist" className="ui-tabs flex gap-1 border-b border-gray-200 dark:border-dark-line">
          <button data-testid="ta-contribution-tab-contribution" role="tab" aria-selected={tab === 'contribution'} onClick={() => setTab('contribution')} className={tab === 'contribution' ? TAB_ON : TAB_OFF}><span aria-hidden="true" className="material-symbols-outlined">leaderboard</span>{t('ta.tab.contribution')}</button>
          <button data-testid="ta-contribution-tab-transfers" role="tab" aria-selected={tab === 'transfers'} onClick={() => setTab('transfers')} className={tab === 'transfers' ? TAB_ON : TAB_OFF}><span aria-hidden="true" className="material-symbols-outlined">swap_horiz</span>{t('ta.tab.transfers')}</button>
        </div>
        {tab === 'transfers' ? (
          <TransfersTab period={period} />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-dark-line">
            <table data-testid="ta-contribution-table" className="min-w-full divide-y divide-gray-200 dark:divide-dark-line text-sm">
              <thead className="bg-gray-50 dark:bg-white/5">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">{t('ta.col.ta')}</th>
                  <th className={TH}>{t('ta.col.newCv')}</th>
                  <th className={TH}>{t('ta.col.duplicate')}</th>
                  <th className={TH}>{t('ta.col.parseError')}</th>
                  <th className={TH}>{t('ta.col.processing')}</th>
                  <th className={TH} title={t('ta.tip.transferIn')}>{t('ta.col.transferIn')}</th>
                  <th className={TH} title={t('ta.tip.transferOut')}>{t('ta.col.transferOut')}</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white" title={t('ta.tip.total')}>{t('ta.col.total')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-dark-line bg-white dark:bg-dark-surface">
                {rows.map((r) => {
                  const unattributed = r.ta === UNATTRIBUTED;
                  return (
                    <tr key={r.ta} data-testid={`ta-contribution-row-${unattributed ? 'unattributed' : slug(r.ta)}`} className={unattributed ? 'bg-gray-50 dark:bg-white/5' : ''}>
                      <td className="px-4 py-3 text-gray-900 dark:text-white">
                        {unattributed ? <span className="text-gray-500 dark:text-gray-400 italic">{r.ta}</span> : r.ta}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">{r.newCv}</td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{r.duplicate}</td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{r.parseError}</td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{r.processing}</td>
                      <td className="px-4 py-3 text-right text-emerald-700 dark:text-emerald-400">{plus(r.transferIn)}</td>
                      <td className="px-4 py-3 text-right text-amber-700 dark:text-amber-400">{minus(r.transferOut)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">{r.total}</td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">{t('ta.empty')}</td></tr>
                )}
              </tbody>
              <tfoot className="bg-gray-50 dark:bg-white/5 font-medium">
                <tr>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{t('ta.col.total')}</td>
                  <td className="px-4 py-3 text-right text-gray-900 dark:text-white">{totals.newCv}</td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{totals.duplicate}</td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{totals.parseError}</td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{totals.processing}</td>
                  <td className="px-4 py-3 text-right text-emerald-700 dark:text-emerald-400">{plus(totals.transferIn)}</td>
                  <td className="px-4 py-3 text-right text-amber-700 dark:text-amber-400">{minus(totals.transferOut)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">{totals.total}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
