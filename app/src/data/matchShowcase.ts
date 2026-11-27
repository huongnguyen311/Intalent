import type { Activity, Candidate, DemoState } from '../domain/types';
import { SOURCE_CV_UPLOAD, SOURCE_REFERRAL } from '../domain/sources';
import { withProfiles } from './seedDetail';

/**
 * Candidates written to fit the seeded JDs, so JD Matching shows its whole UI at the default 70% threshold:
 * strong and partial fits with ✓/✕ skill chips, a stated rate or "Contact for rate", start dates, several
 * locations, and (for the Senior Frontend JD) more than one page of results. A few sit just under 70%
 * so lowering the slider visibly adds people. Rng-free and added after every seeded figure is built.
 */
type Spec = {
  name: string; title: string; seniority: string; english: string; skills: string[]; domains: string[];
  location: string; rate?: number; startInDays?: number; referral?: boolean;
};

const SPECS: Spec[] = [
  // Senior Frontend Developer (jd-2026-002): React, TypeScript, Vue · Healthcare, SaaS · Senior 5y.
  { name: 'Lam Bao Ngoc', title: 'Senior Frontend Engineer', seniority: 'Senior', english: 'Advanced', skills: ['React', 'TypeScript', 'Vue', 'Next.js', 'Tailwind CSS'], domains: ['Healthcare', 'SaaS'], location: 'Ho Chi Minh City', rate: 2800, startInDays: 14 },
  { name: 'Trinh Quoc Viet', title: 'Frontend Tech Lead', seniority: 'Lead', english: 'Fluent', skills: ['React', 'TypeScript', 'Vue', 'Next.js', 'GraphQL'], domains: ['SaaS'], location: 'Hanoi', rate: 3600, startInDays: 30 },
  { name: 'Ha Minh Chau', title: 'Senior React Developer', seniority: 'Senior', english: 'Intermediate', skills: ['React', 'TypeScript', 'Redux', 'Jest'], domains: ['Healthcare'], location: 'Da Nang', startInDays: 7 },
  { name: 'Quach Thanh Tung', title: 'Senior Vue.js Developer', seniority: 'Senior', english: 'Advanced', skills: ['Vue', 'TypeScript', 'Nuxt', 'Pinia'], domains: ['SaaS', 'Healthcare'], location: 'Ho Chi Minh City', rate: 2500 },
  { name: 'Diep Gia Han', title: 'Frontend Developer', seniority: 'Middle', english: 'Advanced', skills: ['React', 'TypeScript', 'Vue', 'Storybook'], domains: ['Healthcare', 'SaaS'], location: 'Can Tho', rate: 1500, startInDays: 21, referral: true },
  { name: 'Kieu Anh Duy', title: 'Senior Frontend Engineer', seniority: 'Senior', english: 'Basic', skills: ['React', 'TypeScript', 'Vue', 'Vite'], domains: ['SaaS'], location: 'Hanoi', rate: 2300, startInDays: 45 },
  { name: 'Mac Thu Trang', title: 'Senior UI Engineer', seniority: 'Senior', english: 'Intermediate', skills: ['React', 'TypeScript', 'Vue', 'Figma'], domains: ['Healthcare'], location: 'Remote (Vietnam)', startInDays: 10 },
  { name: 'Ong Tuan Kiet', title: 'Senior Web Developer', seniority: 'Senior', english: 'Intermediate', skills: ['React', 'Vue', 'JavaScript', 'Sass'], domains: ['E-commerce'], location: 'Ho Chi Minh City', rate: 2000 },
  { name: 'Luu My Duyen', title: 'Junior Frontend Developer', seniority: 'Junior', english: 'Intermediate', skills: ['React', 'TypeScript', 'HTML', 'CSS'], domains: ['Education'], location: 'Hue', rate: 700, startInDays: 7 },

  // Senior Backend Engineer (Node.js) (jd-2026-005): 12 skills · Fintech, Payments, E-commerce · Senior 4y.
  { name: 'Tang Duc Thinh', title: 'Senior Backend Engineer', seniority: 'Senior', english: 'Advanced', skills: ['Node.js', 'TypeScript', 'NestJS', 'PostgreSQL', 'Redis', 'Kafka', 'Docker', 'Kubernetes', 'AWS', 'REST APIs', 'gRPC', 'Microservices'], domains: ['Fintech', 'Payments'], location: 'Ho Chi Minh City', rate: 3400, startInDays: 30 },
  { name: 'Van Ngoc Son', title: 'Backend Team Lead', seniority: 'Lead', english: 'Advanced', skills: ['Node.js', 'TypeScript', 'NestJS', 'PostgreSQL', 'Redis', 'Kafka', 'Docker', 'Kubernetes', 'AWS'], domains: ['Payments', 'E-commerce'], location: 'Hanoi', startInDays: 60 },
  { name: 'Chu Thi Lan Anh', title: 'Senior Node.js Developer', seniority: 'Senior', english: 'Intermediate', skills: ['Node.js', 'TypeScript', 'PostgreSQL', 'Redis', 'Docker', 'AWS', 'REST APIs', 'Microservices'], domains: ['Fintech'], location: 'Da Nang', rate: 2700 },
  { name: 'Phung Hai Dang', title: 'Senior Software Engineer', seniority: 'Senior', english: 'Advanced', skills: ['Node.js', 'TypeScript', 'NestJS', 'PostgreSQL', 'Kafka', 'gRPC', 'Microservices', 'Docker'], domains: ['E-commerce'], location: 'Ho Chi Minh City', rate: 3000, startInDays: 14, referral: true },
  { name: 'Lac Minh Quan', title: 'Backend Developer', seniority: 'Middle', english: 'Intermediate', skills: ['Node.js', 'TypeScript', 'NestJS', 'PostgreSQL', 'Redis', 'Docker', 'REST APIs'], domains: ['Payments'], location: 'Hanoi', rate: 1700, startInDays: 14 },
  { name: 'Thai Bao Long', title: 'Principal Backend Engineer', seniority: 'Principal', english: 'Fluent', skills: ['Node.js', 'TypeScript', 'NestJS', 'PostgreSQL', 'Redis', 'Docker', 'Kubernetes', 'AWS', 'REST APIs', 'Microservices'], domains: ['Fintech', 'Payments', 'E-commerce'], location: 'Singapore', rate: 5200, startInDays: 90 },
  { name: 'Ninh Thu Ha', title: 'Senior Backend Engineer', seniority: 'Senior', english: 'Advanced', skills: ['Node.js', 'TypeScript', 'PostgreSQL', 'Redis', 'Kafka', 'Docker', 'Kubernetes', 'AWS', 'Microservices'], domains: ['Fintech', 'Payments'], location: 'Ho Chi Minh City' },
  { name: 'Giang Van Hieu', title: 'Senior Java Developer', seniority: 'Senior', english: 'Intermediate', skills: ['Java', 'Spring Boot', 'PostgreSQL', 'Docker', 'AWS', 'Kafka'], domains: ['Fintech'], location: 'Hanoi', rate: 2600, startInDays: 30 },
  { name: 'Hua Khanh Linh', title: 'Senior Backend Engineer', seniority: 'Senior', english: 'Advanced', skills: ['Node.js', 'TypeScript', 'NestJS', 'PostgreSQL', 'Redis', 'Kafka', 'Docker', 'Kubernetes', 'REST APIs', 'gRPC', 'Microservices'], domains: ['E-commerce', 'Fintech'], location: 'Da Nang', rate: 3100, startInDays: 21 },

  // Tech Lead / Senior Engineer (jd-2026-003): 12 skills · SaaS, B2B Sales Technology · Lead 7y · Advanced English.
  { name: 'Doan Nhat Minh', title: 'Engineering Lead', seniority: 'Lead', english: 'Advanced', skills: ['ReactJS', 'TypeScript', 'Node.js', 'PostgreSQL', 'Docker', 'AWS', 'GraphQL', 'CI/CD', 'System Design', 'Code Review', 'Mentoring', 'Redis'], domains: ['SaaS', 'B2B Sales Technology'], location: 'Ho Chi Minh City', rate: 4500, startInDays: 45 },
  { name: 'Au Thanh Phong', title: 'Tech Lead', seniority: 'Lead', english: 'Advanced', skills: ['ReactJS', 'TypeScript', 'Node.js', 'PostgreSQL', 'Docker', 'AWS', 'System Design', 'Code Review', 'Mentoring'], domains: ['SaaS'], location: 'Hanoi', startInDays: 30 },
  { name: 'Ta Quynh Nhu', title: 'Principal Engineer', seniority: 'Principal', english: 'Fluent', skills: ['ReactJS', 'TypeScript', 'Node.js', 'GraphQL', 'Redis', 'CI/CD', 'System Design', 'Mentoring'], domains: ['SaaS'], location: 'Remote (Vietnam)', rate: 5000 },
  { name: 'Khuc Duy Anh', title: 'Senior Full-stack Engineer', seniority: 'Senior', english: 'Advanced', skills: ['ReactJS', 'TypeScript', 'Node.js', 'PostgreSQL', 'Docker', 'AWS', 'System Design'], domains: ['B2B Sales Technology'], location: 'Da Nang', rate: 3200, startInDays: 14 },
  { name: 'Bach Hong Phuc', title: 'Backend Lead', seniority: 'Lead', english: 'Intermediate', skills: ['TypeScript', 'Node.js', 'PostgreSQL', 'Docker', 'AWS', 'CI/CD', 'Code Review'], domains: ['Logistics'], location: 'Ho Chi Minh City', rate: 3800 },

  // Senior Flutter & Java Engineer (jd-2026-001): 5 skills · Robotics, Mobile Applications · Senior 4y.
  { name: 'Yen Hoai Nam', title: 'Senior Mobile Engineer', seniority: 'Senior', english: 'Advanced', skills: ['Flutter', 'Java', 'Dart', 'Kotlin', 'REST APIs'], domains: ['Mobile Applications', 'Robotics'], location: 'Ho Chi Minh City', rate: 2900, startInDays: 21 },
  { name: 'Tieu Bich Ngoc', title: 'Senior Flutter Developer', seniority: 'Senior', english: 'Intermediate', skills: ['Flutter', 'Dart', 'Kotlin', 'REST APIs', 'Firebase'], domains: ['Mobile Applications'], location: 'Hanoi', startInDays: 7 },
  { name: 'Lo Van Khai', title: 'Mobile Tech Lead', seniority: 'Lead', english: 'Advanced', skills: ['Flutter', 'Java', 'Dart', 'Swift'], domains: ['Mobile Applications'], location: 'Da Nang', rate: 3500, startInDays: 60 },
  { name: 'Cu Thao Vy', title: 'Flutter Developer', seniority: 'Middle', english: 'Intermediate', skills: ['Flutter', 'Dart', 'REST APIs', 'Bloc'], domains: ['Mobile Applications'], location: 'Can Tho', rate: 1400, startInDays: 14 },
];

const DAY = 86_400_000;
const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]+/g, '.');

export const MATCH_SHOWCASE_COUNT = SPECS.length;

export function withMatchShowcase(s: DemoState, base: number): DemoState {
  const day = (n: number) => new Date(base + n * DAY).toISOString();
  const bare: Candidate[] = SPECS.map((p, i) => ({
    id: `cand-m${String(i + 1).padStart(2, '0')}`,
    name: p.name,
    title: p.title,
    email: `${slug(p.name)}@example.com`,
    phone: `09${String(81_000_000 + i * 137_911).slice(0, 8)}`,
    seniority: p.seniority,
    english: p.english,
    skills: p.skills,
    domains: p.domains,
    tags: [],
    groups: [],
    cvOwner: ['u-huy', 'u-linh', 'u-tien', 'u-chau'][i % 4],
    source: p.referral ? SOURCE_REFERRAL : SOURCE_CV_UPLOAD,
    inTalentPool: true as const,
    createdAt: day(-(3 + i * 4)),
    cv: `${p.title} (${p.seniority}). Skills: ${p.skills.join(', ')}.`,
  }));
  const candidates = withProfiles(bare, base).map((c, i) => {
    const p = SPECS[i];
    return {
      ...c,
      location: p.location,
      expectedRate: p.rate,
      availableFrom: p.startInDays === undefined ? undefined : day(p.startInDays).slice(0, 10),
      consents: [{ purpose: 'recruitment' as const, policyVersion: '2026-01', at: c.createdAt }],
    };
  });
  const created: Activity[] = candidates.map((c) => ({
    type: 'candidate_created', candidateId: c.id, by: c.cvOwner, at: c.createdAt, detail: `Added to Talent Pool via ${c.source}`,
  }));
  return {
    ...s,
    candidates: [...s.candidates, ...candidates],
    activities: [...s.activities, ...created].sort((a, b) => a.at.localeCompare(b.at)),
  };
}
