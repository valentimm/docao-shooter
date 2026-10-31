// ============================================================
//  Brechó da Porca Véia 🧺 (menu): personalizador de visual + loja de partes, com prévia 3D própria (um mini renderizador que só
//  existe com a janela aberta). Nada aqui decide saldo, preço ou posse: o servidor decide, a tela só pede e mostra.
//  Convidado não salva nem compra (a janela só convida a entrar na conta).
// ============================================================
import * as THREE from 'three';
import { makeDocao, makeKnife, poseButterfly } from './docao.js';
import { poseVictory, resetVictoryPose, ALL_DANCES, isPaidDance, normDance } from './victory-dance.js';
import './costumes.js';
import { getAccount, getItems, getEarn, getChal, onAccount, refreshStats, equipLook, buyItem, equipKnife, equipSniper, equipGun, openBox } from './account.js';
import { CHAL_PER_DAY, TIERS } from './shared/challenges.js';
import { COLORS, SLOTS, ITEMS, SHOP_TEAMS, CURRENCY, COIN_ICON, SHOP_NAME, SHOP_EMOJI, SHOP_BUTTON, DEFAULT_LOOK, COSTUME_SLOT, DANCE_SLOT, KNIFE_SLOT, KNIFE_MODELS, KNIFE_COLORS, GUN_GROUPS, encodeLook, parseLook, itemById, itemForDance, isFreeItem, teamItems } from './shared/closet.js';
import { BOX_NAME, BOX_EMOJI, lootItems } from './shared/lootbox.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let look = { ...DEFAULT_LOOK, items: {} }, tab = 'look', trial = null, busy = false, three = null, raf = 0, pendingBuy = null;

const currentCode = () => { const items = { ...look.items }; if (trial && trial.slot !== DANCE_SLOT && trial.slot !== KNIFE_SLOT && !(itemById(trial.id) && itemById(trial.id).sniper)) { if (trial.slot !== COSTUME_SLOT) delete items[COSTUME_SLOT]; items[trial.slot] = trial.id; } return encodeLook({ shirt: look.shirt, pants: look.pants, items }); };
const previewKnife = () => {
  if (trial) { const it = itemById(trial.id); if (it && it.knife) return it; }
  const id = getAccount() && getAccount().knife;
  return id && owned(id) ? itemById(id) : null;
};
const msg = (t, ok = false) => { const m = $('closetMsg'); m.textContent = t || ''; m.style.color = ok ? '#2a6f4a' : ''; };

// ---------- prévia 3D ----------
function startThree() {
  if (three) return;
  const canvas = $('closetCanvas'), renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setSize(260, 330, false);
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(32, 260 / 330, 0.1, 50); cam.position.set(0, 1.25, 5.2); cam.lookAt(0, 1.0, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8f7a55, 1.8)); const sun = new THREE.DirectionalLight(0xffffff, 2); sun.position.set(2, 3, 3); scene.add(sun);
  three = { renderer, scene, cam, model: null, code: '', yaw: 0, dance: '', danceUntil: 0, t: 0, last: 0 };
  bindSpin(canvas);
}
function showModel() {
  if (!three) return; const code = currentCode(), held = previewKnife(), key = code + '|' + (held ? held.id : '');
  if (three.code === key && three.model) return;
  if (three.model) three.scene.remove(three.model.group); three.code = key;
  three.model = makeDocao(code, { withGun: false, pose: 'idle' });
  if (held) { const kn = makeKnife(1.7, 0.006, held.knife, held.finish); kn.rotation.set(-Math.PI / 2, 0, 0); kn.position.set(0, -0.6, 0.02); three.model.arms[0].add(kn); }
  three.scene.add(three.model.group); three.last = 0; three.bfly = 0;
}
// Prévia PARADA, de frente. Só gira se a pessoa arrastar o boneco ou apertar ◀ ▶ (e "Frente" volta pro centro).
function bindSpin(canvas) {
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, yaw: three.yaw }; canvas.setPointerCapture(e.pointerId); canvas.classList.add('drag'); });
  canvas.addEventListener('pointermove', (e) => { if (drag) three.yaw = drag.yaw + (e.clientX - drag.x) * 0.012; });
  const end = () => { drag = null; canvas.classList.remove('drag'); };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
}
const owned = (id) => isFreeItem(id) || getItems().includes(id);
const turn = (d) => { if (three) three.yaw = d === 0 ? 0 : three.yaw + d; };
// dança de prévia: a da loja fica rodando enquanto a parte estiver "experimentando"; a escolhida nos botões roda uma vez
function playDance(id, forever) { if (!three) return; three.dance = id; three.t = 0; three.danceUntil = forever ? Infinity : performance.now() + 3300; }
function stopDance() { if (!three) return; three.dance = ''; if (three.model) { resetVictoryPose(three.model); three.model.group.position.set(0, 0, 0); three.model.group.rotation.set(0, 0, 0); } }
function loop(now) {
  if (!three || $('closetModal').classList.contains('hidden')) { raf = 0; return; }
  const dt = Math.min(0.05, three.last ? (now - three.last) / 1000 : 0.016); three.last = now;
  const m = three.model;
  if (m) {
    if (three.dance && now > three.danceUntil) stopDance();
    if (three.dance) { three.t += dt; m.danceBase = { x: 0, y: 0, z: 0, yaw: three.yaw }; poseVictory(m, three.dance, three.t); }
    else {
      m.group.rotation.y = three.yaw;
      const kn = m.arms[0] && m.arms[0].children.find((c) => c.userData && c.userData.bflyBlade);
      if (kn) { three.bfly = (three.bfly || 0) + dt; const u = three.bfly % 2.4; poseButterfly(kn, u < 0.95 ? u / 0.95 : 1); }
    }
  }
  three.renderer.render(three.scene, three.cam); raf = requestAnimationFrame(loop);
}
function stopThree() { if (raf) cancelAnimationFrame(raf); raf = 0; } // o renderizador fica (criado uma vez) e só o laço de desenho para; perder o contexto WebGL e recriar na mesma tela dá erro

// ---------- telas ----------
function renderWallet() {
  const a = getAccount(), e = getEarn(); if (!a) return;
  $('closetWallet').innerHTML = `${COIN_ICON} <b>${a.coins | 0}</b> ${CURRENCY} · ${BOX_EMOJI} <b>${a.boxes | 0}</b> caixote${(a.boxes | 0) === 1 ? '' : 's'}<small>Partidas hoje: ${e.today | 0}/${e.cap | 0} · desafios sem teto · 1 caixote por dia e +1 por desafio</small>`;
}
const curDance = () => { try { return normDance(localStorage.getItem('docao.dance')); } catch (e) { return 'moonwalk'; } };
function renderLook() {
  const owned = new Set(getItems());
  const sw = (key, val) => COLORS.map((c, i) => `<button type="button" class="closet-sw${val === i ? ' on' : ''}" data-${key}="${i}" style="background:${c}" aria-label="Cor ${i + 1}"></button>`).join('');
  let h = `<div class="closet-slot"><h4>Camiseta</h4><div class="closet-chips">${sw('shirt', look.shirt)}</div></div><div class="closet-slot"><h4>Shorts</h4><div class="closet-chips">${sw('pants', look.pants)}</div></div>`;
  for (const [k, name] of SLOTS) {
    const mine = ITEMS.filter((i) => i.slot === k && (isFreeItem(i.id) || owned.has(i.id)));
    h += `<div class="closet-slot"><h4>${name}${k === COSTUME_SLOT ? ' <small>(troca camiseta, shorts e peças de uma vez)</small>' : ''}</h4><div class="closet-chips"><button type="button" data-slot="${k}" data-item=""${!look.items[k] ? ' class="on"' : ''}>Nada</button>${mine.map((i) => `<button type="button" data-slot="${k}" data-item="${i.id}"${look.items[k] === i.id ? ' class="on"' : ''}>${i.emoji} ${esc(i.name)}${isFreeItem(i.id) ? ' · grátis' : ''}</button>`).join('')}${mine.length ? '' : '<span class="closet-note">Nada na mochila ainda. Veja a Loja!</span>'}</div></div>`;
  }
  const curK = (getAccount() && getAccount().knife) || '';
  h += `<div class="closet-slot"><h4>Faca</h4><div class="closet-chips"><button type="button" data-knife=""${!curK ? ' class="on"' : ''}>Faca de churrasqueiro</button></div></div>`;
  for (const model of KNIFE_MODELS) {
    const mine = ITEMS.filter((i) => i.knife === model.knife && owned.has(i.id));
    const chips = mine.map((i) => { const color = KNIFE_COLORS.find((c) => c.finish === i.finish); return `<button type="button" data-knife="${i.id}"${curK === i.id ? ' class="on"' : ''}>${esc(color ? color.name : i.name)}</button>`; }).join('');
    h += `<div class="closet-slot"><h4>${model.emoji} ${esc(model.name)}</h4><div class="closet-chips">${chips || '<span class="closet-note">Nenhuma cor na mochila. Elas saem no Caixote da Primeira Safra.</span>'}</div></div>`;
  }
  const acct = getAccount();
  for (const [key, label] of GUN_GROUPS) {
    const curG = key === 'sniper' ? (acct && acct.sniper) || '' : (acct && acct.guns && acct.guns[key]) || '';
    const mine = ITEMS.filter((i) => i.gun === key && owned.has(i.id));
    const attr = key === 'sniper' ? 'data-sniper' : 'data-gun';
    const chips = mine.map((i) => `<button type="button" ${attr}="${key === 'sniper' ? i.id : key}"${key === 'sniper' ? '' : ` data-gid="${i.id}"`}${curG === i.id ? ' class="on"' : ''}>${i.emoji} ${esc(i.name)}</button>`).join('');
    h += `<div class="closet-slot"><h4>${esc(label)}</h4><div class="closet-chips"><button type="button" ${attr}="${key === 'sniper' ? '' : key}"${key === 'sniper' ? '' : ' data-gid=""'}${!curG ? ' class="on"' : ''}>De fábrica</button>${chips || '<span class="closet-note">Nenhuma pintura na mochila. Sai no Caixote.</span>'}</div></div>`;
  }
  const cur = curDance(), mineD = ALL_DANCES.filter((d) => !isPaidDance(d.id) || owned.has(d.item));
  h += `<div class="closet-slot"><h4>Dança da vitória (tecla B)</h4><div class="closet-chips">${mineD.map((d) => `<button type="button" data-dance-pick="${d.id}"${cur === d.id ? ' class="on"' : ''}>💃 ${esc(d.name)}</button>`).join('')}</div></div>`;
  h += '<button type="button" id="closetSave" class="ticket-btn">SALVAR E USAR ESTE VISUAL</button><p class="closet-note">As skins da lista continuam no menu. O visual salvo vale nas partidas online com conta.</p>';
  $('closetLook').innerHTML = h;
}
function shopCard(i, owned, coins) {
  const aka = i.aka ? `<small class="closet-aka">${esc(i.aka)}</small>` : '';
  const line = i.line ? `<small>${esc(i.line)}</small>` : '';
  const head = `<b>${i.emoji} ${esc(i.name)}</b>${aka}${line}`;
  if (isFreeItem(i.id)) return `<div class="closet-card free${trial && trial.id === i.id ? ' try' : ''}" data-try="${i.id}">${head}<div class="price free">GRÁTIS</div><div class="free-tag">PADRÃO</div></div>`;
  const has = owned.has(i.id), can = coins >= i.price;
  return `<div class="closet-card${trial && trial.id === i.id ? ' try' : ''}" data-try="${i.id}">${head}<div class="price">${COIN_ICON} ${i.price}</div><button type="button" data-buy="${i.id}"${has || !can ? ' disabled' : ''}>${has ? 'NA MOCHILA' : can ? 'COMPRAR' : 'FALTAM ' + (i.price - coins)}</button></div>`;
}
function renderShop() {
  const e0 = getEarn();
  const owned = new Set(getItems()), a = getAccount(), coins = a ? a.coins | 0 : 0;
  let h = `<p class="closet-note">Como ganhar ${CURRENCY}: abates, fim de partida, vitória e waves da Invasão, em partidas <b>online com conta</b> (até ${e0.cap | 0} por dia), mais os <b>3 desafios do dia</b> (sem teto). Treino não rende. Não dá pra comprar com dinheiro de verdade.</p>`;
  for (const [id, name] of SHOP_TEAMS) {
    const members = teamItems(id);
    if (!members.length) continue;
    h += `<div class="closet-sec team"><h4>${esc(name)}</h4><div class="closet-grid">${members.map((i) => shopCard(i, owned, coins)).join('')}</div></div>`;
  }
  for (const [k, name] of SLOTS) {
    const list = ITEMS.filter((i) => i.slot === k && !i.team);
    if (!list.length) continue;
    h += `<div class="closet-sec"><h4>${esc(name)}</h4><div class="closet-grid">${list.map((i) => shopCard(i, owned, coins)).join('')}</div></div>`;
  }
  h += `<p class="closet-note">Skins de arma e faca não se compram. O peso delas é a raridade no ${esc(BOX_NAME)}.</p>`;
  h += `<div class="closet-sec"><h4>Danças da vitória <small>(tecla B)</small></h4><div class="closet-grid">${ITEMS.filter((i) => i.slot === DANCE_SLOT).map((i) => shopCard(i, owned, coins)).join('')}</div></div>`;
  $('closetShop').innerHTML = h;
}
// ---------- desafios do dia (só leitura: quem conta e paga é o servidor) ----------
const hms = (s) => { s = Math.max(0, s | 0); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h}h ${String(m).padStart(2, '0')}min` : m ? `${m}min ${String(s % 60).padStart(2, '0')}s` : `${s}s`; };
function chalClock() { const c = getChal(), el = document.getElementById('chalReset'); if (el && c) el.textContent = hms(c.resetIn); if (c && c.resetIn <= 0 && !chalRefreshing) { chalRefreshing = true; refreshStats().finally(() => { chalRefreshing = false; }); } }
let chalTimer = 0, chalRefreshing = false;
function renderBox() {
  const box = $('closetBox'); if (!box) return;
  const a = getAccount(), n = a ? a.boxes | 0 : 0, owned = new Set(getItems());
  const weights = [...new Set(lootItems().map((i) => i.weight))].sort((x, y) => x - y);
  const catalog = weights.map((w) => {
    const list = lootItems().filter((i) => i.weight === w).map((i) => `<span class="loot-chip${owned.has(i.id) ? ' mine' : ''}">${i.emoji} ${esc(i.name)}</span>`).join('');
    return `<div class="closet-sec"><h4>Peso ${w}</h4><div class="loot-catalog">${list}</div></div>`;
  }).join('');
  box.innerHTML = `<div class="chal-head"><b>${BOX_EMOJI} ${esc(BOX_NAME)}</b> <span>${n} fechado${n === 1 ? '' : 's'}</span></div>`
    + `<button type="button" id="closetOpenBox" class="ticket-btn"${n ? '' : ' disabled'}>${n ? 'ABRIR UM CAIXOTE' : 'SEM CAIXOTE AGORA'}</button>`
    + catalog;
}
function renderChal() {
  const c = getChal(), box = $('closetChal');
  if (!c || !c.list) { box.innerHTML = '<p class="closet-note">Carregando os desafios…</p>'; return; }
  const done = c.list.filter((x) => x.done).length, total = c.list.reduce((t, x) => t + x.reward, 0);
  box.innerHTML = `<div class="chal-head"><b>Desafios do dia</b> <span>${done}/${CHAL_PER_DAY} feitos · até ${COIN_ICON} ${total}</span></div>`
    + c.list.map((x) => `<div class="chal-card t${x.tier}${x.done ? ' done' : ''}"><div class="chal-top"><span class="chal-tier">${TIERS[x.tier]}</span><span class="chal-mode">${esc(x.mode)}</span><span class="chal-prize">${x.done ? '✅ ' : ''}${COIN_ICON} ${x.reward} + ${BOX_EMOJI} 1</span></div>`
      + `<div class="chal-text">${esc(x.text)}</div><div class="chal-bar"><i style="width:${Math.round(100 * Math.min(1, x.prog / x.goal))}%"></i></div><div class="chal-prog">${x.done ? 'Completo! Prêmio já está na carteira.' : `${x.prog} / ${x.goal}`}</div></div>`).join('')
    + `<p class="closet-note">Novos desafios em <b id="chalReset">${hms(c.resetIn)}</b> (meia-noite de Brasília). Valem só em partida <b>online com conta</b>; Treino e Exploração não contam. O progresso aparece no fim de cada partida. Prêmio de desafio não tem teto diário. Cada desafio feito também entrega um caixote.</p>`;
}
function render() {
  const a = getAccount(); $('closetGuest').classList.toggle('hidden', !!a); $('closetMain').classList.toggle('hidden', !a);
  if (!a) return; renderWallet(); renderLook(); renderShop();
  renderChal(); renderBox();
  $('closetLook').classList.toggle('hidden', tab !== 'look'); $('closetShop').classList.toggle('hidden', tab !== 'shop'); $('closetChal').classList.toggle('hidden', tab !== 'chal'); $('closetBox').classList.toggle('hidden', tab !== 'box');
  $('closetTabLook').classList.toggle('active', tab === 'look'); $('closetTabShop').classList.toggle('active', tab === 'shop'); $('closetTabChal').classList.toggle('active', tab === 'chal'); $('closetTabBox').classList.toggle('active', tab === 'box');
  showModel();
}
function setTab(t) { tab = t; if (t !== 'shop') { trial = null; stopDance(); } msg(''); render(); }

function loadLookFromAccount() {
  const a = getAccount(), p = a && (parseLook(a.custom) || parseLook(a.skin)); const owned = new Set(getItems());
  look = p ? { shirt: p.shirt, pants: p.pants, items: Object.fromEntries(Object.entries(p.items).filter(([, id]) => isFreeItem(id) || owned.has(id))) } : { ...DEFAULT_LOOK, items: {} };
}
export function openCloset(want) {
  trial = null; msg(''); tab = want === 'chal' || want === 'shop' || want === 'box' ? want : 'look'; $('closetModal').classList.remove('hidden');
  clearInterval(chalTimer); chalTimer = setInterval(() => { if ($('closetModal').classList.contains('hidden')) clearInterval(chalTimer); else chalClock(); }, 1000);
  if (getAccount()) { loadLookFromAccount(); startThree(); render(); if (!raf) raf = requestAnimationFrame(loop); refreshStats().then(() => { if (!$('closetModal').classList.contains('hidden')) { loadLookFromAccount(); render(); } }); }
  else render();
}
function closeAsk() { pendingBuy = null; const d = $('closetBuyAsk'); if (d) d.classList.add('hidden'); }
function askBuy(it) {
  pendingBuy = it;
  $('closetBuyAskText').textContent = `Deseja comprar ${it.name} por ${it.price} Docoins?`;
  $('closetBuyAsk').classList.remove('hidden');
  $('closetBuyNo').focus();
}
function closeCloset() { clearInterval(chalTimer); closeAsk(); $('closetModal').classList.add('hidden'); trial = null; stopDance(); stopThree(); }
async function finishBuy(it) {
  busy = true; msg('Comprando…'); const r = await buyItem(it.id); busy = false;
  if (r.error) msg(r.error); else {
    msg(`Comprou: ${it.name}! Já está na sua mochila.`, true);
    if (it.sniper) { const er = await equipSniper(it.id); if (!er.error) document.dispatchEvent(new CustomEvent('docao-sniper-pick', { detail: it.id })); }
    else if (it.knife) { const er = await equipKnife(it.id); if (!er.error) document.dispatchEvent(new CustomEvent('docao-knife-pick', { detail: it.id })); }
    else if (it.dance) { try { localStorage.setItem('docao.dance', it.dance); } catch (er) { /* sem storage */ } document.dispatchEvent(new CustomEvent('docao-dance-pick', { detail: it.dance })); }
    else { if (it.slot === COSTUME_SLOT) look.items = {}; else delete look.items[COSTUME_SLOT]; look.items[it.slot] = it.id; }
    trial = null;
  }
  render();
}

async function onClick(e) {
  const t = e.target; if (busy) return;
  if (pendingBuy) {
    if (t.id === 'closetBuyAsk' || t.closest('#closetBuyNo')) { closeAsk(); return; }
    if (t.closest('#closetBuyYes')) { const it = pendingBuy; closeAsk(); await finishBuy(it); return; }
    return;
  }
  const sw = t.closest('[data-shirt],[data-pants]');
  if (sw) { if (sw.dataset.shirt !== undefined) look.shirt = +sw.dataset.shirt; else look.pants = +sw.dataset.pants; msg(''); render(); return; }
  const sl = t.closest('button[data-slot]');
  if (sl) {
    const k = sl.dataset.slot;
    if (sl.dataset.item) { if (k === COSTUME_SLOT) look.items = {}; else delete look.items[COSTUME_SLOT]; look.items[k] = sl.dataset.item; } else delete look.items[k]; // fantasia completa não mistura com outras partes
    msg(''); render(); return;
  }
  if (!$('closetReveal').classList.contains('hidden')) {
    if (t.closest('#closetRevealEquip')) { await equipReveal(); return; }
    if (t.id === 'closetReveal' || t.closest('#closetRevealOk')) { $('closetReveal').classList.add('hidden'); render(); return; }
    return;
  }
  const sb = t.closest('[data-sniper]');
  if (sb) {
    const id = sb.dataset.sniper;
    busy = true; const r = await equipSniper(id); busy = false;
    if (r.error) msg(r.error); else { document.dispatchEvent(new CustomEvent('docao-sniper-pick', { detail: id })); const it = itemById(id); msg(id ? `${it ? it.name : 'Skin'} entrou na Torresmo.` : 'A Torresmo voltou para a pintura de fábrica.', true); render(); }
    return;
  }
  const gb = t.closest('[data-gun]');
  if (gb) {
    const key = gb.dataset.gun, id = gb.dataset.gid || '';
    busy = true; const r = await equipGun(key, id); busy = false;
    if (r.error) msg(r.error); else { document.dispatchEvent(new CustomEvent('docao-gun-pick', { detail: { key, id } })); const it = itemById(id); msg(id ? `${it ? it.name : 'Skin'} entrou na arma.` : 'Voltou para a pintura de fábrica.', true); render(); }
    return;
  }
  if (t.closest('#closetOpenBox')) { await finishOpen(); return; }
  const kb = t.closest('[data-knife]');
  if (kb) {
    const id = kb.dataset.knife;
    busy = true; const r = await equipKnife(id); busy = false;
    if (r.error) msg(r.error); else { document.dispatchEvent(new CustomEvent('docao-knife-pick', { detail: id })); msg(id ? 'Faca equipada. Ela entra na mão quando você saca.' : 'Voltou pra faca de churrasqueiro.', true); render(); }
    return;
  }
  const dp = t.closest('[data-dance-pick]');
  if (dp) { const id = dp.dataset.dancePick; try { localStorage.setItem('docao.dance', id); } catch (er) { /* sem storage */ } document.dispatchEvent(new CustomEvent('docao-dance-pick', { detail: id })); playDance(id, false); msg('Dança escolhida! Ela roda no B durante a partida.', true); render(); return; }
  if (t.closest('[data-turn]')) { turn(t.closest('[data-turn]').dataset.turn === 'front' ? 0 : +t.closest('[data-turn]').dataset.turn); return; }
  if (t.closest('#closetSave')) {
    busy = true; msg('Salvando…'); const r = await equipLook(encodeLook(look)); busy = false;
    if (r.error) msg(r.error); else { msg('Visual salvo! Ele já está valendo. 🐷', true); document.dispatchEvent(new CustomEvent('docao-look-saved')); } return;
  }
  const buy = t.closest('button[data-buy]');
  if (buy && !buy.disabled) { const it = itemById(buy.dataset.buy); if (it) askBuy(it); return; }
  const card = t.closest('[data-try]');
  if (card) {
    const it = itemById(card.dataset.try); trial = trial && trial.id === it.id ? null : { id: it.id, slot: it.slot };
    if (trial && it.dance) playDance(it.dance, true); else stopDance();
    msg(trial ? (it.sniper ? (owned(it.id) ? 'Já está na mochila. Equipe em Personalizar ou em Trocar visual.' : 'Skin da Torresmo. O boneco não veste a arma — ela aparece quando você saca.') : isFreeItem(it.id) ? `Prévia: ${it.name}. Já é sua, sem gastar Docoin.` : owned(it.id) ? 'Prévia (você já tem). Clique de novo pra tirar.' : 'Prévia (ainda não é seu). Clique de novo pra tirar.') : ''); render();
  }
}

let revealDrop = null;
function showReveal(r) {
  revealDrop = r && r.item && !r.dupe ? r.item : null;
  const it = r.item, name = it ? `${it.emoji} ${it.name}` : 'uma skin';
  $('closetRevealText').textContent = r.dupe ? `Repetida: ${name}. Entrou ${r.gain} Docoins no lugar.` : `Nova skin: ${name}. Peso ${it ? it.weight : ''}. Já está na mochila.`;
  $('closetRevealEquip').classList.toggle('hidden', !revealDrop);
  $('closetReveal').classList.remove('hidden');
}
async function equipReveal() {
  const it = revealDrop; if (!it) return;
  $('closetReveal').classList.add('hidden');
  busy = true;
  let r;
  if (it.knife) r = await equipKnife(it.id);
  else if (it.gun === 'sniper' || it.sniper) r = await equipSniper(it.id);
  else r = await equipGun(it.gun, it.id);
  busy = false;
  if (r && r.error) { msg(r.error); return; }
  if (it.knife) document.dispatchEvent(new CustomEvent('docao-knife-pick', { detail: it.id }));
  else if (it.gun === 'sniper' || it.sniper) document.dispatchEvent(new CustomEvent('docao-sniper-pick', { detail: it.id }));
  else document.dispatchEvent(new CustomEvent('docao-gun-pick', { detail: { key: it.gun, id: it.id } }));
  msg(`${it.name} equipada.`, true); render();
}
async function finishOpen() {
  busy = true; msg('Abrindo…'); const r = await openBox(); busy = false;
  if (r.error) { msg(r.error); return; }
  msg(r.dupe ? `Repetida. +${r.gain} Docoins.` : `${r.item.emoji} ${r.item.name} entrou na mochila.`, true);
  render(); showReveal(r);
}
let wardrobeDirty = false, wardrobeCustom = false, wardrobeSniper = '', wardrobeGuns = {};
const wardrobeNote = (t, ok = false) => { const m = $('wardrobeOwnedMsg'); if (!m) return; m.textContent = t || ''; m.style.color = ok ? '#d5c597' : '#ffb4a8'; };
function paintWardrobe() {
  const box = $('wardrobeOwned'); if (!box) return;
  const a = getAccount();
  if (!a) {
    box.innerHTML = '<p class="wardrobe-note">Entre na conta para montar o visual com o que você já comprou. As skins da lista continuam aqui.</p><button type="button" id="wardrobeLogin" class="wardrobe-save">ENTRAR</button>';
    wardrobeNote('');
    return;
  }
  const ownedSet = new Set(getItems());
  const swatches = (attr, val) => COLORS.map((c, i) => `<button type="button" class="closet-sw${wardrobeCustom && val === i ? ' on' : ''}" data-${attr}="${i}" style="background:${c}" aria-label="Cor ${i + 1}"></button>`).join('');
  let h = '<h4>Mochila</h4><p class="wardrobe-note">Use o que já é seu. Comprar continua no Brechó.</p>';
  h += `<div class="closet-slot"><h4>Camiseta</h4><div class="closet-chips">${swatches('wshirt', look.shirt)}</div></div>`;
  h += `<div class="closet-slot"><h4>Shorts</h4><div class="closet-chips">${swatches('wpants', look.pants)}</div></div>`;
  for (const [k, name] of SLOTS) {
    const mine = ITEMS.filter((i) => i.slot === k && (isFreeItem(i.id) || ownedSet.has(i.id)));
    h += `<div class="closet-slot"><h4>${name}</h4><div class="closet-chips"><button type="button" data-wslot="${k}" data-witem=""${wardrobeCustom && !look.items[k] ? ' class="on"' : ''}>Nada</button>${mine.map((i) => `<button type="button" data-wslot="${k}" data-witem="${i.id}"${wardrobeCustom && look.items[k] === i.id ? ' class="on"' : ''}>${i.emoji} ${esc(i.name)}</button>`).join('')}${mine.length ? '' : '<span class="wardrobe-note">Nada comprado neste espaço.</span>'}</div></div>`;
  }
  for (const [key, label] of GUN_GROUPS) {
    const curG = key === 'sniper' ? wardrobeSniper : (wardrobeGuns[key] || '');
    const mine = ITEMS.filter((i) => i.gun === key && ownedSet.has(i.id));
    h += `<div class="closet-slot"><h4>${esc(label)}</h4><div class="closet-chips"><button type="button" data-wgun="${key}" data-wgid=""${!curG ? ' class="on"' : ''}>De fábrica</button>`;
    h += mine.map((i) => `<button type="button" data-wgun="${key}" data-wgid="${i.id}"${curG === i.id ? ' class="on"' : ''}>${i.emoji} ${esc(i.name)}</button>`).join('') || '<span class="wardrobe-note">Nenhuma pintura na mochila. Sai no Caixote.</span>';
    h += '</div></div>';
  }
  h += '<button type="button" id="wardrobeSave" class="wardrobe-save">SALVAR E USAR ESTE VISUAL</button>';
  box.innerHTML = h;
}
function markWardrobe() {
  wardrobeDirty = true; wardrobeCustom = true;
  document.dispatchEvent(new CustomEvent('docao-look-preview', { detail: encodeLook(look) }));
  paintWardrobe();
}
export function refreshWardrobeLook() {
  if (!wardrobeDirty) {
    const a = getAccount();
    if (a) { loadLookFromAccount(); wardrobeSniper = a.sniper || ''; wardrobeGuns = { ...(a.guns || {}) }; wardrobeCustom = !!(a.skin && String(a.skin).startsWith('x1.')); }
    else { wardrobeCustom = false; wardrobeSniper = ''; wardrobeGuns = {}; }
  }
  paintWardrobe();
}
async function onWardrobeClick(e) {
  const t = e.target; if (busy) return;
  if (t.closest('#wardrobeLogin')) { const b = $('acctBtn'); if (b) b.click(); return; }
  const sw = t.closest('[data-wshirt],[data-wpants]');
  if (sw) {
    if (sw.dataset.wshirt !== undefined) look.shirt = +sw.dataset.wshirt;
    if (sw.dataset.wpants !== undefined) look.pants = +sw.dataset.wpants;
    wardrobeNote(''); markWardrobe(); return;
  }
  const sl = t.closest('button[data-wslot]');
  if (sl) {
    const k = sl.dataset.wslot;
    if (sl.dataset.witem) { if (k === COSTUME_SLOT) look.items = {}; else delete look.items[COSTUME_SLOT]; look.items[k] = sl.dataset.witem; }
    else delete look.items[k];
    wardrobeNote(''); markWardrobe(); return;
  }
  const gn = t.closest('[data-wgun]');
  if (gn) {
    const key = gn.dataset.wgun, id = gn.dataset.wgid || '';
    if (key === 'sniper') wardrobeSniper = id; else { wardrobeGuns = { ...wardrobeGuns }; if (id) wardrobeGuns[key] = id; else delete wardrobeGuns[key]; }
    wardrobeDirty = true; wardrobeNote(''); paintWardrobe(); return;
  }
  if (!t.closest('#wardrobeSave')) return;
  const a = getAccount(); if (!a) { wardrobeNote('Entre na conta para salvar.'); return; }
  const sniperChanged = (a.sniper || '') !== wardrobeSniper;
  busy = true; wardrobeNote('Salvando…');
  if (wardrobeCustom) {
    const r = await equipLook(encodeLook(look));
    if (r.error) { busy = false; wardrobeNote(r.error); return; }
    document.dispatchEvent(new CustomEvent('docao-look-saved'));
  }
  let gearChanged = sniperChanged;
  if (sniperChanged) {
    const er = await equipSniper(wardrobeSniper);
    if (er.error) { busy = false; wardrobeNote(er.error); return; }
    document.dispatchEvent(new CustomEvent('docao-sniper-pick', { detail: wardrobeSniper }));
  }
  for (const [key] of GUN_GROUPS) {
    if (key === 'sniper') continue;
    const now = (a.guns && a.guns[key]) || '', want = wardrobeGuns[key] || '';
    if (now === want) continue;
    const er = await equipGun(key, want);
    if (er.error) { busy = false; wardrobeNote(er.error); return; }
    document.dispatchEvent(new CustomEvent('docao-gun-pick', { detail: { key, id: want } }));
    gearChanged = true;
  }
  busy = false; wardrobeDirty = false;
  wardrobeNote(wardrobeCustom || gearChanged ? 'Visual salvo. Ele já está valendo.' : 'Escolha peças da mochila ou uma pintura de arma.', !!(wardrobeCustom || gearChanged));
  refreshWardrobeLook();
}

export function initCloset() {
  $('closetBtn').textContent = `${SHOP_EMOJI} ${SHOP_BUTTON}`; $('closetTitle').textContent = `${SHOP_NAME} ${SHOP_EMOJI}`; // nome da loja: constantes em shared/closet.js
  $('closetBtn').onclick = () => openCloset(); $('closetClose').onclick = closeCloset;
  document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('[data-open-chal]')) openCloset('chal'); if (e.target.closest && e.target.closest('[data-open-box]')) openCloset('box'); });
  $('closetLogin').onclick = () => { closeCloset(); $('acctBtn').click(); };
  $('closetTabLook').onclick = () => setTab('look'); $('closetTabShop').onclick = () => setTab('shop'); $('closetTabChal').onclick = () => setTab('chal'); $('closetTabBox').onclick = () => setTab('box');
  $('closetModal').addEventListener('click', onClick);
  $('closetModal').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') { if (!$('closetReveal').classList.contains('hidden')) { $('closetReveal').classList.add('hidden'); return; } if (pendingBuy) closeAsk(); else closeCloset(); } });
  $('closetModal').addEventListener('mousedown', (e) => e.stopPropagation());
  const ownedBox = $('wardrobeOwned'); if (ownedBox) ownedBox.addEventListener('click', onWardrobeClick);
  document.addEventListener('docao-skin-catalog', () => { wardrobeDirty = false; wardrobeCustom = false; refreshWardrobeLook(); });
  document.addEventListener('docao-look-saved', () => { if (wardrobeDirty) return; refreshWardrobeLook(); });
  refreshWardrobeLook();
  onAccount((a) => {
    if (!wardrobeDirty) refreshWardrobeLook();
    if (!a && !$('closetModal').classList.contains('hidden')) { stopThree(); render(); }
    else if (a && !$('closetModal').classList.contains('hidden') && !busy) { renderWallet(); renderShop(); renderChal(); renderBox(); }
  });
}
