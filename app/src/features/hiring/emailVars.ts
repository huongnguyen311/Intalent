import { fillTemplate, formatMoney, interviewTime, nextInterview, shortDate } from '../../domain/hiring';
import { stageLabel } from '../../domain/stages';
import { translate } from '../../i18n/translate';
import type { Application, Candidate, Interview, Job, Lang } from '../../domain/types';
import { useStore } from '../../store/store';

/** Values for the `{{…}}` placeholders in email templates. `interview` overrides the next scheduled one. */
export function emailVars(
  candidate: Candidate,
  lang: Lang,
  app?: Application,
  job?: Job,
  interview?: Interview,
): Record<string, string> {
  const iv = interview ?? (app ? nextInterview(app) : undefined);
  const offer = app?.offer;
  return {
    name: candidate.name,
    job: job?.title ?? '',
    stage: app ? stageLabel(app.stage, lang) : '',
    time: iv ? interviewTime(iv.at) : '',
    // An interview without a room/link yet still reads naturally in the invitation.
    place: iv ? iv.place || translate(lang, 'interview.placeTbc', { mode: translate(lang, `interview.mode.${iv.mode}`) }) : '',
    salary: offer ? formatMoney(offer.salary, offer.currency) : '',
    startDate: offer ? shortDate(offer.startDate) : '',
    validUntil: offer ? shortDate(offer.validUntil) : '',
    // Where the candidate signs in to accept or decline an offer and follow their applications.
    portalLink: `${typeof window === 'undefined' ? '' : window.location.origin}/careers/login`,
  };
}

/** Subject line for a template: "<template name> – <job title>". */
export const emailSubject = (templateName: string, job?: Job) => (job ? `${templateName} – ${job.title}` : templateName);

/**
 * Sends a template straight away (no composer), e.g. "notify candidate" on a stage move.
 * Returns false when the template is missing or the candidate has no email.
 */
export function sendTemplate(templateId: string, appId: string, by: string, lang: Lang, interview?: Interview): boolean {
  const s = useStore.getState();
  const app = s.applications.find((a) => a.id === appId);
  const candidate = app && s.candidates.find((c) => c.id === app.candidateId);
  const job = app && s.jobs.find((j) => j.id === app.jobId);
  const tpl = s.prompts.find((p) => p.id === templateId);
  if (!app || !candidate || !tpl) return false;
  const body = fillTemplate(tpl.text, emailVars(candidate, lang, app, job, interview));
  return !!s.sendEmail({ candidateId: candidate.id, applicationId: app.id, templateId, subject: emailSubject(tpl.name, job), body }, by);
}
