import type { Lang, Stage } from './types';

export const STAGES: Stage[] = ['new', 'screening', 'interview', 'offer', 'hired', 'rejected'];

const LABELS: Record<Stage, Record<Lang, string>> = {
  new: { en: 'New', vi: 'Mới' },
  screening: { en: 'Screening', vi: 'Sàng lọc' },
  interview: { en: 'Interview', vi: 'Phỏng vấn' },
  offer: { en: 'Offer', vi: 'Đề nghị' },
  hired: { en: 'Hired', vi: 'Đã tuyển' },
  rejected: { en: 'Rejected', vi: 'Từ chối' },
};

export function stageLabel(stage: Stage, lang: Lang): string {
  return LABELS[stage][lang];
}
