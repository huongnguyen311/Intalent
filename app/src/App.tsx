import { BrowserRouter } from 'react-router-dom';
import { Toaster } from './components/Toast';
import { AppRoutes } from './routes';

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div data-app>
        <AppRoutes />
        <Toaster />
      </div>
    </BrowserRouter>
  );
}
