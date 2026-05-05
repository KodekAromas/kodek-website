import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' };

  try {
    const { name, email, company, vertical, message } = await request.json();

    if (!name || !email) {
      return new Response(JSON.stringify({ error: 'Name and email are required.' }), {
        status: 400,
        headers,
      });
    }

    const apiKey = import.meta.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error('RESEND_API_KEY is not set');
      return new Response(JSON.stringify({ error: 'Server configuration error.' }), {
        status: 503,
        headers,
      });
    }

    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
        <div style="background:#06060a;padding:24px 32px;border-radius:8px 8px 0 0">
          <span style="font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:18px;letter-spacing:0.08em;color:#f0eee8">KODEK</span>
        </div>
        <div style="border:1px solid #e5e7eb;border-top:none;padding:32px;border-radius:0 0 8px 8px">
          <h2 style="margin:0 0 24px;font-size:20px;font-weight:700">New Project Inquiry</h2>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;width:120px;color:#6b7280;font-size:14px">Name</td><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:14px;font-weight:500">${name}</td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:14px">Email</td><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:14px"><a href="mailto:${email}" style="color:#7c6af0">${email}</a></td></tr>
            ${company ? `<tr><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:14px">Company</td><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:14px">${company}</td></tr>` : ''}
            ${vertical ? `<tr><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;color:#6b7280;font-size:14px">Vertical</td><td style="padding:10px 0;border-bottom:1px solid #f3f4f6;font-size:14px">${vertical}</td></tr>` : ''}
            ${message ? `<tr><td style="padding:14px 0;vertical-align:top;color:#6b7280;font-size:14px">Message</td><td style="padding:14px 0;font-size:14px;line-height:1.6">${message.replace(/\n/g, '<br>')}</td></tr>` : ''}
          </table>
          <div style="margin-top:28px;padding:16px;background:#f9fafb;border-radius:6px;font-size:13px;color:#6b7280">
            Submitted via kodek.in contact form
          </div>
        </div>
      </div>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Kodek Website <noreply@kodek.in>',
        to: ['sales@kodek.in'],
        reply_to: email,
        subject: `New inquiry from ${name}${company ? ` — ${company}` : ''}`,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Resend error:', err);
      return new Response(JSON.stringify({ error: 'Failed to send message.' }), {
        status: 500,
        headers,
      });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  } catch (err) {
    console.error('Contact form error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error.' }), {
      status: 500,
      headers,
    });
  }
};
