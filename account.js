// ============================================================
//  Conta do jogador (login OPCIONAL): fala com o Worker (/api/auth, /api/me, /api/rank). Sem Three.js.
//  O token fica só no navegador (localStorage 'docao.auth'); convidado = sem token, o jogo funciona igual.
// ============================================================
import { HTTP_URL } from './config.js';

const KEY = 'docao.auth';
let token = ''; try { token = localStorage.getItem(KEY) || ''; } catch (e) { /* sem storage */ }
let account = null, stats = null, items = [], earn = { today: 0, cap: 0 }; // { nick, skin, custom, coins } · mochila (ids das partes) · ganho de hoje · { all:{kills,deaths,wins,matches}, dm:{...}, ... }
const subs = new Set();
const emit = () => subs.forEach((f) => { try { f(account, stats); } catch (e) { console.error(e); } });
export const getToken = () => token;
export const getAccount = () => account;
export const getStats = () => stats;
export const getItems = () => items.slice(); // mochila no cliente: vem do /api/me e da compra (sem polling)
export const getEarn = () => earn;
let chal = null, chalAt = 0; // desafios do dia (vêm no /api/me; o relógio do reset anda no cliente)
export const getChal = () => (chal ? { ...chal, resetIn: Math.max(0, Math.round(chal.resetIn - (Date.now() - chalAt) / 1000)) } : null);
export const onAccount = (f) => { subs.add(f); return () => subs.delete(f); };
function setToken(t) { token = t || ''; try { if (token) localStorage.setItem(KEY, token); else localStorage.removeItem(KEY); } catch (e) { /* sem storage */ } }

async function api(path, { method = 'GET', body, auth = false } = {}) {
  const headers = {}; if (body) headers['Content-Type'] = 'application/json'; if (auth && token) headers.Authorization = 'Bearer ' + token;
  let r; try { r = await fetch(HTTP_URL + path, { method, headers, body: body ? JSON.stringify(body) : undefined }); } catch (e) { return { ok: false, status: 0, data: { error: 'Sem conexão com o servidor' } }; }
  const data = await r.json().catch(() => ({})); return { ok: r.ok, status: r.status, data };
}
async function enter(path, nick, password) {
  const r = await api(path, { method: 'POST', body: { nick, password } });
  if (!r.ok || !r.data.token) return { error: r.data.error || 'Não deu certo. Tente de novo.' };
  setToken(r.data.token); account = r.data.account; stats = null; items = []; emit(); refreshStats(); return { account };
}
export const register = (nick, password) => enter('/api/auth/register', nick, password);
export const login = (nick, password) => enter('/api/auth/login', nick, password);
export async function logout() { const t = token; if (t) await api('/api/auth/logout', { method: 'POST', auth: true }); setToken(''); account = null; stats = null; items = []; emit(); }
export function dropSession() { setToken(''); account = null; stats = null; items = []; emit(); } // token vencido/recusado pelo servidor da sala
export async function refreshStats() {
  if (!token) return null; const r = await api('/api/me', { auth: true });
  if (r.status === 401) { dropSession(); return null; }
  if (r.ok) { account = r.data.account; stats = r.data.stats; items = r.data.items || []; earn = r.data.earn || earn; chal = r.data.chal || null; chalAt = Date.now(); emit(); } return r.ok ? r.data : null;
}
export const loadMe = refreshStats; // no começo: confere o token guardado (se vencer, volta a convidado)
let skinTimer = 0, skinWant = '';
export function saveSkin(skin) { // pula de skin em skin sem gravar a cada clique: espera 700 ms parado (menos escrita no D1)
  if (!token || !account || account.skin === skin) return; skinWant = skin; clearTimeout(skinTimer);
  skinTimer = setTimeout(async () => {
    const want = skinWant; if (!token || !account || account.skin === want) return;
    const r = await api('/api/me/skin', { method: 'PUT', body: { skin: want }, auth: true });
    if (r.ok && account) { account.skin = want; if (want.startsWith('x1.')) account.custom = want; } else if (r.status === 401) dropSession();
  }, 700);
}
export async function equipLook(code) { // visual personalizado: imediato, com resposta (o servidor confere se as partes são suas)
  if (!token || !account) return { error: 'Entre na sua conta para salvar o visual' };
  clearTimeout(skinTimer);
  const r = await api('/api/me/skin', { method: 'PUT', body: { skin: code }, auth: true });
  if (r.status === 401) { dropSession(); return { error: 'Sessão expirada. Entre de novo.' }; }
  if (!r.ok) return { error: r.data.error || 'Não deu pra salvar' };
  account.skin = code; account.custom = code; emit(); return { ok: true };
}
export async function buyItem(item) { // o servidor decide: preço, saldo e se já é seu. Aqui só atualiza a tela com a resposta.
  if (!token || !account) return { error: 'Entre na sua conta para comprar' };
  const r = await api('/api/shop/buy', { method: 'POST', body: { item }, auth: true });
  if (r.status === 401) { dropSession(); return { error: 'Sessão expirada. Entre de novo.' }; }
  if (!r.ok) { if (r.status === 409 && !items.includes(item)) { items.push(item); emit(); } return { error: r.data.error || 'Não deu pra comprar' }; }
  if (!items.includes(r.data.item)) items.push(r.data.item); account.coins = r.data.coins; emit(); return { ok: true, coins: r.data.coins };
}
export async function equipKnife(id) { // '' volta pra faca de churrasqueiro. O servidor só aceita faca que está na mochila.
  if (!token || !account) return { error: 'Entre na sua conta para equipar' };
  const r = await api('/api/me/knife', { method: 'PUT', body: { knife: id || '' }, auth: true });
  if (r.status === 401) { dropSession(); return { error: 'Sessão expirada. Entre de novo.' }; }
  if (!r.ok) return { error: r.data.error || 'Não deu pra equipar' };
  account.knife = r.data.knife || null; emit(); return { ok: true, knife: account.knife };
}
export async function equipSniper(id) {
  if (!token || !account) return { error: 'Entre na sua conta para equipar' };
  const r = await api('/api/me/sniper', { method: 'PUT', body: { sniper: id || '' }, auth: true });
  if (r.status === 401) { dropSession(); return { error: 'Sessão expirada. Entre de novo.' }; }
  if (!r.ok) return { error: r.data.error || 'Não deu pra equipar' };
  account.sniper = r.data.sniper || null; emit(); return { ok: true, sniper: account.sniper };
}
export async function equipGun(key, id) {
  if (!token || !account) return { error: 'Entre na sua conta para equipar' };
  const r = await api('/api/me/gun', { method: 'PUT', body: { key, item: id || '' }, auth: true });
  if (r.status === 401) { dropSession(); return { error: 'Sessão expirada. Entre de novo.' }; }
  if (!r.ok) return { error: r.data.error || 'Não deu pra equipar' };
  account.guns = r.data.guns || {}; emit(); return { ok: true, guns: account.guns };
}
export async function openBox() {
  if (!token || !account) return { error: 'Entre na sua conta para abrir o caixote' };
  const r = await api('/api/lootbox/open', { method: 'POST', auth: true });
  if (r.status === 401) { dropSession(); return { error: 'Sessão expirada. Entre de novo.' }; }
  if (!r.ok) return { error: r.data.error || 'Não deu pra abrir' };
  if (!r.data.dupe && r.data.item && !items.includes(r.data.item.id)) items.push(r.data.item.id);
  account.coins = r.data.coins | 0; account.boxes = r.data.boxes | 0; emit();
  return { ok: true, dupe: !!r.data.dupe, item: r.data.item, coins: account.coins, gain: r.data.gain | 0, boxes: account.boxes };
}
export async function spinWheel(ids) {
  if (!token || !account) return { error: 'Entre na sua conta para girar a roleta' };
  const r = await api('/api/lootbox/wheel', { method: 'POST', body: { items: ids }, auth: true });
  if (r.status === 401) { dropSession(); return { error: 'Sessão expirada. Entre de novo.' }; }
  if (!r.ok) return { error: r.data.error || 'Não deu pra girar' };
  const spent = Array.isArray(r.data.spent) ? r.data.spent : [];
  items = items.filter((id) => !spent.includes(id));
  if (!r.data.dupe && r.data.item && !items.includes(r.data.item.id)) items.push(r.data.item.id);
  account.coins = r.data.coins | 0;
  account.knife = r.data.knife || null;
  account.sniper = r.data.sniper || null;
  account.guns = r.data.guns || {};
  emit();
  return { ok: true, dupe: !!r.data.dupe, item: r.data.item, coins: account.coins, gain: r.data.gain | 0, spent, knife: account.knife, sniper: account.sniper, guns: account.guns };
}
export async function loadRank(mode = 'all', sort = 'kills') {
  const r = await api(`/api/rank?mode=${encodeURIComponent(mode)}&sort=${encodeURIComponent(sort)}&limit=20`);
  return r.ok ? r.data.rows || [] : null;
}
