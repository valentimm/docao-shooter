// Flinch da luneta, red dot dos fuzis e pente da Carabina da Granja.
// Uso: node test-flinch-reddot.mjs
import { WEAPONS, FLINCH, RED_DOT, flinchKick, applyFlinch, decayFlinch, isAssault } from './shared/rules.js';
import { FAMAS, COMMANDO, UZI, LMG } from './shared/rules.js';
import { piecesOf, resolveWeapon, defaultKit, classLoad, normalizeClasses, kitIsDefault, clampKit } from './shared/attachments.js';
import { kickRecoil } from './shared/recoil.js';

const fails = [];
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) fails.push(m); };
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;

const granja = WEAPONS.find((w) => w.key === 'carabina');
ok(granja && granja.mag === 5 && granja.reserve === 40, `Carabina da Granja 5/40 (mag ${granja && granja.mag}, reserva ${granja && granja.reserve})`);
ok(granja.adsIn === 0.15 * 1.275 && granja.scopeAt === 0.97, `ADS da Granja ${granja.adsIn}s (27,5% mais lento que os 0,15 originais), lente em ${granja.scopeAt}`);
ok(!WEAPONS.find((w) => w.key === 'sniper').adsIn && !WEAPONS.find((w) => w.key === 'canhao').adsIn, 'Torresmo e Canhão continuam no tempo global de ADS');

ok(isAssault(0) && isAssault(FAMAS) && isAssault(COMMANDO), 'fuzil, FAMAS e Commando são AR');
ok(!isAssault(UZI) && !isAssault(LMG) && !isAssault(4), 'SMG, LMG e pistola não são AR');
for (const i of [0, FAMAS, COMMANDO]) {
  const ids = piecesOf(i, 'optic').map((p) => p.id);
  ok(ids[0] === 'reddot' && ids.includes(''), `${WEAPONS[i].key}: red dot na mira, massa de milho continua`);
}
ok(!piecesOf(UZI, 'optic').some((p) => p.id === 'reddot'), 'MP5K não ganha red dot');

const dot = resolveWeapon(0, { optic: 'reddot' });
ok(dot.redDot && dot.adsFov === RED_DOT.adsFov && near(dot.adsSpread, RED_DOT.adsSpread) && dot.recoil === WEAPONS[0].recoil, `red dot: fov ${dot.adsFov}, spread ADS ${dot.adsSpread}, recuo de quadril ${dot.recoil}`);
ok(near(dot.adsRecoil, 0.35), `coice mirando fica em ${dot.adsRecoil} (65% a menos)`);
ok(near(75 / dot.adsFov, 1.19, 0.02), `zoom ${ (75 / dot.adsFov).toFixed(3) }× dentro de 1,1–1,25`);
const spray = (w, ads, n = 6) => {
  const p = { pitch: 0, yaw: 0, crouch: 0 };
  for (let i = 0; i < n; i++) kickRecoil(p, w, i * 0.1, ads, ads >= 0.85);
  return p;
};
const ironGun = { ...dot, redDot: false };
const hip = spray(dot, 0), hipIron = spray(ironGun, 0);
const aim = spray(dot, 1), plain = spray(ironGun, 1), mid = spray(dot, 0.5), midIron = spray(ironGun, 0.5);
ok(near(hip.pitch, hipIron.pitch) && hip.pitch > plain.pitch, `quadril igual sem a redução (${hip.pitch.toFixed(4)})`);
ok(aim.pitch > 0 && near(aim.pitch, plain.pitch * RED_DOT.recoil) && near(aim.yaw, plain.yaw * RED_DOT.recoil), `ADS red dot é ${RED_DOT.recoil} do coice real (pitch ${aim.pitch.toFixed(4)} / ${plain.pitch.toFixed(4)}, yaw ${aim.yaw.toFixed(4)} / ${plain.yaw.toFixed(4)})`);
ok(near(mid.pitch, midIron.pitch), 'abaixo do limiar do red dot o coice ADS continua o normal');
const famas = resolveWeapon(FAMAS, defaultKit(FAMAS));
ok(famas.redDot && famas.adsFov === 63, 'FAMAS de fábrica já nasce de red dot');
ok(resolveWeapon(0, { optic: '' }).adsFov === 40 && !resolveWeapon(0, { optic: '' }).redDot, 'massa de milho continua o zoom antigo');

const classes = normalizeClasses(null, { primary: 0, secondary: 4, melee: 7 });
const loaded = classLoad(classes[0], null);
ok(loaded.kits.rifle.optic === 'reddot', 'classe nova equipa o red dot');
const iron = { ...classes[0], kits: { rifle: { optic: '', barrel: '', mag: '', stock: '' } } };
const ironLoad = classLoad(normalizeClasses([iron, iron, iron, iron, iron], {})[0], null);
ok(ironLoad.kits.rifle.optic === '', 'quem carimbou a massa de milho não volta pro red dot');
ok(kitIsDefault(0, defaultKit(0)) && !kitIsDefault(0, { optic: '' }), 'padrão é red dot; alça vazia não é padrão');
ok(clampKit(0, { optic: 'vidro' }).optic === '', 'luneta de sniper continua fora do fuzil');

const full = flinchKick(80, 1, () => 0.5);
const ref = flinchKick(FLINCH.refDmg, 1, () => 0.5);
const light = flinchKick(10, 1, () => 0.5);
const hipF = flinchKick(FLINCH.refDmg, 0, () => 0);
ok(near(full.pitch, ref.pitch) && full.pitch > light.pitch, 'dano acima da referência bate no teto e o leve empurra menos');
ok(near(hipF.pitch, ref.pitch * FLINCH.hip) && hipF.pitch < ref.pitch * 0.25, `fora da luneta fica em ${FLINCH.hip} do tranco`);
const side = flinchKick(40, 1, () => 0);
ok(side.yaw < 0 && Math.abs(side.yaw) <= FLINCH.yaw + 1e-9, 'o lateral tem sinal e não passa da amplitude');

const pile = { pitch: 0, yaw: 0, flinch: null };
for (let n = 0; n < 30; n++) applyFlinch(pile, 100, 1, () => 1);
ok(pile.flinch.pitch <= FLINCH.maxPitch + 1e-9 && Math.abs(pile.flinch.yaw) <= FLINCH.maxYaw + 1e-9, `rajada não passa do teto (${pile.flinch.pitch.toFixed(3)} / ${pile.flinch.yaw.toFixed(3)})`);
const back = { pitch: FLINCH.maxPitch, yaw: 0 };
decayFlinch(back, FLINCH.recover);
ok(back.pitch < FLINCH.maxPitch * 0.06 && back.pitch > 0, `em ${FLINCH.recover}s volta quase tudo (sobra ${back.pitch.toFixed(4)})`);

console.log(fails.length ? `\n${fails.length} FALHA(S)` : '\nTUDO OK');
process.exit(fails.length ? 1 : 0);
