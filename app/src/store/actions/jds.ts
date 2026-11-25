import type { Jd } from '../../domain/types';
import type { DemoActions, Env, Get, Set } from './types';

/** Next free JD-YYYY-NNN for the year `now` falls in. */
function nextCode(existing: Jd[], now: string): string {
  const year = now.slice(0, 4);
  const used = existing
    .map((j) => /^JD-(\d{4})-(\d+)$/.exec(j.code))
    .filter((m): m is RegExpExecArray => m !== null && m[1] === year)
    .map((m) => Number(m[2]));
  return `JD-${year}-${String(Math.max(0, ...used) + 1).padStart(3, '0')}`;
}

export function jdActions(
  set: Set,
  get: Get,
  env: Env,
): Pick<DemoActions, 'createJd' | 'updateJd' | 'setJdStatus' | 'deleteJd'> {
  const touch = (id: string, change: Partial<Jd>): boolean => {
    if (!get().jds.some((j) => j.id === id)) return false;
    const updatedAt = env.now();
    set((s) => ({ jds: s.jds.map((j) => (j.id === id ? { ...j, ...change, updatedAt } : j)) }));
    return true;
  };

  return {
    createJd({ title, client, domains, skills, body, status, mustHave, skillsExperience, ...details }) {
      const at = env.now();
      const code = nextCode(get().jds, at);
      const jd: Jd = {
        id: code.toLowerCase(),
        code,
        title: title.trim(),
        client: client?.trim() ?? '',
        domains,
        skills,
        body,
        status: status ?? 'Draft',
        ...(mustHave ? { mustHave } : {}),
        ...(skillsExperience ? { skillsExperience } : {}),
        // Structured fields from the full-page editor; undefined ones are dropped so old JDs keep their shape.
        ...Object.fromEntries(Object.entries(details).filter(([, v]) => v !== undefined)),
        createdAt: at,
        updatedAt: at,
      };
      set((s) => ({ jds: [jd, ...s.jds] }));
      return jd;
    },

    updateJd: (id, patch) => touch(id, { ...patch, ...(patch.title !== undefined ? { title: patch.title.trim() } : {}) }),

    setJdStatus: (id, status) => touch(id, { status }),

    deleteJd(id) {
      if (!get().jds.some((j) => j.id === id)) return { ok: false, reason: 'not_found' };
      const jobs = get().jobs.filter((j) => j.jdId === id).length;
      if (jobs > 0) return { ok: false, reason: 'in_use', jobs };
      set((s) => ({ jds: s.jds.filter((j) => j.id !== id) }));
      return { ok: true };
    },
  };
}
