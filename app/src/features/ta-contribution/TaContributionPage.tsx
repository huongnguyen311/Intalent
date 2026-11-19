import { useMemo, useState } from 'react';
import { AppLayout } from '../../components/AppLayout';
import { toast } from '../../components/Toast';
import { toCsv } from '../../domain/csv';
import { taContribution, UNATTRIBUTED, type Period, type TaRow } from '../../domain/taContribution';
import { useT, type TKey } from '../../i18n/i18n';
import { useStore } from '../../store/store';
import { TransfersTab } from './TransfersTab';

type Tab = 'contribution' | 'transfers';

const RANGES: Array<{ id: Period; testId: string; label: TKey }> = [
  { id: 'day', testId: 'day', label: 'ta.range.day' },
  { id: 'week', testId: 'week', label: 'ta.range.week' },
  { id: '3m', testId: '3m', label: 'ta.range.3m' },
  { id: '6m', testId: '6m', label: 'ta.range.6m' },
  { id: 'all', testId: 'all', label: 'ta.range.all' },
];
const RANGE_ON = 'px-3 py-1.5 text-sm transition-colors bg-blue-600 text-white';
const RANGE_OFF = 'px-3 py-1.5 text-sm transition-colors bg-white text-gray-600 hover:bg-gray-50';
const TAB_ON = 'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors border-blue-600 text-blue-600';
const TAB_OFF = 'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors border-transparent text-gray-500 hover:text-gray-700';
const TH = 'px-4 py-3 text-right font-medium text-gray-600';

const plus = (n: number) => (n > 0 ? `+${n}` : '0');
const minus = (n: number) => (n > 0 ? `−${n}` : '0');
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function download(csv: string) {
  if (typeof URL.createObjectURL !== 'function') return;
  const a = document.createElement('a');
  // BOM so Excel reads the Vietnamese text as UTF-8.
  a.href = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }));
  a.download = 'cv-theo-ta.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

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
    download(toCsv([...rows, totals].map(header)));
    toast(t('ta.exported'));
  };

  return (
    <AppLayout title="">
      <div className="p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="ty-title text-2xl font-semibold text-gray-900">{t('nav.cvByTa')}</h1>
            <p className="text-sm text-gray-500 mt-1">{t('ta.subtitle')}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              {RANGES.map((r) => (
                <button key={r.id} data-testid={`ta-contribution-range-${r.testId}-button`} onClick={() => setPeriod(r.id)} className={r.id === period ? RANGE_ON : RANGE_OFF}>
                  {t(r.label)}
                </button>
              ))}
            </div>
            <button data-testid="ta-contribution-export-button" disabled={rows.length === 0} onClick={exportCsv} className="px-4 py-1.5 text-sm rounded-lg bg-gray-900 text-white disabled:opacity-40">
              {t('ta.export')}
            </button>
          </div>
        </div>
        <div className="flex gap-1 border-b border-gray-200">
          <button data-testid="ta-contribution-tab-contribution" onClick={() => setTab('contribution')} className={tab === 'contribution' ? TAB_ON : TAB_OFF}>{t('ta.tab.contribution')}</button>
          <button data-testid="ta-contribution-tab-transfers" onClick={() => setTab('transfers')} className={tab === 'transfers' ? TAB_ON : TAB_OFF}>{t('ta.tab.transfers')}</button>
        </div>
        {tab === 'transfers' ? (
          <TransfersTab period={period} />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table data-testid="ta-contribution-table" className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">{t('ta.col.ta')}</th>
                  <th className={TH}>{t('ta.col.newCv')}</th>
                  <th className={TH}>{t('ta.col.duplicate')}</th>
                  <th className={TH}>{t('ta.col.parseError')}</th>
                  <th className={TH}>{t('ta.col.processing')}</th>
                  <th className={TH} title={t('ta.tip.transferIn')}>{t('ta.col.transferIn')}</th>
                  <th className={TH} title={t('ta.tip.transferOut')}>{t('ta.col.transferOut')}</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-900" title={t('ta.tip.total')}>{t('ta.col.total')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {rows.map((r) => {
                  const unattributed = r.ta === UNATTRIBUTED;
                  return (
                    <tr key={r.ta} data-testid={`ta-contribution-row-${unattributed ? 'unattributed' : slug(r.ta)}`} className={unattributed ? 'bg-gray-50' : ''}>
                      <td className="px-4 py-3 text-gray-900">
                        {unattributed ? <span className="text-gray-500 italic">{r.ta}</span> : r.ta}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{r.newCv}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{r.duplicate}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{r.parseError}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{r.processing}</td>
                      <td className="px-4 py-3 text-right text-emerald-700">{plus(r.transferIn)}</td>
                      <td className="px-4 py-3 text-right text-amber-700">{minus(r.transferOut)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{r.total}</td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">{t('ta.empty')}</td></tr>
                )}
              </tbody>
              <tfoot className="bg-gray-50 font-medium">
                <tr>
                  <td className="px-4 py-3 text-gray-700">{t('ta.col.total')}</td>
                  <td className="px-4 py-3 text-right text-gray-900">{totals.newCv}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{totals.duplicate}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{totals.parseError}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{totals.processing}</td>
                  <td className="px-4 py-3 text-right text-emerald-700">{plus(totals.transferIn)}</td>
                  <td className="px-4 py-3 text-right text-amber-700">{minus(totals.transferOut)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{totals.total}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
