import { jobPostFromJd } from '../domain/jobPost';
import type { Jd, Job } from '../domain/types';

/** The structured JD fields the editor fills; each seeded JD gets all of them. */
type JdDetail = Required<Pick<Jd,
  'summary' | 'responsibilities' | 'dailyTasks' | 'aboutTeam' | 'mustHave' | 'niceToHave' | 'criticalSkills' | 'seniority' |
  'minYears' | 'english' | 'availableFrom' | 'location' | 'workingModel' | 'education' | 'major' | 'languages' |
  'certifications' | 'otherRequirements'>>;

/** The JD's pasted-text version, built from the structured fields so both say the same thing. */
export function structuredBody(title: string, skills: string[], d: Pick<JdDetail, 'summary' | 'responsibilities' | 'mustHave' | 'niceToHave'>): string {
  const list = (xs: string[]) => xs.map((x) => `- ${x}`);
  return [
    title.toUpperCase(), '',
    'ABOUT THE ROLE', d.summary, '',
    'RESPONSIBILITIES', ...list(d.responsibilities), '',
    'TECH STACK', skills.join(', '), '',
    'MUST-HAVE SKILLS', ...list(d.mustHave), '',
    'NICE TO HAVE', ...list(d.niceToHave),
  ].join('\n');
}

/** Careers-page "Your skills and experience": must-haves, then the nice-to-haves. */
export const skillsExperienceOf = (d: Pick<JdDetail, 'mustHave' | 'niceToHave'>) =>
  [...d.mustHave.map((m) => `- ${m}`), '', 'Nice to have:', ...d.niceToHave.map((n) => `- ${n}`)].join('\n');

const JD_DETAILS: Record<string, JdDetail> = {
  'jd-2026-004': {
    summary:
      'Northwind Retail is growing its online store across Vietnam and Thailand. As Senior Growth Marketing Lead you will own ' +
      'paid, organic and lifecycle channels end to end and turn data into a growth plan that pays back within the quarter.',
    responsibilities: [
      'Own the growth plan and monthly budget across Google Ads, Meta Ads, SEO and email',
      'Build and keep the funnel dashboards in GA4 and Looker Studio',
      'Plan and run A/B tests on landing pages, checkout and onboarding emails',
      'Set up and improve marketing automation journeys in HubSpot',
      'Report weekly on CAC, ROAS and conversion to the client’s leadership',
      'Coach two marketing executives on campaign setup and analysis',
    ],
    dailyTasks: [
      'Check spend, ROAS and alerts across ad accounts',
      'Review experiment results and decide what ships',
      'Sync with design and content on this week’s creatives',
    ],
    aboutTeam:
      'You will lead a small growth pod of 2 marketing executives, 1 designer and 1 content writer, working closely with the ' +
      'client’s e-commerce and product teams.',
    mustHave: [
      '5+ years in performance or growth marketing, 2+ years leading campaigns end to end',
      'Hands-on with Google Ads, Meta Ads and GA4',
      'Comfortable with SQL or Looker Studio to build your own reports',
      'Proven record of running A/B tests and improving conversion rates',
      'Upper-intermediate English for reports and calls with the client',
    ],
    niceToHave: [
      'E-commerce or retail marketing experience',
      'HubSpot or another marketing automation tool',
      'Experience with TikTok Ads or affiliate programs',
    ],
    criticalSkills: ['Google Ads', 'GA4', 'Meta Ads'],
    seniority: 'Senior',
    minYears: 5,
    english: 'Upper-Intermediate',
    availableFrom: '2027-01-05',
    location: 'Ho Chi Minh City',
    workingModel: 'Hybrid',
    education: 'bachelor',
    major: 'Marketing, Business, Economics or a related field',
    languages: ['Thai - basic (a plus)'],
    certifications: ['Google Ads Search Certification', 'GA4 Certification (a plus)'],
    otherRequirements: 'Occasional trips to Bangkok (2–3 times a year).',
  },
  'jd-2026-003': {
    summary:
      'Acme SaaS builds a B2B sales platform used by 1,200 companies. As Tech Lead you will guide a team of 6 engineers, ' +
      'own the architecture of the core product and still write code every week.',
    responsibilities: [
      'Lead technical design and architecture for the core platform',
      'Write and review code in React, TypeScript and Node.js',
      'Set coding standards, review practices and the CI/CD pipeline',
      'Break down the roadmap with the Product Manager and plan sprints',
      'Mentor engineers through 1:1s, pairing and code review',
      'Own reliability: monitoring, incident response and post-mortems',
    ],
    dailyTasks: [
      'Lead the morning stand-up and unblock the team',
      'Review pull requests and design documents',
      'Spend focus time on the hardest tickets',
    ],
    aboutTeam:
      'A fully remote team of 6 engineers and 1 QA across Vietnam and Singapore, working with the client’s product and design teams.',
    mustHave: [
      '7+ years of software engineering, 2+ years as a tech lead',
      'Strong React and TypeScript on the frontend, Node.js on the backend',
      'Designed and run systems on AWS with PostgreSQL and Redis',
      'Experience with Docker and CI/CD pipelines',
      'Fluent English: you will present designs to the client',
    ],
    niceToHave: [
      'GraphQL in production',
      'Experience in B2B SaaS or sales tools',
      'Hiring and onboarding engineers',
    ],
    criticalSkills: ['ReactJS', 'TypeScript', 'Node.js', 'System Design'],
    seniority: 'Lead',
    minYears: 7,
    english: 'Advanced',
    availableFrom: '2027-01-15',
    location: 'Ho Chi Minh City',
    workingModel: 'Remote',
    education: 'bachelor',
    major: 'Computer Science, Software Engineering or a related field',
    languages: [],
    certifications: ['AWS Certified Solutions Architect – Associate (a plus)'],
    otherRequirements: 'Overlap at least 4 hours a day with Singapore time (UTC+8).',
  },
  'jd-2026-002': {
    summary:
      'MediCore Health runs a patient portal used by 40 clinics. As Senior Frontend Developer you will build fast, accessible ' +
      'screens that patients and doctors rely on every day.',
    responsibilities: [
      'Build new features in React and TypeScript from design to release',
      'Turn Figma designs into reusable, accessible components',
      'Keep page speed and Core Web Vitals in the green',
      'Write unit and end-to-end tests for the screens you own',
      'Help move older Vue screens to the React codebase',
      'Review code and support two junior frontend developers',
    ],
    dailyTasks: [
      'Join stand-up with the product squad',
      'Pair with the designer on new screens',
      'Review and merge pull requests',
    ],
    aboutTeam:
      'A product squad of 4 frontend, 3 backend, 2 QA and 1 designer. We ship every two weeks and care a lot about accessibility.',
    mustHave: [
      '5+ years building web apps, 3+ years with React',
      'Strong TypeScript and modern CSS',
      'Experience with testing (Vitest or Jest, Playwright or Cypress)',
      'Understanding of web accessibility (WCAG 2.1)',
      'Intermediate English for written communication',
    ],
    niceToHave: [
      'Vue 2/3 experience for the migration work',
      'Healthcare or other regulated-industry projects',
      'Design systems or Storybook',
    ],
    criticalSkills: ['React', 'TypeScript'],
    seniority: 'Senior',
    minYears: 5,
    english: 'Intermediate',
    availableFrom: '2026-12-15',
    location: 'Hanoi',
    workingModel: 'Hybrid',
    education: 'bachelor',
    major: 'Computer Science or a related field',
    languages: [],
    certifications: [],
    otherRequirements: 'Must handle patient data under the client’s privacy rules (training provided).',
  },
  'jd-2026-001': {
    summary:
      'Our robotics team builds the mobile app and backend that control warehouse robots. You will work across Flutter and ' +
      'Java to ship features that move real machines.',
    responsibilities: [
      'Build and ship features in the Flutter app for iOS and Android',
      'Build and maintain Java / Kotlin services and REST APIs',
      'Connect the app to robots over the internal messaging layer',
      'Write tests and keep app crash rate under 0.5%',
      'Work with hardware engineers to test features on real robots',
    ],
    dailyTasks: [
      'Stand-up with the software and hardware teams',
      'Test new builds on the robots in the lab',
      'Review pull requests',
    ],
    aboutTeam:
      'An in-house team of 5 software and 4 hardware engineers in our Hanoi lab, with a robot test area next to the desks.',
    mustHave: [
      '4+ years in mobile development, 2+ years with Flutter and Dart',
      'Backend experience with Java or Kotlin and REST APIs',
      'Published at least one app on the App Store or Google Play',
      'Good debugging skills across app and backend',
      'Intermediate English for reading docs and writing tickets',
    ],
    niceToHave: [
      'Experience with IoT, Bluetooth or robotics',
      'Native Android (Kotlin) or iOS (Swift) work',
      'MQTT or WebSocket messaging',
    ],
    criticalSkills: ['Flutter', 'Java'],
    seniority: 'Senior',
    minYears: 4,
    english: 'Intermediate',
    availableFrom: '2026-12-15',
    location: 'Hanoi',
    workingModel: 'Onsite',
    education: 'bachelor',
    major: 'Computer Science, Electronics or a related field',
    languages: ['Japanese - N3 (a plus)'],
    certifications: [],
    otherRequirements: 'Work onsite in the robot lab; safety training given in the first week.',
  },
};

/** Fills every structured field (and a matching body) on the seeded JDs; JDs without detail stay as they are. */
export function withJdDetails(jds: Jd[]): Jd[] {
  return jds.map((jd) => {
    const d = JD_DETAILS[jd.id];
    if (!d) return jd;
    return { ...jd, ...d, body: structuredBody(jd.title, jd.skills, d), skillsExperience: skillsExperienceOf(d) };
  });
}

const OFFICE: Record<string, string> = {
  Hanoi: 'Office: 8th floor, 54 Lieu Giai, Ba Dinh, Hanoi.',
  'Ho Chi Minh City': 'Office: 12th floor, 123 Nguyen Dinh Chieu, District 3, Ho Chi Minh City.',
};
const HOURS = 'Working hours: Monday to Friday, 9:00–18:00 (flexible start between 8:00 and 10:00).';
const BENEFITS = [
  '- 13th-month salary plus a performance bonus twice a year',
  '- Premium health insurance for you and one family member',
  '- 15 days of paid leave, plus your birthday off',
  '- USD 500 yearly learning budget for courses, books and certifications',
  '- Team trips, monthly happy hours and a yearly company retreat',
];

const additionalInfo = (location: string, extra: string[], steps: string[]) =>
  [OFFICE[location] ?? `Office: ${location}.`, HOURS, ...extra, 'Hiring process:', ...steps.map((s) => `- ${s}`)].join('\n');

/** Job-post content and hiring-team fields per seeded job. */
const JOB_POSTS: Record<string, (job: Job) => Partial<Job>> = {
  'job-1': (j) => ({
    minYears: 5, education: 'bachelor', interviewers: ['u-nam', 'u-chau'],
    whyLove: [...BENEFITS, '- Hybrid work: 3 days in the office, 2 days from home', '- MacBook Pro and a 27" monitor from day one'].join('\n'),
    additionalInfo: additionalInfo(j.location, [], [
      'HR screening call (20 minutes)', 'Take-home React exercise (about 3 hours)',
      'Technical interview reviewing your exercise (60 minutes)', 'Final talk with the Engineering Manager (45 minutes)',
    ]),
  }),
  'job-2': (j) => ({
    minYears: 7, education: 'bachelor', interviewers: ['u-thu', 'u-chau'],
    whyLove: [...BENEFITS, '- Fully remote, with a USD 300 home-office allowance', '- Paid trip to meet the client team in Singapore once a year'].join('\n'),
    additionalInfo: additionalInfo(j.location, ['Remote role: you can work from anywhere in Vietnam.'], [
      'HR screening call (20 minutes)', 'Technical deep-dive with a senior engineer (60 minutes)',
      'System design interview (90 minutes)', 'Culture fit with the client’s CTO (45 minutes)',
    ]),
  }),
  'job-3': (j) => ({
    minYears: 4, education: 'bachelor', interviewers: ['u-nam', 'u-huy'],
    questions: [
      { id: 'q-app', label: 'Link to an app you published (App Store or Google Play)', type: 'text', required: true },
      { id: 'q-onsite', label: 'Can you work onsite in our Hanoi lab full time?', type: 'yesno', required: true },
    ],
    whyLove: [...BENEFITS, '- Work with real robots in our in-house lab', '- Lunch provided every working day'].join('\n'),
    additionalInfo: additionalInfo(j.location, [], [
      'HR screening call (20 minutes)', 'Technical interview on Flutter and Java (60 minutes)',
      'Lab visit and meet the team (45 minutes)', 'Offer within 3 working days after the final round',
    ]),
  }),
  'job-4': (j) => ({
    minYears: 5, education: 'bachelor', interviewers: ['u-thu', 'u-linh'],
    questions: [
      { id: 'q-budget', label: 'What is the largest monthly ad budget you have managed?', type: 'text', required: true },
      { id: 'q-portfolio', label: 'Link to a case study or campaign report you are proud of', type: 'text', required: false },
    ],
    whyLove: [...BENEFITS, '- Hybrid work: 3 days in the office, 2 days from home', '- Own a real budget and see your results every week'].join('\n'),
    additionalInfo: additionalInfo(j.location, [], [
      'HR screening call (20 minutes)', 'Marketing case study presentation (60 minutes)',
      'Interview with the client’s Head of E-commerce (45 minutes)', 'Offer within 3 working days after the final round',
    ]),
  }),
  'job-5': (j) => ({
    minYears: 2, education: 'college', interviewers: ['u-nam'],
    salaryMin: 20_000_000, salaryMax: 32_000_000, currency: 'VND', showSalary: true,
    questions: [{ id: 'q-flutter', label: 'How many years have you worked with Flutter?', type: 'text', required: true }],
    whyLove: [...BENEFITS, '- Mentoring from senior Flutter engineers', '- Lunch provided every working day'].join('\n'),
    additionalInfo: additionalInfo(j.location, [], [
      'HR screening call (20 minutes)', 'Technical interview on Flutter (60 minutes)', 'Offer within 3 working days',
    ]),
  }),
  'job-6': (j) => ({
    minYears: 3, education: 'bachelor', interviewers: ['u-thu'],
    salaryMin: 25_000_000, salaryMax: 38_000_000, currency: 'VND', showSalary: false,
    questions: [{ id: 'q-channels', label: 'Which marketing channels have you run on your own?', type: 'text', required: true }],
    whyLove: [...BENEFITS, '- Hybrid work: 3 days in the office, 2 days from home'].join('\n'),
    additionalInfo: additionalInfo(j.location, [], [
      'HR screening call (20 minutes)', 'Marketing case interview (60 minutes)', 'Final talk with the Marketing Lead (30 minutes)',
    ]),
  }),
};

/** Fills the job post (its copy of the JD sections, why love, additional info), hiring team and requirements on the seeded jobs. */
export function withJobPosts(jobs: Job[], jds: Jd[]): Job[] {
  return jobs.map((j) => {
    const jd = jds.find((d) => d.id === j.jdId);
    return { ...j, ...(jd ? jobPostFromJd(jd) : {}), ...(JOB_POSTS[j.id]?.(j) ?? {}) };
  });
}
