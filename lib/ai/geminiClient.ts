/**
 * EcoLami — Client Google Gemini
 * gemini-2.0-flash (gratuit) pour le tuteur et la vision.
 */

import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  type Content,
} from '@google/generative-ai';

const MODEL = 'gemini-2.0-flash';

const SAFETY = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT,        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,       threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

function getClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY manquante dans .env.local');
  return new GoogleGenerativeAI(key);
}

// ─── Streaming SSE ───────────────────────────────

export interface StreamCallbacks {
  onToken: (t: string) => void;
  onDone: (full: string) => void;
  onError: (msg: string) => void;
}

export async function streamChat(opts: {
  systemPrompt: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  userMessage: string;
  callbacks: StreamCallbacks;
}): Promise<void> {
  const { systemPrompt, history, userMessage, callbacks } = opts;

  const genAI = getClient();
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: systemPrompt,
    safetySettings: SAFETY,
    generationConfig: { maxOutputTokens: 1024, temperature: 0.7, topP: 0.9 },
  });

  // Convertir historique → format Gemini
  const geminiHistory: Content[] = history.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  try {
    const chat = model.startChat({ history: geminiHistory });
    const result = await chat.sendMessageStream(userMessage);

    let full = '';
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) { full += text; callbacks.onToken(text); }
    }
    callbacks.onDone(full);

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur Gemini';
    callbacks.onError(msg.includes('quota') ? 'Quota Gemini atteint. Réessaie dans quelques secondes.' : msg);
  }
}

// ─── Analyse d'image (Mode Scan) ─────────────────

export interface HomeworkAnalysis {
  title: string;
  subject: string;
  grade: string;
  topic: string;
  exercises: Array<{
    id: number;
    text: string;
    type: 'calcul'|'redaction'|'qcm'|'probleme'|'schema'|'autre';
    difficulty: 'facile'|'moyen'|'difficile';
    estimated_minutes: number;
  }>;
  difficulty: 'facile'|'moyen'|'difficile';
  estimated_total_minutes: number;
  transcription: string;
  first_question: string;
  confidence: number;
}

const SCAN_PROMPT = `Tu es EcoLami. Analyse cette photo de devoir scolaire français.
Identifie les exercices et retourne UNIQUEMENT ce JSON (pas de texte autour) :
{
  "title": "titre du devoir",
  "subject": "mathematiques|francais|sciences|histoire-geo|anglais|autre",
  "grade": "cp|ce1|ce2|cm1|cm2|6eme|5eme|4eme|3eme|2nde|1ere|terminale",
  "topic": "chapitre ou notion",
  "exercises": [{"id":1,"text":"texte complet","type":"calcul|redaction|qcm|probleme|schema|autre","difficulty":"facile|moyen|difficile","estimated_minutes":5}],
  "difficulty": "difficulté globale",
  "estimated_total_minutes": 20,
  "transcription": "tout le texte visible",
  "first_question": "première question socratique pour guider l'élève",
  "confidence": 0.9
}`;

export async function analyzeImage(base64: string, mimeType: string): Promise<HomeworkAnalysis> {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({
    model: MODEL,
    safetySettings: SAFETY,
    generationConfig: { maxOutputTokens: 4096, temperature: 0.2 },
  });

  const result = await model.generateContent([
    { inlineData: { mimeType, data: base64 } },
    { text: SCAN_PROMPT },
  ]);

  const text = result.response.text();
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Impossible d\'analyser cette image. Vérifiez que la photo est nette.');

  const analysis = JSON.parse(match[0]) as HomeworkAnalysis;
  if (!analysis.exercises?.length) throw new Error('Aucun exercice détecté. Prenez une photo plus proche.');
  return analysis;
}

// ─── Génération simple (sans streaming) ──────────

export async function generate(prompt: string, system?: string): Promise<string> {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({
    model: MODEL, safetySettings: SAFETY,
    ...(system ? { systemInstruction: system } : {}),
    generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
  });
  const result = await model.generateContent(prompt);
  return result.response.text();
}
