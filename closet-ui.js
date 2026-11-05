// ============================================================
//  Brechó da Porca Véia 🧺 (menu): personalizador de visual + loja de partes, com prévia 3D própria (um mini renderizador que só
//  existe com a janela aberta). Nada aqui decide saldo, preço ou posse: o servidor decide, a tela só pede e mostra.
//  Convidado não salva nem compra (a janela só convida a entrar na conta).
// ============================================================
import * as THREE from 'three';
import { makeDocao, makeKnife, poseButterfly } from './docao.js';
import { poseVictory, resetVictoryPose, ALL_DANCES, isPaidDance, normDance } from './victory-dance.js';
import './costumes.js';
import { getAccount, getItems, getEarn, getChal, onAccount, refreshStats, equipLook, buyItem, equipKnife, equipSniper, equipGun, openBox, buyBox, spinWheel } from './account.js';
import { CHAL_PER_DAY, TIERS } from './shared/challenges.js';
import { COLORS, SLOTS, ITEMS, SHOP_TEAMS, CURRENCY, COIN_ICON, SHOP_NAME, SHOP_EMOJI, SHOP_BUTTON, DEFAULT_LOOK, COSTUME_SLOT, DANCE_SLOT, KNIFE_SLOT, KNIFE_MODELS, KNIFE_COLORS, GUN_GROUPS, encodeLook, parseLook, itemById, itemForDance, isFreeItem, teamItems } from './shared/closet.js';
import { BOX_NAME, BOX_EMOJI, BOX_PRICE, lootItems, wheelFloor } from './shared/lootbox.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let look = { ...DEFAULT_LOOK, items: {} }, tab = 'look', trial = null, busy = false, three = null, raf = 0, pendingBuy = null, pendingBox = false, pendingWheel = null, wheelPick = [];
let lootThumbOf = () => '';
export function setLootThumbSource(fn) { lootThumbOf = typeof fn === 'function' ? fn : () => ''; }

const currentCode = () => { const items = { ...look.items }; const trialItem = trial && itemById(trial.id); if (trial && trial.slot !== DANCE_SLOT && trial.slot !== KNIFE_SLOT && !(trialItem && (trialItem.sniper || trialItem.gun))) items[trial.slot] = trial.id; return encodeLook({ shirt: look.shirt, pants: look.pants, items }); };
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
  $('closetWallet').innerHTML = `${COIN_ICON} <b>${a.coins | 0}</b> ${CURRENCY} · ${BOX_EMOJI} <b>${a.boxes | 0}</b> caixote${(a.boxes | 0) === 1 ? '' : 's'}<small>Partidas hoje: ${e.today | 0}/${e.cap | 0} · desafios sem teto · 1 grátis ao entrar, +1 por desafio e 1 comprado por dia</small>`;
}
const curDance = () => { try { return normDance(localStorage.getItem('docao.dance')); } catch (e) { return 'moonwalk'; } };
function renderLook() {
  const owned = new Set(getItems());
  const sw = (key, val) => COLORS.map((c, i) => `<button type="button" class="closet-sw${val === i ? ' on' : ''}" data-${key}="${i}" style="background:${c}" aria-label="Cor ${i + 1}"></button>`).join('');
  let h = `<div class="closet-slot"><h4>Camiseta</h4><div class="closet-chips">${sw('shirt', look.shirt)}</div></div><div class="closet-slot"><h4>Shorts</h4><div class="closet-chips">${sw('pants', look.pants)}</div></div>`;
  for (const [k, name] of SLOTS) {
    const mine = ITEMS.filter((i) => i.slot === k && (isFreeItem(i.id) || owned.has(i.id)));
    h += `<div class="closet-slot"><h4>${name}${k === COSTUME_SLOT ? ' <small>(a fantasia fica, e o acessório entra junto)</small>' : ''}</h4><div class="closet-chips"><button type="button" data-slot="${k}" data-item=""${!look.items[k] ? ' class="on"' : ''}>Nada</button>${mine.map((i) => `<button type="button" data-slot="${k}" data-item="${i.id}"${look.items[k] === i.id ? ' class="on"' : ''}>${i.emoji} ${esc(i.name)}${isFreeItem(i.id) ? ' · grátis' : ''}</button>`).join('')}${mine.length ? '' : '<span class="closet-note">Nada na mochila ainda. Veja a Loja!</span>'}</div></div>`;
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
    const list = ITEMS.filter((i) => i.slot === k && !i.team && !i.loot);
    if (!list.length) continue;
    h += `<div class="closet-sec"><h4>${esc(name)}</h4><div class="closet-grid">${list.map((i) => shopCard(i, owned, coins)).join('')}</div></div>`;
  }
  h += `<p class="closet-note">Skins de arma, faca e luva do caixote não se compram. O peso delas é a raridade no ${esc(BOX_NAME)}.</p>`;
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
  wheelPick = wheelPick.filter((id) => owned.has(id)).slice(0, 3);
  const weights = [...new Set(lootItems().map((i) => i.weight))].sort((x, y) => x - y);
  const catalogBody = weights.map((w) => {
    const list = lootItems().filter((i) => i.weight === w).map((i) => `<span class="loot-chip${owned.has(i.id) ? ' mine' : ''}">${i.emoji} ${esc(i.name)}</span>`).join('');
    return `<div class="closet-sec"><h4>Peso ${w}</h4><div class="loot-catalog">${list}</div></div>`;
  }).join('');
  const catalog = `<details class="loot-fold"><summary>Ver prêmios do caixote</summary>${catalogBody}</details>`;
  const mine = lootItems().filter((i) => owned.has(i.id)).sort((x, y) => x.weight - y.weight || x.name.localeCompare(y.name, 'pt'));
  const slots = [0, 1, 2].map((i) => {
    const it = itemById(wheelPick[i]);
    return `<button type="button" class="wheel-slot${it ? ' fill' : ''}" data-wheel-slot="${i}">${it ? `${it.emoji}<br>${esc(it.name)}` : 'vazia'}</button>`;
  }).join('');
  const picks = mine.map((i) => `<button type="button" class="loot-chip${wheelPick.includes(i.id) ? ' pick' : ''}" data-wheel-pick="${i.id}">${i.emoji} ${esc(i.name)}</button>`).join('');
  const wheel = `<div class="wheel-box"><div class="chal-head"><b>🎡 Roleta</b></div><div class="wheel-slots">${slots}</div>`
    + (mine.length < 3 ? '<p class="closet-note">Precisa de 3 skins na mochila.</p>' : `<div class="loot-catalog">${picks}</div>`)
    + `<button type="button" id="closetSpin" class="ticket-btn"${wheelPick.length === 3 ? '' : ' disabled'}>${wheelPick.length === 3 ? 'GIRAR A ROLETA' : 'ESCOLHA 3 SKINS'}</button></div>`;
  const coins = a ? a.coins | 0 : 0, bought = !!(a && a.boxBought), canBuy = !bought && coins >= BOX_PRICE;
  const buyLabel = bought ? 'CAIXOTE DE HOJE JÁ COMPRADO' : canBuy ? `COMPRAR 1 CAIXOTE · ${BOX_PRICE}` : `FALTAM ${BOX_PRICE - coins} DOCOINS`;
  box.innerHTML = `<div class="chal-head"><b>${BOX_EMOJI} ${esc(BOX_NAME)}</b> <span>${n} fechado${n === 1 ? '' : 's'}</span></div>`
    + `<button type="button" id="closetOpenBox" class="ticket-btn"${n ? '' : ' disabled'}>${n ? 'ABRIR UM CAIXOTE' : 'SEM CAIXOTE AGORA'}</button>`
    + `<button type="button" id="closetBuyBox" class="ticket-btn alt"${canBuy ? '' : ' disabled'}>${buyLabel}</button>`
    + `<p class="closet-note">Dá pra comprar 1 caixote por dia por ${BOX_PRICE} ${CURRENCY}, além do grátis e dos desafios. O dia vira à meia-noite de Brasília.</p>`
    + wheel + catalog;
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
function closeBoxAsk() { pendingBox = false; const d = $('closetBuyAsk'); if (d) d.classList.add('hidden'); }
function askBox() {
  pendingBox = true;
  $('closetBuyAskText').textContent = `Comprar um caixote por ${BOX_PRICE} Docoins? Só dá pra comprar 1 por dia.`;
  $('closetBuyAsk').classList.remove('hidden');
  $('closetBuyNo').focus();
}
function askBuy(it) {
  pendingBuy = it;
  $('closetBuyAskText').textContent = `Deseja comprar ${it.name} por ${it.price} Docoins?`;
  $('closetBuyAsk').classList.remove('hidden');
  $('closetBuyNo').focus();
}
function closeWheelAsk() { pendingWheel = null; $('closetBuyAsk').classList.add('hidden'); }
function closeCloset() { clearInterval(chalTimer); closeAsk(); closeBoxAsk(); pendingWheel = null; abortReel(); $('closetReveal').classList.add('hidden'); $('closetModal').classList.add('hidden'); trial = null; stopDance(); stopThree(); }
async function finishBuy(it) {
  busy = true; msg('Comprando…'); const r = await buyItem(it.id); busy = false;
  if (r.error) msg(r.error); else {
    msg(`Comprou: ${it.name}! Já está na sua mochila.`, true);
    if (it.sniper) { const er = await equipSniper(it.id); if (!er.error) document.dispatchEvent(new CustomEvent('docao-sniper-pick', { detail: it.id })); }
    else if (it.knife) { const er = await equipKnife(it.id); if (!er.error) document.dispatchEvent(new CustomEvent('docao-knife-pick', { detail: it.id })); }
    else if (it.dance) { try { localStorage.setItem('docao.dance', it.dance); } catch (er) { /* sem storage */ } document.dispatchEvent(new CustomEvent('docao-dance-pick', { detail: it.dance })); }
    else look.items[it.slot] = it.id;
    trial = null;
  }
  render();
}

async function onClick(e) {
  const t = e.target;
  if (reel) { reel.skip(); return; }
  if (busy) return;
  if (pendingBox) {
    if (t.id === 'closetBuyAsk' || t.closest('#closetBuyNo')) { closeBoxAsk(); return; }
    if (t.closest('#closetBuyYes')) { closeBoxAsk(); await finishBoxBuy(); return; }
    return;
  }
  if (pendingBuy) {
    if (t.id === 'closetBuyAsk' || t.closest('#closetBuyNo')) { closeAsk(); return; }
    if (t.closest('#closetBuyYes')) { const it = pendingBuy; closeAsk(); await finishBuy(it); return; }
    return;
  }
  if (pendingWheel) {
    if (t.id === 'closetBuyAsk' || t.closest('#closetBuyNo')) { closeWheelAsk(); return; }
    if (t.closest('#closetBuyYes')) { const ids = pendingWheel; closeWheelAsk(); await finishWheel(ids); return; }
    return;
  }
  const sw = t.closest('[data-shirt],[data-pants]');
  if (sw) { if (sw.dataset.shirt !== undefined) look.shirt = +sw.dataset.shirt; else look.pants = +sw.dataset.pants; msg(''); render(); return; }
  const sl = t.closest('button[data-slot]');
  if (sl) {
    const k = sl.dataset.slot;
    if (sl.dataset.item) look.items[k] = sl.dataset.item; else delete look.items[k];
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
  if (t.closest('#closetBuyBox')) { askBox(); return; }
  const wp = t.closest('[data-wheel-pick]');
  if (wp) {
    const id = wp.dataset.wheelPick, at = wheelPick.indexOf(id);
    if (at >= 0) wheelPick.splice(at, 1); else if (wheelPick.length < 3) wheelPick.push(id);
    renderBox(); return;
  }
  const ws = t.closest('[data-wheel-slot]');
  if (ws && wheelPick[+ws.dataset.wheelSlot]) { wheelPick.splice(+ws.dataset.wheelSlot, 1); renderBox(); return; }
  if (t.closest('#closetSpin')) { askWheel(); return; }
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

let revealDrop = null, reel = null, reelGen = 0;
// Faixa da sorte → cor. Quanto maior o peso, mais perto do dourado e mais longa a festa.
// Amarelo não é faixa: é o último suspiro antes do dourado travar.
const LOOT_LADDER = [
  { id: 'green', label: 'Verde', rank: 0, hex: '#24924a', glow: '#8dffb4', ink: '#f3fff6' },
  { id: 'blue', label: 'Azul', rank: 1, hex: '#2a6fbf', glow: '#9dceff', ink: '#f2f8ff' },
  { id: 'red', label: 'Vermelho', rank: 2, hex: '#d12626', glow: '#ff9b92', ink: '#fff4f2' },
  { id: 'orange', label: 'Laranja', rank: 3, hex: '#e86a12', glow: '#ffc48a', ink: '#fff6ec' },
  { id: 'yellow', label: 'Amarelo', rank: 4, hex: '#e2b000', glow: '#ffe58a', ink: '#fffbeb' },
  { id: 'gold', label: 'Dourado', rank: 5, hex: '#f0c14a', glow: '#fff1a8', ink: '#fff8df' },
];
const LOOT_RANK = { 500: 0, 750: 1, 1000: 2, 1250: 3, 2000: 5 };
const SPIN_MS = [3600, 5000, 6400, 8000, 9600, 11000];
// A roleta percorre a mesma fita, só que um pouco mais devagar que o caixote.
const WHEEL_SPIN = 1.3;
const SPIN_LEAD = [16, 22, 30, 38, 44, 52];
const SPIN_OVER = [8, 16, 32, 52, 64, 78];
const lookOf = (it) => LOOT_LADDER[LOOT_RANK[it && it.weight | 0] ?? 0];
function motionOff() {
  try {
    const v = localStorage.getItem('docao.reducedAnim');
    if (v === '1') return true;
    if (v === '0') return false;
  } catch (e) { /* segue o sistema */ }
  return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
}
const paintLoot = (el, look) => {
  if (!el || !look) return;
  el.dataset.tier = look.id;
  el.style.setProperty('--loot', look.hex);
  el.style.setProperty('--loot-glow', look.glow);
  el.style.setProperty('--loot-ink', look.ink);
};
const cardHtml = (it) => {
  const look = lookOf(it);
  return `<div class="loot-card" data-tier="${look.id}" style="--loot:${look.hex};--loot-glow:${look.glow}"><span class="loot-photo">${it.emoji || '🎁'}</span><span class="loot-name">${esc(it.name || 'Skin')}</span><span class="loot-tier">${look.label}</span></div>`;
};
function paintCardPreviews(trackEl, cards) {
  const seen = new Map();
  for (let i = 0; i < cards.length; i++) {
    const it = cards[i];
    if (!seen.has(it.id)) seen.set(it.id, lootThumbOf(it) || '');
    const url = seen.get(it.id);
    const photo = trackEl.children[i] && trackEl.children[i].querySelector('.loot-photo');
    if (!url || !photo) continue;
    photo.classList.add('has-preview');
    photo.style.backgroundImage = `url("${url}")`;
    photo.textContent = '';
    photo.setAttribute('role', 'img');
    photo.setAttribute('aria-label', it.name || 'Arma');
  }
}
function pickFrom(pool) { return pool[Math.floor(Math.random() * pool.length)]; }
function buildStrip(pool, winner, rank) {
  const lead = SPIN_LEAD[rank] || SPIN_LEAD[0];
  const cards = [];
  for (let i = 0; i < lead; i++) cards.push(pickFrom(pool));
  const winAt = cards.length;
  cards.push(winner);
  const up = rank >= 2 ? pool.filter((i) => (i.weight | 0) > (winner.weight | 0)) : [];
  cards.push(up.length ? pickFrom(up) : pickFrom(pool));
  for (let i = 0; i < 7; i++) cards.push(pickFrom(pool));
  return { cards, winAt };
}
// O começo ainda é o trecho rápido, só que menos disparado: ~18% do tempo leva metade da fita.
// O resto desacelera até parar, e o final só assenta.
const SPIN_BURST_T = 0.18, SPIN_BURST_D = 0.50, SPIN_SETTLE = 0.14;
const SPIN_SLOW_R = 1 - SPIN_BURST_T;
const SPIN_VJOIN = 2 * (1 - SPIN_BURST_D) / SPIN_SLOW_R;
const SPIN_V0 = 2 * SPIN_BURST_D / SPIN_BURST_T - SPIN_VJOIN;
function spinApproach(tau) {
  if (tau <= SPIN_BURST_T) return SPIN_V0 * tau + (SPIN_VJOIN - SPIN_V0) * tau * tau / (2 * SPIN_BURST_T);
  const s = tau - SPIN_BURST_T;
  return SPIN_BURST_D + SPIN_VJOIN * s - SPIN_VJOIN * s * s / (2 * SPIN_SLOW_R);
}
const xAt = (t, target, overshoot) => {
  const past = target - overshoot;
  const approachEnd = 1 - SPIN_SETTLE;
  if (t < approachEnd) return past * spinApproach(t / approachEnd);
  const u = (t - approachEnd) / SPIN_SETTLE, e = u * u * (3 - 2 * u);
  return past * (1 - e) + target * e;
};
// No começo a moldura segue a carta que passa. No fim ela sobe a escada só até a faixa sorteada
// (verde → … → amarelo → dourado) e uma carta mais rara ainda pode piscar na agulha.
function climbLook(t, result) {
  const start = Math.max(0.4, 0.78 - result.rank * 0.06);
  if (t < start) return null;
  if (t >= 1) return result;
  const u = (t - start) / (1 - start);
  const step = Math.min(result.rank, Math.floor(Math.pow(u, 1.6) * (result.rank + 0.999)));
  return LOOT_LADDER[step] || result;
}
function lookAt(t, result, card) {
  if (t >= 1) return result;
  const cardLook = lookOf(card), climbed = climbLook(t, result);
  if (!climbed) return cardLook;
  return cardLook.rank > climbed.rank ? cardLook : climbed;
}
function burst(host, look) {
  host.innerHTML = '';
  const n = [0, 8, 14, 22, 28, 36][look.rank] || 0;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, d = 46 + Math.random() * (36 + look.rank * 18);
    const s = document.createElement('i');
    s.className = 'loot-spark';
    s.style.setProperty('--x', (Math.cos(a) * d).toFixed(1) + 'px');
    s.style.setProperty('--y', (Math.sin(a) * d).toFixed(1) + 'px');
    s.style.background = i % 4 === 0 ? '#fff8e0' : look.glow;
    s.style.animationDelay = (Math.random() * 0.08) + 's';
    host.appendChild(s);
  }
}
function abortReel() { reelGen += 1; if (reel) reel.abort(); reel = null; }
function dropLine(r, kind) {
  const it = r.item, name = it ? `${it.emoji} ${it.name}` : 'uma skin';
  if (r.dupe) return `Repetida: ${name}. Entrou ${r.gain} Docoins no lugar.`;
  if (kind === 'wheel') return `A roleta parou em ${name}. Peso ${it.weight}. Já está na mochila.`;
  return `Nova skin: ${name}. Peso ${it.weight}. Já está na mochila.`;
}
function spinTrack(o) {
  if (o.ms <= 0) return Promise.resolve();
  const t0 = performance.now();
  let lastId = '', lastClimb = '', lastIndex = -1;
  return new Promise((resolve) => {
    const frame = (now) => {
      if (o.dead()) { resolve(); return; }
      const t = o.skipped() ? 1 : Math.min(1, (now - t0) / o.ms);
      const x = xAt(t, o.target, o.overshoot);
      o.track.style.transform = `translate3d(${x}px,0,0)`;
      const idx = Math.max(0, Math.min(o.cards.length - 1, Math.round((o.center - x) / o.step)));
      const shown = lookAt(t, o.result, o.cards[idx]);
      const climbed = climbLook(t, o.result);
      if (shown.id !== lastId) { lastId = shown.id; paintLoot(o.show, shown); }
      if (climbed && o.result.rank > 0 && climbed.id !== lastClimb) {
        lastClimb = climbed.id;
        o.kicker.textContent = climbed.rank >= 5 ? 'Dourado…' : climbed.rank >= 4 ? 'Amarelo…' : climbed.label + '…';
        o.kicker.classList.remove('pop'); void o.kicker.offsetWidth; o.kicker.classList.add('pop');
      }
      if (idx !== lastIndex && t > 0.5) {
        lastIndex = idx;
        const marker = $('closetLootMarker');
        if (marker) { marker.classList.remove('tick'); void marker.offsetWidth; marker.classList.add('tick'); }
      }
      if (t < 1) requestAnimationFrame(frame); else resolve();
    };
    requestAnimationFrame(frame);
  });
}
async function presentDrop(r, kind, pool) {
  const it = r && r.item;
  const show = $('closetLootShow'), track = $('closetLootTrack'), kicker = $('closetLootKicker');
  const text = $('closetRevealText'), acts = $('closetRevealActs'), sparks = $('closetLootSparks');
  if (!it || !show || !track) {
    if (text) text.textContent = r && r.dupe ? `Repetida. Entrou ${r.gain} Docoins.` : 'O caixote abriu.';
    $('closetReveal').classList.remove('hidden');
    return;
  }
  const gen = ++reelGen;
  const look = lookOf(it);
  const source = (pool && pool.length ? pool : lootItems()).slice();
  if (!source.some((i) => i.id === it.id)) source.push(it);
  const reduce = motionOff();
  const { cards, winAt } = buildStrip(source, it, reduce ? 0 : look.rank);
  revealDrop = r.dupe ? null : it;
  track.innerHTML = cards.map(cardHtml).join('');
  if (kind === 'wheel') paintCardPreviews(track, cards);
  track.style.transform = 'translate3d(0,0,0)';
  sparks.innerHTML = '';
  show.className = 'loot-show';
  paintLoot(show, LOOT_LADDER[0]);
  kicker.textContent = kind === 'wheel' ? 'A roleta está girando…' : 'O caixote está girando…';
  kicker.classList.remove('pop');
  text.textContent = '';
  acts.classList.add('hidden');
  $('closetRevealEquip').classList.toggle('hidden', !revealDrop);
  $('closetReveal').classList.remove('hidden');
  const card = track.children[0];
  const gap = parseFloat(getComputedStyle(track).gap) || 8;
  const w = card ? card.getBoundingClientRect().width : 0;
  const view = track.parentElement.clientWidth;
  const step = w + gap;
  const center = (view - w) / 2;
  const jitter = (Math.random() - 0.5) * w * 0.2;
  const target = center - winAt * step + jitter;
  const spinMs = SPIN_MS[look.rank] || SPIN_MS[0];
  const ms = reduce || !(w > 0) ? 0 : (kind === 'wheel' ? Math.round(spinMs * WHEEL_SPIN) : spinMs);
  let skipped = false, dead = false;
  reel = { skip() { skipped = true; }, abort() { dead = true; } };
  await spinTrack({
    track, ms, target, overshoot: reduce ? 0 : SPIN_OVER[look.rank], cards, step, center, result: look, kicker, show,
    skipped: () => skipped, dead: () => dead || gen !== reelGen,
  });
  if (dead || gen !== reelGen) { if (reelGen === gen) reel = null; return; }
  track.style.transform = `translate3d(${target}px,0,0)`;
  paintLoot(show, look);
  show.classList.add('land', 'is-' + look.id);
  const hit = track.children[winAt];
  if (hit) hit.classList.add('hit');
  kicker.textContent = look.rank >= 5 ? 'DOURADO!' : look.label.toUpperCase() + '!';
  kicker.classList.remove('pop'); void kicker.offsetWidth; kicker.classList.add('pop');
  if (!reduce) burst(sparks, look);
  text.textContent = dropLine(r, kind);
  acts.classList.remove('hidden');
  reel = null;
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
async function finishBoxBuy() {
  busy = true; msg('Comprando caixote…');
  try {
    const r = await buyBox();
    if (r.error) msg(r.error); else msg('Caixote comprado. Já pode abrir.', true);
    render();
  } finally { busy = false; }
}
async function finishOpen() {
  busy = true; msg('Abrindo…');
  try {
    const r = await openBox();
    if (r.error) { msg(r.error); return; }
    msg(r.dupe ? `Repetida. +${r.gain} Docoins.` : `${r.item.emoji} ${r.item.name} entrou na mochila.`, true);
    render();
    await presentDrop(r, 'box');
  } finally { busy = false; }
}
function askWheel() {
  if (wheelPick.length !== 3) return;
  const names = wheelPick.map((id) => { const it = itemById(id); return it ? `${it.emoji} ${it.name}` : id; });
  pendingWheel = wheelPick.slice();
  $('closetBuyAskText').textContent = `Girar a roleta com ${names.join(', ')}? Elas saem da mochila.`;
  $('closetBuyAsk').classList.remove('hidden');
  $('closetBuyNo').focus();
}
async function finishWheel(ids) {
  const prev = getAccount() || {}, prevKnife = prev.knife || '', prevSniper = prev.sniper || '', prevGuns = { ...(prev.guns || {}) };
  busy = true; msg('Girando…');
  try {
    const r = await spinWheel(ids);
    if (r.error) { msg(r.error); return; }
    wheelPick = [];
    const nowA = getAccount() || {};
    if (prevKnife && prevKnife !== (nowA.knife || '')) document.dispatchEvent(new CustomEvent('docao-knife-pick', { detail: '' }));
    if (prevSniper && prevSniper !== (nowA.sniper || '')) document.dispatchEvent(new CustomEvent('docao-sniper-pick', { detail: '' }));
    for (const [key, gid] of Object.entries(prevGuns)) if (gid && gid !== ((nowA.guns || {})[key] || '')) document.dispatchEvent(new CustomEvent('docao-gun-pick', { detail: { key, id: '' } }));
    msg(r.dupe ? `Repetida. +${r.gain} Docoins.` : `${r.item.emoji} ${r.item.name} entrou na mochila.`, true);
    render();
    const floor = wheelFloor(ids.map((id) => itemById(id)).filter(Boolean));
    const pool = lootItems().filter((i) => i.weight >= floor);
    await presentDrop(r, 'wheel', pool);
  } finally { busy = false; }
}
let wardrobeDirty = false, wardrobeCustom = false, wardrobeSniper = '', wardrobeGuns = {}, wardrobeGunFocus = 'rifle', wardrobeGunTouched = false;
const wardrobeNote = (t, ok = false) => { const m = $('wardrobeOwnedMsg'); if (!m) return; m.textContent = t || ''; m.style.color = ok ? '#d5c597' : '#ffb4a8'; };
function emitGunPreview() {
  if (!wardrobeGunTouched) {
    const equipped = GUN_GROUPS.map(([k]) => k).find((k) => (k === 'sniper' ? wardrobeSniper : wardrobeGuns[k]));
    wardrobeGunFocus = equipped || 'rifle';
  }
  const id = wardrobeGunFocus === 'sniper' ? (wardrobeSniper || '') : (wardrobeGuns[wardrobeGunFocus] || '');
  const it = id && itemById(id);
  const label = (GUN_GROUPS.find(([k]) => k === wardrobeGunFocus) || ['', 'Arma'])[1];
  document.dispatchEvent(new CustomEvent('docao-gun-preview', { detail: { key: wardrobeGunFocus, id, name: it ? it.name : `${label} de fábrica` } }));
}
function paintWardrobe() {
  const box = $('wardrobeOwned'); if (!box) return;
  const a = getAccount();
  if (!a) {
    box.innerHTML = '<p class="wardrobe-note">Entre na conta para montar o visual com o que você já comprou. As skins da lista continuam aqui.</p><button type="button" id="wardrobeLogin" class="wardrobe-save">ENTRAR</button>';
    wardrobeNote('');
    emitGunPreview();
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
  emitGunPreview();
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
    if (sl.dataset.witem) look.items[k] = sl.dataset.witem;
    else delete look.items[k];
    wardrobeNote(''); markWardrobe(); return;
  }
  const gn = t.closest('[data-wgun]');
  if (gn) {
    const key = gn.dataset.wgun, id = gn.dataset.wgid || '';
    if (key === 'sniper') wardrobeSniper = id; else { wardrobeGuns = { ...wardrobeGuns }; if (id) wardrobeGuns[key] = id; else delete wardrobeGuns[key]; }
    wardrobeGunFocus = key; wardrobeGunTouched = true; wardrobeDirty = true; wardrobeNote(''); paintWardrobe(); return;
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
  $('closetModal').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') { if (reel) { reel.skip(); return; } if (!$('closetReveal').classList.contains('hidden')) { $('closetReveal').classList.add('hidden'); return; } if (pendingBox) closeBoxAsk(); else if (pendingBuy) closeAsk(); else if (pendingWheel) closeWheelAsk(); else closeCloset(); } });
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
