// Ranking do Circuito Pocilga: tempo m:ss,mmm, estrelas e a linha de quem está logado.
// Sem DOM, sem Three.js e sem rede — o menu e o Tab só pintam o que esta função devolve.
export const GUEST_RANK_NOTE = 'Entre na conta para entrar no ranking';
export const PIT_RANK_LIMIT = 10;
export const PIT_TAB_CACHE_MS = 12000;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function formatRankClock(sec) {
  if (!(sec >= 0) || !Number.isFinite(sec)) return '—';
  const ms = Math.max(0, Math.round(sec * 1000));
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const milli = ms % 1000;
  return `${m}:${String(s).padStart(2, '0')},${String(milli).padStart(3, '0')}`;
}

export function starsRank(n) {
  const k = Math.max(0, Math.min(3, n | 0));
  return '★'.repeat(k) + '☆'.repeat(3 - k);
}

// Top e, se a conta logada ficou de fora, a linha dela com a posição real.
export function pitBoardRows(data, { logged = false } = {}) {
  const rows = Array.isArray(data && data.rows) ? data.rows.slice(0, PIT_RANK_LIMIT) : [];
  const me = logged && data && data.me && data.me.nick ? data.me : null;
  if (me && !rows.some((r) => r.nick === me.nick)) return rows.concat([me]);
  return rows;
}

export function renderPitRank(data, { nick = '', logged = false, variant = 'menu', loading = false, error = false } = {}) {
  const warn = logged ? '' : `<p class="pit-rank-warn">${GUEST_RANK_NOTE}</p>`;
  const kicker = variant === 'tab' ? '<p class="pit-tab-kicker">Pistoleiro da Pocilga</p>' : '';
  if (loading) return `${kicker}<p class="pit-rank-empty">Carregando…</p>${warn}`;
  if (error || data == null) return `${kicker}<p class="pit-rank-empty">Não deu pra carregar o ranking agora.</p>${warn}`;
  const rows = pitBoardRows(data, { logged });
  if (!rows.length) return `${kicker}<p class="pit-rank-empty">Ninguém fechou o Pistoleiro da Pocilga ainda.</p>${warn}`;
  const head = '<tr><th>#</th><th>Apelido</th><th>Tempo</th><th>Estrelas</th></tr>';
  const body = rows.map((r) => {
    const mine = !!(logged && nick && r.nick === nick);
    return `<tr class="${mine ? 'me' : ''}"><td>${r.place | 0}</td><td style="text-align:left">${esc(r.nick)}</td><td>${formatRankClock(r.best)}</td><td class="stars">${starsRank(r.stars)}</td></tr>`;
  }).join('');
  const table = variant === 'tab'
    ? `<table>${head}${body}</table>`
    : `<table><thead>${head}</thead><tbody>${body}</tbody></table>`;
  return `${kicker}${table}${warn}`;
}

// Cache curto do Tab: abrir de novo dentro do prazo não bate no servidor.
export function createRankCache({ load, now = () => Date.now(), ttl = PIT_TAB_CACHE_MS } = {}) {
  let slot = null, pending = null;
  return {
    peek() { return slot && now() - slot.at < ttl ? slot.data : null; },
    async get() {
      if (slot && now() - slot.at < ttl) return slot.data;
      if (pending) return pending;
      pending = Promise.resolve().then(() => load()).then((data) => {
        pending = null;
        if (data) slot = { at: now(), data };
        return data;
      }, (err) => { pending = null; throw err; });
      return pending;
    },
  };
}
