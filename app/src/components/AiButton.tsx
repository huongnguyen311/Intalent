import { Link } from 'react-router-dom';

/** Floating AI Search shortcut, ported from mockup/candidates.html. */
export function AiButton({ search = '' }: { search?: string }) {
  return (
    <Link
      to={{ pathname: '/assistant', search }}
      aria-label="AI Search"
      className="fixed bottom-3 right-3 z-50 flex items-center justify-center bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white rounded-full shadow-lg hover:shadow-xl cursor-pointer overflow-hidden"
      style={{ padding: 12, opacity: 1, transform: 'none' }}
    >
      <div className="relative flex-shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-search w-6 h-6" aria-hidden="true">
          <path d="m21 21-4.34-4.34" />
          <circle cx="11" cy="11" r="8" />
        </svg>
        <div className="absolute -top-2 -right-2" style={{ transform: 'none' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-sparkles w-3.5 h-3.5 text-yellow-300 fill-yellow-300" aria-hidden="true">
            <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" />
            <path d="M20 2v4" />
            <path d="M22 4h-4" />
            <circle cx="4" cy="20" r="2" />
          </svg>
        </div>
      </div>
      <div className="overflow-hidden" style={{ width: 0, opacity: 0 }}>
        <span className="font-semibold text-sm whitespace-nowrap pl-3 pr-1 inline-block">AI Search</span>
      </div>
    </Link>
  );
}
