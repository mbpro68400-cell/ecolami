/**
 * POST /api/chat
 * Streaming SSE du tuteur socratique Gemini.
 */

import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createAdminClient, getProfileByClerkId, getSessionMessages, saveMessage } from '@/lib/supabase/client';
import { streamChat } from '@/lib/ai/geminiClient';
import { buildPrompt, type TutoringMode, type SchoolLevel, type NeuroprofileTag } from '@/lib/ai/systemPrompts';

const PLAN_MSG_LIMITS: Record<string, number> = {
  free: 20, famille: 100, famille_plus: 200, ecole: 200,
};

export async function POST(req: NextRequest) {
  // ── Auth ──
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'Non authentifié' }, { status: 401 });

  const body = await req.json();
  const { session_id, message, child_id } = body as {
    session_id: string; message: string; child_id: string;
  };

  if (!session_id || !message || !child_id) {
    return Response.json({ error: 'session_id, message et child_id requis' }, { status: 400 });
  }

  const db = createAdminClient();

  // ── Profil parent ──
  const profile = await getProfileByClerkId(userId);
  if (!profile) return Response.json({ error: 'Profil introuvable' }, { status: 404 });

  const plan = profile.plan ?? 'free';

  // ── Session ──
  const { data: session } = await db.from('sessions').select('*')
    .eq('id', session_id).eq('parent_id', profile.id).single();
  if (!session) return Response.json({ error: 'Session introuvable' }, { status: 404 });
  if (session.status !== 'active') return Response.json({ error: 'Session terminée' }, { status: 409 });

  const msgLimit = PLAN_MSG_LIMITS[plan] ?? 20;
  if (session.msg_count >= msgLimit) {
    return Response.json({ error: `Limite de ${msgLimit} messages atteinte.`, code: 'MSG_LIMIT' }, { status: 429 });
  }

  // ── Enfant ──
  const { data: child } = await db.from('children').select('*')
    .eq('id', child_id).eq('parent_id', profile.id).single();
  if (!child) return Response.json({ error: 'Enfant introuvable' }, { status: 404 });

  // ── System prompt ──
  const systemPrompt = buildPrompt({
    mode: session.mode as TutoringMode,
    child: {
      firstName: child.name,
      level: child.grade as SchoolLevel,
      age: child.age,
      neuroprofiles: [child.neuro_profile as NeuroprofileTag],
      preferredLanguage: 'fr',
    },
    subject: session.subject,
    exerciseText: session.exercise_text ?? undefined,
  });

  // ── Historique ──
  const msgs = await getSessionMessages(session_id);
  const history = msgs.map(m => ({ role: m.role as 'user'|'assistant', content: m.content }));

  // ── Sauvegarder le message user ──
  await saveMessage(session_id, 'user', message);

  // ── Stream SSE ──
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      await streamChat({
        systemPrompt, history, userMessage: message,
        callbacks: {
          onToken: (t) => send({ type: 'token', content: t }),
          async onDone(full) {
            await saveMessage(session_id, 'assistant', full, { model: 'gemini-2.0-flash' });
            await db.from('sessions').update({ msg_count: (session.msg_count ?? 0) + 2 }).eq('id', session_id);
            send({ type: 'done', content: full });
            controller.close();
          },
          onError(msg) {
            send({ type: 'error', message: msg });
            controller.close();
          },
        },
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
