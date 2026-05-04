import OpenAI from 'openai';

export const runtime = 'edge';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are Kody, the AI assistant for Kodek (Kodekaromas Technologies Pvt. Ltd.), an AI and technology research company headquartered in Bhubaneswar, Odisha, India. You help website visitors learn about Kodek's services and figure out if Kodek is the right partner for their project.

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

// Rate limiting: 10 requests per IP per 60 seconds
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;
const ipStore = new Map<string, { count: number; windowStart: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipStore.get(ip);
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    ipStore.set(ip, { count: 1, windowStart: now });
    return false;
  }
  if (entry.count >= RATE_LIMIT) return true;
  entry.count++;
  return false;
}

const ALLOWED_ORIGINS = [
  'https://kodek.in',
  'https://www.kodek.in',
  'https://kodekaromas.github.io',
  'http://localhost:4321',
];

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Block requests from outside allowed origins
  const origin = req.headers.get('origin') || '';
  if (!ALLOWED_ORIGINS.includes(origin)) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // IP rate limiting
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';

  if (isRateLimited(ip)) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please wait a moment before trying again.' }),
      { status: 429, headers: { ...corsHeaders(req), 'Retry-After': '60' } }
    );
  }

  try {
    const { messages } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid messages' }), {
        status: 400,
        headers: corsHeaders(req),
      });
    }

    const sanitized = messages.slice(-20).map((m: { role: string; content: string }) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: String(m.content).slice(0, 2000),
    }));

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 500,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...sanitized],
    });

    const content = response.choices[0]?.message?.content ?? '';
    return new Response(JSON.stringify({ content }), { status: 200, headers: corsHeaders(req) });
  } catch (err) {
    console.error('Chat error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: corsHeaders(req),
    });
  }
}
