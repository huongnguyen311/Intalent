import { useState } from 'react';
import { formatMoney, shortDate } from '../../domain/hiring';
import type { Application, Offer } from '../../domain/types';
import { useT } from '../../i18n/i18n';
import { useStore } from '../../store/store';

const BTN = 'h-10 px-5 rounded-full text-sm font-bold';

/**
 * The candidate's side of an offer: its terms, who to ask, and Accept / Decline (with a reason) while it is open.
 * Accepting moves the application to Hired, exactly as when the recruiter records the answer.
 */
export function OfferResponse({ app, offer, userId, onDone }: { app: Application; offer: Offer; userId: string; onDone: (ok: boolean, text: string) => void }) {
  const t = useT('careers');
  const owner = useStore((s) => s.users.find((u) => u.id === offer.createdBy));
  const [mode, setMode] = useState<'idle' | 'accept' | 'decline'>('idle');
  const [reason, setReason] = useState('');

  const answer = (accepted: boolean) => {
    const ok = useStore.getState().respondOffer(app.id, accepted, userId, accepted ? undefined : reason);
    onDone(ok, t(ok ? (accepted ? 'portal.offer.acceptedToast' : 'portal.offer.declinedToast') : 'portal.offer.failed'));
    setMode('idle');
  };

  return (
    <div className="mt-2 rounded-lg bg-emerald-50 text-emerald-800 px-3 py-3 text-sm space-y-2">
      <p>{t('portal.apps.offer', { salary: formatMoney(offer.salary, offer.currency), start: shortDate(offer.startDate), until: shortDate(offer.validUntil) })}</p>
      {offer.note && <p className="text-emerald-700 whitespace-pre-wrap">{offer.note}</p>}
      {owner && <p className="text-xs text-emerald-700">{t('portal.offer.contact', { name: owner.name, email: owner.email })}</p>}

      {offer.status === 'accepted' && <p className="font-bold">{t('portal.offer.accepted')}</p>}
      {offer.status === 'declined' && <p className="font-bold text-ink-muted">{t('portal.offer.declined')}</p>}

      {offer.status === 'sent' && mode === 'idle' && (
        <div className="flex gap-2 pt-1 flex-wrap">
          <button type="button" onClick={() => setMode('accept')} className={`${BTN} bg-emerald-600 text-white`}>{t('portal.offer.accept')}</button>
          <button type="button" onClick={() => setMode('decline')} className={`${BTN} bg-white ring-1 ring-emerald-200 text-emerald-800`}>{t('portal.offer.decline')}</button>
        </div>
      )}
      {offer.status === 'sent' && mode === 'accept' && (
        <div className="pt-1 space-y-2">
          <p className="font-semibold">{t('portal.offer.confirmAccept')}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => answer(true)} className={`${BTN} bg-emerald-600 text-white`}>{t('portal.offer.confirm')}</button>
            <button type="button" onClick={() => setMode('idle')} className={`${BTN} bg-white ring-1 ring-emerald-200`}>{t('portal.offer.back')}</button>
          </div>
        </div>
      )}
      {offer.status === 'sent' && mode === 'decline' && (
        <div className="pt-1 space-y-2">
          <label htmlFor={`decline-${app.id}`} className="block font-semibold">{t('portal.offer.reasonLabel')}</label>
          <textarea id={`decline-${app.id}`} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-white ring-1 ring-emerald-200 text-ink outline-none focus:ring-2 focus:ring-primary" />
          <div className="flex gap-2">
            <button type="button" disabled={!reason.trim()} onClick={() => answer(false)} className={`${BTN} bg-ink text-white disabled:opacity-40`}>{t('portal.offer.sendDecline')}</button>
            <button type="button" onClick={() => setMode('idle')} className={`${BTN} bg-white ring-1 ring-emerald-200`}>{t('portal.offer.back')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
