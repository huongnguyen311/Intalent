import { toast } from '../../components/Toast';
import { fieldsToCheck, LOW_CONFIDENCE } from '../../domain/parseCv';
import { PARSE_FIELDS, type Candidate, type ProfileSuggestion } from '../../domain/types';
import { userName } from '../../domain/users';
import { useT } from '../../i18n/i18n';
import { me } from '../../store/session';
import { useStore } from '../../store/store';
import { fullDate } from '../jds/format';

const show = (v: string | string[]) => (Array.isArray(v) ? v.join(', ') : v) || '—';

/** What the candidate proposed for HR-standardised fields: approve applies it, reject drops it. */
export function SuggestionsReview({ candidate }: { candidate: Candidate }) {
  const t = useT();
  const list = candidate.suggestions ?? [];
  if (list.length === 0) return null;
  const review = (sg: ProfileSuggestion, approve: boolean) => {
    if (useStore.getState().reviewSuggestion(candidate.id, sg.id, approve, me())) {
      toast(t(approve ? 'suggest.toast.approved' : 'suggest.toast.rejected'));
    }
  };
  return (
    <section data-testid="suggestions-review" className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 p-4 space-y-3">
      <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300 text-sm">
        <span className="material-symbols-outlined text-[18px]">rule</span>{t('suggest.banner', { n: list.length })}
      </div>
      {list.map((sg) => (
        <div key={sg.id} className="rounded-lg bg-white dark:bg-[#1e1e1e] border border-amber-100 dark:border-amber-900/30 px-3 py-2 flex items-center gap-3">
          <div className="flex-1 min-w-0 text-sm">
            <div className="text-xs font-semibold text-[#896a61]">{t(`suggest.field.${sg.field}`)} · {fullDate(sg.at)}</div>
            <div className="mt-0.5">
              <span className="line-through text-gray-400">{show(candidate[sg.field])}</span>
              <span className="mx-2 text-[#896a61]">→</span>
              <span className="font-semibold text-slate-800 dark:text-white">{show(sg.value)}</span>
            </div>
          </div>
          <button onClick={() => review(sg, false)} className="px-3 py-1.5 text-xs font-bold rounded-full border border-[#e6dddb] dark:border-[#3a3433] hover:border-red-300 hover:text-red-600">
            {t('suggest.reject')}
          </button>
          <button onClick={() => review(sg, true)} className="px-3 py-1.5 text-xs font-bold rounded-full bg-primary text-white hover:bg-primary-hover">
            {t('suggest.approve')}
          </button>
        </div>
      ))}
    </section>
  );
}

/** Uploaded CV files, newest first, with who uploaded them (the candidate or a staff member). */
export function CvVersions({ candidate }: { candidate: Candidate }) {
  const t = useT();
  const users = useStore((s) => s.users);
  const versions = [...(candidate.cvVersions ?? [])].reverse();
  if (versions.length === 0) return null;
  return (
    <section data-testid="cv-versions">
      <h3 className="text-sm font-bold text-[#181211] dark:text-white mb-3 flex items-center gap-2">
        <span className="material-symbols-outlined text-[18px]">history</span>{t('cv.versions')}
      </h3>
      <ul className="space-y-2">
        {versions.map((v, i) => (
          <li key={v.id} className="flex items-center gap-3 rounded-lg bg-[#f8f6f6] dark:bg-[#251f1e] px-3 py-2 text-sm">
            <span className="material-symbols-outlined text-[18px] text-red-500">picture_as_pdf</span>
            <span className="flex-1 min-w-0 truncate font-medium">{v.fileName}</span>
            {i === 0 && <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold">{t('cv.latest')}</span>}
            <span className="text-xs text-[#896a61] whitespace-nowrap">{fullDate(v.at)} · {userName(users, v.by)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** AI parse quality (PRD FE-07): fields with low confidence or missing from the CV, until HR marks them checked. */
export function ParseReview({ candidate }: { candidate: Candidate }) {
  const t = useT();
  const parse = candidate.parse;
  if (!parse) return null;
  const { low, missing } = fieldsToCheck(parse);
  const reviewed = !!parse.reviewedAt;
  const markReviewed = () => {
    const r = useStore.getState().updateCandidate(candidate.id, { parse: { ...parse, reviewedBy: me(), reviewedAt: new Date().toISOString() } });
    if (r.ok) toast(t('parse.toast.reviewed'));
  };
  const chip = 'px-2 py-0.5 rounded-full text-xs font-bold';
  return (
    <section data-testid="parse-review" className={`rounded-xl border p-4 space-y-2 ${reviewed || (low.length === 0 && missing.length === 0) ? 'border-[#e6dddb] dark:border-[#3a3433]' : 'border-sky-200 bg-sky-50 dark:bg-sky-900/10 dark:border-sky-800'}`}>
      <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-white">
        <span className="material-symbols-outlined text-[18px] text-primary">document_scanner</span>
        {t('parse.title')}
        <span className="text-xs font-normal text-[#896a61]">{parse.model} · {fullDate(parse.at)}</span>
        {reviewed && <span className={`${chip} ml-auto bg-emerald-50 text-emerald-700`}>{t('parse.reviewed')}</span>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PARSE_FIELDS.filter((f) => parse.confidence[f] !== undefined).map((f) => {
          const c = parse.confidence[f]!;
          const weak = c < LOW_CONFIDENCE;
          return (
            <span key={f} title={t('parse.confidence')} className={`${chip} ${weak ? 'bg-amber-100 text-amber-800' : 'bg-white dark:bg-white/5 text-slate-600 dark:text-gray-300 border border-gray-100 dark:border-white/10'}`}>
              {t(`parse.field.${f}`)} {Math.round(c * 100)}%
            </span>
          );
        })}
        {missing.map((f) => (
          <span key={f} className={`${chip} bg-red-50 text-red-600`}>{t(`parse.field.${f}`)}: {t('parse.missing')}</span>
        ))}
      </div>
      {!reviewed && (low.length > 0 || missing.length > 0) && (
        <div className="flex items-center gap-3">
          <p className="text-xs text-[#896a61] flex-1">{t('parse.hint', { n: low.length + missing.length })}</p>
          <button onClick={markReviewed} className="px-3 py-1.5 text-xs font-bold rounded-full bg-primary text-white hover:bg-primary-hover">{t('parse.markReviewed')}</button>
        </div>
      )}
    </section>
  );
}
