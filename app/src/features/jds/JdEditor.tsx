import { useEffect, useState, type ReactNode } from 'react';
import { Drawer } from '../../components/Drawer';
import { toast } from '../../components/Toast';
import { AiTextField } from '../../components/AiTextField';
import { extractJd, jdRequirements } from '../../domain/jdExtract';
import { draftSkillsExperience } from '../../domain/jdWriter';
import type { Jd } from '../../domain/types';
import { useT } from '../../i18n/i18n';
import { useStore } from '../../store/store';
import { BTN_GHOST, BTN_PRIMARY, FIELD } from '../../components/ui';


const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-semibold text-ink-muted">{label}</label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

type Props = { open: boolean; jd?: Jd; onClose: () => void; onSaved?: (jd: Jd) => void };

/** Create (from typed fields or pasted text) or edit a JD in a slide-over. */
export function JdEditor({ open, jd, onClose, onSaved }: Props) {
  const t = useT();
  const taxonomy = useStore((s) => s.taxonomy);
  const [paste, setPaste] = useState('');
  const [title, setTitle] = useState('');
  const [client, setClient] = useState('');
  const [domains, setDomains] = useState('');
  const [skills, setSkills] = useState('');
  const [body, setBody] = useState('');
  const [skillsExperience, setSkillsExperience] = useState('');
  const [mustHave, setMustHave] = useState<string[] | undefined>();
  const [publish, setPublish] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setPaste('');
    setTitle(jd?.title ?? '');
    setClient(jd?.client ?? '');
    setDomains(jd?.domains.join(', ') ?? '');
    setSkills(jd?.skills.join(', ') ?? '');
    setBody(jd?.body ?? '');
    setMustHave(jd?.mustHave);
    setSkillsExperience(jd?.skillsExperience ?? '');
    setPublish(false);
    setError('');
  }, [open, jd]);

  const extract = () => {
    if (!paste.trim()) return;
    const x = extractJd(paste, taxonomy);
    setTitle(x.title);
    setDomains(x.domains.join(', '));
    setSkills(x.skills.join(', '));
    setBody(x.body);
    setMustHave(x.mustHave);
    toast(t('jds.editor.extracted'), 'info');
  };

  /** The form as a JD, so AI drafts read the same requirements matching does. */
  const draftJd = (): Jd => ({
    id: '', code: '', title, client, domains: list(domains), skills: list(skills), body, status: 'Draft', createdAt: '', updatedAt: '',
  });

  const save = () => {
    if (!title.trim()) return setError(t('jds.editor.err.title'));
    const fields = { title, client, domains: list(domains), skills: list(skills), body, skillsExperience: skillsExperience.trim(), ...(mustHave ? { mustHave } : {}) };
    const { createJd, updateJd } = useStore.getState();
    if (jd) {
      updateJd(jd.id, fields);
      toast(t('jds.toast.saved'));
      onSaved?.({ ...jd, ...fields });
    } else {
      const created = createJd({ ...fields, status: publish ? 'Published' : 'Draft' });
      toast(t('jds.toast.created', { code: created.code }));
      onSaved?.(created);
    }
    onClose();
  };

  return (
    <Drawer open={open} title={t(jd ? 'jds.editor.editTitle' : 'jds.editor.createTitle')} onClose={onClose} guardUnsaved variant="center">
      <div className="flex flex-col gap-4">
        {!jd && (
          <div className="flex flex-col gap-2 p-3 rounded-xl border border-dashed border-line dark:border-dark-line">
            <label htmlFor="jd-paste" className="text-xs font-semibold text-ink-muted">{t('jds.editor.paste')}</label>
            <textarea id="jd-paste" rows={5} className={FIELD} placeholder={t('jds.editor.pastePlaceholder')} value={paste} onChange={(e) => setPaste(e.target.value)} />
            <button type="button" onClick={extract} disabled={!paste.trim()} className={`${BTN_GHOST} self-start flex items-center gap-1.5 disabled:opacity-50`}>
              <span className="material-symbols-outlined text-[18px] text-primary">auto_awesome</span>
              {t('jds.editor.extract')}
            </button>
          </div>
        )}
        <Field id="jd-title" label={t('jds.editor.title')} error={error}>
          <input id="jd-title" className={FIELD} value={title} onChange={(e) => { setTitle(e.target.value); setError(''); }} />
        </Field>
        <Field id="jd-client" label={t('jds.editor.client')}>
          <input id="jd-client" className={FIELD} value={client} onChange={(e) => setClient(e.target.value)} />
        </Field>
        <Field id="jd-domains" label={t('jds.editor.domains')}>
          <input id="jd-domains" className={FIELD} value={domains} onChange={(e) => setDomains(e.target.value)} />
        </Field>
        <Field id="jd-skills" label={t('jds.editor.skills')}>
          <input id="jd-skills" className={FIELD} value={skills} onChange={(e) => setSkills(e.target.value)} />
        </Field>
        <Field id="jd-body" label={t('jds.editor.body')}>
          <textarea id="jd-body" rows={10} className={FIELD} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <AiTextField
          id="jd-skills-experience"
          label={t('jds.editor.skillsExperience')}
          value={skillsExperience}
          onChange={setSkillsExperience}
          draft={() => draftSkillsExperience(jdRequirements(draftJd(), taxonomy))}
        />
        {!jd && (
          <label className="flex items-center gap-2 text-sm text-ink dark:text-white">
            <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} className="rounded border-gray-300 text-primary focus:ring-primary" />
            {t('jds.editor.publishNow')}
          </label>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className={BTN_GHOST}>{t('common.cancel')}</button>
          <button type="button" onClick={save} className={BTN_PRIMARY}>{t('jds.editor.save')}</button>
        </div>
      </div>
    </Drawer>
  );
}
