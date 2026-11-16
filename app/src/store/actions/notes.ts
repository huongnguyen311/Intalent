import type { Activity, Note } from '../../domain/types';
import type { DemoActions, Env, Get, Set } from './types';

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export function noteActions(set: Set, get: Get, env: Env): Pick<DemoActions, 'addNote' | 'convertNote'> {
  return {
    addNote(input, by) {
      const at = env.now();
      const note: Note = { id: env.id('note'), ...input, createdBy: by, createdAt: at };
      const activity: Activity = {
        type: 'note_added',
        by,
        at,
        detail: `Note about ${input.name} (not in Talent Pool)`,
      };
      set((s) => ({ notes: [...s.notes, note], activities: [...s.activities, activity] }));
      return note;
    },

    convertNote(noteId, by) {
      const note = get().notes.find((n) => n.id === noteId);
      if (!note) throw new Error(`Unknown note: ${noteId}`);
      const contact = note.contact.trim();
      const identity = EMAIL_RE.test(contact) ? { email: contact } : { phone: contact };
      const result = get().upsertCandidate({ name: note.name, ...identity }, { source: 'Note', by });
      const activity: Activity = {
        type: 'note_converted',
        candidateId: result.candidate.id,
        by,
        at: env.now(),
        detail: result.created ? 'Note converted to new profile' : 'Note linked to existing profile',
      };
      set((s) => ({
        notes: s.notes.map((n) => (n.id === noteId ? { ...n, convertedToCandidateId: result.candidate.id } : n)),
        activities: [...s.activities, activity],
      }));
      return result;
    },
  };
}
