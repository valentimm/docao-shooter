import assert from 'node:assert/strict';
import { unlockDevSkins } from './server/src/dev-skins.js';
import { ITEMS } from './shared/closet.js';
const writes = [];
const DB = { prepare(query) { return { bind(...args) { return { async run() { writes.push({ query, args }); } }; } }; } };
for (const flag of [undefined, '0', 'true']) {
  assert.equal(await unlockDevSkins({ DB, DEV_UNLOCK_SKINS: flag }, 42, new URL('http://localhost:8795/api/me')), false);
}
for (const host of ['docao-shooter-server.valentimm.workers.dev', 'localhost.exemplo.com', 'docao.mvalentim.dev']) {
  assert.equal(await unlockDevSkins({ DB, DEV_UNLOCK_SKINS: '1' }, 42, new URL(`https://${host}/api/me`)), false);
}
assert.equal(writes.length, 0, 'produção e flag desligada não escrevem na mochila');
for (const host of ['localhost', '127.0.0.1', '[::1]']) {
  assert.equal(await unlockDevSkins({ DB, DEV_UNLOCK_SKINS: '1' }, 42, new URL(`http://${host}:8795/api/me`)), true);
}
assert.equal(writes.length, 3);
for (const { query, args } of writes) {
  assert.match(query, /INSERT OR IGNORE INTO inventory/);
  assert.equal(args[0], 42);
  assert.deepEqual(JSON.parse(args[1]), ITEMS.map(item => item.id));
}
console.log('OK: todas as skins liberadas apenas com flag explícita em localhost; produção e progressão normal preservadas.');
