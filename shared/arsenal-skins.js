// Skins do Brechó pertencem à arma base; não criam índices novos no loadout.
import { WEAPONS, KNIFE } from './rules.js';
import { ITEMS } from './closet.js';

export function skinChannel(weapon) {
  if (weapon === KNIFE) return 'knife';
  const key = WEAPONS[weapon]?.key;
  if (!key) return null;
  return ITEMS.some(item => item.gun === key) ? key : null;
}

export function ownedWeaponSkins(weapon, owned = []) {
  const channel = skinChannel(weapon), ids = new Set(owned);
  if (!channel) return [];
  return ITEMS.filter(item => ids.has(item.id) && (channel === 'knife' ? !!item.knife : item.gun === channel));
}

export function equippedWeaponSkin(weapon, account) {
  const channel = skinChannel(weapon);
  if (!account || !channel) return '';
  return (channel === 'knife' ? account.knife : channel === 'sniper' ? account.sniper : account.guns?.[channel]) || '';
}
