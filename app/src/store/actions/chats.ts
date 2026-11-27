import { hasCriteria, parseQuery, searchCandidates } from '../../domain/scoring';
import type { ChatMessage } from '../../domain/types';
import { translate } from '../../i18n/translate';
import type { DemoActions, Env, Get, Set } from './types';

/** Stable 0..n-1 number from a string, so the same question always gets the same demo scores. */
function hashOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Demo only: the real scorer gives every candidate who covers the asked criteria 100%, so a short
 * question returns a wall of ties. Spread them into a believable 55–98% range, stable per candidate + question.
 */
const demoScore = (candidateId: string, question: string, score: number) => Math.max(55, Math.min(98, score - (hashOf(`${candidateId}|${question.trim().toLowerCase()}`) % 40)));

export function chatActions(set: Set, get: Get, env: Env): Pick<DemoActions, 'sendChat' | 'deleteChat'> {
  return {
    sendChat(sessionId, text) {
      const id = sessionId ?? env.id('chat');
      const at = env.now();
      const { candidates, taxonomy, ui } = get();
      const req = parseQuery(text, taxonomy);
      const hits = hasCriteria(req) ? searchCandidates(candidates, req) : [];
      const reply = !hasCriteria(req)
        ? translate(ui.lang, 'assistant.reply.noCriteria')
        : hits.length
          ? translate(ui.lang, 'assistant.reply.found', { count: hits.length })
          : translate(ui.lang, 'assistant.reply.none');
      const messages: ChatMessage[] = [
        { sessionId: id, role: 'user', text, at },
        {
          sessionId: id,
          role: 'assistant',
          text: reply,
          at,
          results: hits
            .map((h) => ({ candidateId: h.candidate.id, score: demoScore(h.candidate.id, text, h.score), reason: h.reason }))
            .sort((a, b) => b.score - a.score),
        },
      ];
      set((s) => ({ chats: [...s.chats, ...messages] }));
      return id;
    },

    deleteChat(sessionId) {
      set((s) => ({ chats: s.chats.filter((m) => m.sessionId !== sessionId) }));
    },
  };
}
