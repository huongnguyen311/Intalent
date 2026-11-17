import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, toneFor } from '../../components/Avatar';
import { Drawer } from '../../components/Drawer';
import { averageRating, daysInStage } from '../../domain/pipeline';
import { stageLabel } from '../../domain/stages';
import type { Application, Job, Stage } from '../../domain/types';
import { CURRENT_USER_ID, userName } from '../../domain/users';
import { useLang, useT } from '../../i18n/i18n';
import { useStore } from '../../store/store';
import { fullDate } from '../jds/format';
import { MoveToMenu } from './CandidateCard';

type Props = { appId: string | null; job: Job; onClose: () => void; onMove: (appId: string, to: Stage) => void };

const H = 'text-xs font-bold text-[#896a61] uppercase tracking-wider mb-3';
const FILLED = { fontVariationSettings: "'FILL' 1" };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="py-5 border-t border-[#f4f1f0] dark:border-[#2a2423] first:border-t-0 first:pt-0">
      <h4 className={H}>{title}</h4>
      {children}
    </section>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="flex">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={`material-symbols-outlined text-[16px] ${n <= value ? 'text-amber-400' : 'text-gray-200'}`} style={FILLED}>star</span>
      ))}
    </span>
  );
}

/** Side panel for one application: summary, quick move, ratings by the team, stage history and comments. */
export function ApplicationDrawer({ appId, job, onClose, onMove }: Props) {
  const app = useStore((s) => s.applications.find((a) => a.id === appId));
  const candidate = useStore((s) => s.candidates.find((c) => c.id === app?.candidateId));
  if (!app) return null;
  const name = candidate?.name ?? app.candidateId;
  return (
    <Drawer open title={name} onClose={onClose}>
      <DrawerBody app={app} job={job} name={name} title={candidate?.title} onMove={(to) => onMove(app.id, to)} />
    </Drawer>
  );
}

type BodyProps = { app: Application; job: Job; name: string; title?: string; onMove: (to: Stage) => void };

function DrawerBody({ app, job, name, title, onMove }: BodyProps) {
  const t = useT();
  const [lang] = useLang();
  const users = useStore((s) => s.users);
  const [comment, setComment] = useState('');
  useEffect(() => setComment(''), [app.id]);
  const who = (id: string) => userName(users, id);
  const ratings = app.ratings ?? [];
  const avg = averageRating(app);
  const mine = ratings.find((r) => r.by === CURRENT_USER_ID)?.stars ?? 0;

  const post = () => {
    if (useStore.getState().addComment(app.id, comment, CURRENT_USER_ID)) setComment('');
  };

  const facts: [string, string][] = [
    [t('pipeline.drawer.stage'), stageLabel(app.stage, lang)],
    [t('pipeline.drawer.inStage'), t('jobs.days', { n: daysInStage(app) })],
    [t('pipeline.drawer.source'), app.source],
    [t('pipeline.drawer.via'), t(`jobs.via.${app.via}`)],
    [t('pipeline.drawer.addedBy'), who(app.addedBy)],
    [t('pipeline.drawer.added'), fullDate(app.addedAt)],
  ];

  return (
    <div className="text-sm text-[#181211] dark:text-[#e6dddb]">
      <Section title={job.title}>
        <div className="flex items-center gap-3 mb-4">
          <Avatar name={name} tone={toneFor(name)} />
          <div className="flex-1 min-w-0">
            <div className="font-bold text-slate-800 dark:text-white">{name}</div>
            <div className="text-xs text-[#896a61]">{title}</div>
          </div>
          <MoveToMenu
            current={app.stage}
            onMove={onMove}
            button={(toggle) => (
              <button onClick={toggle} className="px-4 py-2 rounded-full border border-[#e6dddb] dark:border-[#3a3433] text-sm font-bold flex items-center gap-1 hover:border-primary/50 transition-colors">
                {t('pipeline.moveTo')}<span className="material-symbols-outlined text-[18px]">expand_more</span>
              </button>
            )}
          />
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-[#896a61]">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        {app.rejectedReason && (
          <p className="mt-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 px-3 py-2">
            <span className="font-bold">{t('pipeline.drawer.reason')}:</span> {app.rejectedReason}
          </p>
        )}
        <Link to={`/candidates/${app.candidateId}`} className="inline-flex items-center gap-1 mt-4 font-bold text-primary hover:underline">
          {t('pipeline.drawer.profile')}<span className="material-symbols-outlined text-[18px]">arrow_forward</span>
        </Link>
      </Section>

      <Section title={t('pipeline.drawer.ratings')}>
        <p className="text-[#896a61] mb-3">
          {avg === undefined ? t('pipeline.drawer.noRatings') : t('pipeline.drawer.average', { avg, count: ratings.length })}
        </p>
        <ul className="space-y-2 mb-4">
          {ratings.map((r) => (
            <li key={r.by} className="flex items-center justify-between">
              <span>{who(r.by)}</span>
              <Stars value={r.stars} />
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-[#896a61]">{t('pipeline.drawer.yourRating')}</span>
          <span className="flex">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                aria-label={t('pipeline.drawer.rate', { n })}
                aria-pressed={n <= mine}
                onClick={() => useStore.getState().rateApplication(app.id, CURRENT_USER_ID, n)}
                className={`material-symbols-outlined text-[22px] hover:scale-110 transition-transform ${n <= mine ? 'text-amber-400' : 'text-gray-300'}`}
                style={FILLED}
              >
                star
              </button>
            ))}
          </span>
        </div>
      </Section>

      <Section title={t('pipeline.drawer.history')}>
        <ol className="space-y-3 border-l-2 border-[#f4f1f0] dark:border-[#2a2423] pl-4">
          {[...app.history].reverse().map((h, i) => (
            <li key={`${h.at}-${i}`}>
              <div className="font-bold">{stageLabel(h.stage, lang)}</div>
              <div className="text-xs text-[#896a61]">{fullDate(h.at)} · {who(h.by)}</div>
            </li>
          ))}
        </ol>
      </Section>

      <Section title={t('pipeline.drawer.comments')}>
        <ul className="space-y-3 mb-4">
          {app.comments.map((c, i) => (
            <li key={`${c.at}-${i}`} className="rounded-xl bg-[#f8f6f6] dark:bg-[#251f1e] px-3 py-2">
              <div className="text-xs text-[#896a61] mb-1"><span className="font-bold text-slate-700 dark:text-gray-200">{who(c.by)}</span> · {fullDate(c.at)}</div>
              <div>{c.text}</div>
            </li>
          ))}
          {app.comments.length === 0 && <li className="text-[#896a61]">{t('pipeline.drawer.noComments')}</li>}
        </ul>
        <label htmlFor="app-comment" className="sr-only">{t('pipeline.drawer.commentLabel')}</label>
        <textarea
          id="app-comment"
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t('pipeline.drawer.commentPlaceholder')}
          className="w-full px-3 py-2 bg-white dark:bg-[#251f1e] border border-[#e6dddb] dark:border-[#3a3433] rounded-lg text-sm focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none"
        />
        <div className="flex justify-end mt-2">
          <button
            disabled={!comment.trim()}
            onClick={post}
            className="px-4 py-2 text-sm font-medium bg-primary hover:bg-primary-hover text-white rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('pipeline.drawer.post')}
          </button>
        </div>
      </Section>
    </div>
  );
}
