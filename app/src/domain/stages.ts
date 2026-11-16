import { translate } from '../i18n/translate';
import type { Lang, Stage } from './types';

export const STAGES: Stage[] = ['new', 'screening', 'interview', 'offer', 'hired', 'rejected'];

export function stageLabel(stage: Stage, lang: Lang): string {
  return translate(lang, `stage.${stage}`);
}
