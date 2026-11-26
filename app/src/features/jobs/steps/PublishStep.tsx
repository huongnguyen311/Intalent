import { useState } from 'react';
import { AiTextField } from '../../../components/AiTextField';
import { Modal } from '../../../components/Modal';
import { CONTENT_TEMPLATE, draftAdditionalInfo } from '../../../domain/jdWriter';
import type { JobQuestion } from '../../../domain/types';
import { useT } from '../../../i18n/i18n';
import { useStore } from '../../../store/store';
import type { JobForm } from '../useJobForm';
import { BTN_GHOST, BTN_PRIMARY, CHECKBOX, FIELD, GROUP, GROUPS, GroupHeader, PostArea } from './ui';

const template = (id: string) => useStore.getState().prompts.find((p) => p.id === id)?.text ?? '';

/** Job post & application section: job post copy and screening questions. Skills and requirements live in RequirementsStep. */
export function PublishStep({ form }: { form: JobForm }) {
  const t = useT();
  const { values: v, set } = form;
  const questions = v.questions;
  const editQuestion = (id: string, p: Partial<JobQuestion>) => set.questions(questions.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const [confirming, setConfirming] = useState(false);
  // Replacing what is already there asks first; an empty post just loads.
  const loadFromJd = () => (form.hasPostContent ? setConfirming(true) : form.loadFromJd());
  const area = (id: string, label: string, key: 'summary' | 'responsibilities' | 'aboutTeam', rows: number, perLine = false) => (
    <PostArea form={form} id={id} label={label} field={key} rows={rows} perLine={perLine} />
  );
  return (
    <div className={GROUPS}>
      <fieldset className={`${GROUP} lg:grid lg:grid-cols-2`}>
        <legend className="sr-only">{t('jobs.drawer.content')}</legend>
        <div className="lg:col-span-2 flex justify-end">
          <button type="button" className={`${BTN_GHOST} inline-flex items-center gap-1.5 !py-1.5`} disabled={!form.selected} onClick={loadFromJd}
            title={form.selected ? undefined : t('jobs.post.pickJdFirst')}>
            <span aria-hidden="true" className="material-symbols-outlined text-[18px]">sync</span>{t('jobs.post.loadFromJd')}
          </button>
        </div>
        <div className="lg:col-span-2">{area('job-summary', t('jobs.post.summary'), 'summary', 4)}</div>
        <div className="lg:col-span-2">{area('job-duties', t('jobs.post.duties'), 'responsibilities', 6, true)}</div>
        <div className="lg:col-span-2">{area('job-team', t('jobs.post.team'), 'aboutTeam', 3)}</div>
        <AiTextField id="job-why-love" label={t('jobs.drawer.whyLove')} value={v.whyLove} onChange={set.whyLove} draft={() => template(CONTENT_TEMPLATE.whyLove)} />
        <AiTextField
          id="job-additional-info"
          label={t('jobs.drawer.additionalInfo')}
          value={v.additionalInfo}
          onChange={set.additionalInfo}
          draft={() => draftAdditionalInfo({ location: v.location, employment: v.employment, level: v.level }, template(CONTENT_TEMPLATE.additionalInfo))}
        />
      </fieldset>
      <fieldset className={`${GROUP} !gap-3`}>
        <legend className="sr-only">{t('jobs.drawer.questions')}</legend>
        <GroupHeader title={t('jobs.drawer.questions')} hint={questions.length === 0 ? t('jobs.drawer.questionsNone') : undefined} />
        {questions.map((q, i) => (
          <div key={q.id} className="flex items-center gap-2">
            <input
              aria-label={t('jobs.drawer.questionLabel', { n: i + 1 })}
              className={FIELD}
              value={q.label}
              placeholder={t('jobs.drawer.questionPlaceholder')}
              onChange={(e) => editQuestion(q.id, { label: e.target.value })}
            />
            <select
              aria-label={t('jobs.drawer.questionType')}
              className={`${FIELD} !w-28`}
              value={q.type}
              onChange={(e) => editQuestion(q.id, { type: e.target.value as JobQuestion['type'] })}
            >
              <option value="text">{t('jobs.drawer.qtype.text')}</option>
              <option value="yesno">{t('jobs.drawer.qtype.yesno')}</option>
            </select>
            <label className="flex items-center gap-1 text-xs text-[#896a61] whitespace-nowrap">
              <input type="checkbox" checked={q.required} onChange={(e) => editQuestion(q.id, { required: e.target.checked })} className={CHECKBOX} />
              {t('jobs.drawer.required')}
            </label>
            <button
              type="button"
              aria-label={t('jobs.drawer.removeQuestion')}
              onClick={() => set.questions(questions.filter((x) => x.id !== q.id))}
              className="text-[#896a61] hover:text-red-500"
            >
              <span className="material-symbols-outlined text-[18px]">delete</span>
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => set.questions([...questions, { id: `q-${crypto.randomUUID().slice(0, 8)}`, label: '', type: 'text', required: false }])}
          className="self-start text-sm font-bold text-primary hover:underline flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>{t('jobs.drawer.addQuestion')}
        </button>
      </fieldset>
      <Modal
        open={confirming}
        title={t('jobs.post.confirmTitle')}
        onClose={() => setConfirming(false)}
        footer={
          <>
            <button type="button" className={BTN_GHOST} onClick={() => setConfirming(false)}>{t('common.cancel')}</button>
            <button type="button" className={BTN_PRIMARY} onClick={() => { form.loadFromJd(); setConfirming(false); }}>{t('jobs.post.replace')}</button>
          </>
        }
      >
        <p>{t('jobs.post.confirmBody')}</p>
      </Modal>
    </div>
  );
}
