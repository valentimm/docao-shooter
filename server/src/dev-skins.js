// Concessão real no D1 local: equipar continua usando a mesma validação de mochila.
import { ITEMS } from '../../shared/closet.js';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export async function unlockDevSkins(env, accountId, url) {
  if (env.DEV_UNLOCK_SKINS !== '1' || !LOCAL_HOSTS.has(url.hostname)) return false;
  await env.DB.prepare(
    'INSERT OR IGNORE INTO inventory (account_id, item, acquired_at) SELECT ?1, value, ?3 FROM json_each(?2)'
  ).bind(accountId, JSON.stringify(ITEMS.map(item => item.id)), Math.floor(Date.now() / 1000)).run();
  return true;
}
