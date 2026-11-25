import { useMemo, useState, type ReactNode } from 'react';
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
import { InterviewCalendar, ViewSwitch, type CalRow, type InterviewView } from './InterviewCalendar';
import { JobStageProvider } from '../pipeline/jobStageContext';
import { useStageMove } from '../pipeline/useStageMove';

type Row = { iv: Interview; app: Application; job?: Job; name: string };

const MODE_ICON = { online: 'videocam', onsite: 'apartment', phone: 'call' } as const;

/**
 * Every interview the signed-in user sits on, as a list (upcoming first, then past) or a week/month calendar.
 * `?view=list|week|month` and `?d=YYYY-MM-DD` keep the choice and the shown range in the URL.
 */
export function MyInterviewsPage() {
  const t = useT();
  const user = useMe();
  const applications = useStore((s) => s.applications);
  const candidates = useStore((s) => s.candidates);
  const jobs = useStore((s) => s.jobs);
  const [params, setParams] = useSearchParams();
  const viewParam = params.get('view');
  // The calendar week is the default; `?view=month` and `?view=list` pick the others.
  const view: InterviewView = viewParam === 'month' || viewParam === 'list' ? viewParam : 'week';
  const cursor = /^\d{4}-\d{2}-\d{2}$/.test(params.get('d') ?? '') ? params.get('d')! : localStamp(new Date()).slice(0, 10);
  const setView = (v: InterviewView, d = cursor) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        n.delete('app');
        if (v === 'week') n.delete('view');
        else n.set('view', v);
        if (v === 'list') n.delete('d');
        else n.set('d', d);
        return n;
      },
      { replace: true },
    );
  const [open, setOpen] = useState<{ appId: string; job: Job; ivId?: string } | null>(() => {
    // `?app=<id>` (from the to-do list) opens that application on the user's round still waiting for their scorecard.
    const id = params.get('app');
    const s = useStore.getState();
    const app = id ? s.applications.find((a) => a.id === id) : undefined;
    const job = app && s.jobs.find((j) => j.id === app.jobId);
    const mine = (app?.interviews ?? []).filter((iv) => iv.interviewers.includes(user.id) && iv.status !== 'cancelled');
    const iv = mine.find((x) => !x.scorecards.some((c) => c.by === user.id)) ?? mine[0];
    return app && job ? { appId: app.id, job, ivId: iv?.id } : null;
  });
  // Same move flow as the pipeline (note dialog, permission check, toast), so "Move to…" here really moves.
  const { move, dialog } = useStageMove();

  const rows = useMemo(() => {
    const out: Row[] = [];
    for (const app of applications) {
      for (const iv of app.interviews ?? []) {
        if (!iv.interviewers.includes(user.id) || iv.status === 'cancelled') continue;
        const c = candidates.find((x) => x.id === app.candidateId);
        out.push({ iv, app, job: jobs.find((j) => j.id === app.jobId), name: c?.name ?? app.candidateId });
      }
    }
    return out;
  }, [applications, candidates, jobs, user.id]);

  const now = localStamp(new Date());
  const upcoming = rows.filter((r) => r.iv.status === 'scheduled' && r.iv.at >= now).sort((a, b) => a.iv.at.localeCompare(b.iv.at));
  const past = rows.filter((r) => !upcoming.includes(r)).sort((a, b) => b.iv.at.localeCompare(a.iv.at));

  const toneOf = (iv: Interview): CalRow['tone'] =>
    iv.scorecards.some((c) => c.by === user.id) ? 'green' : iv.status !== 'scheduled' || iv.at < now ? 'amber' : 'violet';

  const table = (title: string, list: Row[], empty: string, extra?: ReactNode) => (
    <section className="bg-white dark:bg-surface-dark rounded-2xl border border-[#e6dddb] dark:border-white/10 overflow-hidden">
      <div className="px-4 py-3 min-h-[57px] flex items-center gap-2 border-b border-[#f4f1f0] dark:border-[#2a2423]">
        <h2 className="ty-section text-sm font-bold text-slate-800 dark:text-white">
          {title} <span className="text-[#896a61] font-medium">({list.length})</span>
        </h2>
        {extra && <div className="ml-auto">{extra}</div>}
      </div>
      {list.length === 0 ? (
        <p className="px-4 py-8 text-sm text-[#896a61] text-center">{empty}</p>
      ) : (
        <ul className="divide-y divide-[#f4f1f0] dark:divide-[#2a2423]">
          {list.map(({ iv, app, job, name }) => {
            const scored = iv.scorecards.some((c) => c.by === user.id);
            const due = iv.status !== 'scheduled' || iv.at < now;
            // A meeting link is long and says nothing on its own; rooms and addresses are worth showing.
            const place = iv.place && !/^https?:\/\//.test(iv.place) ? ` · ${iv.place}` : '';
            return (
              <li key={iv.id}>
                <button
                  onClick={() => job && setOpen({ appId: app.id, job, ivId: iv.id })}
                  className="w-full text-left px-4 py-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                >
                  <div className="w-48 shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums text-slate-800 dark:text-white">{interviewTime(iv.at)}</div>
                  <Avatar name={name} tone={toneFor(name)} small />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-slate-800 dark:text-white truncate">{name}</div>
                    <div className="text-xs text-[#896a61] truncate">{job?.title} · {iv.round}</div>
                  </div>
                  <div className="hidden lg:flex items-center gap-1 text-xs text-[#896a61] w-40 shrink-0 min-w-0">
                    <span aria-hidden="true" className="material-symbols-outlined text-[16px]">{MODE_ICON[iv.mode]}</span>
                    <span className="truncate" title={iv.place || undefined}>{t(`interview.mode.${iv.mode}`)}{place}</span>
                  </div>
                  <div className="w-32 shrink-0 text-right">
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
      <div className="p-8 max-w-[1400px] mx-auto space-y-6 min-h-full">
        {view === 'list' ? (
          <>
            {table(t('myInterviews.upcoming'), upcoming, t('myInterviews.noneUpcoming'), <ViewSwitch view="list" onChange={setView} />)}
            {table(t('myInterviews.past'), past, t('myInterviews.nonePast'))}
          </>
        ) : (
          <InterviewCalendar
            rows={rows.map((r) => ({ ...r, tone: toneOf(r.iv) }))}
            mode={view}
            cursor={cursor}
            onCursor={(d) => setView(view, d)}
            onMode={(m, d) => setView(m, d)}
            onOpen={(r) => r.job && setOpen({ appId: r.app.id, job: r.job, ivId: r.iv.id })}
          />
        )}
      </div>
      {open && (
        // The job's own columns and names, so "Move to" never offers stages this job does not run.
        <JobStageProvider job={open.job}>
          <ApplicationDrawer appId={open.appId} job={open.job} onClose={() => setOpen(null)} onMove={move} focusInterviewId={open.ivId} />
        </JobStageProvider>
      )}
      {dialog}
    </AppLayout>
  );
}
