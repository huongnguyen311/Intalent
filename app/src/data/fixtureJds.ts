import type { ChatMessage, Jd, MockupMatching } from '../domain/types';

/** Fixture-only figures for JD Detail, JD Matching and AI Search history (mockup/jd-detail.html, jd-matching.html, assistant.html). */

export const FRONTEND_JD_ID = 'jd-2026-002';

const FRONTEND_JD_BODY =
  'SENIOR FRONTEND DEVELOPER\nSeniority: Senior\n\n\nABOUT THE ROLE\n\nWe are seeking a Senior Frontend Developer with 5+ years of professional experience to join our team. You will contribute to frontend solutions within the healthcare and SaaS sectors, working with React, TypeScript, and Vue to build user-facing products in this dynamic industry. Your expertise in frontend development will be essential as you collaborate on product initiatives that drive value for our clients and users.\n\n\nTECH STACK\n\nReact, TypeScript, Vue\n\n\nMUST-HAVE SKILLS\n\n- 5+ years of frontend development experience\n- Healthcare or SaaS industry experience\n- 5+ years of professional experience\n- None English level';

/** The mockup's detail page shows only the first two bullets as must-have skills. */
export function withMockupJdDetail(jds: Jd[]): Jd[] {
  return jds.map((j) =>
    j.id === FRONTEND_JD_ID
      ? {
          ...j,
          body: FRONTEND_JD_BODY,
          mustHave: ['5+ years of frontend development experience', 'Healthcare or SaaS industry experience'],
        }
      : j,
  );
}

const row = (
  name: string, title: string, score: number, seniority: string, years: number, english: string,
  have: string[], miss: string[], reason: string,
): MockupMatching['rows'][number] => ({
  candidateId: 'cand-mock-01', name, title, score, seniority, years, english, have, miss, reason,
});

export const MOCKUP_MATCHING: MockupMatching = {
  jdId: FRONTEND_JD_ID,
  english: 'Intermediate+',
  scanned: 781,
  strong: 12,
  partial: 37,
  lastRun: { time: '20:41', date: 'Nov 16, 2026' },
  rows: [
    row('Nguyen Hoang Long', 'Senior Frontend Engineer', 94, 'Senior', 7, 'Advanced', ['React', 'TypeScript', 'Vue'], [], '7 yrs React/TypeScript, 3 yrs on a hospital booking SaaS. Led migration from Vue 2 to Vue 3.'),
    row('Tran Thi Mai Anh', 'Frontend Tech Lead', 91, 'Lead', 9, 'Advanced', ['React', 'TypeScript'], ['Vue'], 'Strong React + TS, leads a team of 5 on a B2B SaaS dashboard. No recent Vue work.'),
    row('Le Quang Huy', 'Senior Software Engineer (Web)', 87, 'Senior', 6, 'Intermediate', ['React', 'Vue', 'TypeScript'], [], 'Full frontend stack match. Domain is fintech rather than healthcare.'),
    row('Pham Ngoc Tram', 'Frontend Developer', 82, 'Middle', 5, 'Advanced', ['React', 'TypeScript'], ['Vue'], '5 yrs React in an e-health startup. Seniority one level below the JD.'),
    row('Vo Minh Tuan', 'Senior Vue.js Developer', 78, 'Senior', 8, 'Intermediate', ['Vue', 'TypeScript'], ['React'], 'Vue expert with SaaS background. Limited React experience (side projects only).'),
    row('Dang Bao Tran', 'Fullstack Developer', 74, 'Senior', 6, 'Basic', ['React', 'TypeScript'], ['Vue'], 'Good stack overlap, mostly backend in the last 2 years. English below requirement.'),
    row('Huynh Gia Khang', 'UI Engineer', 69, 'Middle', 4, 'Advanced', ['React'], ['TypeScript', 'Vue'], 'Strong UI/design-system work in React, JavaScript only. 4 yrs experience.'),
    row('Bui Thanh Son', 'Frontend Developer', 63, 'Middle', 3, 'Intermediate', ['Vue'], ['React', 'TypeScript'], 'Vue 3 on healthcare portal. Below required experience and stack coverage.'),
  ],
};

const OLD = '2026-03-24T15:30:21.000Z';
const q = (n: number, text: string): ChatMessage[] => [
  { sessionId: `chat-mock-${n}`, role: 'user', text, at: OLD },
  { sessionId: `chat-mock-${n}`, role: 'assistant', text: '', at: OLD, results: [] },
];

/** History sidebar of the mockup (all under "Older"). */
export const MOCKUP_CHATS: ChatMessage[] = [
  ...q(1, 'Frontend Developer'),
  ...q(2, 'Frontend Developer'),
  ...q(3, 'Tìm ứng viên senior .Net, có tiếng Anh Good.'),
  ...q(4, 'tìm dev .Net tiêng anh tốt'),
];
