// Portão do site: exige senha (SITE_PASSWORD) em todo caminho estático.
// O token do cookie é um HMAC, nunca a senha em texto. Sem a env, o portão fecha.
import { next } from '@vercel/functions';

export const config = { runtime: 'edge' };

export const COOKIE = 'docao_gate';
export const MAX_AGE = 60 * 60 * 24 * 30;
const TOKEN_MSG = 'docao-site-gate-v1';

export function safeEqual(a, b) {
  const left = String(a ?? '');
  const right = String(b ?? '');
  const len = Math.max(left.length, right.length);
  let out = left.length ^ right.length;
  for (let i = 0; i < len; i++) {
    out |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
  }
  return out === 0;
}

export async function gateToken(secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(String(secret)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(TOKEN_MSG));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function readCookie(header, name) {
  if (!header) return '';
  for (const part of String(header).split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (k === name) return part.slice(i + 1).trim();
  }
  return '';
}

export function safeNextPath(raw, fallback = '/') {
  const value = String(raw || '').trim();
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\') || /[\r\n]/.test(value)) {
    return fallback;
  }
  try {
    const u = new URL(value, 'https://docao.local');
    if (u.origin !== 'https://docao.local') return fallback;
    return u.pathname + u.search + u.hash;
  } catch {
    return fallback;
  }
}

export function cookieHeader(token, { secure = true } = {}) {
  const parts = [
    `${COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${MAX_AGE}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function page({ title, body, status = 200, headers = {} }) {
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  :root { --ink:#2a1410; --gold:#F7A531; --cream:#fff8ec; --pink:#ff9fb6; --red:#e63946; }
  * { box-sizing: border-box; }
  html, body { margin: 0; min-height: 100%; }
  body {
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: radial-gradient(ellipse at 50% 20%, #3a221c 0%, #111 62%);
    font-family: "Trebuchet MS", "Segoe UI", Arial, sans-serif;
    color: #fff8ec;
  }
  .card {
    width: min(420px, calc(100vw - 32px));
    background: rgba(20, 16, 18, .92);
    border: 4px solid var(--ink);
    border-radius: 22px;
    padding: 28px 28px 24px;
    text-align: center;
    box-shadow: 0 8px 0 var(--ink), 0 0 40px rgba(247, 165, 49, .28);
  }
  .salsicha {
    width: 92px; height: 44px; margin: 0 auto 10px; position: relative;
  }
  .salsicha i {
    display: block; width: 92px; height: 32px; border-radius: 20px;
    background: linear-gradient(#f0a04a, #c45c2a);
    border: 3px solid var(--ink); position: absolute; left: 0; top: 8px;
    box-shadow: inset 0 6px 0 rgba(255,255,255,.2);
  }
  .salsicha b {
    position: absolute; left: 10px; right: 10px; top: 0; height: 16px;
    border-radius: 8px 8px 4px 4px;
    background: #fff3d0; border: 3px solid var(--ink);
  }
  h1 {
    margin: 4px 0 0;
    font-size: 52px; line-height: 1;
    color: var(--gold);
    -webkit-text-stroke: 3px var(--ink);
    paint-order: stroke fill;
    letter-spacing: 1px;
  }
  .sub {
    margin: 8px 0 22px;
    color: var(--pink);
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    font-size: 13px;
  }
  p { margin: 0 0 16px; color: #ffe8c2; font-weight: 700; line-height: 1.4; }
  label { display: block; text-align: left; font-weight: 800; color: #ffd27a; font-size: 14px; }
  input[type=password] {
    display: block; width: 100%; margin-top: 6px; margin-bottom: 14px;
    padding: 10px 12px; border-radius: 12px; border: 3px solid var(--ink);
    font-size: 18px; font-weight: 700; background: var(--cream); color: var(--ink);
  }
  button {
    width: 100%; padding: 14px; font-size: 22px; font-weight: 800;
    color: #fff; background: var(--red); border: 4px solid var(--ink);
    border-radius: 16px; box-shadow: 0 5px 0 var(--ink); cursor: pointer;
    font-family: inherit;
  }
  button:hover { background: #ff4d5a; }
  button:active { transform: translateY(3px); box-shadow: 0 2px 0 var(--ink); }
  .err {
    margin: 0 0 14px; padding: 8px 10px; border-radius: 10px;
    background: #4a1518; border: 2px solid #ff6b6b; color: #ffd0d0;
    font-weight: 800; font-size: 14px;
  }
  .hint { margin-top: 14px; margin-bottom: 0; font-size: 13px; color: #cbb7a0; font-weight: 700; }
</style>
</head>
<body>
  <main class="card">${body}</main>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    },
  });
}

export function passwordPage({ nextPath = '/', error = '', status = 401 } = {}) {
  const nextVal = encodeURIComponent(safeNextPath(nextPath));
  const err = error ? `<p class="err" role="alert">${error}</p>` : '';
  return page({
    title: 'Docão · senha',
    status,
    body: `
      <div class="salsicha" aria-hidden="true"><b></b><i></i></div>
      <h1>DOCÃO</h1>
      <p class="sub">Portão da fazendinha</p>
      ${err}
      <form method="post" action="/">
        <input type="hidden" name="next" value="${nextVal}">
        <label>Senha
          <input type="password" name="password" autocomplete="current-password" autofocus required>
        </label>
        <button type="submit">Entrar no jogo</button>
      </form>
      <p class="hint">Quem sabe a senha entra. O resto fica do lado de fora.</p>`,
  });
}

export function missingSecretPage() {
  return page({
    title: 'Docão · portão sem senha',
    status: 503,
    body: `
      <div class="salsicha" aria-hidden="true"><b></b><i></i></div>
      <h1>DOCÃO</h1>
      <p class="sub">Portão trancado</p>
      <p class="err" role="alert">O portão está sem senha configurada. A variável SITE_PASSWORD não está definida neste deploy. Avise o dono do site.</p>
      <p class="hint">Nada do jogo é servido enquanto isso não for resolvido.</p>`,
  });
}

export async function gate(request, env = process.env) {
  const secret = env?.SITE_PASSWORD ?? env?.site_password;
  if (!secret) return missingSecretPage();

  const url = new URL(request.url);
  const expected = await gateToken(secret);
  const got = readCookie(request.headers.get('cookie'), COOKIE);
  if (safeEqual(got, expected)) return null;

  if (request.method === 'POST') {
    let submitted = '';
    let nextPath = safeNextPath(url.searchParams.get('next') || url.pathname + url.search, '/');
    const type = request.headers.get('content-type') || '';
    try {
      if (type.includes('application/x-www-form-urlencoded') || type.includes('multipart/form-data')) {
        const form = await request.formData();
        submitted = String(form.get('password') || '');
        nextPath = safeNextPath(form.get('next') || nextPath, nextPath);
      } else if (type.includes('application/json')) {
        const body = await request.json();
        submitted = String(body?.password || '');
        nextPath = safeNextPath(body?.next || nextPath, nextPath);
      }
    } catch {
      submitted = '';
    }
    if (safeEqual(submitted, secret)) {
      const secure = url.protocol === 'https:';
      return new Response(null, {
        status: 303,
        headers: {
          Location: nextPath,
          'Set-Cookie': cookieHeader(expected, { secure }),
          'cache-control': 'no-store',
        },
      });
    }
    return passwordPage({
      nextPath,
      error: 'Essa senha não é essa não, parceiro. Tenta de novo.',
      status: 401,
    });
  }

  if (request.method === 'HEAD') {
    return new Response(null, { status: 401, headers: { 'cache-control': 'no-store' } });
  }

  const nextPath = url.pathname + url.search + url.hash;
  return passwordPage({ nextPath, status: 401 });
}

export default async function middleware(request) {
  const blocked = await gate(request, process.env);
  if (blocked) return blocked;
  return next();
}
