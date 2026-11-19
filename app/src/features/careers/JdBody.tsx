/** A JD body split into titled sections ("ABOUT THE ROLE" lines become headings, "- x" lines become bullets). */
type Section = { heading?: string; lines: string[] };

const isHeading = (line: string) => line.length < 60 && /[A-Z]/.test(line) && line === line.toUpperCase() && !line.startsWith('-');

export function parseJdBody(body: string): Section[] {
  const out: Section[] = [];
  let cur: Section = { lines: [] };
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (isHeading(line)) {
      if (cur.heading || cur.lines.length) out.push(cur);
      cur = { heading: line, lines: [] };
    } else cur.lines.push(line);
  }
  if (cur.heading || cur.lines.length) out.push(cur);
  return out;
}

const sentence = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

/**
 * Renders the JD as readable sections. `skip` drops sections shown elsewhere on the page (e.g. requirements, skills),
 * and a heading-only section that repeats the job title is dropped too.
 */
export function JdBody({ body, title, skip = [], headingClass }: { body: string; title: string; skip?: RegExp[]; headingClass: string }) {
  const sections = parseJdBody(body).filter(
    (s) => !(s.heading && s.lines.length === 0 && s.heading === title.toUpperCase()) && !(s.heading && skip.some((r) => r.test(s.heading!))),
  );
  return (
    <>
      {sections.map((s, i) => {
        const bullets = s.lines.filter((l) => l.startsWith('- '));
        const text = s.lines.filter((l) => !l.startsWith('- '));
        return (
          <section key={`${s.heading ?? ''}-${i}`}>
            {s.heading && <h2 className={headingClass}>{sentence(s.heading)}</h2>}
            {text.map((l) => <p key={l} className="text-[15px] leading-relaxed text-[#3d312e] mb-2">{l}</p>)}
            {bullets.length > 0 && (
              <ul className="list-disc pl-5 space-y-1 text-[15px] leading-relaxed text-[#3d312e]">
                {bullets.map((b) => <li key={b}>{b.slice(2)}</li>)}
              </ul>
            )}
          </section>
        );
      })}
    </>
  );
}
