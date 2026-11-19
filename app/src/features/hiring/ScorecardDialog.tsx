import { useEffect, useState } from 'react';
import { Modal } from '../../components/Modal';
import { toast } from '../../components/Toast';
import { SCORE_CRITERIA, type Interview, type Recommendation, type ScoreCriterion } from '../../domain/types';
import { useT } from '../../i18n/i18n';
import { me } from '../../store/session';
import { useStore } from '../../store/store';
import { BTN_GHOST, BTN_PRIMARY, FIELD, FILLED, Field } from './ui';

export const RECOMMENDATIONS: Recommendation[] = ['strong_yes', 'yes', 'no', 'strong_no'];
const EMPTY: Record<ScoreCriterion, number> = { technical: 0, communication: 0, problem: 0, culture: 0 };

type Props = { open: boolean; appId: string; interview: Interview; onClose: () => void };

/** The current user's scorecard for one round: 1–5 per criterion, an overall recommendation and a note. */
export function ScorecardDialog({ open, appId, interview, onClose }: Props) {
  const t = useT();
  const [scores, setScores] = useState(EMPTY);
  const [rec, setRec] = useState<Recommendation | ''>('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open) return;
    const mine = interview.scorecards.find((c) => c.by === me());
    setScores(mine?.scores ?? EMPTY);
    setRec(mine?.recommendation ?? '');
    setNote(mine?.note ?? '');
  }, [open, interview]);

  // Named so a disabled Submit explains itself.
  const missing = [
    ...SCORE_CRITERIA.filter((c) => !(scores[c] > 0)).map((c) => t(`scorecard.criterion.${c}`)),
    ...(rec === '' ? [t('scorecard.recommendation')] : []),
  ];
  const complete = missing.length === 0;

  const save = () => {
    if (!complete || rec === '') return;
    if (useStore.getState().submitScorecard(appId, interview.id, { scores, recommendation: rec, note }, me())) {
      toast(t('scorecard.toast'));
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      title={t('scorecard.title', { round: interview.round })}
      onClose={onClose}
      footer={
        <>
          {!complete && <span className="mr-auto self-center text-xs text-[#896a61]">{t('scorecard.missing', { list: missing.join(', ') })}</span>}
          <button onClick={onClose} className={BTN_GHOST}>{t('common.cancel')}</button>
          <button onClick={save} disabled={!complete} className={BTN_PRIMARY}>{t('scorecard.submit')}</button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {SCORE_CRITERIA.map((c) => (
          <div key={c} className="flex items-center justify-between gap-3">
            <span className="font-medium">{t(`scorecard.criterion.${c}`)}</span>
            <span className="flex" role="group" aria-label={t(`scorecard.criterion.${c}`)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-label={t('pipeline.drawer.rate', { n })}
                  aria-pressed={n <= scores[c]}
                  onClick={() => setScores({ ...scores, [c]: n })}
                  className={`material-symbols-outlined text-[22px] hover:scale-110 transition-transform ${n <= scores[c] ? 'text-amber-400' : 'text-gray-300'}`}
                  style={FILLED}
                >
                  star
                </button>
              ))}
            </span>
          </div>
        ))}
        <fieldset>
          <legend className="text-xs font-semibold text-[#896a61] mb-2">{t('scorecard.recommendation')}</legend>
          <div className="grid grid-cols-2 gap-2">
            {RECOMMENDATIONS.map((r) => (
              <label key={r} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm ${rec === r ? 'border-primary bg-primary/5' : 'border-[#e6dddb] dark:border-[#3a3433]'}`}>
                <input type="radio" name="sc-rec" checked={rec === r} onChange={() => setRec(r)} className="text-primary focus:ring-primary" />
                {t(`scorecard.rec.${r}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <Field id="sc-note" label={t('scorecard.note')}>
          <textarea id="sc-note" rows={3} className={FIELD} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
