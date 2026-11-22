// ============================================================
//  Telas de conta e ranking (menu): faixa "Convidado / Logado", janela de entrar/criar conta e ranking.
//  Textos em pt-BR, estilo comanda. Não mexe no jogo: só avisa quem mudou via onAccount.
// ============================================================
import { DEV_LOCAL, getAccount, getToken, getStats, getChal, getElo, onAccount, onPromoGrant, register, login, logout, loadRank, loadEloRank, refreshStats } from './account.js';
import { nickError, passError, cleanNick } from './shared/nick.js';
import { COIN_ICON, CURRENCY } from './shared/closet.js';
import { BOX_PRICE } from './shared/lootbox.js';
import { TIERS } from './shared/challenges.js';
import { ELO_START, ELO_TIERS, ELO_MODES, eloMode, eloSummary, isMaxEloTier } from './shared/elo.js';
import { promoActive, PROMO_ID, PROMO_COINS, PROMO_TITLE, PROMO_KICKER, PROMO_CREDIT_OK, PROMO_GUEST_OK, PROMO_GUEST_SKIP, promoCreditHtml, promoGuestHtml } from './shared/promo.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const RANK_MODES = [['all', 'Geral'], ['dm', 'Mata-mata'], ['dom', 'Dominação'], ['bomb', 'Bomba'], ['inv', 'Invasão']];
let reg = false, rankMode = 'all', rankSort = 'kills', busy = false, eloPick = 'comp';

// ---------- painel "Desafios do dia" no menu principal (só leitura: vem no mesmo /api/me da conta; nada é gravado) ----------
const left = (s) => { s = Math.max(0, s | 0); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h}h ${String(m).padStart(2, '0')}min` : m ? `${m}min` : 'menos de 1 min'; };
let dailyTimer = 0, dailyAsked = 0;
function renderDaily() {
  const box = $('dailyPanel'); if (!box) return; const a = getAccount(), c = a ? getChal() : null;
  if (a?.dev) { box.innerHTML = '<div class="daily-head"><b>DEV local</b></div><p class="daily-note">Todos os visuais liberados, sem login. As escolhas ficam salvas neste navegador.</p>'; box.classList.remove('guest'); return; }
  if (!a) { box.innerHTML = `<div class="daily-head"><b>🎯 Desafios do dia</b></div><p class="daily-guest">3 desafios novos todo dia valendo <b>Docoins ${COIN_ICON}</b>. <button type="button" class="daily-enter" data-daily-enter>ENTRAR NA CONTA</button></p>`; box.classList.add('guest'); return; }
  box.classList.remove('guest');
  if (!c || !c.list) { box.innerHTML = '<div class="daily-head"><b>🎯 Desafios do dia</b><span>carregando…</span></div>'; return; }
  if (c.resetIn <= 0 && Date.now() - dailyAsked > 30000) { dailyAsked = Date.now(); refreshStats(); } // virou o dia: busca os novos (1 leitura)
  const done = c.list.filter((x) => x.done).length;
  box.innerHTML = `<div class="daily-head"><b>🎯 Desafios do dia <em>${done}/${c.list.length}</em></b><span title="Novos desafios à meia-noite de Brasília">⏳ novos em <b>${left(c.resetIn)}</b></span></div>`
    + c.list.map((x) => `<button type="button" class="daily-row t${x.tier}${x.done ? ' done' : ''}" data-open-chal title="${esc(x.text + ' — ' + TIERS[x.tier] + ' · ' + x.mode)}"><span class="daily-text">${esc(x.text)}</span>`
      + `<span class="daily-prize">${x.done ? '✓ ' : ''}${COIN_ICON} ${x.reward}</span><span class="daily-bar"><i style="width:${Math.round(100 * Math.min(1, x.prog / x.goal))}%"></i></span><span class="daily-prog">${x.prog}/${x.goal}</span></button>`).join('')
    + `<p class="daily-note">🌽 <b>${a.boxes | 0}</b> caixote${(a.boxes | 0) === 1 ? '' : 's'} · 1 ao entrar, +1 por desafio e 1 comprado por ${BOX_PRICE}. <button type="button" data-open-box>ABRIR</button></p>`
    + '<p class="daily-note">🌐 Conta só em <b>partida online</b> logado (sala com bots vale). Offline e Treino não contam.</p>';
}
function renderStrip(a) {
  const t = $('acctTxt'), b = $('acctBtn');
  b.disabled = !!a?.dev;
  if (a?.dev) { t.textContent = 'DEV local · todas as skins liberadas · sem login'; b.textContent = 'DEV LOCAL'; return; }
  if (a) { t.innerHTML = `🐷 <b>${esc(a.nick)}</b> · <span class="nw">${COIN_ICON} <b>${a.coins | 0}</b> ${CURRENCY}</span> · 🌽 <b>${a.boxes | 0}</b>`; b.textContent = 'MINHA CONTA'; }
  else { t.textContent = 'Convidado · com conta: apelido só seu, skin guardada e ranking'; b.textContent = 'ENTRAR'; }
}
function renderUser() {
  const a = getAccount(), s = (getStats() || {}).all || { kills: 0, deaths: 0, wins: 0, matches: 0 };
  $('acctGuest').classList.toggle('hidden', !!a); $('acctUser').classList.toggle('hidden', !a);
  if (a) {
    $('acctNickView').textContent = a.nick;
    $('acctStats').innerHTML = [['Abates', s.kills], ['Mortes', s.deaths], ['Vitórias', s.wins], ['Partidas', s.matches]].map(([k, v]) => `<div><b>${v | 0}</b>${k}</div>`).join('');
  }
}
function setMode(isReg) {
  reg = isReg; $('acctTabLogin').classList.toggle('active', !reg); $('acctTabReg').classList.toggle('active', reg);
  $('acctPass2Row').classList.toggle('hidden', !reg); $('acctSubmit').textContent = reg ? 'CRIAR CONTA' : 'ENTRAR'; $('acctErr').textContent = '';
  $('acctPass').autocomplete = reg ? 'new-password' : 'current-password';
  $('acctHelp').textContent = reg ? 'Apelido de 3 a 16 letras/números (pode ter espaço . - _). Ele fica fixo e é só seu. Senha de pelo menos 8 caracteres.' : 'Entre com o apelido e a senha da sua comanda.';
}
const guestPromoKey = () => `docao.promo.${PROMO_ID}.guest`;
function guestPromoSeen() { try { return localStorage.getItem(guestPromoKey()) === '1'; } catch (e) { return true; } }
function markGuestPromoSeen() { try { localStorage.setItem(guestPromoKey(), '1'); } catch (e) { /* sem storage */ } }
function closePromo() { const m = $('promoModal'); if (m) m.classList.add('hidden'); }
function openPromo({ guest }) {
  const modal = $('promoModal'); if (!modal) return;
  $('promoKicker').textContent = PROMO_KICKER;
  $('promoTitle').textContent = PROMO_TITLE;
  const coins = $('promoCoins');
  if (guest) coins.classList.add('hidden');
  else { coins.classList.remove('hidden'); coins.innerHTML = `${COIN_ICON} <b>${PROMO_COINS}</b> <small>${CURRENCY}</small>`; }
  $('promoBody').innerHTML = guest ? promoGuestHtml() : promoCreditHtml();
  $('promoOk').textContent = guest ? PROMO_GUEST_OK : PROMO_CREDIT_OK;
  $('promoSkip').textContent = PROMO_GUEST_SKIP;
  $('promoSkip').classList.toggle('hidden', !guest);
  modal.dataset.kind = guest ? 'guest' : 'credit';
  modal.classList.remove('hidden');
  $('promoOk').focus();
}
function showPromoGuestOnce() {
  if (DEV_LOCAL || !promoActive() || getAccount() || guestPromoSeen()) return;
  markGuestPromoSeen();
  openPromo({ guest: true });
}
function onPromoOk() {
  const guest = $('promoModal')?.dataset.kind === 'guest';
  closePromo();
  if (guest && !getAccount()) openAcct();
}

function openAcct() { $('acctErr').textContent = ''; $('acctPass').value = ''; $('acctPass2').value = ''; renderUser(); $('acctModal').classList.remove('hidden'); if (getAccount()) refreshStats(); else $('acctNick').focus(); }
const closeAcct = () => $('acctModal').classList.add('hidden');

async function submit(ev) {
  ev.preventDefault(); if (busy) return; const err = $('acctErr'); err.textContent = '';
  const nick = cleanNick($('acctNick').value), pass = $('acctPass').value;
  if (reg) {
    const e = nickError(nick) || passError(pass) || (pass !== $('acctPass2').value ? 'As senhas não são iguais' : null);
    if (e) { err.textContent = e; return; }
  } else if (!nick || !pass) { err.textContent = 'Preencha apelido e senha'; return; }
  busy = true; $('acctSubmit').disabled = true;
  const r = await (reg ? register(nick, pass) : login(nick, pass));
  busy = false; $('acctSubmit').disabled = false;
  if (r.error) { err.textContent = r.error; $('acctPass').value = ''; $('acctPass2').value = ''; return; }
  $('acctPass').value = ''; $('acctPass2').value = ''; closeAcct();
}

async function renderRank() {
  const box = $('rankBody'); box.innerHTML = '<div class="rank-empty">Carregando…</div>';
  const rows = await loadRank(rankMode, rankSort), me = getAccount();
  if (!rows) { box.innerHTML = '<div class="rank-empty">Não deu pra carregar o ranking agora.</div>'; return; }
  if (!rows.length) { box.innerHTML = '<div class="rank-empty">Ninguém no ranking ainda. Entre numa sala online com sua conta e seja o primeiro porco da lista! 🐷</div>'; return; }
  box.innerHTML = `<table><thead><tr><th>#</th><th>Apelido</th><th>Abates</th><th>Mortes</th><th>K/D</th><th>Vitórias</th></tr></thead><tbody>${rows.map((r, i) => `<tr${me && me.nick === r.nick ? ' class="me"' : ''}><td>${i + 1}</td><td>${esc(r.nick)}</td><td>${r.kills | 0}</td><td>${r.deaths | 0}</td><td>${r.deaths ? (r.kills / r.deaths).toFixed(2) : (r.kills | 0)}</td><td>${r.wins | 0}</td></tr>`).join('')}</tbody></table>`;
}
function openRank() { closeAcct(); $('rankModal').classList.remove('hidden'); renderRank(); }

const ELO_SEAL = { pipoca: 'PIPOCA', coxinha: 'COXINHA', pastel: 'PASTEL', espetinho: 'ESPETO', churrasqueiro: 'BRASA', capataz: 'CAPATAZ', pingou: 'PINGOU', docao: 'SUPREMO' };
function eloBoard() {
  const e = getElo();
  const modes = {};
  for (const m of ELO_MODES) {
    const row = e && e.modes && e.modes[m.id];
    if (row && row.tier) modes[m.id] = row;
    else if (m.id === 'comp' && e && e.tier && !e.modes) modes[m.id] = e;
    else modes[m.id] = { mode: m.id, ...eloSummary(ELO_START, 0), wins: 0, peak: ELO_START };
  }
  return modes;
}
function eloView(mode = 'comp') {
  return eloBoard()[eloMode(mode) ? mode : 'comp'];
}
function pigFace(fill, snout, eye) {
  return `<path d="m33 24-3-7 12 5m8 0 12-5-3 8" fill="${fill}"/><ellipse cx="48" cy="28" rx="17" ry="12" fill="${fill}"/><ellipse cx="48" cy="31" rx="9.5" ry="5.5" fill="${snout}"/><circle cx="44.6" cy="31" r="1.6" fill="${eye}"/><circle cx="51.4" cy="31" r="1.6" fill="${eye}"/><circle cx="40.2" cy="24.2" r="1.5" fill="${snout}"/><circle cx="55.8" cy="24.2" r="1.5" fill="${snout}"/>`;
}
function sealText(rating, tag, color) {
  return `<text x="48" y="58" text-anchor="middle" fill="${color}" font-family="Fredoka,Arial Black,Arial,sans-serif" font-size="16" font-weight="900">${rating | 0}</text><text x="48" y="70" text-anchor="middle" fill="${color}" font-family="Fredoka,Trebuchet MS,Arial,sans-serif" font-size="8.5" font-weight="900" letter-spacing=".4">${esc(tag || 'ELO')}</text>`;
}
function ringDots(r, n, from, to, fill, rad) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const a = from + (to - from) * (n === 1 ? 0.5 : i / (n - 1));
    s += `<circle cx="${(48 + Math.cos(a) * r).toFixed(1)}" cy="${(48 + Math.sin(a) * r).toFixed(1)}" r="${rad}" fill="${fill}"/>`;
  }
  return s;
}
function eloBrasaoHtml(rating, tag, emoji, tierId) {
  const id = tierId || 'coxinha';
  const pig = pigFace;
  const txt = (color) => sealText(rating, tag, color);
  let body = '';
  let ink = '#9c3b2a';
  let badgeBg = '#fff6e4';
  if (id === 'pipoca') {
    ink = '#c4a15a'; badgeBg = '#fff8dc';
    body = `<circle cx="48" cy="48" r="43" fill="#fff6d2" stroke="#e6c56a" stroke-width="3"/>
      <circle cx="48" cy="48" r="37" fill="none" stroke="#e6c56a" stroke-width="1.2" stroke-dasharray="2 3"/>
      <circle cx="22" cy="30" r="3.4" fill="#fffdf2" stroke="#e6b325" stroke-width="1"/><circle cx="74" cy="30" r="3.1" fill="#fff3b0" stroke="#e6b325" stroke-width="1"/>
      <circle cx="30" cy="16" r="2.6" fill="#fffdf2" stroke="#e6b325" stroke-width=".8"/><circle cx="66" cy="16" r="2.8" fill="#ffe08a" stroke="#e6b325" stroke-width=".8"/>
      ${pig('#c4a15a', '#fff6d2', '#8a6a28')}
      ${txt('#8a6a28')}`;
  } else if (id === 'pastel') {
    ink = '#c47d0e'; badgeBg = '#fff3c4';
    body = `<circle cx="48" cy="48" r="44" fill="#ffe08a" stroke="#e0a106" stroke-width="3.5"/>
      <circle cx="48" cy="48" r="38" fill="none" stroke="#fff6d0" stroke-width="3" stroke-dasharray="1.2 3.2" stroke-linecap="round"/>
      <circle cx="48" cy="48" r="33" fill="none" stroke="#f0b429" stroke-width="1.4"/>
      <ellipse cx="48" cy="20" rx="8" ry="3" fill="#fff6c8" opacity=".85"/>
      ${pig('#d4920a', '#fff3c4', '#8a5a08')}
      ${txt('#8a4e00')}`;
  } else if (id === 'espetinho') {
    ink = '#ff6b2c'; badgeBg = '#2b2118';
    body = `<circle cx="48" cy="48" r="44" fill="#3a2418" stroke="#ff6b2c" stroke-width="3.5"/>
      <circle cx="48" cy="48" r="38" fill="none" stroke="#ffd29a" stroke-width="1.3"/>
      <line x1="16" y1="16" x2="80" y2="16" stroke="#e7d3b0" stroke-width="1.6"/>
      <rect x="24" y="12" width="7" height="8" rx="2" fill="#c4482a"/><rect x="44" y="12" width="7" height="8" rx="2" fill="#e07a3d"/><rect x="64" y="12" width="7" height="8" rx="2" fill="#8a2e22"/>
      ${ringDots(40, 4, 0.4, 2.7, '#ffb703', 1.6)}
      ${pig('#ff8a4c', '#ffd7b0', '#3a2418')}
      ${txt('#ffe8c8')}`;
  } else if (id === 'churrasqueiro') {
    ink = '#ff5a1f'; badgeBg = '#2a0d08';
    body = `<circle cx="48" cy="48" r="44" fill="#4a120c" stroke="#ff5a1f" stroke-width="4"/>
      <circle cx="48" cy="48" r="37" fill="none" stroke="#ffb703" stroke-width="2"/>
      <path d="M20 22c2-8 6-6 6 0 2-7 6-5 5 1 2-8 7-6 6 1" fill="#ffb703"/>
      <path d="M64 20c2-8 6-6 6 1 2-7 6-5 5 2" fill="#ff5a1f"/>
      <path d="M30 78h36M33 82h30" stroke="#ffb703" stroke-width="1.3" stroke-linecap="round"/>
      ${pig('#ff7a3c', '#ffd0a8', '#2a0d08')}
      ${txt('#ffe08a')}`;
  } else if (id === 'capataz') {
    ink = '#6b3a1f'; badgeBg = '#f6e2c4';
    body = `<circle cx="48" cy="48" r="44" fill="#f4d7ae" stroke="#6b3a1f" stroke-width="3.5"/>
      <circle cx="48" cy="48" r="39" fill="none" stroke="#e0b15a" stroke-width="2.4" stroke-dasharray="4 2"/>
      <circle cx="48" cy="48" r="34" fill="none" stroke="#6b3a1f" stroke-width="1"/>
      ${ringDots(41, 8, 0, Math.PI * 2 - 0.01, '#e0b15a', 1.5)}
      ${pig('#6b3a1f', '#f4d7ae', '#2a140c')}
      <path d="M33 14c1-11 29-11 30 0" fill="#8a5a2b"/>
      <path d="M20 14h56c-2 4.2-13 6.2-28 6.2S22 18.2 20 14z" fill="#e0a15a" stroke="#5c3318" stroke-width=".8"/>
      <rect x="44.5" y="4.5" width="7" height="4.5" rx="1" fill="#ffd60a" stroke="#7a4a00" stroke-width=".5"/>
      ${txt('#4a2614')}`;
  } else if (id === 'pingou') {
    ink = '#e23d6b'; badgeBg = '#ffe4ee';
    body = `<circle cx="48" cy="48" r="44" fill="#ffd0e0" stroke="#e23d6b" stroke-width="4"/>
      <circle cx="48" cy="48" r="38" fill="none" stroke="#ffd166" stroke-width="2.4"/>
      <circle cx="48" cy="48" r="33" fill="none" stroke="#ff8fab" stroke-width="1.2" stroke-dasharray="2 2"/>
      <circle cx="40" cy="33" r="2.2" fill="#ff8fab" opacity=".8"/><circle cx="56" cy="33" r="2.2" fill="#ff8fab" opacity=".8"/>
      <path d="M22 18l2 3-3 .4zM74 18l-2 3 3 .4zM18 40l3 1-1 3zM78 40l-3 1 1 3z" fill="#ffd166"/>
      ${pig('#ff5d8f', '#fff0f5', '#7a2040')}
      <ellipse cx="48" cy="29.5" rx="4" ry="2" fill="#fff" opacity=".45"/>
      ${txt('#9a2048')}`;
  } else if (id === 'docao') {
    ink = '#ffd60a'; badgeBg = '#1b1230';
    body = `<circle cx="48" cy="48" r="44" fill="#24143f" stroke="#ffd60a" stroke-width="3.2"/>
      <circle cx="48" cy="48" r="40" fill="none" stroke="#9d4edd" stroke-width="2"/>
      <circle cx="48" cy="48" r="36" fill="none" stroke="#ffd60a" stroke-width="1.2"/>
      ${ringDots(42, 6, -2.8, -0.3, '#7ae0ff', 1.7)}
      ${ringDots(42, 4, 0.4, 2.6, '#ff4d8d', 1.7)}
      <path d="M20 46l2 1.4-2 1.4-2-1.4zM76 46l2 1.4-2 1.4-2-1.4z" fill="#ffd60a"/>
      ${pig('#ffd60a', '#fff6d0', '#24143f')}
      <path d="M33 16l3.5-7 3.5 5 4-8 4 5 3.5-7 3.5 5 4-6v8z" fill="#ffd60a" stroke="#7a4a00" stroke-width=".6"/>
      <circle cx="40" cy="11" r="1.3" fill="#7ae0ff"/><circle cx="48" cy="7" r="1.4" fill="#ff4d8d"/><circle cx="56" cy="11" r="1.3" fill="#7ae0ff"/>
      ${txt('#fff3bf')}`;
  } else {
    ink = '#c45c1a'; badgeBg = '#fff1d6';
    body = `<circle cx="48" cy="48" r="43" fill="#ffe7c2" stroke="#c45c1a" stroke-width="3.4"/>
      <circle cx="48" cy="48" r="37" fill="none" stroke="#e7b15a" stroke-width="1.8" stroke-dasharray="3 2"/>
      ${pig('#a34522', '#ffe7c2', '#6a2412')}
      <g transform="translate(20 20) rotate(-40)">
        <ellipse cx="0" cy="0" rx="7" ry="3.6" fill="#e07a3d" stroke="#8a3018" stroke-width=".7"/>
        <rect x="-1.3" y="2.2" width="2.6" height="7" rx="1" fill="#f6e0c0" stroke="#c4a574" stroke-width=".5"/>
      </g>
      ${txt('#8a3018')}`;
  }
  return `<svg viewBox="0 0 96 96" aria-hidden="true">${body}</svg><span class="elo-brasao-badge" style="color:${ink};background:${badgeBg};border-color:${ink}">${esc(emoji || '🍿')}</span>`;
}
function paintCompEloBtn() {
  const btn = $('compEloBtn'); if (!btn) return;
  const a = getAccount(), v = eloView(), t = v.tier;
  const crest = $('compEloCrest');
  if (crest) crest.innerHTML = eloBrasaoHtml(v.rating, ELO_SEAL[t.id] || 'ELO', t.emoji, t.id);
  btn.dataset.tier = t.id || '';
  if (!a || a.dev) {
    $('compEloTitle').textContent = t.name || 'Seu Elo';
    $('compEloSub').textContent = a?.dev ? 'DEV local · Elo só em conta online' : `${ELO_MODES.length} modalidades · entre na conta`;
  } else {
    $('compEloTitle').textContent = t.name;
    $('compEloSub').textContent = `${ELO_MODES.length} modalidades · toque para ver`;
  }
  btn.setAttribute('aria-label', `Elos, competitivo ${t.name}, ${v.rating}. Abrir as modalidades`);
}
async function renderEloModal() {
  const a = getAccount(), pick = eloMode(eloPick) ? eloPick : 'comp', meta = eloMode(pick);
  const board = eloBoard(), v = board[pick], t = v.tier;
  const logged = a && !a.dev;
  const tabs = $('eloModes');
  if (tabs) tabs.innerHTML = ELO_MODES.map((m) => {
    const row = board[m.id];
    return `<button type="button" data-elo="${m.id}" class="${m.id === pick ? 'active' : ''}">${esc(m.name)}<small>${row.tier.emoji} ${row.rating | 0}</small></button>`;
  }).join('');
  const crest = eloBrasaoHtml(logged ? v.rating : ELO_START, ELO_SEAL[t.id] || 'ELO', t.emoji, t.id);
  $('eloHero').innerHTML = logged
    ? `<div class="elo-badge">${crest}</div><div><b>${esc(meta.name)} · ${esc(t.name)}</b><span class="elo-rating">${v.rating}</span><small>${v.games | 0} partidas · ${v.wins | 0} vitórias · pico ${v.peak | v.rating}</small>${v.max ? '' : `<small>Próxima: ${esc(v.next.name)} (${v.next.min}+)</small>`}</div>`
    : `<div class="elo-badge">${crest}</div><div><b>${esc(meta.name)} · ${esc(t.name)}</b><span class="elo-rating">${ELO_START}</span><small>${a?.dev ? 'DEV local não grava Elo' : 'Entre na conta para começar a subir'}</small></div>`;
  const eloLine = pick === 'dm'
    ? '<p><b>Elo:</b> quem termina na frente sobe mais, e ficar perto do primeiro dói menos do que tomar um banho de abates. O Elo de cada um na sala muda o tamanho disso.</p>'
    : '<p><b>Elo:</b> sobe na vitória e cai na derrota. O quanto muda depende do Elo médio do outro lado e da sua performance.</p>';
  $('eloHow').innerHTML = `<p>${esc(meta.how)}</p>${eloLine}<p><b>Sem killstreak:</b> quando a partida vale Elo, Olho, míssil, gavião, chopper, grelha e fim da chapa ficam de fora.</p>`;
  $('eloTiers').innerHTML = ELO_TIERS.map((x) => `<div class="elo-tier${t.id === x.id ? ' on' : ''}"><div class="elo-tier-seal">${eloBrasaoHtml(x.min, ELO_SEAL[x.id], x.emoji, x.id)}</div><b>${esc(x.name)}</b><em>${x.min}+</em><small>${esc(x.blurb)}</small></div>`).join('');
  const wrap = $('eloLadderWrap'), box = $('eloLadder');
  const title = wrap && wrap.querySelector('.elo-ladder-title');
  if (title) title.textContent = `Ranking · ${meta.name}`;
  if (a && !a.dev && isMaxEloTier(v.rating)) {
    wrap.classList.remove('hidden');
    box.innerHTML = '<div class="rank-empty">Carregando…</div>';
    const rows = await loadEloRank(pick, 20), me = getAccount();
    if (pick !== eloPick) return;
    if (!rows) box.innerHTML = '<div class="rank-empty">Não deu pra carregar o ranking de Elo.</div>';
    else if (!rows.length) box.innerHTML = '<div class="rank-empty">Ninguém no Docão Supremo desta modalidade ainda.</div>';
    else box.innerHTML = `<table><thead><tr><th>#</th><th>Apelido</th><th>Insígnia</th><th>Elo</th><th>Vitórias</th></tr></thead><tbody>${rows.map((r, i) => {
      const tier = r.tier || eloSummary(r.rating).tier;
      return `<tr${me && me.nick === r.nick ? ' class="me"' : ''}><td>${i + 1}</td><td>${esc(r.nick)}</td><td>${esc((tier.emoji || '') + ' ' + (tier.name || ''))}</td><td>${r.rating | 0}</td><td>${r.wins | 0}</td></tr>`;
    }).join('')}</tbody></table>`;
  } else wrap.classList.add('hidden');
}
function openElo() { closeAcct(); $('eloModal').classList.remove('hidden'); renderEloModal(); }
const closeElo = () => $('eloModal').classList.add('hidden');

export function initAccountUI() {
  $('rankModes').innerHTML = RANK_MODES.map(([id, nm]) => `<button type="button" data-mode="${id}"${id === rankMode ? ' class="active"' : ''}>${nm}</button>`).join('');
  $('rankModes').onclick = (e) => { const b = e.target.closest('button[data-mode]'); if (!b) return; rankMode = b.dataset.mode; $('rankModes').querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b)); renderRank(); };
  document.querySelector('.rank-sort').onclick = (e) => { const b = e.target.closest('button[data-sort]'); if (!b) return; rankSort = b.dataset.sort; document.querySelectorAll('.rank-sort button').forEach((x) => x.classList.toggle('active', x === b)); renderRank(); };
  $('acctBtn').onclick = openAcct; $('acctClose').onclick = closeAcct; $('rankBtn').onclick = openRank; $('rankClose').onclick = () => $('rankModal').classList.add('hidden');
  $('acctRank').onclick = openRank;
  if ($('compEloBtn')) $('compEloBtn').onclick = openElo;
  if ($('eloStripBtn')) $('eloStripBtn').onclick = openElo;
  if ($('eloClose')) $('eloClose').onclick = closeElo;
  if ($('eloModes')) $('eloModes').onclick = (e) => { const b = e.target.closest('button[data-elo]'); if (!b) return; eloPick = b.dataset.elo; renderEloModal(); };
  $('acctTabLogin').onclick = () => setMode(false); $('acctTabReg').onclick = () => setMode(true);
  $('acctForm').addEventListener('submit', submit);
  $('acctLogout').onclick = async () => { await logout(); renderUser(); $('acctNick').focus(); };
  for (const id of ['acctModal', 'rankModal', 'eloModal', 'promoModal']) { const el = $(id); if (!el) continue; el.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') el.classList.add('hidden'); }); el.addEventListener('mousedown', (e) => e.stopPropagation()); }
  $('promoOk').onclick = onPromoOk;
  $('promoSkip').onclick = closePromo;
  onPromoGrant(() => openPromo({ guest: false }));
  onAccount((a) => { renderStrip(a); renderUser(); renderDaily(); paintCompEloBtn(); });
  renderStrip(getAccount()); renderDaily(); paintCompEloBtn(); setMode(false);
  $('dailyPanel').addEventListener('click', (e) => { if (e.target.closest('[data-daily-enter]')) openAcct(); });
  if (!DEV_LOCAL && !getToken()) showPromoGuestOnce();
  clearInterval(dailyTimer); dailyTimer = setInterval(() => { if (getAccount() && !document.getElementById('menu').classList.contains('hidden')) renderDaily(); }, 30000); // só o relógio anda (sem rede)
}
