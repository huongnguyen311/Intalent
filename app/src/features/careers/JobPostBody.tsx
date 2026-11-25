import { jobPostOf } from '../../domain/jobPost';
import type { Jd, Job } from '../../domain/types';
import { useT, type LangScope, type TKey } from '../../i18n/i18n';
import { JdBody } from './JdBody';
import { PostSection } from './PostSection';

/** A titled list with check-mark bullets (requirements, nice to have). */
function CheckList({ heading, items, headingClass }: { heading: string; items: string[]; headingClass: string }) {
  return (
    <section>
      <h2 className={headingClass}>{heading}</h2>
      <ul className="space-y-2">
        {items.map((r) => (
          <li key={r} className="flex gap-2.5">
            <span className="material-symbols-outlined icon-filled text-primary text-[20px] mt-0.5">check_circle</span>
            <span>{r}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The job post sections as the careers page shows them, from the job's own copy (or its JD for older jobs).
 * Shared by the public job page and the in-app preview, so both always show the same post.
 * Order: the role and its work, then what it takes, then the team and the offer.
 */
export function JobPostBody({ job, jd, headingClass, scope = 'careers' }: { job: Job; jd?: Jd; headingClass: string; scope?: LangScope }) {
  const t = useT(scope);
  const post = jobPostOf(job, jd);
  const bullets = (items: string[]) => items.map((i) => `- ${i}`).join('\n');
  const overview = ([
    ['careers.job.about', post.summary],
    ['careers.job.duties', bullets(post.responsibilities)],
  ] as [TKey, string][]).filter(([, text]) => text.trim());
  // Any overview section (team included) means the post was written out, so the JD's pasted text is not shown.
  const hasOverview = overview.length > 0 || !!post.aboutTeam;
  return (
    <>
      {hasOverview ? (
        overview.map(([key, text]) => <PostSection key={key} heading={t(key)} text={text} headingClass={headingClass} />)
      ) : jd?.body ? (
        // Only posts with no overview fall back to the JD's original pasted text.
        <JdBody
          body={jd.body}
          title={job.title}
          headingClass={headingClass}
          // Requirements and skills have their own blocks below, so their copies in the body are not repeated.
          skip={[...(post.mustHave.length ? [/MUST|REQUIRE/] : []), ...(post.niceToHave.length ? [/NICE/] : []), ...(post.skills.length ? [/TECH STACK|SKILLS/] : [])]}
        />
      ) : (
        <>
          <h2 className={headingClass}>{t('careers.job.about')}</h2>
          <p>{t('careers.job.noDescription')}</p>
        </>
      )}
      {post.skills.length > 0 && (
        <section>
          <h2 className={headingClass}>{t('careers.job.skills')}</h2>
          <div className="flex gap-2 flex-wrap">
            {post.skills.map((s) => <span key={s} className="px-3 py-1 rounded-full bg-primary/10 text-primary-ink text-xs font-semibold">{s}</span>)}
          </div>
        </section>
      )}
      {post.mustHave.length > 0 && <CheckList heading={t('careers.job.requirements')} items={post.mustHave} headingClass={headingClass} />}
      {post.niceToHave.length > 0 && <CheckList heading={t('careers.job.niceToHave')} items={post.niceToHave} headingClass={headingClass} />}
      {post.aboutTeam && <PostSection heading={t('careers.job.team')} text={post.aboutTeam} headingClass={headingClass} />}
      {job.whyLove && <PostSection heading={t('careers.job.whyLove')} text={job.whyLove} headingClass={headingClass} />}
      {job.additionalInfo && <PostSection heading={t('careers.job.additionalInfo')} text={job.additionalInfo} headingClass={headingClass} />}
    </>
  );
}
