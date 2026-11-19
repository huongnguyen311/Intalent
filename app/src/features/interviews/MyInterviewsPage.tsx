import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { Avatar, toneFor } from '../../components/Avatar';
import { interviewTime, localStamp } from '../../domain/hiring';
import type { Application, Interview, Job } from '../../domain/types';
import { useT } from '../../i18n/i18n';
import { useMe } from '../../store/session';
import { useStore } from '../../store/store';
import { Pill } from '../hiring/ui';
import { ApplicationDrawer } from '../pipeline/ApplicationDrawer';
import { JobStageProvider } from '../pipeline/jobStageContext';
import { useStageMove } from '../pipeline/useStageMove';

type Row = { iv: Interview; app: Application; job?: Job; name: string; title: string };

const MODE_ICON = { online: 'videocam', onsite: 'apartment', phone: 'call' } as const;

/** Every interview the signed-in user sits on: upcoming first, then past; a row opens the application. */
export function MyInterviewsPage() {
  const t = useT();
  const user = useMe();
  const applications = useStore((s) => s.applications);
  const candidates = useStore((s) => s.candidates);
  const jobs = useStore((s) => s.jobs);
  const [params] = useSearchParams();
  const [open, setOpen] = useState<{ appId: string; job: Job } | null>(() => {
    // `?app=<id>` (from the to-do list) opens that application.
    const id = params.get('app');
    const s = useStore.getState();
    const app = id ? s.applications.find((a) => a.id === id) : undefined;
    const job = app && s.jobs.find((j) => j.id === app.jobId);
    return app && job ? { appId: app.id, job } : null;
  });
  // Same move flow as the pipeline (note dialog, permission check, toast), so "Move to…" here really moves.
  const { move, dialog } = useStageMove();

  const rows = useMemo(() => {
    const out: Row[] = [];
    for (const app of applications) {
      for (const iv of app.interviews ?? []) {
        if (!iv.interviewers.includes(user.id) || iv.status === 'cancelled') continue;
        const c = candidates.find((x) => x.id === app.candidateId);
        out.push({ iv, app, job: jobs.find((j) => j.id === app.jobId), name: c?.name ?? app.candidateId, title: c?.title ?? '' });
      }
    }
    return out;
  }, [applications, candidates, jobs, user.id]);

  const now = localStamp(new Date());
  const upcoming = rows.filter((r) => r.iv.status === 'scheduled' && r.iv.at >= now).sort((a, b) => a.iv.at.localeCompare(b.iv.at));
  const past = rows.filter((r) => !upcoming.includes(r)).sort((a, b) => b.iv.at.localeCompare(a.iv.at));

  const table = (title: string, list: Row[], empty: string) => (
    <section className="bg-white dark:bg-surface-dark rounded-2xl border border-gray-100 dark:border-white/10 shadow-sm overflow-hidden">
      <h2 className="ty-section px-6 py-4 text-sm font-bold text-slate-800 dark:text-white border-b border-[#f4f1f0] dark:border-[#2a2423]">
        {title} <span className="text-[#896a61] font-medium">({list.length})</span>
      </h2>
      {list.length === 0 ? (
        <p className="px-6 py-8 text-sm text-[#896a61] text-center">{empty}</p>
      ) : (
        <ul className="divide-y divide-[#f4f1f0] dark:divide-[#2a2423]">
          {list.map(({ iv, app, job, name, title: role }) => {
            const scored = iv.scorecards.some((c) => c.by === user.id);
            const due = iv.status !== 'scheduled' || iv.at < now;
            return (
              <li key={iv.id}>
                <button
                  onClick={() => job && setOpen({ appId: app.id, job })}
                  className="w-full text-left px-6 py-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                >
                  <div className="w-44 shrink-0 text-sm font-bold text-violet-600 dark:text-violet-400">{interviewTime(iv.at)}</div>
                  <Avatar name={name} tone={toneFor(name)} small />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-slate-800 dark:text-white truncate">{name} <span className="font-medium text-[#896a61]">· {role}</span></div>
                    <div className="text-xs text-[#896a61] truncate">{job?.title} · {iv.round}</div>
                  </div>
                  <div className="hidden md:flex items-center gap-1 text-xs text-[#896a61] w-56 min-w-0">
                    <span className="material-symbols-outlined text-[16px]">{MODE_ICON[iv.mode]}</span>
                    <span className="truncate">{t(`interview.mode.${iv.mode}`)}{iv.place ? ` · ${iv.place}` : ''}</span>
                  </div>
                  <div className="w-36 text-right">
                    {scored ? <Pill tone="green">{t('myInterviews.scored')}</Pill> : due ? <Pill tone="amber">{t('myInterviews.needsScore')}</Pill> : <Pill tone="violet">{t('interview.status.scheduled')}</Pill>}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );

  return (
    <AppLayout title={t('nav.myInterviews')} subtitle={t('myInterviews.subtitle')}>
      <div className="p-8 max-w-[1200px] mx-auto space-y-6">
        {table(t('myInterviews.upcoming'), upcoming, t('myInterviews.noneUpcoming'))}
        {table(t('myInterviews.past'), past, t('myInterviews.nonePast'))}
      </div>
      {open && (
        // The job's own columns and names, so "Move to" never offers stages this job does not run.
        <JobStageProvider job={open.job}>
          <ApplicationDrawer appId={open.appId} job={open.job} onClose={() => setOpen(null)} onMove={move} />
        </JobStageProvider>
      )}
      {dialog}
    </AppLayout>
  );
}
