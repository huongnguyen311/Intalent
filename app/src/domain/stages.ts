import { translate } from '../i18n/translate';
import type { Lang, Stage } from './types';

/** PRD 3.5 default pipeline, then the end states (Hired is reached via the flow; Rejected/Withdrawn end it early). */
export const CUSTOM_STAGES: Stage[] = ['custom_1', 'custom_2', 'custom_3', 'custom_4', 'custom_5', 'custom_6'];

export const STAGES: Stage[] = [
  'new', 'ai_screening', 'screening', 'interview', 'assessment', 'final_interview', ...CUSTOM_STAGES, 'offer', 'hired', 'rejected', 'withdrawn',
];

/** Stages a card moves forward through, in global order (no Rejected/Withdrawn). A job may show its columns in another order. */
export const FORWARD_STAGES: Stage[] = ['new', 'ai_screening', 'screening', 'interview', 'assessment', 'final_interview', ...CUSTOM_STAGES, 'offer', 'hired'];

export const isCustomStage = (stage: Stage): boolean => CUSTOM_STAGES.includes(stage);

/** Stages that end an application: no SLA, no further work. */
export const END_STAGES: Stage[] = ['hired', 'rejected', 'withdrawn'];

export const isEnded = (stage: Stage): boolean => END_STAGES.includes(stage);

/** Rejected or Withdrawn: the application closed without a hire. */
export const isClosedOut = (stage: Stage): boolean => stage === 'rejected' || stage === 'withdrawn';

export function stageLabel(stage: Stage, lang: Lang): string {
  return translate(lang, `stage.${stage}`);
}
