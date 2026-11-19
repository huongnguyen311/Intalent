import { TIMEZONES } from '../../domain/company';
import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import { toast } from '../../components/Toast';
import { localStamp, localTimeZone, TEMPLATE, zoneLabel } from '../../domain/hiring';
import type { Application, InterviewMode } from '../../domain/types';
import { assignableUsers } from '../../domain/users';
import { useLang, useT } from '../../i18n/i18n';
import { me } from '../../store/session';
import { useStore } from '../../store/store';
import { sendTemplate } from './emailVars';
import { BTN_GHOST, BTN_PRIMARY, FIELD, Field } from './ui';

const MODES: InterviewMode[] = ['online', 'onsite', 'phone'];
const DURATIONS = [30, 45, 60, 90];

/** Tomorrow 10:00 local. */
function defaultSlot(): { date: string; time: string } {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  const [date, time] = localStamp(d).split('T');
  return { date, time };
}

type Props = { open: boolean; app: Application; candidateName: string; hasEmail: boolean; onClose: () => void };

/** Schedule one interview round; optionally emails the invitation (simulated). */
export function InterviewDialog({ open, app, candidateName, hasEmail, onClose }: Props) {
  const t = useT();
  const [lang] = useLang();
  const users = useStore((s) => s.users);
  const job = useStore((s) => s.jobs.find((j) => j.id === app.jobId));
  const [round, setRound] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState(60);
  const [mode, setMode] = useState<InterviewMode>('online');
  const [place, setPlace] = useState('');
  const [panel, setPanel] = useState<string[]>([]);
  const [notify, setNotify] = useState(true);
  const [error, setError] = useState('');
  // PRD 3.6: times carry a zone; it starts from the company time zone once one is set in Company settings.
  const companyZone = useStore((s) => s.company?.timezone);
  const [zone, setZone] = useState<string | undefined>(companyZone ?? localTimeZone());

  useEffect(() => {
    if (!open) return;
    const n = (app.interviews ?? []).filter((i) => i.status !== 'cancelled').length + 1;
    const slot = defaultSlot();
    setRound(t('interview.defaultRound', { n }));
    setDate(slot.date);
    setTime(slot.time);
    setDuration(60);
    setMode('online');
    setPlace('');
    setPanel(job ? [job.hiringManager] : [me()]);
    setNotify(hasEmail);
    setError('');
    setZone(companyZone ?? localTimeZone());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggle = (id: string) => setPanel((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const save = () => {
    if (!round.trim() || !date || !time) return setError(t('interview.err.required'));
    if (panel.length === 0) return setError(t('interview.err.panel'));
    const iv = useStore.getState().scheduleInterview(
      app.id,
      { round, at: `${date}T${time}`, durationMin: duration, mode, place, interviewers: panel, ...(zone ? { timeZone: zone } : {}) },
      me(),
    );
    if (!iv) return setError(t('interview.err.required'));
    const mailed = notify && sendTemplate(TEMPLATE.interview, app.id, me(), lang, iv);
    toast(t(mailed ? 'interview.toast.scheduledMailed' : 'interview.toast.scheduled', { name: candidateName }));
    onClose();
  };

  return (
    <Modal
      open={open}
      wide
      title={t('interview.schedule')}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className={BTN_GHOST}>{t('common.cancel')}</button>
          <button onClick={save} className={BTN_PRIMARY}>{t('interview.save')}</button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field id="iv-round" label={t('interview.round')}>
          <input id="iv-round" className={FIELD} value={round} onChange={(e) => setRound(e.target.value)} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field id="iv-date" label={t('interview.date')}>
            <input id="iv-date" type="date" className={FIELD} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field id="iv-time" label={t('interview.time')}>
            <input id="iv-time" type="time" aria-describedby="iv-zone" className={FIELD} value={time} onChange={(e) => setTime(e.target.value)} />
            {zone && <p id="iv-zone" className="text-xs text-[#896a61] mt-1">{t('interview.zone', { zone: `${zoneLabel(zone, `${date || '2026-01-01'}T${time || '00:00'}`)} · ${zone}` })}</p>}
            {companyZone && (
              <select aria-label={t('company.timezone')} className={`${FIELD} mt-1 !py-1 text-xs`} value={zone} onChange={(e) => setZone(e.target.value)}>
                {[...new Set([zone ?? companyZone, companyZone, ...TIMEZONES])].map((z) => <option key={z} value={z}>{z}</option>)}
              </select>
            )}
          </Field>
          <Field id="iv-duration" label={t('interview.duration')}>
            <select id="iv-duration" className={FIELD} value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {DURATIONS.map((d) => <option key={d} value={d}>{t('interview.minutes', { n: d })}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field id="iv-mode" label={t('interview.mode')}>
            <select id="iv-mode" className={FIELD} value={mode} onChange={(e) => setMode(e.target.value as InterviewMode)}>
              {MODES.map((m) => <option key={m} value={m}>{t(`interview.mode.${m}`)}</option>)}
            </select>
          </Field>
          <div className="col-span-2">
            <Field id="iv-place" label={t(mode === 'online' ? 'interview.link' : mode === 'phone' ? 'interview.phone' : 'interview.place')}>
              <input id="iv-place" className={FIELD} value={place} onChange={(e) => setPlace(e.target.value)} placeholder={mode === 'online' ? 'https://meet.example.com/…' : ''} />
            </Field>
          </div>
        </div>
        <fieldset>
          <legend className="text-xs font-semibold text-[#896a61] mb-2">{t('interview.interviewers')}</legend>
          <div className="grid grid-cols-2 gap-2">
            {assignableUsers(users).map((u) => (
              <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={panel.includes(u.id)} onChange={() => toggle(u.id)} className="rounded border-gray-300 text-primary focus:ring-primary" />
                {u.name}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={notify} disabled={!hasEmail} onChange={(e) => setNotify(e.target.checked)} className="rounded border-gray-300 text-primary focus:ring-primary" />
          {t(hasEmail ? 'interview.notify' : 'interview.notifyNoEmail')}
        </label>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
