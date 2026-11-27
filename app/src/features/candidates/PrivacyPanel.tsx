import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { toast } from '../../components/Toast';
import type { Candidate } from '../../domain/types';
import { useT } from '../../i18n/i18n';
import { me, useCan } from '../../store/session';
import { useStore } from '../../store/store';
import { fullDate } from '../jds/format';

/**
 * PRD 1.3 / AC-12: consent records and the "anonymize" request flow. Anonymizing erases contact details, CV,
 * files and emails, withdraws consents and writes an audit event; skills and dates stay for reporting.
 */
export function PrivacyPanel({ candidate }: { candidate: Candidate }) {
  const t = useT();
  const allowed = useCan()('privacy');
  const [confirming, setConfirming] = useState(false);
  const consents = candidate.consents ?? [];
  if (!allowed && consents.length === 0) return null;

  const anonymize = () => {
    if (useStore.getState().anonymizeCandidate(candidate.id, me())) toast(t('privacy.toast.done'));
    setConfirming(false);
  };

  return (
    <section data-testid="privacy-panel" className="rounded-2xl border border-line dark:border-dark-line bg-white dark:bg-dark-surface p-5 sm:p-6 space-y-3">
      <h3 className="flex items-center gap-2 text-base font-semibold text-ink dark:text-white">
        <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-primary">shield_person</span>
        {t('privacy.title')}
      </h3>
      {candidate.anonymizedAt && (
        <p className="text-sm rounded-lg bg-gray-100 dark:bg-white/5 px-3 py-2">{t('privacy.anonymizedOn', { date: fullDate(candidate.anonymizedAt) })}</p>
      )}
      {consents.length === 0 ? (
        <p className="text-xs text-ink-muted">{t('privacy.noConsent')}</p>
      ) : (
        <ul className="space-y-1 text-xs">
          {consents.map((c, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className={`size-2 rounded-full ${c.withdrawnAt ? 'bg-gray-400' : 'bg-emerald-500'}`}></span>
              {t('privacy.consentLine', { date: fullDate(c.at), version: c.policyVersion })}
              {c.withdrawnAt && <span className="text-ink-muted">· {t('privacy.withdrawn', { date: fullDate(c.withdrawnAt) })}</span>}
            </li>
          ))}
        </ul>
      )}
      {allowed && !candidate.anonymizedAt && (
        <button onClick={() => setConfirming(true)} className="px-3 py-1.5 text-xs font-bold rounded-full border border-red-200 text-red-600 hover:bg-red-50">
          {t('privacy.anonymize')}
        </button>
      )}
      <Modal
        open={confirming}
        title={t('privacy.confirmTitle')}
        onClose={() => setConfirming(false)}
        footer={
          <>
            <button onClick={() => setConfirming(false)} className="px-4 py-2 text-sm font-bold rounded-full border border-line">{t('common.cancel')}</button>
            <button onClick={anonymize} className="px-4 py-2 text-sm font-bold rounded-full bg-red-600 text-white hover:bg-red-700">{t('privacy.anonymize')}</button>
          </>
        }
      >
        <p>{t('privacy.confirmBody', { name: candidate.name })}</p>
      </Modal>
    </section>
  );
}
