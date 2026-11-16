import { Link } from 'react-router-dom';
import { Chip } from '../../components/Chip';
import { stageLabel } from '../../domain/stages';
import { userName } from '../../domain/users';
import { useLang, useT, type TKey } from '../../i18n/i18n';
import { useStore } from '../../store/store';

const COLUMNS = ['job', 'stage', 'source', 'via', 'addedBy', 'addedAt'] as const;

/** Every Application of a candidate: job (linked to its pipeline), stage, source, via, who added it and when. */
export function UsedIn({ candidateId }: { candidateId: string }) {
  const t = useT();
  const [lang] = useLang();
  const applications = useStore((s) => s.applications);
  const jobs = useStore((s) => s.jobs);
  const users = useStore((s) => s.users);
  const rows = applications
    .filter((a) => a.candidateId === candidateId)
    .sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  return (
    <section aria-label={t('profile.section.usedIn')}>
      <h3 className="text-sm font-bold text-[#896a61] uppercase tracking-wider mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-[18px]">account_tree</span> {t('profile.section.usedIn')}
      </h3>
      {rows.length === 0 ? (
        <p className="text-sm text-[#896a61]">{t('profile.usedIn.empty')}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#e6dddb] dark:border-[#3a3433]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#f8f6f6] dark:bg-[#251f1e] text-xs font-bold text-[#896a61] uppercase tracking-wider">
              <tr>
                {COLUMNS.map((k) => (
                  <th key={k} className="px-3 py-2">{t(`profile.usedIn.${k}` as TKey)}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f4f1f0] dark:divide-[#2a2423]">
              {rows.map((a) => (
                <tr key={a.id} data-testid={`used-in-${a.jobId}`}>
                  <td className="px-3 py-2">
                    <Link className="font-semibold text-primary hover:underline" to={`/pipeline/${a.jobId}`}>
                      {jobs.find((j) => j.id === a.jobId)?.title ?? a.jobId}
                    </Link>
                  </td>
                  <td className="px-3 py-2"><Chip>{stageLabel(a.stage, lang)}</Chip></td>
                  <td className="px-3 py-2">{a.source}</td>
                  <td className="px-3 py-2">{t(`via.${a.via}` as TKey)}</td>
                  <td className="px-3 py-2">{userName(users, a.addedBy)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-[#896a61]">{a.addedAt.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
