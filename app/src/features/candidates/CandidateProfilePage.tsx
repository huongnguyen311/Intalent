import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AppLayout } from '../../components/AppLayout';
import { toast } from '../../components/Toast';
import { isFixtureMode } from '../../data/fixtureMockup';
import type { Candidate } from '../../domain/types';
import { userName } from '../../domain/users';
import { useShowNew } from '../../hooks';
import { useT } from '../../i18n/i18n';
import { useStore } from '../../store/store';
import { AddToPipelineModal } from './AddToPipelineModal';
import { CvDocument } from './CvDocument';
import { UsedIn } from './UsedIn';

const INPUT =
  'w-full py-2.5 bg-white dark:bg-[#251f1e] border border-[#e6dddb] dark:border-[#3a3433] rounded-xl text-sm text-[#181211] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed pl-4 pr-4 hover:border-primary/50 ';
const READONLY = 'cursor-default !bg-gray-100 dark:!bg-gray-700 ';
const SECRET_INPUT =
  'w-full py-2.5 bg-gray-100 dark:bg-gray-700 border border-[#e6dddb] dark:border-[#3a3433] rounded-xl text-sm text-[#181211] dark:text-white focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none transition-all pr-10 pl-4 cursor-default  ';
const SECRET_INPUT_EDIT =
  'w-full py-2.5 bg-white dark:bg-[#251f1e] border border-[#e6dddb] dark:border-[#3a3433] rounded-xl text-sm text-[#181211] dark:text-white focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none transition-all pr-10 pl-4 hover:border-primary/50 ';
const TEXTAREA =
  'w-full py-2.5 px-4 bg-white dark:bg-[#251f1e] border border-[#e6dddb] dark:border-[#3a3433] rounded-xl text-sm text-[#181211] dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:border-primary/50 ';
const LABEL = 'text-sm font-semibold text-[#181211] dark:text-white';
const SECTION_H3 = 'text-sm font-bold text-[#896a61] uppercase tracking-wider mb-4 flex items-center gap-2';
const SECTION_H3_ROW = 'text-sm font-bold text-[#896a61] uppercase tracking-wider flex items-center gap-2';
const HR = 'border-[#e6dddb] dark:border-[#2a2423]';
const CARD = 'p-4 rounded-xl border border-[#e6dddb] dark:border-[#3a3433] bg-[#f8f6f6] dark:bg-[#251f1e]';
const SUB_LABEL = 'block text-xs font-medium text-[#896a61]';
const SUB_INPUT =
  'w-full rounded border-[#e6dddb] dark:border-[#3a3433] bg-gray-100 dark:bg-gray-700 text-sm text-[#181211] dark:text-white focus:ring-0 focus:border-[#e6dddb] dark:focus:border-[#3a3433] p-2 cursor-default';
const PILL_PRIMARY =
  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800';
const PILL_SECONDARY =
  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700';
const SKILL_LABEL = 'block text-sm font-medium text-[#181211] dark:text-[#e6dddb] mb-2';
const BTN_EDIT = 'flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-lg shadow-sm transition-colors bg-primary hover:bg-primary-hover text-white';
const BTN_GHOST =
  'flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-lg border border-[#e6dddb] dark:border-[#3a3433] text-[#181211] dark:text-white hover:border-primary/50 transition-colors';

const ZOOM_STEP = 0.25;

type Draft = Pick<Candidate, 'name' | 'title' | 'email' | 'phone' | 'seniority' | 'english'> & { summary: string };

const toDraft = (c: Candidate): Draft => ({
  name: c.name, title: c.title, email: c.email, phone: c.phone, summary: c.summary ?? '', seniority: c.seniority, english: c.english,
});

function TextField({ label, value, editing, onChange, testId }: {
  label: string; value: string; editing: boolean; onChange?: (v: string) => void; testId?: string;
}) {
  const editable = editing && Boolean(onChange);
  return (
    <div className="space-y-1.5 ">
      <label className={LABEL}>{label} </label>
      <div className="relative group">
        <input
          className={INPUT + (editable ? '' : READONLY)}
          readOnly={!editable}
          data-testid={testId}
          aria-label={label}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
        />
      </div>
    </div>
  );
}

function SecretField({ label, value, editing, onChange }: {
  label: string; value: string; editing: boolean; onChange: (v: string) => void;
}) {
  const unlocked = useStore((s) => s.ui.piiUnlocked);
  const [shown, setShown] = useState(false);
  const visible = shown || unlocked || editing;
  return (
    <div className="space-y-1.5 ">
      <label className={`${LABEL} flex items-center gap-1`}>{label}</label>
      <div className="relative group">
        <input
          readOnly={!editing}
          aria-label={label}
          className={editing ? SECRET_INPUT_EDIT : SECRET_INPUT}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          aria-label={visible ? 'Hide' : 'Show'}
          onClick={() => setShown(!shown)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary transition-colors material-symbols-outlined text-[20px]"
        >
          {visible ? 'visibility' : 'visibility_off'}
        </button>
      </div>
    </div>
  );
}

function SubField({ label, value, area }: { label: string; value: string; area?: boolean }) {
  return (
    <div className="space-y-1">
      <label className={SUB_LABEL}>{label}</label>
      {area ? (
        <textarea readOnly rows={3} className={SUB_INPUT} value={value} />
      ) : (
        <input readOnly className={SUB_INPUT} type="text" value={value} />
      )}
    </div>
  );
}

const SectionTitle = ({ icon, children }: { icon: string; children: string }) => (
  <h3 className={SECTION_H3}>
    <span className="material-symbols-outlined text-[18px]">{icon}</span> {children}
  </h3>
);

export function CandidateProfilePage() {
  const t = useT();
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const showNew = useShowNew();
  const candidate = useStore((s) => s.candidates.find((c) => c.id === id));
  const users = useStore((s) => s.users);
  const [editing, setEditing] = useState(params.get('edit') === '1');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const search = isFixtureMode() ? '?fixture=mockup' : '';

  if (!candidate) {
    return (
      <AppLayout title={t('profile.title')}>
        <div className="p-8 text-[#896a61]">{t('profile.notFound')}</div>
      </AppLayout>
    );
  }
  const c = candidate;
  const form = editing ? (draft ?? toDraft(c)) : toDraft(c);
  const set = (k: keyof Draft) => (v: string) => setDraft({ ...form, [k]: v });

  const startEdit = () => {
    setDraft(toDraft(c));
    setEditing(true);
  };
  const stopEdit = () => {
    setDraft(null);
    setEditing(false);
  };
  const save = () => {
    useStore.getState().updateCandidate(c.id, {
      name: form.name.trim() || c.name,
      title: form.title.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      seniority: form.seniority.trim(),
      english: form.english.trim(),
      summary: form.summary.trim(),
    });
    toast(t('profile.saved'));
    stopEdit();
  };

  const primary = c.primarySkills ?? c.skills;
  const secondary = c.secondarySkills ?? [];

  return (
    <AppLayout title={t('profile.title')} bare>
      <div className="flex flex-col h-full bg-background-light dark:bg-background-dark overflow-hidden">
        <header className="bg-white dark:bg-[#1e1e1e] flex-shrink-0 z-20 border-b border-[#e6dddb] dark:border-[#2a2423]">
          <div className="h-16 px-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <nav className="flex items-center text-sm font-medium text-[#896a61]">
                <button className="hover:text-primary transition-colors" onClick={() => navigate({ pathname: '/candidates', search })}>
                  {t('nav.candidatePool')}
                </button>
                <span className="material-symbols-outlined text-[16px] mx-2">chevron_right</span>
                <span className="text-[#181211] dark:text-white">{c.name}</span>
              </nav>
              <div className="h-6 w-px bg-gray-100 dark:bg-gray-700 mx-1"></div>
              <h2 className="text-lg font-bold text-[#181211] dark:text-white">{t('profile.title')}</h2>
            </div>
          </div>
        </header>
        <div className="flex-1 flex overflow-hidden">
          <div className="w-1/2 overflow-y-auto custom-scrollbar bg-white dark:bg-[#1e1e1e] border-r border-[#e6dddb] dark:border-[#2a2423]">
            <div className="p-8 max-w-3xl mx-auto space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-lg text-blue-700 dark:text-blue-300 text-xs font-medium w-fit">
                  <span className="material-symbols-outlined text-[16px]">auto_awesome</span>{t('profile.aiNote')}
                </div>
                <div className="flex items-center gap-3">
                  {showNew && (
                    <button className={BTN_GHOST} onClick={() => setPipelineOpen(true)}>
                      <span className="material-symbols-outlined text-[18px]">add_task</span>{t('atp.title')}
                    </button>
                  )}
                  {editing ? (
                    <>
                      <button className={BTN_GHOST} onClick={stopEdit}>{t('common.cancel')}</button>
                      <button className={BTN_EDIT} onClick={save}>
                        <span className="material-symbols-outlined text-[18px]">check</span>{t('profile.save')}
                      </button>
                    </>
                  ) : (
                    <button className={BTN_EDIT} title={t('profile.editTitle')} onClick={startEdit}>
                      <span className="material-symbols-outlined text-[18px]">edit</span>{t('profile.edit')}
                    </button>
                  )}
                </div>
              </div>
              <section>
                <SectionTitle icon="person">{t('profile.section.personal')}</SectionTitle>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <TextField label={t('profile.field.fullName')} value={form.name} editing={editing} onChange={set('name')} />
                  <TextField label={t('profile.field.role')} value={form.title} editing={editing} onChange={set('title')} />
                  <SecretField label={t('profile.field.email')} value={form.email} editing={editing} onChange={set('email')} />
                  <div className="flex items-end">
                    <button className="w-full flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-xl shadow-sm transition-all whitespace-nowrap bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-500/20" title="Send email to candidate">
                      <span className="material-symbols-outlined text-[20px]">mail</span>{t('profile.sendEmail')}
                    </button>
                  </div>
                  <SecretField label={t('profile.field.phone')} value={form.phone} editing={editing} onChange={set('phone')} />
                  <div></div>
                  <button className="h-auto flex-1 flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-xl shadow-sm transition-all whitespace-nowrap bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white shadow-green-500/20" title="Open Zalo">
                    <span className="material-symbols-outlined text-[20px]">open_in_new</span>{t('profile.openZalo')}
                  </button>
                  <button className="flex-1 flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-xl shadow-sm transition-all whitespace-nowrap bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-emerald-500/20" title="Open WhatsApp">
                    <span className="material-symbols-outlined text-[20px]">call</span>{t('profile.openWhatsapp')}
                  </button>
                </div>
              </section>
              <hr className={HR} />
              <section>
                <SectionTitle icon="short_text">{t('profile.section.summary')}</SectionTitle>
                <div className="space-y-1.5 ">
                  <div className="relative group">
                    <textarea
                      className={TEXTAREA + (editing ? '' : READONLY)}
                      readOnly={!editing}
                      aria-label={t('profile.section.summary')}
                      rows={4}
                      value={form.summary}
                      onChange={(e) => set('summary')(e.target.value)}
                    />
                  </div>
                </div>
              </section>
              <hr className={HR} />
              <section>
                <SectionTitle icon="star">{t('profile.section.skills')}</SectionTitle>
                <div className="space-y-4">
                  <div>
                    <label className={SKILL_LABEL}>{t('profile.skills.primary')}</label>
                    <div className="flex flex-wrap gap-2">
                      {primary.map((s) => <span key={s} className={PILL_PRIMARY}>{s}</span>)}
                    </div>
                  </div>
                  {secondary.length > 0 && (
                    <div>
                      <label className={SKILL_LABEL}>{t('profile.skills.secondary')}</label>
                      <div className="flex flex-wrap gap-2">
                        {secondary.map((s) => <span key={s} className={PILL_SECONDARY}>{s}</span>)}
                      </div>
                    </div>
                  )}
                </div>
              </section>
              <hr className={HR} />
              <section>
                <SectionTitle icon="tune">{t('profile.section.attributes')}</SectionTitle>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <TextField label={t('profile.field.seniority')} value={form.seniority} editing={editing} onChange={set('seniority')} />
                  <TextField label={t('profile.field.english')} value={form.english} editing={editing} onChange={set('english')} />
                  <div className="space-y-1.5">
                    <label className={LABEL}>{t('profile.field.openToWork')}</label>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex flex-col gap-2 ">
                        <div className="flex items-center gap-3 mt-1">
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input className="sr-only peer" disabled readOnly type="checkbox" checked={Boolean(c.openToWork)} aria-label={t('profile.field.openToWork')} />
                            <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/40 rounded-full peer dark:bg-[#2a2423] peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label className="block text-sm font-medium text-[#181211] dark:text-[#e6dddb]">{t('profile.field.domain')}</label>
                    <div className="w-full rounded-lg border border-[#e6dddb] dark:border-[#3a3433] bg-[#f8f6f6] dark:bg-[#251f1e] p-2.5 flex flex-wrap gap-1.5">
                      {c.domains.map((d) => (
                        <span key={d} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-white dark:bg-[#1e1e1e] border border-[#e6dddb] dark:border-[#3a3433] text-[#181211] dark:text-white">{d}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                  <TextField label={t('profile.field.availability')} value="" editing={false} />
                  <TextField label={t('profile.field.rate')} value="" editing={false} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                  <div className="space-y-2">
                    <TextField label={t('profile.field.cvOwner')} value={userName(users, c.cvOwner)} editing={false} testId="candidate-detail-cvowner-input" />
                    <div className="flex items-center gap-4">
                      <button type="button" data-testid="candidate-detail-change-owner" className="text-sm font-semibold text-primary hover:underline">{t('profile.changeOwner')}</button>
                      <button type="button" className="text-sm font-semibold text-[#896a61] hover:underline">{t('profile.ownerHistory')}</button>
                    </div>
                  </div>
                  <TextField label={t('profile.field.lastUpdatedBy')} value="—" editing={false} testId="candidate-detail-lastupdatedby-input" />
                </div>
              </section>
              <hr className={HR} />
              <section>
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <SectionTitle icon="code">{t('profile.section.techStack')}</SectionTitle>
                    <div className="p-3 rounded-lg border border-[#e6dddb] dark:border-[#3a3433] bg-[#f8f6f6] dark:bg-[#251f1e] flex flex-wrap gap-2">
                      {(c.techStack ?? []).map((s) => (
                        <span key={s} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white dark:bg-[#1e1e1e] border border-[#e6dddb] dark:border-[#3a3433] text-sm text-[#181211] dark:text-white">{s}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
              <hr className={HR} />
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h3 className={SECTION_H3_ROW}>
                    <span className="material-symbols-outlined text-[18px]">work</span> {t('profile.section.experience')}
                  </h3>
                </div>
                <div className="space-y-4">
                  {(c.experience ?? []).map((x) => (
                    <div key={`${x.company}-${x.start}`} className={CARD}>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <SubField label={t('profile.exp.title')} value={x.title} />
                        <SubField label={t('profile.exp.company')} value={x.company} />
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <SubField label={t('profile.exp.start')} value={x.start} />
                        <SubField label={t('profile.exp.end')} value={x.end} />
                      </div>
                      <SubField label={t('profile.exp.desc')} value={x.description} area />
                    </div>
                  ))}
                </div>
              </section>
              <hr className={HR} />
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h3 className={SECTION_H3_ROW}>
                    <span className="material-symbols-outlined text-[18px]">school</span> {t('profile.section.education')}
                  </h3>
                </div>
                <div className="space-y-4">
                  {(c.education ?? []).map((e) => (
                    <div key={e.degree} className={CARD}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <SubField label={t('profile.edu.degree')} value={e.degree} />
                        <SubField label={t('profile.edu.institution')} value={e.institution} />
                        <SubField label={t('profile.edu.year')} value={e.year} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
              {showNew && (
                <>
                  <hr className={HR} />
                  <UsedIn candidateId={c.id} />
                </>
              )}
              <div className="h-8"></div>
            </div>
          </div>
          <div className="w-1/2 flex flex-col bg-gray-100 dark:bg-[#0f0a09]">
            <div className="h-12 bg-white dark:bg-[#1e1e1e] border-b border-[#e6dddb] dark:border-[#2a2423] flex items-center justify-between px-4 shadow-sm z-10">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[#896a61]">{t('profile.doc.original')}</span>
                <span className="text-sm font-bold text-[#181211] dark:text-white flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px] text-red-500">picture_as_pdf</span>{c.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-[#f8f6f6] dark:bg-[#251f1e] rounded-lg border border-[#e6dddb] dark:border-[#3a3433] p-1">
                  <button onClick={() => setZoom((z) => Math.max(0.5, z - ZOOM_STEP))} className="size-7 flex items-center justify-center rounded hover:bg-white dark:hover:bg-[#1e1e1e] text-[#896a61] transition-colors" title={t('profile.doc.zoomOut')}>
                    <span className="material-symbols-outlined text-[18px]">remove</span>
                  </button>
                  <button onClick={() => setZoom(1)} className="text-xs font-medium min-w-[40px] px-2 text-center text-[#181211] dark:text-white hover:text-primary transition-colors" title={t('profile.doc.resetZoom')}>
                    {Math.round(zoom * 100)}%
                  </button>
                  <button onClick={() => setZoom((z) => Math.min(2, z + ZOOM_STEP))} className="size-7 flex items-center justify-center rounded hover:bg-white dark:hover:bg-[#1e1e1e] text-[#896a61] transition-colors" title={t('profile.doc.zoomIn')}>
                    <span className="material-symbols-outlined text-[18px]">add</span>
                  </button>
                </div>
                <a href="#" target="_blank" rel="noopener noreferrer" className="size-8 flex items-center justify-center rounded-lg hover:bg-[#f8f6f6] dark:hover:bg-[#251f1e] text-[#896a61] transition-colors" title={t('profile.doc.openTab')}>
                  <span className="material-symbols-outlined text-[20px]">open_in_new</span>
                </a>
              </div>
            </div>
            <div className="flex-1 overflow-auto custom-scrollbar flex justify-center bg-[#525659] dark:bg-[#121212]">
              <div className="relative w-full h-full" style={{ overflow: 'hidden' }}>
                <CvDocument c={c} zoom={zoom} />
                <a className="absolute top-4 right-4 size-10 flex items-center justify-center bg-white dark:bg-gray-800 rounded-full shadow-lg hover:shadow-xl transition-shadow text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white cursor-pointer z-10" title={t('profile.doc.download')}>
                  <span className="material-symbols-outlined text-[20px]">download</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
      {showNew && <AddToPipelineModal open={pipelineOpen} onClose={() => setPipelineOpen(false)} candidateIds={[c.id]} />}
    </AppLayout>
  );
}
