import type { Candidate, DemoState, MockupTotals, TaRow, User } from '../domain/types';
import { MOCKUP_CHATS, MOCKUP_MATCHING, withMockupJdDetail } from './fixtureJds';
import { buildEnglishTaxonomy, buildJds, buildPrompts } from './seed';

/** True when the URL query asks for the static-mockup fixture (`?fixture=mockup`). */
export function isFixtureMode(search: string = typeof window === 'undefined' ? '' : window.location.search): boolean {
  return new URLSearchParams(search).get('fixture') === 'mockup';
}

// The mockup truncates long skill lists to "first N + M more"; hidden ones are padded with these.
const FILLER_SKILLS = [
  'Lead Generation', 'Negotiation', 'Pipeline Management', 'Cold Outreach', 'Forecasting', 'Account Planning',
  'Presentation', 'Market Research', 'Customer Success', 'Reporting', 'Excel', 'Trello', 'Slack', 'Zoom',
  'Notion', 'Canva', 'HubSpot', 'Zoho', 'Pipedrive', 'Zendesk',
];

type Row = [
  name: string, title: string, email: string, phone: string, seniority: string,
  visibleSkills: string[], hiddenSkills: number, english: string,
];

const CANDIDATE_ROWS: Row[] = [
  ['PHAM MINH KHOA', 'Head of Sales', 'khoa.pham@example.com', '+84 0901 234 567', 'Lead', ['CRM Systems'], 1, 'Advanced'],
  ['Võ Thành Đạt', 'Business Development Specialist B2B', 'dat.vo@example.com', '091 222 3344', 'Middle', ['Food Delivery Platform'], 10, 'Basic'],
  ['Hoang Gia Bao', 'Business Developer', 'bao.hoang@example.com', '(+84) 933 111 222', 'Senior', ['Apollo', 'LinkedIn'], 17, 'Advanced'],
  ['NGO DUC THINH', 'Sales Executive & Team Leader', 'thinh.ngo@example.com', '0812 345 678', 'Senior', ['CRM Systems', 'POS Systems'], 1, 'Intermediate'],
  ['LAM VAN HAI', 'Regional Office Manager', 'hai.lam@example.com', '0819 876 543', 'Senior', ['DMS (Document Management System)'], 8, 'Intermediate'],
  ['Ngô Đức Thịnh', 'Sales Employee - Team Leader', 'thinh.ngoduc@example.com', '0812 345 678', 'Senior', ['CRM', 'POS', 'SaaS'], 0, 'Intermediate'],
  ['Truong Quoc Viet', 'Senior Business Development Consultant', 'viet.truong@example.com', '+84 388 000 111', 'Senior', ['MS Office', 'Google Office'], 3, 'Advanced'],
  ['MAI TUAN (KEVIN)', 'Account Manager', 'kevin.mai@example.com', '+84 909 555 666', 'Senior', ['Salesforce', 'Nutshell CRM'], 7, 'Advanced'],
  ['Đặng Thị Thu Hà', 'Sales Project/Presales Consultant', 'ha.dang@example.com', '+84-377 123 456', 'Middle', ['Miro', 'Odoo', 'ERP'], 6, 'Intermediate'],
  ['BUI NGOC ANH', 'SAP Business One Consultant / Project Leader', 'anh.bui@example.com', '0966-000-321', 'Senior', ['SAP Business One'], 7, 'Intermediate'],
];

// cvOwner is the display name here: the mockup's owner is not one of its 10 listed users.
const CV_OWNER = 'Tran Bao Ngoc';

/** Profile detail the mockup shows for its first candidate (candidate-detail.html); the other rows have none. */
const FIRST_CANDIDATE_PROFILE: Partial<Candidate> = {
  headline: 'Head of Sales | Business Development | MBA',
  location: 'Ho Chi Minh City',
  summary:
    'Sales leader with 15+ years of experience in B2B software, payments and telecom. Builds and scales sales teams, designs go-to-market plans for new products, and manages long-term relationships with enterprise and banking clients. Comfortable working with cross-functional product and delivery teams.',
  primarySkills: [
    'Sales Strategy', 'Business Development', 'Key Account Management', 'Go-to-Market Strategy',
    'Team Leadership', 'P&L Management', 'Sales Forecasting', 'Partnership Development',
  ],
  secondarySkills: [
    'IT Managed Services', 'System Integration', 'Fintech Solutions', 'Online Payment Gateways', 'EMV-POS',
    'Cybersecurity', 'Data Center Solutions', 'Cloud Solutions', 'Market Penetration', 'Channel Development',
  ],
  techStack: ['CRM Systems', 'Microsoft Office Suite'],
  domains: ['IT', 'Telecommunications', 'Fintech', 'Banking', 'Financial Services', 'E-commerce', 'Healthcare'],
  openToWork: false,
  experience: [
    {
      title: 'Head of Sales', company: 'Nova Payments (demo)', start: '2024-01', end: '2026-06',
      description: 'Built and led a sales team of 10. Launched the go-to-market plan for a new POS product line and reached 90% of the yearly target in the first two quarters. Set up the weekly pipeline review and forecasting process.',
    },
    {
      title: 'Key Account Manager', company: 'BlueRiver Systems (demo)', start: '2021-03', end: '2023-12',
      description: 'Managed 25 enterprise accounts in banking and retail. Grew account revenue 35% year over year through upsell of managed services and cloud solutions. Coordinated with solution architects on tenders.',
    },
    {
      title: 'Sales Manager', company: 'Orion Tech JSC (demo)', start: '2017-06', end: '2021-02',
      description: 'Sold system integration and IT managed services to FMCG and healthcare clients. Opened new accounts through outbound prospecting, partner referrals and industry events.',
    },
    {
      title: 'Sales Specialist', company: 'Sunrise Telecom (demo)', start: '2011-01', end: '2017-05',
      description: 'Sold data center, network and leased-line services to domestic and international companies. Worked with technical teams to deliver projects on time and supported bid preparation.',
    },
  ],
  education: [
    { degree: 'MBA in Marketing', institution: 'Saigon Business School (demo)', year: '2015' },
    { degree: 'BA in Information Systems', institution: 'City University (demo)', year: '2010' },
  ],
};

function buildCandidates(): Candidate[] {
  return CANDIDATE_ROWS.map(([name, title, email, phone, seniority, visible, hidden, english], i) => {
    const filler = FILLER_SKILLS.filter((s) => !visible.includes(s)).slice(i % 3, (i % 3) + hidden);
    return {
      id: `cand-mock-${String(i + 1).padStart(2, '0')}`,
      name, title, email, phone, seniority, english,
      skills: [...visible, ...filler],
      domains: [], tags: [], groups: [],
      cvOwner: CV_OWNER,
      source: 'Upload',
      inTalentPool: true,
      createdAt: '2026-03-01T00:00:00.000Z',
      cv: '',
      ...(i === 0 ? FIRST_CANDIDATE_PROFILE : {}),
    };
  });
}

/** Avatar colours the mockup shows per row (its own palette hash is not reproducible from the data). */
export const MOCKUP_AVATAR_TONES: Record<string, 'purple' | 'blue' | 'teal' | 'orange'> = {
  'cand-mock-01': 'purple', 'cand-mock-02': 'purple', 'cand-mock-03': 'teal', 'cand-mock-04': 'orange',
  'cand-mock-05': 'blue', 'cand-mock-06': 'orange', 'cand-mock-07': 'purple', 'cand-mock-08': 'teal',
  'cand-mock-09': 'blue', 'cand-mock-10': 'purple',
};

const USER_ROWS: Array<[id: string, name: string, email: string, role: string, status: string, createdAt: string]> = [
  ['u-mock-01', 'Lê Minh Châu', 'chau.le@company.demo', 'Super Admin', 'Active', '2026-06-03'],
  ['u-mock-02', 'Demo User 04', 'demo.user04@example.com', 'Candidate', 'Active', '2026-10-03'],
  ['u-mock-03', 'Arjun Mehta', 'arjun.mehta@example.com', 'Candidate', 'Inactive', '2026-03-24'],
  ['u-mock-04', 'Khanh Le', 'khanh.le@company.demo', 'Super Admin', 'Inactive', '2026-04-09'],
  ['u-mock-05', 'Demo Tester', 'demo.tester@example.com', 'Candidate', 'Active', '2026-10-03'],
  ['u-admin', 'Super Admin', 'admin@company.demo', 'Super Admin', 'Active', '2026-02-24'],
  ['u-mock-07', 'Linh Pham', 'linh.pham@company.demo', 'Super Admin', 'Inactive', '2026-02-25'],
  ['u-mock-08', 'Quan Vu', 'quan.vu@example.com', 'Admin', 'Inactive', '2026-02-24'],
  ['u-mock-09', 'Demo User 03', 'demo.user03@example.com', 'Candidate', 'Active', '2026-10-03'],
  ['u-mock-10', 'Nhi Do', 'nhi.do@company.demo', 'Admin', 'Active', '2026-03-26'],
];

const ta = (
  name: string, newCv: number, duplicateUploads: number, parseFailed: number, processing: number,
  received: number, transferredOut: number, total: number,
): TaRow => ({ name, newCv, duplicateUploads, parseFailed, processing, received, transferredOut, total });

function buildTotals(): MockupTotals {
  return {
    dashboard: {
      totalCandidates: 781,
      activeCandidates: 781,
      parsing: { ok: 891, of: 1000 },
      missingEmail: 95,
      topStacks: [
        { label: 'Docker', pct: 18.12, color: '#3b82f6' },
        { label: 'JavaScript', pct: 17.9, color: '#8b5cf6' },
        { label: 'PostgreSQL', pct: 17.74, color: '#fbbf24' },
        { label: 'MySQL', pct: 16.81, color: '#10b981' },
        { label: 'TypeScript', pct: 14.79, color: '#f97316' },
        { label: 'MongoDB', pct: 14.63, color: '#ef4444' },
      ],
      seniority: [
        { label: 'Intern', count: 5 },
        { label: 'Junior', count: 95 },
        { label: 'Mid', count: 182 },
        { label: 'Senior', count: 411 },
        { label: 'Lead', count: 57 },
        { label: 'Prin.', count: 25 },
        { label: 'Arch.', count: 2 },
      ],
      contributors: [
        { name: 'Lê Minh Châu', total: 170, newCv: 130 },
        { name: 'Tran Bao Ngoc', total: 138, newCv: 108 },
        { name: 'Phan Huu Tri', total: 4, newCv: 1 },
      ],
      availableStacks: [
        { label: 'Docker', count: 332, pct: 11.93 },
        { label: 'JavaScript', count: 328, pct: 11.79 },
      ],
      english: [
        { label: 'Advanced', count: 379, color: '#ef5125' },
        { label: 'Intermediate', count: 354, color: '#fca5a5' },
        { label: 'Beginner', count: 36, color: '#fef3f2' },
      ],
      domains: [
        { label: 'E-commerce', pct: 38 },
        { label: 'SaaS', pct: 25 },
        { label: 'Fintech', pct: 14 },
        { label: 'Healthcare', pct: 14 },
        { label: 'FinTech', pct: 10 },
      ],
    },
    users: { total: 17, superAdmins: 9, admins: 3, users: 5 },
    taContribution: {
      rows: [
        ta('Lê Minh Châu', 130, 39, 1, 0, 2, 1, 170),
        ta('Tran Bao Ngoc', 108, 27, 0, 0, 4, 1, 138),
        ta('Phan Huu Tri', 1, 4, 0, 0, 0, 1, 4),
        ta('Unattributed (before CV Owner tracking)', 0, 0, 236, 100, 0, 0, 0),
      ],
      totals: ta('Tổng', 239, 70, 237, 100, 6, 3, 312),
    },
  };
}

/** Reproduces exactly what mockup/*.html shows; figures 10 rows cannot yield live in meta.totals. */
export function buildMockupFixture(): DemoState {
  const users: User[] = USER_ROWS.map(([id, name, email, role, status, createdAt]) => ({
    id, name, email, role, status, createdAt,
  }));
  return {
    candidates: buildCandidates(),
    applications: [],
    jobs: [],
    campaigns: [],
    notes: [],
    activities: [],
    users,
    jds: withMockupJdDetail(buildJds()),
    taxonomy: buildEnglishTaxonomy(),
    prompts: buildPrompts(),
    chats: MOCKUP_CHATS,
    emails: [],
    // The mockup's candidate list shows contact details unlocked.
    ui: { lang: 'en', careersLang: 'vi', piiUnlocked: true },
    meta: { totals: buildTotals(), matching: MOCKUP_MATCHING },
  };
}
