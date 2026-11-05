// Chat da sala: o histórico fica aberto no canto da partida e também no lobby e no fim.
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let hooks = { send() {}, teamMode() { return false; }, shouldLock() { return false; }, lockPointer() {}, clearKeys() {} };
let lines = [];
let shown = true;
let roomOn = true;
let typing = false;
let scope = 'all';
let composeScope = 'all';
let suppress = 0;
let teamOn = false;
let teamWord = 'Time';
let sig = '';

export function chatTyping() { return typing; }
export function chatShown() { return shown; }
export function chatRoomOn() { return roomOn; }
export function chatConsumeUnlock() {
  if (typing) return true;
  if (suppress > 0) { suppress--; return true; }
  return false;
}
export function chatNoteLocked() { if (!typing) suppress = 0; }

export function initChat(h) {
  hooks = h;
  try { shown = localStorage.getItem('docao.chat') !== '0'; } catch (e) { shown = true; }
  $('chat').classList.toggle('hidden', !shown);
  document.querySelectorAll('[data-chat-toggle]').forEach((el) => {
    el.checked = shown;
    el.addEventListener('change', () => setShown(el.checked));
  });
  document.querySelectorAll('[data-say]').forEach((b) => { b.addEventListener('click', () => { composeScope = b.dataset.say; paintScope(); }); });
  bindKeep('lobbyChatForm', 'lobbyChatInput');
  bindKeep('overChatForm', 'overChatInput');
  $('chatForm').addEventListener('submit', (e) => { e.preventDefault(); sendText(scope, $('chatInput').value); closeChat(true); });
  $('chatInput').addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.code === 'Escape') { e.preventDefault(); closeChat(true); }
    if (e.code === 'Tab') e.preventDefault();
  });
  $('chatInput').addEventListener('keyup', (e) => { if (e.code !== 'KeyK') e.stopPropagation(); });
  paintScope();
}

function bindKeep(formId, inputId) {
  const form = $(formId), input = $(inputId);
  form.addEventListener('submit', (e) => { e.preventDefault(); const sc = composeScope === 'team' && hooks.teamMode() ? 'team' : 'all'; sendText(sc, input.value); input.value = ''; });
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.code === 'Escape') input.blur();
    if (e.code === 'Tab') e.preventDefault();
  });
  input.addEventListener('keyup', (e) => { if (e.code !== 'KeyK') e.stopPropagation(); });
}

function setShown(on) {
  shown = !!on;
  try { localStorage.setItem('docao.chat', shown ? '1' : '0'); } catch (e) { /* sem storage */ }
  $('chat').classList.toggle('hidden', !shown);
  document.querySelectorAll('[data-chat-toggle]').forEach((el) => { el.checked = shown; });
  if (!shown) closeChat(false);
}

export function chatSetRoom(on) {
  roomOn = on !== false;
  $('lobbyChatForm').classList.toggle('hidden', !roomOn);
  $('lobbyChatOff').classList.toggle('hidden', roomOn);
  $('overChatForm').classList.toggle('hidden', !roomOn);
  if (!roomOn) closeChat(false);
}
export function chatSetTeam(on) { teamOn = !!on; if (!teamOn) composeScope = 'all'; paintScope(); }
export function chatTeamWord(w) { teamWord = w || 'Time'; }
export function chatUseHooks(next) {
  const prev = hooks;
  hooks = { ...hooks, ...next };
  return () => { hooks = prev; };
}
export function chatSay(scope, text) { sendText(scope, text); }
export function chatClear() { lines = []; sig = ''; render(true); }
export function chatSeed(list) { lines = Array.isArray(list) ? list.slice(-30) : []; sig = ''; render(true); }
export function chatPush(line) {
  if (!line || typeof line.text !== 'string') return;
  const scope = line.scope === 'team' ? 'team' : 'all';
  if (!line.local) {
    const i = lines.findIndex((l) => l.local && l.id === line.id && l.text === line.text && (l.scope === 'team' ? 'team' : 'all') === scope);
    if (i >= 0) { lines[i] = line; if (lines.length > 30) lines.shift(); render(true); return; }
  }
  lines.push(line); if (lines.length > 30) lines.shift(); render(true);
}

export function openChat(sc) {
  if (!shown || !roomOn) return false;
  scope = sc === 'team' && hooks.teamMode() ? 'team' : 'all';
  typing = true; suppress = 1;
  hooks.clearKeys();
  if (document.pointerLockElement) document.exitPointerLock();
  $('chat').classList.add('open');
  $('chatForm').classList.remove('hidden');
  $('chatScopeLabel').textContent = scope === 'team' ? 'Time' : 'Todos';
  const input = $('chatInput'); input.value = ''; input.focus();
  render(true);
  return true;
}
export function closeChat(relock) {
  if (!typing && !suppress) return;
  typing = false;
  $('chat').classList.remove('open');
  $('chatForm').classList.add('hidden');
  $('chatInput').blur();
  render(true);
  if (relock && hooks.shouldLock()) hooks.lockPointer();
  else suppress = 0;
}

function sendText(sc, raw) {
  const text = String(raw || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!text || !roomOn) return;
  const scope = sc === 'team' ? 'team' : 'all';
  const me = hooks.me ? hooks.me() : null;
  if (me) chatPush({ local: 1, id: me.id, name: me.name, team: me.team, scope, dead: me.dead ? 1 : 0, text, at: Date.now() });
  hooks.send({ t: 'say', text, scope });
}
export function chatUseAll() {
  scope = 'all';
  composeScope = 'all';
  const label = $('chatScopeLabel');
  if (label) label.textContent = 'Todos';
  paintScope();
}
function paintScope() {
  const team = teamOn && hooks.teamMode();
  document.querySelectorAll('[data-say]').forEach((b) => {
    if (b.dataset.say === 'team') b.classList.toggle('hidden', !team);
    b.classList.toggle('on', b.dataset.say === (team ? composeScope : 'all'));
  });
}
function lineHtml(l) {
  if (l.sys) return `<div class="cline sys">${esc(l.text)}</div>`;
  const who = l.scope === 'team' ? teamWord : 'Todos';
  const tm = l.team === 0 ? 'tm0' : l.team === 1 ? 'tm1' : 'tmx';
  const nem = !l.sys && hooks.nemesis && hooks.nemesis(l.id);
  return `<div class="cline${l.dead ? ' dead' : ''}"><i>${who}</i> <b class="${tm}${nem ? ' nemesis' : ''}">${nem ? '<span class="nemesis-skull">💀</span>' : ''}${esc(l.name)}</b> ${esc(l.text)}${l.dead ? ' <em>(morto)</em>' : ''}</div>`;
}
export function chatRefresh() {
  if (!$('chat')) return;
  sig = '';
  render(true);
}
function render(force) {
  const next = (typing ? '1' : '0') + lines.map((l) => (l.at || 0) + l.text).join('|');
  if (!force && next === sig) return;
  sig = next;
  const html = lines.map(lineHtml).join('');
  document.querySelectorAll('[data-chat]').forEach((el) => {
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 28;
    el.innerHTML = html;
    if (near) el.scrollTop = el.scrollHeight;
  });
}
