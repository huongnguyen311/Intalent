import { useState } from 'react';
import { BTN_PRIMARY } from '../../components/ui';
import { toast } from '../../components/Toast';
import { inPeriod, type Period } from '../../domain/taContribution';
import { assignableUsers, userName } from '../../domain/users';
import { useT } from '../../i18n/i18n';
import { me } from '../../store/session';
import { useStore } from '../../store/store';

const SELECT = 'px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-dark-line bg-white dark:bg-dark-surface text-gray-700 dark:text-gray-300';
const TH = 'px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300';

/** Owner-transfer history for the period, plus a form to move one CV to another TA. */
export function TransfersTab({ period }: { period: Period }) {
  const t = useT();
  const candidates = useStore((s) => s.candidates);
  const users = useStore((s) => s.users);
  const activities = useStore((s) => s.activities);
  const [candidateId, setCandidateId] = useState('');
  const [toId, setToId] = useState('');
  const staff = assignableUsers(users);

  const rows = activities
    .filter((a) => a.type === 'owner_transferred' && inPeriod(a, period, Date.now()))
    .sort((a, b) => b.at.localeCompare(a.at));
  const nameOf = (id?: string) => (id ? userName(users, id) : '-');
  const candidateName = (id?: string) => candidates.find((c) => c.id === id)?.name ?? '-';

  const transfer = () => {
    const res = useStore.getState().transferOwner(candidateId, toId, me());
    if (res.ok) {
      toast(t('ta.transferred'));
      setCandidateId('');
      setToId('');
    } else {
      toast(t('ta.transferFailed'), 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select aria-label={t('ta.transfer.candidate')} data-testid="ta-contribution-transfer-candidate" className={SELECT} value={candidateId} onChange={(e) => setCandidateId(e.target.value)}>
          <option value="">{t('ta.transfer.candidate')}</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>{c.name} ({nameOf(c.cvOwner) || '-'})</option>
          ))}
        </select>
        <select aria-label={t('ta.transfer.to')} data-testid="ta-contribution-transfer-to" className={SELECT} value={toId} onChange={(e) => setToId(e.target.value)}>
          <option value="">{t('ta.transfer.to')}</option>
          {staff.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
        <button data-testid="ta-contribution-transfer-button" disabled={!candidateId || !toId} onClick={transfer} className={BTN_PRIMARY}>
          {t('ta.transfer.submit')}
        </button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-dark-line">
        <table data-testid="ta-contribution-transfers-table" className="min-w-full divide-y divide-gray-200 dark:divide-dark-line text-sm">
          <thead className="bg-gray-50 dark:bg-white/5">
            <tr>
              {(['ta.transfers.time', 'ta.transfers.candidate', 'ta.transfers.from', 'ta.transfers.to', 'ta.transfers.by'] as const).map((k) => (
                <th key={k} className={TH}>{t(k)}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-dark-line bg-white dark:bg-dark-surface">
            {rows.map((a, i) => (
              <tr key={`${a.at}-${i}`}>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{new Date(a.at).toLocaleString('en-US')}</td>
                <td className="px-4 py-3 text-gray-900 dark:text-white">{candidateName(a.candidateId)}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{nameOf(a.from)}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{nameOf(a.to)}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{nameOf(a.by)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">{t('ta.transfers.empty')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
