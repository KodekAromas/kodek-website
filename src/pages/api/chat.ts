import type { APIRoute } from 'astro';
import OpenAI from 'openai';

export const prerender = false;

const SYSTEM_PROMPT = `You are Kody, the AI assistant for Kodek (Kodekaromas Technologies Pvt. Ltd.), an AI and technology research company. You help website visitors learn about Kodek's services and figure out if Kodek is the right partner for their project.

Kodek builds across five verticals:
1. AI Research & Software — LLM tools, RAG pipelines, AI agents, custom ML, full-stack AI web apps
2. Software Simulations — physics-based simulations, digital twins, training simulators, process models
3. AR / VR Experiences — WebXR, A-Frame, spatial computing, immersive walkthroughs, 3D product configurators
4. Game Development — serious games, training sims, game AI systems, browser-based games, interactive narratives
5. Architecture & Built Environment — ArchViz, AI design assistants, 3D floor plan viewers, PropTech

Live products:
- Builders Copilot: AI-powered real estate CRM. Includes an AI chatbot on every property page, a Leads CRM with status tracking and activity timeline, admin dashboard with analytics, virtual tour integration. White-label available.
- AI Room Restyler: Upload a room photo, choose a style + write a prompt, get a photorealistic AI-restyled version in seconds. Includes style presets, strength controls, personal restyle library, high-res downloads. White-label available.

Service packages (all fixed-price, timeline-guaranteed):
- Package A (Research Spike): ₹25,000 (~$300), 5–7 business days. Technical research sprint, feasibility assessment, tech recommendation report, live PoC prototype, 30-min review call.
- Package B (Interactive Prototype): ₹80,000 (~$1,000), 14–21 business days. Full-stack interactive prototype, deployed live link, 2 revision rounds, source code + docs.
- Package C (Production-Ready Product): ₹1,50,000 (~$1,800), 3–5 weeks. Most popular. Full-stack dev + auth, admin dashboard, cloud deployment, 60-day support, team training.
- Package D (Full Immersive Suite): ₹3,00,000+ (~$3,500+), 5–8 weeks. AI software + AR/VR or simulation, branded deployment, 90-day support, full source files + training.

Contact:
- Email: sales@kodek.in (project inquiries), careers@kodek.in (job applications)
- Website: kodek.in
- Response time: within 24 hours

Guidelines:
- Be helpful, concise, and professional. Match the tone of an AI-first research company — smart but approachable.
- Keep responses short (2–4 sentences) unless the visitor asks a detailed question.
- If someone wants to start a project or request a demo, direct them to the contact form on the page or to sales@kodek.in.
- Don't make up facts about Kodek. Stick to what's above.
- If asked something you don't know, say so honestly and offer to connect them with the team.`;

// Allowed origins — only kodek.in and local dev can use this endpoint
const ALLOWED_ORIGINS = [
  'https://kodek.in',
  'https://www.kodek.in',
];

function getAllowedOrigin(request: Request): string | null {
  const origin = request.headers.get('origin') || '';
  return ALLOWED_ORIGINS.includes(origin) ? origin : null;
}

function json(data: unknown, status = 200, origin?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
    headers['Vary'] = 'Origin';
  }
  return new Response(JSON.stringify(data), { status, headers });
}

export const OPTIONS: APIRoute = async ({ request }) => {
  const origin = getAllowedOrigin(request);
  if (!origin) return new Response(null, { status: 403 });
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    },
  });
};

export const POST: APIRoute = async ({ request, clientAddress }) => {
  // Block requests not from kodek.in
  const origin = getAllowedOrigin(request);
  if (!origin) {
    return json({ error: 'Forbidden' }, 403);
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    clientAddress ||
    'unknown';

  const apiKey = import.meta.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OPENAI_API_KEY is not set');
    return json({ error: 'Server configuration error.' }, 500, origin);
  }

  try {
    const body = await request.json();
    const { messages } = body as { messages: Array<{ role: string; content: string }> };

    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: 'Invalid messages' }, 400, origin);
    }

    // Hard cap: reject oversized payloads before touching OpenAI
    const totalChars = messages.reduce((sum, m) => sum + String(m.content || '').length, 0);
    if (totalChars > 20_000) {
      return json({ error: 'Request too large.' }, 400, origin);
    }

    const sanitized = messages.slice(-10).map((m) => ({
      role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: String(m.content).slice(0, 1000),
    }));

    const client = new OpenAI({ apiKey });
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 300,           // tighter cap — Kody answers are short
      temperature: 0.5,
      user: ip,                  // lets OpenAI flag/block abusive users
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...sanitized],
    });

    const content = response.choices[0]?.message?.content ?? '';
    return json({ content }, 200, origin);
  } catch (err) {
    console.error('Chat error:', err);
    return json({ error: 'Internal server error' }, 500, origin);
  }
};
