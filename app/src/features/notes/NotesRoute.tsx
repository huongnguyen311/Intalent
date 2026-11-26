import { Navigate } from 'react-router-dom';
import { useShowNew } from '../../hooks';
import { NotesPage } from './NotesPage';

/** The Notes list is retired in the app (old links land on the pool); the flat page stays for the mockup fixture. */
export function NotesRoute() {
  return useShowNew() ? <Navigate to="/candidates" replace /> : <NotesPage />;
}
