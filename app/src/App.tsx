import { useLayoutEffect } from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { Toaster } from './components/Toast';
import { isFixtureMode } from './data/fixtureMockup';
import { AppRoutes } from './routes';

/** Marks <html> in mockup-fixture mode so tokens.css restores the production colours for the pixel diff. */
function FixtureFlag() {
  const { search } = useLocation();
  useLayoutEffect(() => {
    document.documentElement.toggleAttribute('data-fixture', isFixtureMode(search));
  }, [search]);
  return null;
}

/** A new page starts at the top (the router keeps the old scroll position, so a job page opened mid-list hid its title). */
function ScrollToTop() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    window.scrollTo?.(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <FixtureFlag />
      <ScrollToTop />
      <div data-app>
        <AppRoutes />
        <Toaster />
      </div>
    </BrowserRouter>
  );
}
