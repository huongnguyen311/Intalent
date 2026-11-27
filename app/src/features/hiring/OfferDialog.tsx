import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import { toast } from '../../components/Toast';
import { localStamp, salaryRange } from '../../domain/hiring';
import { CURRENCIES, type Application, type Currency } from '../../domain/types';
import { useT } from '../../i18n/i18n';
import { me } from '../../store/session';
import { useStore } from '../../store/store';
import { EMPLOYMENTS } from '../jobs/jobForm';
import { BTN_GHOST, BTN_PRIMARY, FIELD, Field } from './ui';

const inDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return localStamp(d).slice(0, 10);
};

type Props = { open: boolean; app: Application; onClose: () => void };

/** Create or edit the offer as a draft. Sending it is a separate step (email), so HR can review first. */
export function OfferDialog({ open, app, onClose }: Props) {
  const t = useT();
  const job = useStore((s) => s.jobs.find((j) => j.id === app.jobId));
  const [salary, setSalary] = useState('');
  const [currency, setCurrency] = useState<Currency>('VND');
  const [startDate, setStartDate] = useState('');
  const [contract, setContract] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    const o = app.offer;
    setSalary(o ? String(o.salary) : job?.salaryMax ? String(job.salaryMax) : '');
    setCurrency(o?.currency ?? job?.currency ?? 'VND');
    setStartDate(o?.startDate ?? inDays(30));
    setContract(o?.contract ?? job?.employment ?? EMPLOYMENTS[0]);
    setValidUntil(o?.validUntil ?? inDays(7));
    setNote(o?.note ?? '');
    setError('');
  }, [open, app.offer, job]);

  const range = job && salaryRange(job);

  const save = () => {
    const amount = Number(salary.replace(/[^\d]/g, ''));
    if (!(amount > 0) || !startDate || !validUntil) return setError(t('offer.err.required'));
    if (validUntil < localStamp(new Date()).slice(0, 10)) return setError(t('offer.err.expired'));
    if (useStore.getState().saveOffer(app.id, { salary: amount, currency, startDate, contract, validUntil, note }, me())) {
      toast(t('offer.toast.saved'));
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      title={t(app.offer ? 'offer.edit' : 'offer.create')}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className={BTN_GHOST}>{t('common.cancel')}</button>
          <button onClick={save} className={BTN_PRIMARY}>{t('offer.saveDraft')}</button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Field id="of-salary" label={t('offer.salary')}>
              <input id="of-salary" inputMode="numeric" className={FIELD} value={salary} onChange={(e) => setSalary(e.target.value)} />
            </Field>
          </div>
          <Field id="of-currency" label={t('offer.currency')}>
            <select id="of-currency" className={FIELD} value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </div>
        {range && <p className="text-xs text-ink-muted -mt-2">{t('offer.jobRange', { range })}</p>}
        <div className="grid grid-cols-2 gap-3">
          <Field id="of-start" label={t('offer.startDate')}>
            <input id="of-start" type="date" className={FIELD} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field id="of-valid" label={t('offer.validUntil')}>
            <input id="of-valid" type="date" className={FIELD} value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </Field>
        </div>
        <Field id="of-contract" label={t('offer.contract')}>
          <select id="of-contract" className={FIELD} value={contract} onChange={(e) => setContract(e.target.value)}>
            {(EMPLOYMENTS.includes(contract) || !contract ? EMPLOYMENTS : [...EMPLOYMENTS, contract]).map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </Field>
        <Field id="of-note" label={t('offer.note')}>
          <textarea id="of-note" rows={3} className={FIELD} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('offer.notePlaceholder')} />
        </Field>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}

type DeclineProps = { open: boolean; onClose: () => void; onConfirm: (reason: string) => void };

/** Declining needs a reason so it can be reported on later. */
export function DeclineOfferDialog({ open, onClose, onConfirm }: DeclineProps) {
  const t = useT();
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (open) setReason('');
  }, [open]);
  return (
    <Modal
      open={open}
      title={t('offer.decline.title')}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className={BTN_GHOST}>{t('common.cancel')}</button>
          <button disabled={!reason.trim()} onClick={() => onConfirm(reason.trim())} className="px-4 py-2 text-sm font-medium text-white rounded-lg shadow-sm bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed">
            {t('offer.decline.confirm')}
          </button>
        </>
      }
    >
      <Field id="of-decline" label={t('offer.decline.reason')}>
        <textarea id="of-decline" rows={3} autoFocus className={FIELD} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('offer.decline.placeholder')} />
      </Field>
    </Modal>
  );
}
