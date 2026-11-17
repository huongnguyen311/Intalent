import { hasCriteria, parseQuery, searchCandidates } from '../../domain/scoring';
import type { ChatMessage } from '../../domain/types';
import { translate } from '../../i18n/translate';
import type { DemoActions, Env, Get, Set } from './types';

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
          results: hits.map((h) => ({ candidateId: h.candidate.id, score: h.score, reason: h.reason })),
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
