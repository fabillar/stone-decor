/* Stone Decor — contact & quote form handler (Vercel serverless function)
 * Sends form submissions to info@stonedecor.net via Resend.
 *
 * Environment variables (Vercel → Project → Settings → Environment Variables):
 *   RESEND_API_KEY  (required) — added by the Resend integration
 *   CONTACT_TO      (optional) — defaults to info@stonedecor.net
 *   CONTACT_FROM    (optional) — defaults to "Stone Decor Website <website@stonedecor.net>";
 *                                must be on a domain verified in Resend
 */
const TO = process.env.CONTACT_TO || 'info@stonedecor.net';
const FROM = process.env.CONTACT_FROM || 'Stone Decor Website <website@stonedecor.net>';

const LIMITS = { name: 100, email: 254, phone: 40, text: 200, message: 5000 };
const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/;

const clean = (v, max) => String(v ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, max);
const cleanBlock = (v, max) => String(v ?? '').replace(/\r\n/g, '\n').trim().slice(0, max);
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > 50000) break; }
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }
  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not set');
    return res.status(500).json({ ok: false, error: 'Email service is not configured.' });
  }

  const d = await readBody(req);

  // Honeypot: real visitors never fill the hidden "company" field. Pretend success for bots.
  if (d.company) return res.status(200).json({ ok: true });

  const kind = d.kind === 'quote' ? 'quote' : 'contact';
  const name = kind === 'quote'
    ? clean(d.name, LIMITS.name)
    : clean(`${clean(d.firstName, LIMITS.name)} ${clean(d.lastName, LIMITS.name)}`, LIMITS.name * 2);
  const email = clean(d.email, LIMITS.email);
  const phone = clean(d.phone, LIMITS.phone);
  const projectType = clean(d.projectType, LIMITS.text);
  const timeline = clean(d.timeline, LIMITS.text);
  const location = clean(d.location, LIMITS.text);
  const message = cleanBlock(kind === 'quote' ? d.details : d.message, LIMITS.message);

  const missing = !name || !email || !message || (kind === 'quote' && !projectType);
  if (missing) return res.status(400).json({ ok: false, error: 'Please fill in the required fields marked with *.' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ ok: false, error: 'Please enter a valid email address.' });

  const subject = kind === 'quote'
    ? `Quote request – ${projectType} – ${name}`
    : `Website enquiry${projectType ? ' – ' + projectType : ''} – ${name}`;

  const rows = [
    ['Name', name],
    ['Email', email],
    ['Phone', phone],
    ['Project type', projectType],
    ['Timeline', timeline],
    ['Location', location],
  ].filter(([, v]) => v);

  const text = `${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\n${kind === 'quote' ? 'Project details' : 'Message'}:\n${message}\n\n— Sent from the stonedecor.net ${kind} form`;

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f2ec;font-family:Georgia,'Times New Roman',serif;color:#2b2520">
<table role="presentation" width="100%" style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e6ddd0">
<tr><td style="padding:24px 28px;border-bottom:1px solid #e6ddd0">
<p style="margin:0 0 4px;font:12px/1.4 Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#9a7b4f">${kind === 'quote' ? 'New quote request' : 'New website enquiry'}</p>
<h1 style="margin:0;font-size:22px;font-weight:normal">${esc(name)}</h1></td></tr>
<tr><td style="padding:20px 28px"><table role="presentation" style="font:14px/1.6 Arial,sans-serif">
${rows.map(([k, v]) => `<tr><td style="padding:2px 16px 2px 0;color:#8a7d6e;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:2px 0">${k === 'Email' ? `<a href="mailto:${esc(v)}" style="color:#9a7b4f">${esc(v)}</a>` : k === 'Phone' ? `<a href="tel:${esc(v.replace(/[^\d+]/g, ''))}" style="color:#9a7b4f">${esc(v)}</a>` : esc(v)}</td></tr>`).join('\n')}
</table></td></tr>
<tr><td style="padding:0 28px 24px"><p style="margin:0 0 6px;font:12px/1.4 Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#8a7d6e">${kind === 'quote' ? 'Project details' : 'Message'}</p>
<div style="font:15px/1.6 Arial,sans-serif;white-space:pre-wrap">${esc(message)}</div></td></tr>
<tr><td style="padding:14px 28px;background:#faf7f2;border-top:1px solid #e6ddd0;font:12px/1.4 Arial,sans-serif;color:#8a7d6e">Sent from the stonedecor.net ${kind} form. Reply to this email to respond directly to ${esc(name)}.</td></tr>
</table></body></html>`;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [TO], reply_to: email, subject, text, html }),
    });
    if (!r.ok) {
      console.error('Resend error', r.status, await r.text());
      return res.status(502).json({ ok: false, error: 'Sorry, your message could not be sent. Please email info@stonedecor.net directly.' });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Resend request failed', err);
    return res.status(502).json({ ok: false, error: 'Sorry, your message could not be sent. Please email info@stonedecor.net directly.' });
  }
};
