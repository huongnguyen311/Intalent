import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { isFixtureMode } from '../../data/fixtureMockup';
import type { Candidate, CvBullet } from '../../domain/types';
import { useT } from '../../i18n/i18n';

/** A4 at 96 dpi: the page is laid out at this size, then scaled to the pane like a PDF viewer's "fit width". */
export const PAGE_W = 794;
export const PAGE_H = 1123;
const PAD_X = 44;
const PAD_Y = 48;
const CONTENT_H = PAGE_H - PAD_Y * 2;
/** Grey margin around and between pages, in pane pixels at 100%. */
const GUTTER = 8;

const PAGE_STYLE = {
  width: PAGE_W, height: PAGE_H, boxSizing: 'border-box', padding: `${PAD_Y}px ${PAD_X}px`, background: '#fff',
  border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(16,24,40,.06)', fontFamily: 'Arial,Helvetica,sans-serif', fontSize: 15, lineHeight: 1.45,
  color: '#111', overflow: 'hidden', position: 'relative',
} as const;
const SECTION_HEAD = { color: '#1f4e9c', fontWeight: 700, fontSize: 13.5, textTransform: 'uppercase', letterSpacing: 0.2, margin: 0 } as const;
const P = { margin: 0 } as const;
const UL = { margin: 0, paddingLeft: 22, listStyle: 'disc' } as const;
const UL_SUB = { margin: '2px 0 0', paddingLeft: 26, listStyle: 'circle' } as const;
const month = (m: string) => m.replace('-', '/');

/** One unbreakable piece of the CV; `gap` is the space above it, `keep` keeps it on the same page as the next one. */
interface Block { key: string; gap: number; keep?: boolean; node: ReactNode }

function Bullets({ items }: { items: CvBullet[] }) {
  return (
    <ul style={UL}>
      {items.map((b) => (
        <li key={b.text} style={{ marginTop: 2 }}>
          {b.text}
          {b.sub && b.sub.length > 0 && <ul style={UL_SUB}>{b.sub.map((s) => <li key={s}>{s}</li>)}</ul>}
        </li>
      ))}
    </ul>
  );
}

function useBlocks(c: Candidate, maskContact: boolean): Block[] {
  const t = useT();
  const out: Block[] = [];
  const head = (key: string, label: string) => out.push({ key: `h-${key}`, gap: 16, keep: true, node: <p style={SECTION_HEAD}>{label}</p> });

  const contact = [
    c.phone && `${t('profile.cv.cellphone')}: ${maskContact ? '••••••••' : c.phone}`,
    c.email && `${t('profile.cv.email')}: ${maskContact ? '••••••••' : c.email}`,
  ].filter(Boolean).join(' | ');
  out.push({
    key: 'header', gap: 0,
    node: (
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, margin: '0 0 6px', letterSpacing: 0.3 }}>{c.name}</h1>
        <p style={{ ...P, fontWeight: 700 }}>{c.headline ?? c.title}</p>
        {(c.address ?? c.location) && <p style={P}>{c.address ?? c.location}</p>}
        {contact && <p style={P}>{contact}</p>}
      </div>
    ),
  });

  const summary = c.summary ?? c.cv;
  if (summary) {
    head('summary', t('profile.cv.summary'));
    out.push({ key: 'summary', gap: 4, node: <p style={{ ...P, textAlign: 'justify' }}>{summary}</p> });
  }

  if (c.competencies?.length) {
    head('comp', t('profile.cv.competencies'));
    c.competencies.forEach((x) => out.push({
      key: `comp-${x.label}`, gap: 2,
      node: <ul style={UL}><li><b>{x.label}:</b> {x.text}</li></ul>,
    }));
  } else if (c.skills.length) {
    head('skills', t('profile.cv.skills'));
    out.push({ key: 'skills', gap: 4, node: <p style={P}>{c.skills.join(' · ')}</p> });
  }

  if (c.experience?.length) {
    head('exp', t('profile.cv.experience'));
    c.experience.forEach((x, i) => {
      const id = `exp-${i}`;
      out.push({
        key: id, gap: i ? 12 : 6, keep: true,
        node: (
          <>
            <p style={{ ...P, fontWeight: 700 }}>{x.title} | {x.company}</p>
            <p style={{ ...P, fontStyle: 'italic', color: '#444' }}>{month(x.start)} – {x.end ? month(x.end) : t('profile.cv.present')}</p>
          </>
        ),
      });
      if (x.highlights?.length) {
        x.highlights.forEach((b, k) => out.push({ key: `${id}-${k}`, gap: 2, node: <Bullets items={[b]} /> }));
      } else {
        out.push({ key: `${id}-d`, gap: 2, node: <p style={P}>{x.description}</p> });
      }
    });
  }

  if (c.projects?.length) {
    head('proj', t('profile.cv.projects'));
    c.projects.forEach((p, i) => out.push({
      key: `proj-${i}`, gap: i ? 10 : 6,
      node: (
        <>
          <p style={{ ...P, fontWeight: 700 }}>{p.name} | {p.role}</p>
          <p style={{ ...P, fontStyle: 'italic', color: '#444' }}>{p.period}</p>
          <p style={P}>{p.description}</p>
          {p.tech.length > 0 && <p style={P}><b>{t('profile.cv.tech')}:</b> {p.tech.join(', ')}</p>}
        </>
      ),
    }));
  }

  if (c.education?.length) {
    head('edu', t('profile.cv.education'));
    c.education.forEach((e) => out.push({
      key: `edu-${e.degree}`, gap: 4,
      node: <p style={P}><b>{e.degree}</b> — {e.institution}, {e.year}</p>,
    }));
  }

  const list = (key: string, label: string, items?: string[]) => {
    if (!items?.length) return;
    head(key, label);
    out.push({ key, gap: 4, node: <Bullets items={items.map((text) => ({ text }))} /> });
  };
  list('cert', t('profile.cv.certifications'), c.certifications);
  list('lang', t('profile.cv.languages'), c.languages);
  return out;
}

/** Splits measured block heights into pages; a block flagged `keep` never ends a page. */
export function paginate(blocks: Pick<Block, 'keep'>[], heights: number[], limit = CONTENT_H): number[][] {
  const pages: number[][] = [[]];
  let used = 0;
  blocks.forEach((b, i) => {
    const page = pages[pages.length - 1];
    let need = heights[i];
    if (b.keep && i + 1 < blocks.length) need += heights[i + 1];
    if (page.length > 0 && used + need > limit) {
      pages.push([i]);
      used = heights[i];
    } else {
      page.push(i);
      used += heights[i];
    }
  });
  return pages;
}

/**
 * The "original document": the candidate's CV laid out on A4 pages like the PDF viewer in production, built
 * from the CV data. `maskContact`: viewers without contact-data permission see phone and email as dots.
 */
export function CvDocument({ c, zoom, maskContact = false }: { c: Candidate; zoom: number; maskContact?: boolean }) {
  const t = useT();
  const blocks = useBlocks(c, maskContact);
  const measureRef = useRef<HTMLDivElement>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<number[][] | null>(null);
  const [fit, setFit] = useState(0.7);
  const signature = blocks.map((b) => b.key).join('|');

  useLayoutEffect(() => {
    const kids = Array.from(measureRef.current?.children ?? []) as HTMLElement[];
    setPages(paginate(blocks, kids.map((k) => k.offsetHeight)));
    // Re-measure when the content or its language changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, c, t, maskContact]);

  useLayoutEffect(() => {
    const pane = paneRef.current;
    if (!pane) return;
    const update = () => { if (pane.clientWidth) setFit((pane.clientWidth - GUTTER * 2) / PAGE_W); };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(pane);
    return () => ro.disconnect();
  }, []);

  const pageList = pages ?? [blocks.map((_, i) => i)];
  const render = (i: number, first: boolean) => (
    <div key={blocks[i].key} style={{ paddingTop: first ? 0 : blocks[i].gap }}>{blocks[i].node}</div>
  );

  return (
    <div ref={paneRef} style={{ position: 'absolute', inset: 0, overflow: 'auto', padding: `${GUTTER}px 0` }}>
      {/* Off-screen copy at page width, measured to decide where each page breaks. */}
      <div ref={measureRef} aria-hidden style={{ ...PAGE_STYLE, height: 'auto', padding: 0, width: PAGE_W - PAD_X * 2, position: 'absolute', visibility: 'hidden', left: -10000, top: 0 }}>
        {blocks.map((_, i) => render(i, i === 0))}
      </div>
      <div style={{ zoom: fit * zoom, width: PAGE_W, margin: '0 auto' }}>
        <div data-cv-pages style={{ display: 'flex', flexDirection: 'column', gap: GUTTER * 1.5, alignItems: 'center' }}>
          {pageList.map((idx, p) => (
            <div key={p} data-testid="cv-page" style={PAGE_STYLE}>
              {idx.map((i, k) => render(i, k === 0))}
              {isFixtureMode() && p === pageList.length - 1 && (
                <p style={{ marginTop: 28, textAlign: 'center', color: '#999', fontSize: 10 }}>{t('profile.cv.sample')}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
