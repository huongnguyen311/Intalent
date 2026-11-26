import type { Jd, Job } from '../domain/types';
import { jobPostFromJd } from '../domain/jobPost';
import { skillsExperienceOf, structuredBody } from './jobPosts';

/**
 * One open job whose JD and job post fill every field, so the public careers page can be demoed with nothing missing.
 * Added after the applications are built: it has no applicants and draws no rng, so the rest of the seed is unchanged.
 */
export const SHOWCASE_JD_ID = 'jd-2026-005';
export const SHOWCASE_JOB_ID = 'job-7';

const SKILLS = ['Node.js', 'TypeScript', 'NestJS', 'PostgreSQL', 'Redis', 'Kafka', 'Docker', 'Kubernetes', 'AWS', 'REST APIs', 'gRPC', 'Microservices'];

export function buildShowcaseJd(): Jd {
  const mustHave = [
    '4+ years building backend services with Node.js and TypeScript',
    'Solid PostgreSQL skills: schema design, indexing and query tuning',
    'Hands-on experience with microservices and message queues (Kafka or RabbitMQ)',
    'Comfortable with Docker and deploying to a cloud provider (AWS preferred)',
    'Upper-intermediate English to work daily with overseas clients',
  ];
  const responsibilities = [
    'Design, build and own backend services and APIs for a high-traffic payments platform',
    'Model data in PostgreSQL and keep queries fast as volume grows',
    'Build event-driven flows with Kafka and make them reliable and idempotent',
    'Write unit and integration tests and keep CI green',
    'Review code and mentor junior engineers on the team',
    'Work with product, QA and DevOps to plan, ship and monitor releases',
  ];
  const dailyTasks = [
    'Join the 15-minute stand-up with the Singapore product team',
    'Pick up sprint tickets, write code and open pull requests',
    'Review teammates’ pull requests',
    'Check dashboards and alerts for the services you own',
  ];
  const niceToHave = [
    'Experience in fintech, payments or e-wallets',
    'Kubernetes and Terraform in production',
    'gRPC or GraphQL APIs',
    'Observability tools (Grafana, Prometheus, OpenTelemetry)',
  ];
  const summary =
    'We are looking for a Senior Backend Engineer to help scale a payments platform that processes over 2 million ' +
    'transactions a day for customers across Southeast Asia. You will own core services end to end, from design to production.';
  const aboutTeam =
    'You will join a squad of 8 engineers (backend, frontend, QA) working directly with the client’s product team in Singapore. ' +
    'We run two-week sprints, review every pull request and share on-call fairly.';
  const skillsExperience = skillsExperienceOf({ mustHave, niceToHave });
  const body = structuredBody('Senior Backend Engineer (Node.js)', SKILLS, { summary, responsibilities, mustHave, niceToHave });
  return {
    id: SHOWCASE_JD_ID,
    code: 'JD-2026-005',
    title: 'Senior Backend Engineer (Node.js)',
    client: 'PayNest Fintech',
    domains: ['Fintech', 'Payments', 'E-commerce'],
    body,
    skills: SKILLS,
    criticalSkills: ['Node.js', 'TypeScript', 'PostgreSQL'],
    status: 'Published',
    mustHave,
    skillsExperience,
    niceToHave,
    seniority: 'Senior',
    minYears: 4,
    english: 'Upper-Intermediate',
    availableFrom: '2027-01-05',
    location: 'Ho Chi Minh City',
    workingModel: 'Hybrid',
    responsibilities,
    summary,
    aboutTeam,
    dailyTasks,
    education: 'bachelor',
    major: 'Computer Science, Software Engineering or a related field',
    languages: ['Japanese - N3 (a plus)'],
    certifications: ['AWS Certified Developer – Associate (a plus)'],
    otherRequirements: 'Able to join an on-call rotation one week in six (paid separately).',
    createdAt: '2026-11-02',
    updatedAt: '2026-11-10',
  };
}

const MIL = 1_000_000;

export function buildShowcaseJob(daysAgo: (d: number) => string): Job {
  return {
    id: SHOWCASE_JOB_ID,
    jdId: SHOWCASE_JD_ID,
    ...jobPostFromJd(buildShowcaseJd()),
    title: 'Senior Backend Engineer (Node.js)',
    department: 'Engineering',
    location: 'Ho Chi Minh City',
    level: 'Senior',
    employment: 'Full-time',
    workplace: 'hybrid',
    headcount: 2,
    status: 'open',
    hiringPriority: 'high',
    targetHiringDate: daysAgo(-40).slice(0, 10),
    urgencyReason: 'Client is launching a new payments region in Q1 and needs two more backend engineers. Budget approved by the Engineering Director.',
    minYears: 4,
    education: 'bachelor',
    stageSla: { new: 2, ai_screening: 1, screening: 5, interview: 7, assessment: 5, final_interview: 5, offer: 3 },
    openedAt: daysAgo(5),
    updatedAt: daysAgo(2),
    hiringManager: 'u-nam',
    salaryMin: 45 * MIL,
    salaryMax: 70 * MIL,
    currency: 'VND',
    showSalary: true,
    collaborators: ['u-huy', 'u-linh', 'u-tien'],
    interviewers: ['u-thu', 'u-chau'],
    questions: [
      { id: 'q-notice', label: 'What is your notice period?', type: 'text', required: true },
      { id: 'q-salary', label: 'What is your expected monthly salary (gross, VND)?', type: 'text', required: false },
      { id: 'q-hybrid', label: 'Can you work from our Ho Chi Minh City office 3 days a week?', type: 'yesno', required: true },
      { id: 'q-oncall', label: 'Are you open to a paid on-call rotation?', type: 'yesno', required: false },
    ],
    whyLove: [
      '- 13th-month salary plus a performance bonus twice a year',
      '- Premium health insurance for you and one family member',
      '- 15 days of paid leave, plus your birthday off',
      '- USD 500 yearly learning budget for courses, books and certifications',
      '- MacBook Pro and a 27" monitor from day one',
      '- Hybrid work: 3 days in the office, 2 days from home',
      '- Team trips, monthly happy hours and a yearly company retreat',
    ].join('\n'),
    additionalInfo: [
      'Office: 12th floor, 123 Nguyen Dinh Chieu, District 3, Ho Chi Minh City.',
      'Working hours: Monday to Friday, 9:00–18:00 (flexible start between 8:00 and 10:00).',
      'Hiring process:',
      '- HR screening call (20 minutes)',
      '- Technical interview with the team (60 minutes)',
      '- System design and culture fit with the Engineering Manager (60 minutes)',
      '- Offer within 3 working days after the final round',
    ].join('\n'),
  };
}
