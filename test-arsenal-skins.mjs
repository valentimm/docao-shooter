import assert from 'node:assert/strict';
import { KNIFE, SABER, SABER2, GOLD_KNIFE, WEAPONS, CATEGORIES } from './shared/rules.js';
import { ITEMS } from './shared/closet.js';
import { skinChannel, ownedWeaponSkins, equippedWeaponSkin } from './shared/arsenal-skins.js';
const rifle = WEAPONS.findIndex(w => w.key === 'rifle');
const sniper = WEAPONS.findIndex(w => w.key === 'sniper');
const rifleSkin = ITEMS.find(i => i.gun === 'rifle');
const sniperSkin = ITEMS.find(i => i.gun === 'sniper');
const inventory = ['k19', 'k2', rifleSkin.id, sniperSkin.id, 'c15', 'inexistente'];
assert.deepEqual(ownedWeaponSkins(KNIFE, inventory).map(i => i.id).sort(), ['k19', 'k2']);
assert.deepEqual(ownedWeaponSkins(rifle, inventory).map(i => i.id), [rifleSkin.id]);
assert.deepEqual(ownedWeaponSkins(sniper, inventory).map(i => i.id), [sniperSkin.id]);
for (const i of [SABER, SABER2, GOLD_KNIFE]) {
  assert.equal(skinChannel(i), null);
  assert.deepEqual(ownedWeaponSkins(i, inventory), []);
}
assert.deepEqual(ownedWeaponSkins(KNIFE), []);
assert.deepEqual(ownedWeaponSkins(-1, inventory), []);
const account = { knife: 'k19', sniper: sniperSkin.id, guns: { rifle: rifleSkin.id } };
assert.equal(equippedWeaponSkin(KNIFE, account), 'k19');
assert.equal(equippedWeaponSkin(rifle, account), rifleSkin.id);
assert.equal(equippedWeaponSkin(sniper, account), sniperSkin.id);
assert.equal(equippedWeaponSkin(SABER, account), '');
assert.equal(equippedWeaponSkin(KNIFE, null), '');
assert(CATEGORIES.find(c => c.pick === 'melee').weapons.includes(KNIFE));
assert(!WEAPONS.some(w => /Butterfly|Karambit/.test(w.name)));
console.log('OK: skins por arma e inventário; Butterfly e Karambit são visuais da faca; sabres e faca dourada separados.');
