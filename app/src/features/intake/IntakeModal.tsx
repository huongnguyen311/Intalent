import { useEffect, useState, type ReactNode } from 'react';
import { Modal } from '../../components/Modal';
import { toast } from '../../components/Toast';
import { stageLabel } from '../../domain/stages';
import { CURRENT_USER_ID } from '../../domain/users';
import { useLang, useT, type TKey } from '../../i18n/i18n';
import { useStore } from '../../store/store';

type Mode = 'choose' | 'pool' | 'note';

type Props = {
  open: boolean;
  onClose: () => void;
  /** Skip the choice step (e.g. the Notes page opens straight to the note form). */
  initialMode?: 'pool' | 'note';
};

const FIELD =
  'w-full px-3 py-2 bg-white dark:bg-[#251f1e] border border-[#e6dddb] dark:border-[#3a3433] rounded-lg text-sm text-[#181211] dark:text-white focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none';
const BTN_PRIMARY = 'px-4 py-2 text-sm font-medium bg-primary hover:bg-primary-hover text-white rounded-lg shadow-sm transition-colors';
const BTN_GHOST =
  'px-4 py-2 text-sm font-medium border border-[#e6dddb] dark:border-[#3a3433] text-[#181211] dark:text-white rounded-lg hover:border-primary/50 transition-colors';

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-semibold text-[#896a61]">{label}</label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function Choice({ icon, title, desc, onClick }: { icon: string; title: string; desc: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-start gap-3 p-4 text-left rounded-xl border border-[#e6dddb] dark:border-[#3a3433] hover:border-primary transition-colors"
    >
      <span className="material-symbols-outlined text-primary">{icon}</span>
      <span className="flex flex-col gap-0.5">
        <span className="font-bold text-[#181211] dark:text-white">{title}</span>
        <span className="text-xs text-[#896a61]">{desc}</span>
      </span>
    </button>
  );
}

const EMPTY_POOL = { name: '', email: '', phone: '', title: '', seniority: '', english: '', skills: '', jobId: '' };
const EMPTY_NOTE = { name: '', contact: '', text: '' };

export function IntakeModal({ open, onClose, initialMode }: Props) {
  const t = useT();
  const [lang] = useLang();
  const jobs = useStore((s) => s.jobs);
  const taxonomy = useStore((s) => s.taxonomy);
  const [mode, setMode] = useState<Mode>(initialMode ?? 'choose');
  const [pool, setPool] = useState(EMPTY_POOL);
  const [note, setNote] = useState(EMPTY_NOTE);
  const [errors, setErrors] = useState<Partial<Record<string, TKey>>>({});

  const reset = () => {
    setMode(initialMode ?? 'choose');
    setPool(EMPTY_POOL);
    setNote(EMPTY_NOTE);
    setErrors({});
  };
  useEffect(() => {
    if (open) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const finish = () => {
    reset();
    onClose();
  };

  const submitPool = () => {
    const next: typeof errors = {};
    if (!pool.name.trim()) next.name = 'intake.err.name';
    if (!pool.email.trim() && !pool.phone.trim()) next.contact = 'intake.err.contact';
    setErrors(next);
    if (Object.keys(next).length) return;
    const store = useStore.getState();
    const { candidate, created } = store.upsertCandidate(
      {
        name: pool.name.trim(),
        email: pool.email.trim(),
        phone: pool.phone.trim(),
        title: pool.title.trim(),
        seniority: pool.seniority,
        english: pool.english,
        skills: pool.skills.split(',').map((s) => s.trim()).filter(Boolean),
      },
      { source: 'Manual', by: CURRENT_USER_ID },
    );
    toast(t(created ? 'intake.toast.created' : 'intake.toast.merged'), created ? 'success' : 'info');
    if (pool.jobId) {
      const res = store.addToPipeline(candidate.id, pool.jobId, { via: 'manual', source: 'Manual', by: CURRENT_USER_ID });
      if (!res.ok) toast(res.reason === 'duplicate' ? t('intake.toast.alreadyInJob', { stage: stageLabel(res.stage, lang) }) : t('pipeline.jobNotOpen'), 'error');
    }
    finish();
  };

  const submitNote = () => {
    const next: typeof errors = {};
    if (!note.name.trim()) next.name = 'intake.err.name';
    if (!note.contact.trim()) next.contact = 'intake.err.noteContact';
    setErrors(next);
    if (Object.keys(next).length) return;
    useStore.getState().addNote(
      { name: note.name.trim(), contact: note.contact.trim(), text: note.text.trim() },
      CURRENT_USER_ID,
    );
    toast(t('intake.toast.note'), 'info');
    finish();
  };

  const err = (k: string) => (errors[k] ? t(errors[k]!) : undefined);
  const setP = (k: keyof typeof EMPTY_POOL) => (e: { target: { value: string } }) =>
    setPool((p) => ({ ...p, [k]: e.target.value }));
  const setN = (k: keyof typeof EMPTY_NOTE) => (e: { target: { value: string } }) =>
    setNote((p) => ({ ...p, [k]: e.target.value }));
  const levels = (kind: 'english' | 'seniority') => taxonomy.filter((x) => x.kind === kind && x.active);

  const title = mode === 'pool' ? t('intake.pool.title') : mode === 'note' ? t('intake.note.title') : t('intake.title');
  const footer =
    mode === 'choose' ? undefined : (
      <>
        <button className={BTN_GHOST} onClick={initialMode ? finish : () => setMode('choose')}>
          {t(initialMode ? 'common.cancel' : 'common.back')}
        </button>
        <button className={BTN_PRIMARY} onClick={mode === 'pool' ? submitPool : submitNote}>
          {t(mode === 'pool' ? 'intake.submit.pool' : 'intake.submit.note')}
        </button>
      </>
    );

  return (
    <Modal open={open} title={title} onClose={onClose} footer={footer}>
      {mode === 'choose' && (
        <div className="flex flex-col gap-3">
          <Choice icon="groups" title={t('intake.pool.title')} desc={t('intake.pool.desc')} onClick={() => setMode('pool')} />
          <Choice icon="sticky_note_2" title={t('intake.note.title')} desc={t('intake.note.desc')} onClick={() => setMode('note')} />
        </div>
      )}
      {mode === 'pool' && (
        <div className="flex flex-col gap-3">
          <Field id="ip-name" label={t('intake.field.fullName')} error={err('name')}>
            <input id="ip-name" className={FIELD} value={pool.name} onChange={setP('name')} />
          </Field>
          <Field id="ip-email" label={t('intake.field.email')} error={err('contact')}>
            <input id="ip-email" type="email" className={FIELD} value={pool.email} onChange={setP('email')} />
          </Field>
          <Field id="ip-phone" label={t('intake.field.phone')}>
            <input id="ip-phone" className={FIELD} value={pool.phone} onChange={setP('phone')} />
          </Field>
          <Field id="ip-title" label={t('intake.field.title')}>
            <input id="ip-title" className={FIELD} value={pool.title} onChange={setP('title')} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="ip-seniority" label={t('intake.field.seniority')}>
              <select id="ip-seniority" className={FIELD} value={pool.seniority} onChange={setP('seniority')}>
                <option value="" />
                {levels('seniority').map((l) => <option key={l.id} value={l.label}>{l.label}</option>)}
              </select>
            </Field>
            <Field id="ip-english" label={t('intake.field.english')}>
              <select id="ip-english" className={FIELD} value={pool.english} onChange={setP('english')}>
                <option value="" />
                {levels('english').map((l) => <option key={l.id} value={l.label}>{l.label}</option>)}
              </select>
            </Field>
          </div>
          <Field id="ip-skills" label={t('intake.field.skills')}>
            <input id="ip-skills" className={FIELD} value={pool.skills} onChange={setP('skills')} />
          </Field>
          <Field id="ip-job" label={t('intake.field.job')}>
            <select id="ip-job" className={FIELD} value={pool.jobId} onChange={setP('jobId')}>
              <option value="">{t('intake.field.noJob')}</option>
              {jobs.filter((j) => j.status === 'open').map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
          </Field>
        </div>
      )}
      {mode === 'note' && (
        <div className="flex flex-col gap-3">
          <Field id="in-name" label={t('intake.field.name')} error={err('name')}>
            <input id="in-name" className={FIELD} value={note.name} onChange={setN('name')} />
          </Field>
          <Field id="in-contact" label={t('intake.field.contact')} error={err('contact')}>
            <input id="in-contact" className={FIELD} value={note.contact} onChange={setN('contact')} />
          </Field>
          <Field id="in-text" label={t('intake.field.note')}>
            <textarea id="in-text" rows={3} className={FIELD} value={note.text} onChange={setN('text')} />
          </Field>
        </div>
      )}
    </Modal>
  );
}
