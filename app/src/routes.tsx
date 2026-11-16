import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { LoginPage } from './features/auth/LoginPage';
import { CandidatePoolPage } from './features/candidates/CandidatePoolPage';
import { CandidateProfilePage } from './features/candidates/CandidateProfilePage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { NotesPage } from './features/notes/NotesPage';
import { UltraUploadPage } from './features/upload/UltraUploadPage';
import { UploadPage } from './features/upload/UploadPage';

function Placeholder({ title }: { title: string }) {
  return <div className="p-8 max-w-[1400px] mx-auto text-[#896a61]">{title}</div>;
}

/** Internal route → header title. Later tasks replace the placeholder element with the real screen. */
const INTERNAL: { path: string; title: string }[] = [
  { path: '/', title: 'Dashboard' },
  { path: '/candidates', title: 'Candidate Pool' },
  { path: '/candidates/:id', title: 'Candidate' },
  { path: '/upload', title: 'Upload CVs' },
  { path: '/upload-ultra', title: 'Ultra Upload' },
  { path: '/assistant', title: 'AI Search' },
  { path: '/jds', title: 'JD Management' },
  { path: '/jds/:id', title: 'JD Detail' },
  { path: '/jd-matching', title: 'JD Matching' },
  { path: '/taxonomy', title: 'Taxonomy' },
  { path: '/system-config', title: 'System Config' },
  { path: '/users', title: 'User Management' },
  { path: '/ta-contribution', title: 'CV theo TA' },
  { path: '/jobs', title: 'Jobs' },
  { path: '/jobs/:id', title: 'Job' },
  { path: '/pipeline', title: 'Pipeline' },
  { path: '/pipeline/:jobId', title: 'Pipeline' },
  { path: '/campaigns', title: 'Campaigns' },
  { path: '/campaigns/:id', title: 'Campaign' },
  { path: '/notes', title: 'Notes' },
];

const PUBLIC: { path: string; title: string }[] = [
  { path: '/login', title: 'Login' },
  { path: '/careers', title: 'Careers' },
  { path: '/careers/applied', title: 'Application received' },
  { path: '/careers/:jobId', title: 'Job' },
  { path: '/careers/:jobId/apply', title: 'Apply' },
];

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/candidates" element={<CandidatePoolPage />} />
      <Route path="/candidates/:id" element={<CandidateProfilePage />} />
      <Route path="/notes" element={<NotesPage />} />
      <Route path="/upload" element={<UploadPage />} />
      <Route path="/upload-ultra" element={<UltraUploadPage />} />
      {INTERNAL.filter(({ path }) => !['/', '/candidates', '/candidates/:id', '/notes', '/upload', '/upload-ultra'].includes(path)).map(({ path, title }) => (
        <Route
          key={path}
          path={path}
          element={
            <AppLayout title={title}>
              <Placeholder title={title} />
            </AppLayout>
          }
        />
      ))}
      {PUBLIC.filter(({ path }) => path !== '/login').map(({ path, title }) => (
        <Route key={path} path={path} element={<Placeholder title={title} />} />
      ))}
      <Route path="/dashboard" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
