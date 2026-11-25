import { priorityOf } from './jobUrgency';
import { FORWARD_STAGES } from './stages';
import { CAMPAIGN_STATUSES, type Application, type Campaign, type CampaignStatus, type DemoState, type HiringPriority, type Job } from './types';

type JobsAndApps = { jobs: Job[]; applications: Application[] };

/** Jobs pointing at the campaign (in job order), then jobs it already credited applicants to (moved or deleted since). */
export function campaignJobIds(campaign: Pick<Campaign, 'id'>, state: JobsAndApps): string[] {
  const ids = state.jobs.filter((j) => j.campaignId === campaign.id).map((j) => j.id);
  for (const a of state.applications) if (a.campaignId === campaign.id && !ids.includes(a.jobId)) ids.push(a.jobId);
  return ids;
}

/** The campaign a careers-page applicant to this job is credited to: the job's campaign, while it is running. */
export function creditedCampaign(job: Pick<Job, 'campaignId'>, campaigns: Campaign[], today: string): Campaign | undefined {
  const c = job.campaignId ? campaigns.find((x) => x.id === job.campaignId) : undefined;
  return c && effectiveStatus(c, today) === 'active' ? c : undefined;
}

/** Campaigns a job can be put in: any that has not finished. */
export const campaignPickable = (c: Pick<Campaign, 'status'>): boolean => canEdit(c);

/** CMP-<year of createdAt>-<NNN>: one more than the highest number used that year. */
export function nextCampaignCode(existing: Pick<Campaign, 'code'>[], createdAt: string): string {
  const year = createdAt.slice(0, 4);
  const prefix = `CMP-${year}-`;
  const max = existing.reduce((m, c) => (c.code?.startsWith(prefix) ? Math.max(m, Number(c.code.slice(prefix.length)) || 0) : m), 0);
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

/** The status to show and filter by: a scheduled campaign is active from its start date; unknown values read as completed. */
export function effectiveStatus(c: Pick<Campaign, 'status' | 'start'>, today: string): CampaignStatus {
  if (!(CAMPAIGN_STATUSES as readonly string[]).includes(c.status)) return 'completed';
  if (c.status === 'scheduled' && today >= c.start.slice(0, 10)) return 'active';
  return c.status;
}

export const launchStatus = (start: string, today: string): 'scheduled' | 'active' =>
  start.slice(0, 10) > today ? 'scheduled' : 'active';

/** Running past its end date: the detail page suggests marking it completed. */
export const pastEnd = (c: Pick<Campaign, 'status' | 'start' | 'end'>, today: string): boolean =>
  effectiveStatus(c, today) === 'active' && today > c.end.slice(0, 10);

/** Only running or upcoming campaigns can be edited; finished ones (and unknown legacy statuses) are read-only. */
export const canEdit = (c: Pick<Campaign, 'status'>): boolean => ['draft', 'scheduled', 'active', 'paused'].includes(c.status);

export interface CampaignJobRow {
  jobId: string;
  title: string;
  target: number;
  hired: number;
  remaining: number;
  jobStatus?: Job['status'];
  /** False once the job has moved to another campaign (or was deleted); it stays for the applicants it brought. */
  attached: boolean;
  priority: HiringPriority;
  targetHiringDate?: string;
}

/** Per-job target (the job's openings), hired (campaign applicants only) and remaining, plus totals. */
export function campaignJobRows(
  state: JobsAndApps,
  campaign: Pick<Campaign, 'id'>,
): { rows: CampaignJobRow[]; totals: { target: number; hired: number; remaining: number } } {
  const rows = campaignJobIds(campaign, state).map((jobId) => {
    const job = state.jobs.find((j) => j.id === jobId);
    const target = job ? job.headcount ?? 1 : 0;
    const hired = state.applications.filter((a) => a.campaignId === campaign.id && a.jobId === jobId && a.stage === 'hired').length;
    return {
      jobId, title: job?.title ?? jobId, target, hired, remaining: Math.max(0, target - hired),
      jobStatus: job?.status, attached: job?.campaignId === campaign.id, priority: job ? priorityOf(job) : 'normal', targetHiringDate: job?.targetHiringDate,
    };
  });
  const sum = (k: 'target' | 'hired' | 'remaining') => rows.reduce((n, r) => n + r[k], 0);
  return { rows, totals: { target: sum('target'), hired: sum('hired'), remaining: sum('remaining') } };
}

/** Hires that fill a seat: each job counts up to its own target, so extra hires on one job never hide a gap on another. */
export const filledHires = (state: JobsAndApps, campaign: Pick<Campaign, 'id'>): number =>
  campaignJobRows(state, campaign).rows.reduce((n, r) => n + Math.min(r.hired, r.target), 0);

export const targetHires = (state: JobsAndApps, campaign: Pick<Campaign, 'id'>): number => campaignJobRows(state, campaign).totals.target;

const SHORTLIST_FROM = FORWARD_STAGES.indexOf('interview');
const reachedShortlist = (a: Application) =>
  [a.stage, ...a.history.map((h) => h.stage)].some((s) => FORWARD_STAGES.indexOf(s) >= SHORTLIST_FROM);

export type FunnelKey = 'total' | 'aiScreened' | 'shortlisted' | 'interviewed' | 'offers' | 'hired';

export interface CampaignPerformance {
  total: number;
  new: number;
  aiScreened: number;
  shortlisted: number;
  interviewed: number;
  offers: number;
  hired: number;
  rejected: number;
  /** The chain Total → AI screened → Shortlisted → Interviewed → Offers → Hired; `rate` = count / previous count. */
  steps: Array<{ key: FunnelKey; count: number; rate?: number }>;
  /** budget / hired, when both are above 0. */
  costPerHire?: number;
}

export function campaignPerformance(
  state: Pick<DemoState, 'applications' | 'campaigns'>,
  campaignId: string,
  now: Date,
): CampaignPerformance {
  const apps = state.applications.filter((a) => a.campaignId === campaignId);
  const weekAgo = now.getTime() - 7 * 86_400_000;
  const count = (f: (a: Application) => boolean) => apps.filter(f).length;
  const p = {
    total: apps.length,
    new: count((a) => new Date(a.addedAt).getTime() >= weekAgo),
    aiScreened: count((a) => (a.aiEvaluations?.length ?? 0) > 0),
    shortlisted: count(reachedShortlist),
    interviewed: count((a) => !!a.interviews?.some((i) => i.status === 'done')),
    offers: count((a) => !!a.offer && a.offer.status !== 'draft'),
    hired: count((a) => a.stage === 'hired'),
    rejected: count((a) => a.stage === 'rejected'),
  };
  const keys: FunnelKey[] = ['total', 'aiScreened', 'shortlisted', 'interviewed', 'offers', 'hired'];
  const steps = keys.map((key, i) => {
    const prev = i > 0 ? p[keys[i - 1]] : 0;
    return { key, count: p[key], rate: i > 0 && prev > 0 ? p[key] / prev : undefined };
  });
  const budget = state.campaigns.find((c) => c.id === campaignId)?.goals.budget;
  return { ...p, steps, costPerHire: budget && p.hired > 0 ? budget / p.hired : undefined };
}

/** FNV-1a: stable across renders and reloads. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export interface CampaignStats {
  views: number;
  applicants: number;
  /** applicants / views, 0..1 */
  conversion: number;
  hires: number;
  /** Applicants and hires per job on the campaign. */
  byJob: Record<string, { applicants: number; hires: number }>;
}

export function campaignStats(
  state: Pick<DemoState, 'applications' | 'campaigns' | 'jobs'>,
  campaignId: string,
): CampaignStats {
  const campaign = state.campaigns.find((c) => c.id === campaignId);
  const apps = state.applications.filter((a) => a.campaignId === campaignId);
  const byJob: CampaignStats['byJob'] = Object.fromEntries((campaign ? campaignJobIds(campaign, state) : []).map((id) => [id, { applicants: 0, hires: 0 }]));
  for (const a of apps) {
    const row = (byJob[a.jobId] ??= { applicants: 0, hires: 0 });
    row.applicants += 1;
    if (a.stage === 'hired') row.hires += 1;
  }
  // Seeded campaigns carry their own view count; others get a stable one derived from the id.
  const base = campaign && campaign.stats.views > 0 ? campaign.stats.views : 300 + (hash(campaignId) % 1700);
  const views = Math.max(base, apps.length);
  return {
    views,
    applicants: apps.length,
    conversion: views ? apps.length / views : 0,
    hires: apps.filter((a) => a.stage === 'hired').length,
    byJob,
  };
}
