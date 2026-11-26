// Tab da Pocilga: busca o ranking ao abrir e pinta o #tabboard. Não mexe no relógio nem no movimento.
import { getAccount, getToken, loadPitRank } from './account.js';
import { createRankCache, renderPitRank, PIT_TAB_CACHE_MS } from './pocilga-rank.js';

const cache = createRankCache({ load: () => loadPitRank(10), ttl: PIT_TAB_CACHE_MS });

export function pitRankLogged() {
  const a = getAccount();
  return !!(getToken() && a && !a.dev);
}

export async function fillPitTab() {
  const el = document.getElementById('tabboard');
  if (!el) return;
  const logged = pitRankLogged();
  const nick = logged ? getAccount().nick : '';
  const base = { nick, logged, variant: 'tab' };
  const warm = cache.peek();
  el.innerHTML = renderPitRank(warm, { ...base, loading: !warm });
  let data = null, error = false;
  try {
    data = await cache.get();
    if (!data) error = true;
  } catch (e) { error = true; }
  if (el.classList.contains('hidden') || !document.body.classList.contains('pit-on')) return;
  el.innerHTML = renderPitRank(data, { ...base, error });
}
