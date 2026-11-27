import { useMemo } from 'react';
import { userName } from '../../domain/users';
import { useT } from '../../i18n/i18n';
import { useStore } from '../../store/store';

const fmt = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
};

/** Everything logged about this candidate (created, merged, owner change, emails, stages…), newest first. */
export function ActivityHistory({ candidateId }: { candidateId: string }) {
  const t = useT();
  const activities = useStore((s) => s.activities);
  const users = useStore((s) => s.users);
  const rows = useMemo(
    () =>
      activities
        .map((a, i) => ({ a, i }))
        .filter(({ a }) => a.candidateId === candidateId)
        .sort((x, y) => y.a.at.localeCompare(x.a.at) || y.i - x.i)
        .map(({ a }) => a),
    [activities, candidateId],
  );
  return (
    <section aria-label={t('profile.section.activity')}>
      <h3 className="text-base font-semibold text-ink dark:text-white mb-5 flex items-center gap-2">
        <span className="material-symbols-outlined text-[20px] text-primary">history</span> {t('profile.section.activity')}
      </h3>
      {rows.length === 0 ? (
        <p className="text-sm text-ink-muted">{t('profile.activity.empty')}</p>
      ) : (
        <ol className="relative border-l border-line dark:border-dark-line ml-2 space-y-4">
          {rows.map((a, i) => (
            <li key={`${a.at}-${i}`} className="pl-4 relative">
              <span className="absolute -left-[5px] top-1.5 size-2.5 rounded-full bg-primary/70" />
              <p className="text-sm text-ink dark:text-white">{a.detail}</p>
              <p className="text-xs text-ink-muted">{userName(users, a.by) || a.by} · {fmt(a.at)}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
