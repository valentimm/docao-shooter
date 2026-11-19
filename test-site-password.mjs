// Portão do site: senha via env, cookie HMAC, sem servir o jogo sem cookie.
// Uso: SITE_PASSWORD=teste-local-123 node test-site-password.mjs
import { COOKIE, MAX_AGE, cookieHeader, gate, gateToken, missingSecretPage, passwordPage, readCookie, safeEqual, safeNextPath } from './middleware.js';

const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };

const PASS = 'teste-local-123';
const OTHER = 'senha-errada';
const env = { SITE_PASSWORD: PASS };

function req(url, { method = 'GET', cookie, body, type } = {}) {
  const headers = {};
  if (cookie) headers.cookie = cookie;
  if (type) headers['content-type'] = type;
  const init = { method, headers };
  if (body != null) init.body = body;
  return new Request(url, init);
}

ok(safeEqual('abc', 'abc') && !safeEqual('abc', 'abd') && !safeEqual('abc', 'ab') && !safeEqual('', 'a'), 'comparação em tempo constante distingue iguais e diferentes');
ok(safeNextPath('/main.js') === '/main.js' && safeNextPath('/assets/foo.glb?x=1') === '/assets/foo.glb?x=1', 'next relativo é aceito');
ok(safeNextPath('https://evil.test/') === '/' && safeNextPath('//evil.test') === '/' && safeNextPath('/\\evil') === '/', 'next absoluto ou protocol-relative é recusado');
ok(readCookie(`${COOKIE}=aaa; other=1`, COOKIE) === 'aaa' && readCookie('x=1', COOKIE) === '', 'lê o cookie do portão e ignora os outros');

const header = cookieHeader('tokenteste', { secure: true });
ok(header.includes(`${COOKIE}=tokenteste`) && header.includes('HttpOnly') && header.includes('Secure') && header.includes('SameSite=Lax') && header.includes('Path=/') && header.includes(`Max-Age=${MAX_AGE}`), 'cookie é HttpOnly, Secure, SameSite=Lax, Path=/ e dura 30 dias');
ok(!cookieHeader('t', { secure: false }).includes('Secure'), 'em HTTP local o cookie não pede Secure');

const token = await gateToken(PASS);
const token2 = await gateToken(PASS);
const otherTok = await gateToken(OTHER);
ok(token && token === token2 && token.length === 64 && token !== otherTok && token !== PASS && !token.includes(PASS), 'token é HMAC hex estável e não contém a senha em texto');

const missing = await gate(req('https://docao.mvalentim.dev/'), {});
ok(missing.status === 503 && /SITE_PASSWORD/.test(await missing.text()) && !/teste-local/.test(await (await gate(req('https://docao.mvalentim.dev/'), {})).text()), 'sem SITE_PASSWORD o portão fecha com página de erro clara');

const page = await gate(req('https://docao.mvalentim.dev/'), env);
const pageHtml = await page.text();
ok(page.status === 401 && /DOCÃO/.test(pageHtml) && /Entrar no jogo/.test(pageHtml) && /Portão da fazendinha/.test(pageHtml) && /name="password"/.test(pageHtml), 'GET sem cookie devolve a página de senha em pt-BR');
ok(!/teste-local-123/.test(pageHtml) && !pageHtml.includes(token), 'a página de senha não vaza a senha nem o token');

const js = await gate(req('https://docao.mvalentim.dev/main.js'), env);
const jsBody = await js.text();
ok(js.status === 401 && /Entrar no jogo/.test(jsBody) && !/function|export|import/.test(jsBody.slice(0, 80)), 'GET /main.js sem cookie não serve o JS do jogo');

const glb = await gate(req('https://docao.mvalentim.dev/assets/maps/breeze.glb'), env);
ok(glb.status === 401 && (glb.headers.get('content-type') || '').includes('text/html'), 'GET de GLB sem cookie não serve o arquivo');

const head = await gate(req('https://docao.mvalentim.dev/main.js', { method: 'HEAD' }), env);
ok(head.status === 401 && !(await head.text()), 'HEAD sem cookie também é 401 e não devolve o arquivo');

const badForm = new URLSearchParams({ password: OTHER, next: '/' });
const wrong = await gate(req('https://docao.mvalentim.dev/', { method: 'POST', body: badForm, type: 'application/x-www-form-urlencoded' }), env);
const wrongHtml = await wrong.text();
ok(wrong.status === 401 && /não é essa não/.test(wrongHtml) && !wrong.headers.get('set-cookie'), 'senha errada é recusada e não seta cookie');

const goodForm = new URLSearchParams({ password: PASS, next: '/' });
const okLogin = await gate(req('https://docao.mvalentim.dev/', { method: 'POST', body: goodForm, type: 'application/x-www-form-urlencoded' }), env);
const setCookie = okLogin.headers.get('set-cookie') || '';
ok(okLogin.status === 303 && okLogin.headers.get('location') === '/' && setCookie.includes(`${COOKIE}=${token}`) && /HttpOnly/i.test(setCookie) && /Secure/i.test(setCookie) && !setCookie.includes(PASS), 'senha certa seta cookie HMAC HttpOnly/Secure e redireciona');

const deepForm = new URLSearchParams({ password: PASS, next: '/assets/maps/breeze.glb' });
const deep = await gate(req('https://docao.mvalentim.dev/', { method: 'POST', body: deepForm, type: 'application/x-www-form-urlencoded' }), env);
ok(deep.status === 303 && deep.headers.get('location') === '/assets/maps/breeze.glb', 'depois do login redireciona para o caminho pedido');

const evilForm = new URLSearchParams({ password: PASS, next: 'https://evil.test/phish' });
const evil = await gate(req('https://docao.mvalentim.dev/', { method: 'POST', body: evilForm, type: 'application/x-www-form-urlencoded' }), env);
ok(evil.status === 303 && evil.headers.get('location') === '/', 'next externo não é usado no redirect');

const authed = await gate(req('https://docao.mvalentim.dev/main.js', { cookie: `${COOKIE}=${token}` }), env);
ok(authed === null, 'com cookie válido o middleware libera o caminho (main.js segue pro estático)');

const authedGlb = await gate(req('https://docao.mvalentim.dev/assets/maps/breeze.glb', { cookie: `${COOKIE}=${token}` }), env);
ok(authedGlb === null, 'com cookie válido o GLB também é liberado, sem o middleware bufferizar o arquivo');

const stale = await gate(req('https://docao.mvalentim.dev/', { cookie: `${COOKIE}=${otherTok}` }), env);
ok(stale && stale.status === 401, 'cookie assinado com outra senha é recusado');

const src = await (await import('node:fs')).readFileSync(new URL('./middleware.js', import.meta.url), 'utf8');
ok(!/Cheers@/.test(src) && !/SITE_PASSWORD\s*=\s*['"][^'"]+['"]/.test(src), 'middleware.js não contém senha hardcoded');
ok(/runtime:\s*'edge'/.test(src), 'middleware roda no Edge');

const passPage = await passwordPage({ nextPath: '/', error: '' }).text();
ok(/DOCÃO/.test(passPage) && /Senha/.test(passPage), 'página de senha tem título e campo');
ok((await missingSecretPage().text()).includes('SITE_PASSWORD'), 'página de falha cita a env que falta');

if (fails.length) {
  console.log('\nFalhou: ' + fails.length);
  process.exit(1);
}
console.log('\nTudo certo: portão do site');
