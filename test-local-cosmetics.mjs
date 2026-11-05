import assert from 'node:assert/strict';
import { localCosmeticsEnabled } from './shared/local-dev.js';
import { ITEMS } from './shared/closet.js';
for (const hostname of ['localhost', '127.0.0.1', '[::1]']) {
 assert(localCosmeticsEnabled({ hostname }));
 assert(!localCosmeticsEnabled({ hostname, search: '?devSkins=0' }));
}
for (const hostname of ['docao.mvalentim.dev', 'localhost.exemplo.com', '127.0.0.1.exemplo.com']) {
 assert(!localCosmeticsEnabled({ hostname, search: '?devSkins=1' }));
}
const data = new Map([['docao.auth', 'sessao-expirada-de-teste']]);
globalThis.localStorage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) };
globalThis.location = { hostname: 'localhost', search: '?server=ws://localhost:8795' };
let requests = 0;
globalThis.fetch = async () => { requests++; throw Error('Backend indisponível'); };
const local = await import('./account.js?local-test');
assert(local.DEV_LOCAL);
assert(local.getAccount().dev);
assert.equal(local.getToken(), '');
assert.equal(data.get('docao.auth'), 'sessao-expirada-de-teste', 'a sessão real não é alterada');
assert.equal(local.getItems().length, ITEMS.length);
assert((await local.equipKnife('k19')).ok);
assert((await local.equipKnife('t1')).error);
assert.equal(local.getAccount().knife, 'k19');
const rifle = ITEMS.find(i => i.gun === 'rifle');
assert((await local.equipGun('rifle', rifle.id)).ok);
assert((await local.equipGun('p90', rifle.id)).error);
assert((await local.equipSniper('t1')).ok);
assert((await local.equipLook('x1.0.c.c15')).ok);
await local.refreshStats();
assert.equal(requests, 0, 'não depende de autenticação, banco ou rede');
const restored = await import('./account.js?local-reload');
assert.equal(restored.getAccount().knife, 'k19');
assert.equal(restored.getAccount().sniper, 't1');
assert.equal(restored.getAccount().guns.rifle, rifle.id);
assert.equal(restored.getAccount().custom, 'x1.0.c.c15');
assert((await restored.equipKnife('')).ok);
assert.equal(restored.getAccount().knife, null);
globalThis.location = { hostname: 'docao.mvalentim.dev', search: '?devSkins=1' };
data.delete('docao.auth');
const production = await import('./account.js?production-test');
assert(!production.DEV_LOCAL);
assert.equal(production.getAccount(), null);
assert.deepEqual(production.getItems(), []);
assert((await production.equipKnife('k19')).error);
assert((await production.equipGun('rifle', rifle.id)).error);
assert.equal(requests, 0);
console.log('OK: catálogo local sem login/rede, skins válidas por arma, persistência, sessão expirada ignorada e produção sem liberação.');
