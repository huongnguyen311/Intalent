import { Navigate, Route, Routes } from 'react-router-dom';
import { AssistantPage } from './features/assistant/AssistantPage';
import { LoginPage } from './features/auth/LoginPage';
import { CampaignDetailPage } from './features/campaigns/CampaignDetailPage';
import { CampaignsPage } from './features/campaigns/CampaignsPage';
import { CandidatePoolPage } from './features/candidates/CandidatePoolPage';
import { CandidateProfilePage } from './features/candidates/CandidateProfilePage';
import { Applied } from './features/careers/Applied';
import { ApplyForm } from './features/careers/ApplyForm';
import { CareersHome } from './features/careers/CareersHome';
import { CareersJob } from './features/careers/CareersJob';
import { CareersLayout } from './features/careers/CareersLayout';
import { StatusCheck } from './features/careers/StatusCheck';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { JobDetailPage } from './features/jobs/JobDetailPage';
import { JobsPage } from './features/jobs/JobsPage';
import { JdDetailPage } from './features/jds/JdDetailPage';
import { JdListPage } from './features/jds/JdListPage';
import { JdMatchingPage } from './features/matching/JdMatchingPage';
import { NotesRoute } from './features/notes/NotesRoute';
import { PipelinePage } from './features/pipeline/PipelinePage';
import { PublishedJobsPage } from './features/published/PublishedJobsPage';
import { SystemConfigPage } from './features/system-config/SystemConfigPage';
import { TaContributionPage } from './features/ta-contribution/TaContributionPage';
import { TaxonomyPage } from './features/taxonomy/TaxonomyPage';
import { UltraUploadPage } from './features/upload/UltraUploadPage';
import { UploadPage } from './features/upload/UploadPage';
import { UsersPage } from './features/users/UsersPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/candidates" element={<CandidatePoolPage />} />
      <Route path="/candidates/:id" element={<CandidateProfilePage />} />
      <Route path="/notes" element={<NotesRoute />} />
      <Route path="/assistant" element={<AssistantPage />} />
      <Route path="/jds" element={<JdListPage />} />
      <Route path="/jds/:id" element={<JdDetailPage />} />
      <Route path="/jd-matching" element={<JdMatchingPage />} />
      <Route path="/upload" element={<UploadPage />} />
      <Route path="/upload-ultra" element={<UltraUploadPage />} />
      <Route path="/taxonomy" element={<TaxonomyPage />} />
      <Route path="/system-config" element={<SystemConfigPage />} />
      <Route path="/users" element={<UsersPage />} />
      <Route path="/ta-contribution" element={<TaContributionPage />} />
      <Route path="/jobs" element={<JobsPage />} />
      <Route path="/jobs/:id" element={<JobDetailPage />} />
      <Route path="/published" element={<PublishedJobsPage />} />
      <Route path="/campaigns" element={<CampaignsPage />} />
      <Route path="/campaigns/:id" element={<CampaignDetailPage />} />
      <Route path="/pipeline" element={<PipelinePage />} />
      <Route path="/pipeline/:jobId" element={<PipelinePage />} />
      <Route path="/careers" element={<CareersLayout />}>
        <Route index element={<CareersHome />} />
        <Route path="status" element={<StatusCheck />} />
        <Route path="applied" element={<Applied />} />
        <Route path=":jobId" element={<CareersJob />} />
        <Route path=":jobId/apply" element={<ApplyForm />} />
      </Route>
      <Route path="/dashboard" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
