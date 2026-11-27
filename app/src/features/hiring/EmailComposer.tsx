import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../../components/Modal';
import { toast } from '../../components/Toast';
import { fillTemplate } from '../../domain/hiring';
import type { Interview, SentEmail } from '../../domain/types';
import { useLang, useT } from '../../i18n/i18n';
import { me } from '../../store/session';
import { useStore } from '../../store/store';
import { emailSubject, emailVars } from './emailVars';
import { BTN_GHOST, BTN_PRIMARY, FIELD, Field } from './ui';

type Props = {
  open: boolean;
  candidateId: string;
  /** When given, the email is filed under this application and job/stage/interview/offer values fill the template. */
  applicationId?: string;
  templateId?: string;
  interview?: Interview;
  /** Overrides the default "Send email" title, e.g. "Send offer". */
  title?: string;
  onClose: () => void;
  onSent?: (email: SentEmail) => void;
};

/** Pick an email template, review the filled-in text, then send (simulated: logged, not delivered). */
export function EmailComposer({ open, candidateId, applicationId, templateId, interview, title, onClose, onSent }: Props) {
  const t = useT();
  const [lang] = useLang();
  const prompts = useStore((s) => s.prompts);
  const candidate = useStore((s) => s.candidates.find((c) => c.id === candidateId));
  const app = useStore((s) => s.applications.find((a) => a.id === applicationId));
  const job = useStore((s) => s.jobs.find((j) => j.id === app?.jobId));
  const templates = useMemo(() => prompts.filter((p) => p.id.startsWith('email-')), [prompts]);
  const [tpl, setTpl] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const fill = (id: string) => {
    setTpl(id);
    const picked = templates.find((p) => p.id === id);
    if (!picked || !candidate) {
      setSubject(job ? job.title : '');
      setBody('');
      return;
    }
    setSubject(emailSubject(picked.name, job));
    setBody(fillTemplate(picked.text, emailVars(candidate, lang, app, job, interview)));
  };

  useEffect(() => {
    if (open) fill(templateId ?? '');
    // Refill only when the dialog opens; edits in between are the user's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!candidate) return null;
  const to = candidate.email?.trim();
  const unfilled = /\{\{\w+\}\}/.test(body);

  const send = () => {
    const sent = useStore.getState().sendEmail(
      { candidateId, applicationId, ...(tpl ? { templateId: tpl } : {}), subject, body },
      me(),
    );
    if (!sent) return;
    toast(t('email.toast.sent', { to: sent.to }));
    onSent?.(sent);
    onClose();
  };

  return (
    <Modal
      open={open}
      wide
      title={title ?? t('email.title')}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className={BTN_GHOST}>{t('common.cancel')}</button>
          <button onClick={send} disabled={!to || !subject.trim() || !body.trim()} className={BTN_PRIMARY}>
            {t('email.send')}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="text-xs text-ink-muted">
          {t('email.to')}: <span className="font-semibold text-ink dark:text-white">{to ? `${candidate.name} <${to}>` : candidate.name}</span>
        </div>
        {!to && <p className="rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 px-3 py-2">{t('email.noAddress')}</p>}
        <Field id="email-template" label={t('email.template')}>
          <select id="email-template" className={FIELD} value={tpl} onChange={(e) => fill(e.target.value)}>
            <option value="">{t('email.blank')}</option>
            {templates.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field id="email-subject" label={t('email.subject')}>
          <input id="email-subject" className={FIELD} value={subject} onChange={(e) => setSubject(e.target.value)} />
        </Field>
        <Field id="email-body" label={t('email.body')}>
          <textarea id="email-body" rows={10} className={`${FIELD} font-mono text-[13px]`} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        {unfilled && <p className="text-xs text-amber-700 dark:text-amber-300">{t('email.unfilled')}</p>}
        <p className="text-xs text-ink-muted">{t('email.simulated')}</p>
      </div>
    </Modal>
  );
}
