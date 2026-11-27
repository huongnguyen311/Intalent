import { CompanySettingsPage } from './features/settings/CompanySettingsPage';
import { AcceptInvitePage, CareersSlugRedirect, ForgotPasswordPage, ResetPasswordPage, SignupPage, VerifyEmailPage } from './features/auth/SignupPage';
import { InboxPage } from './features/auth/InboxPage';
import { AuditLogPage } from './features/audit/AuditLogPage';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Guard } from './components/Guard';
import { CandidateLogin } from './features/portal/CandidateLogin';
import { CandidatePortal } from './features/portal/CandidatePortal';
import { MyInterviewsPage } from './features/interviews/MyInterviewsPage';
import { AssistantPage } from './features/assistant/AssistantPage';
import { LoginPage } from './features/auth/LoginPage';
import { CampaignDetailPage } from './features/campaigns/CampaignDetailPage';
import { CampaignEditorPage } from './features/campaigns/CampaignEditorPage';
import { CampaignsPage } from './features/campaigns/CampaignsPage';
import { CandidatePoolPage } from './features/candidates/CandidatePoolPage';
import { CandidateProfilePage } from './features/candidates/CandidateProfilePage';
import { PoolInsightsPage } from './features/candidates/PoolInsights';
import { Applied } from './features/careers/Applied';
import { ApplyForm } from './features/careers/ApplyForm';
import { CareersHome } from './features/careers/CareersHome';
import { CareersJob } from './features/careers/CareersJob';
import { CareersLayout } from './features/careers/CareersLayout';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { JobDetailPage } from './features/jobs/JobDetailPage';
import { JobEditorPage } from './features/jobs/JobEditorPage';
import { JobsPage } from './features/jobs/JobsPage';
import { JdDetailPage } from './features/jds/JdDetailPage';
import { JdEditorPage } from './features/jds/JdEditorPage';
import { JdListPage } from './features/jds/JdListPage';
import { JdMatchingPage } from './features/matching/JdMatchingPage';
import { NotesRoute } from './features/notes/NotesRoute';
import { PipelinePage } from './features/pipeline/PipelinePage';
import { SystemConfigPage } from './features/system-config/SystemConfigPage';
import { TaContributionPage } from './features/ta-contribution/TaContributionPage';
import { TaxonomyPage } from './features/taxonomy/TaxonomyPage';
import { UltraUploadPage } from './features/upload/UltraUploadPage';
import { UploadPage } from './features/upload/UploadPage';
import { UsersPage } from './features/users/UsersPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Guard perms={['pool']} redirect><DashboardPage /></Guard>} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify" element={<VerifyEmailPage />} />
      <Route path="/invite" element={<AcceptInvitePage />} />
      <Route path="/inbox" element={<InboxPage />} />
      <Route path="/c/:slug" element={<CareersSlugRedirect />} />
      <Route path="/pool-overview" element={<Guard perms={['pool']}><PoolInsightsPage /></Guard>} />
      <Route path="/candidates" element={<Guard perms={['pool']}><CandidatePoolPage /></Guard>} />
      <Route path="/candidates/:id" element={<Guard perms={['pool', 'pipeline', 'scorecard']}><CandidateProfilePage /></Guard>} />
      <Route path="/notes" element={<Guard perms={['pool']}><NotesRoute /></Guard>} />
      <Route path="/assistant" element={<Guard perms={['pool']}><AssistantPage /></Guard>} />
      <Route path="/jds" element={<Guard perms={['jd.edit']}><JdListPage /></Guard>} />
      <Route path="/jds/new" element={<Guard perms={['jd.edit']}><JdEditorPage mode="create" /></Guard>} />
      <Route path="/jds/:id" element={<Guard perms={['jd.edit']}><JdDetailPage /></Guard>} />
      <Route path="/jds/:id/edit" element={<Guard perms={['jd.edit']}><JdEditorPage mode="edit" /></Guard>} />
      <Route path="/jd-matching" element={<Guard perms={['pool']}><JdMatchingPage /></Guard>} />
      <Route path="/upload" element={<Guard perms={['pool']}><UploadPage /></Guard>} />
      <Route path="/upload-ultra" element={<Guard perms={['pool']}><UltraUploadPage /></Guard>} />
      <Route path="/taxonomy" element={<Guard perms={['taxonomy']}><TaxonomyPage /></Guard>} />
      <Route path="/system-config" element={<Guard perms={['config']}><SystemConfigPage /></Guard>} />
      <Route path="/users" element={<Guard perms={['users.manage']}><UsersPage /></Guard>} />
      <Route path="/audit" element={<Guard perms={['privacy']}><AuditLogPage /></Guard>} />
      <Route path="/settings" element={<Guard perms={['config']}><CompanySettingsPage /></Guard>} />
      <Route path="/ta-contribution" element={<Guard perms={['reports']}><TaContributionPage /></Guard>} />
      <Route path="/jobs" element={<Guard perms={['pipeline']}><JobsPage /></Guard>} />
      <Route path="/jobs/new" element={<Guard perms={['job.edit']}><JobEditorPage mode="create" /></Guard>} />
      <Route path="/jobs/:id" element={<Guard perms={['pipeline']}><JobDetailPage /></Guard>} />
      <Route path="/jobs/:id/edit" element={<Guard perms={['job.edit']}><JobEditorPage mode="edit" /></Guard>} />
      <Route path="/jobs/:id/duplicate" element={<Guard perms={['job.edit']}><JobEditorPage mode="duplicate" /></Guard>} />
      <Route path="/published" element={<Navigate to="/jobs" replace />} />
      <Route path="/campaigns" element={<Guard perms={['campaign']}><CampaignsPage /></Guard>} />
      <Route path="/campaigns/new" element={<Guard perms={['campaign']}><CampaignEditorPage mode="create" /></Guard>} />
      <Route path="/campaigns/:id" element={<Guard perms={['campaign']}><CampaignDetailPage /></Guard>} />
      <Route path="/campaigns/:id/edit" element={<Guard perms={['campaign']}><CampaignEditorPage mode="edit" /></Guard>} />
      <Route path="/pipeline" element={<Guard perms={['pipeline']}><PipelinePage /></Guard>} />
      <Route path="/pipeline/:jobId" element={<Guard perms={['pipeline']}><PipelinePage /></Guard>} />
      <Route path="/my-interviews" element={<Guard perms={['scorecard']}><MyInterviewsPage /></Guard>} />
      <Route path="/me" element={<CareersLayout />}>
        <Route index element={<CandidatePortal />} />
      </Route>
      <Route path="/careers" element={<CareersLayout />}>
        <Route path="login" element={<CandidateLogin />} />
        <Route index element={<CareersHome />} />
        {/* The e-mail status lookup merged into candidate sign-in, which shows the same list. */}
        <Route path="status" element={<Navigate to="/careers/login" replace />} />
        <Route path="applied" element={<Applied />} />
        <Route path=":jobId" element={<CareersJob />} />
        <Route path=":jobId/apply" element={<ApplyForm />} />
      </Route>
      <Route path="/dashboard" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
