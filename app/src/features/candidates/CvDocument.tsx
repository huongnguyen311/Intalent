import { isFixtureMode } from '../../data/fixtureMockup';
import type { Candidate } from '../../domain/types';
import { useT } from '../../i18n/i18n';

const SECTION_HEAD = { color: '#1f4e9c', fontWeight: 700, fontSize: 10, textTransform: 'uppercase' } as const;
const month = (m: string) => m.replace('-', '/');

/** The "original document": a plain white page built from the candidate's CV data (falls back to `cv` text). */
export function CvDocument({ c, zoom }: { c: Candidate; zoom: number }) {
  const t = useT();
  const summary = c.summary ?? c.cv;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'auto', padding: '24px 0' }}>
      <div
        style={{
          width: 'min(92%,640px)', margin: '0 auto', background: '#fff', boxShadow: '0 2px 12px rgba(0,0,0,.35)',
          padding: '48px 52px', fontFamily: 'Arial,Helvetica,sans-serif', fontSize: 11, lineHeight: 1.5, color: '#111',
          ...(zoom !== 1 ? { zoom } : {}),
        }}
      >
        <h1 style={{ textAlign: 'center', fontSize: 24, fontWeight: 700, margin: '0 0 6px' }}>{c.name}</h1>
        <p style={{ textAlign: 'center', fontWeight: 700, margin: 0 }}>{c.headline ?? c.title}</p>
        <p style={{ textAlign: 'center', margin: '0 0 14px' }}>
          {[c.location, c.phone, c.email].filter(Boolean).join(' · ')}
        </p>
        {summary && (
          <>
            <p style={{ ...SECTION_HEAD, margin: '12px 0 4px' }}>{t('profile.cv.summary')}</p>
            <p style={{ margin: 0 }}>{summary}</p>
          </>
        )}
        {c.experience && c.experience.length > 0 && (
          <>
            <p style={{ ...SECTION_HEAD, margin: '14px 0 4px' }}>{t('profile.cv.experience')}</p>
            {c.experience.map((x) => (
              <div key={`${x.company}-${x.start}`}>
                <p style={{ margin: '10px 0 2px', fontWeight: 700 }}>{x.title} | {x.company}</p>
                <p style={{ margin: '0 0 4px', color: '#555' }}>{month(x.start)} – {x.end ? month(x.end) : t('profile.cv.present')}</p>
                <p style={{ margin: 0 }}>{x.description}</p>
              </div>
            ))}
          </>
        )}
        {c.education && c.education.length > 0 && (
          <>
            <p style={{ ...SECTION_HEAD, margin: '14px 0 4px' }}>{t('profile.cv.education')}</p>
            {c.education.map((e) => (
              <p key={e.degree} style={{ margin: '2px 0' }}>{e.degree} — {e.institution}, {e.year}</p>
            ))}
          </>
        )}
        {isFixtureMode() && (
          <p style={{ marginTop: 28, textAlign: 'center', color: '#999', fontSize: 10 }}>{t('profile.cv.sample')}</p>
        )}
      </div>
    </div>
  );
}
