import { Navigate } from 'react-router-dom';
import { useShowNew } from '../../hooks';
import { NotesPage } from './NotesPage';

/** `/notes` now lives under Candidates; the old flat page stays for the mockup fixture. */
export function NotesRoute() {
  return useShowNew() ? <Navigate to="/candidates?tab=notes" replace /> : <NotesPage />;
}
