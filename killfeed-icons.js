// Ícones do killfeed: silhuetas abstratas (SVG inline, cor do texto) pra cada arma, killstreak e o tiro no focinho.
// viewBox 48×16; a frente da arma aponta pra direita (vítima fica à direita no feed).
const P = {
  // armas (chave = WEAPONS[i].key)
  rifle: 'M2 6h30v-2h8v2h6v3H32v2l-5 0v5h-4l1-5H14l-3 4H6l2-4H2z',
  shotgun: 'M2 7h12l3-2h29v3H18l-2 2H8l-3 5H2z',
  sniper: 'M2 7h22v-3h-2V2h12v2h-2v3h16v2H26v2h-4v4h-3l1-4H8l-3 3H2z',
  bazooka: 'M4 5h34l2-2h6v10h-6l-2-2H4zM16 11h3v4h-3z',
  pistol: 'M14 4h26v4H24l-2 2v5h-5l1-7h-4z',
  canhao: 'M1 6h22V3h14v3h10v3H24v2h-4v4h-4l1-4H7l-3 4H1z',
  carabina: 'M2 7h22V5h10v2h13v2H25v2h-3v3h-3v-3H8l-2 3H2z',
  knife: 'M4 7h12v3H4zM16 6h4v5h-4zM20 7h18l8 2-8 2H20z',
  sabre: 'M2 6h12v4H2zM14 5h3v6h-3zM17 7h29v2H17z',
  uzi: 'M10 4h28v4H30v6h-5V8h-3l-2 3h-5l2-3h-7z',
  p90: 'M6 4h34v2h4v3H32v5h-5V9H14l-3 4H7l2-4H6z',
  prego: 'M10 3h14v8h-4v4h-5v-4h-5zM24 6h20v2H24z',
  semi: 'M2 7h14l2-2h28v4H20v2h-3v4h-4l1-4H8l-3 3H2z',
  besta: 'M4 7h30v2H4zM28 1h3v14h-3zM12 9h3v5h-3zM34 7h10l-4 1 4 1H34z',
  arco: 'M14 1c10 3 10 11 0 14l-1-1c8-3 8-9 0-12zM14 2v12M14 8h30l-4-2v4z',
  famas: 'M2 6h36v3H2zM10 3h20v2H10zM12 5h2v1h-2zM26 5h2v1h-2zM38 7h8v1h-8zM18 9h3v5h-4zM8 9h6v4H8z',
  disco: 'M2 10c8-6 36-6 44 0-8 4-36 4-44 0zM18 6c2-5 10-5 12 0z',
  ray: 'M6 8h8v5H8l1-3H6zM14 6h14v4H14zM28 4h6v2h-6zM28 10h6v2h-6zM32 6h8l6 2-6 2h-8z',
  sabre2: 'M2 3h10v3H2zM12 3h2v3h-2zM14 4h22v1H14zM2 10h10v3H2zM12 10h2v3h-2zM14 11h22v1H14z',
  estilingue: 'M2 7h12v2H2zM14 6l8-5h3l-9 6zM14 10l8 5h3l-9-6zM24 2h1v12h-1zM31 8a5 4 0 1 0 10 0a5 4 0 1 0-10 0z', // forquilha + elástico + ovo
  milho: 'M2 6h7v5H2zM9 4h20a4.5 4.5 0 0 1 0 9H9zM29 6h11v4H29zM40 5h3v6h-3zM15 1h8l-1 3h-6zM17 13h3v3h-4zM46 3a1.6 1.6 0 1 0 .1 0zM46 11a1.6 1.6 0 1 0 .1 0z', // pipoqueira com espiga e pipocas na frente
  minigun: 'M4 5h16v7H4zM20 4h3v9h-3zM23 5h21v1H23zM23 7h23v1H23zM23 9h23v1H23zM23 11h21v1H23zM40 4h2v9h-2zM8 2h10v1H8zM8 2h1v3H8zM17 2h1v3h-1zM6 12h8v3H6z', // carcaça, 6 canos (4 linhas), anel, alça e caixa de munição
  lmg: 'M2 6h28v3H2zM8 3h16v2H8zM30 6h14v2H30zM36 4h3v6h-3zM6 9h8v4H6zM18 9h10v5H16z', // corpo longo, cano, quebra-chama, caixa de fita e cabo
  commando: 'M2 7h18v2H2zM20 6h24v3H20zM12 9h4v4H12z', // fuzil reto: corpo fino, cano longo e pente
  tampa: 'M18 2c7.2 0 13 2.4 13 6s-5.8 6-13 6-13-2.4-13-6 5.8-6 13-6zM14 6.2h8v1.8h-8zM2 6.5h6v3H2z', // tampa oval, fresta e alça
  capataz: 'M8 5h6v7H10l1-3H8zM14 6h16v3H14zM28 5h3v5h-3zM16 4h2v2h-2zM20 9h4a3 3 0 0 1 0 5h-4z', // cabo, cano, cão e tambor
  capataz2: 'M4 3h4v4H5l1-2H4zM8 3h12v2H8zM18 2h2v4h-2zM4 10h4v4H5l1-2H4zM8 10h12v2H8zM18 9h2v4h-2z', // dois revólveres, um em cima do outro
  // granada e killstreaks
  nade: 'M18 3h12l-2 12h-8zM17 2h14v2H17z',
  missile: 'M4 6h30l8 2-8 2H4zM4 4l6 2H4zM4 12l6-2H4z',
  heli: 'M4 3h40v1H4zM23 4h2v2h-2zM14 6h18c3 0 5 2 5 4s-2 3-5 3H14zM2 8h12v2H2zM16 14h16v1H16z',
  gunner: 'M4 3h40v1H4zM23 4h2v2h-2zM12 6h18c3 0 5 2 5 4s-2 3-5 3H12zM2 8h10v2H2zM35 10h11v1H35zM35 12h11v1H35z',
  nuke: 'M15 8c0-4 4-6 9-6s9 2 9 6c0 2-2 3-4 3H19c-2 0-4-1-4-3zM21 11h6v3h-6zM16 14h16v2H16z', // cogumelo
  pokebola: 'M24 2a6 6 0 0 1 6 6H26a2 2 0 0 0-4 0h-4a6 6 0 0 1 6-6zM18 9h4a2 2 0 0 0 4 0h4a6 6 0 0 1-12 0z',
};
// rótulo de killstreak (KS_KILL_NAME / label do offline) → ícone
const LABEL = { 'Míssil da granja': 'missile', 'Gavião da granja': 'heli', 'Chopper da granja': 'gunner', 'Fim da chapa': 'nuke', 'Pokébola': 'pokebola' };
const svg = (d, w = 48) => `<svg class="kfi-svg" viewBox="0 0 ${w} 16" width="${w}" height="16" aria-hidden="true"><path fill="currentColor" d="${d}"/></svg>`;
// cabeça de porquinho com mira: tiro no focinho
const HEAD = '<svg class="kfi-hs" viewBox="0 0 18 16" width="18" height="16" aria-hidden="true"><circle cx="9" cy="9" r="5.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path fill="currentColor" d="M3 2l3 3-2 1zM15 2l-3 3 2 1z"/><ellipse cx="9" cy="10.5" rx="2.4" ry="1.6" fill="currentColor"/><path d="M9 0v4M9 14v2M0 9h2M16 9h2" stroke="currentColor" stroke-width="1.4"/></svg>';

// key = WEAPONS[i].key, 'nade' pro copo; label (killstreak) tem prioridade
// tijolos: pela parede; dois porquinhos varados pela mesma bala: collateral
const WALL = '<svg class="kfi-wall" viewBox="0 0 18 16" width="18" height="16" aria-hidden="true"><path fill="currentColor" d="M1 2h7v3H1zM10 2h7v3h-7zM1 7h3v3H1zM6 7h7v3H6zM15 7h2v3h-2zM1 12h7v3H1zM10 12h7v3h-7z"/></svg>';
const COL = '<svg class="kfi-col" viewBox="0 0 24 16" width="24" height="16" aria-hidden="true"><circle cx="7" cy="9" r="4.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="17" cy="9" r="4.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path fill="currentColor" d="M0 8h24v2H0z"/></svg>';
// fx: 1 pela parede, 2 collateral
export function weaponSvg(key) {
  const d = P[key] || P.rifle;
  return `<svg class="wico" viewBox="0 0 48 16" aria-hidden="true"><path fill="currentColor" d="${d}"/></svg>`;
}
export function killIcon(key, label, head, fx = 0) {
  const k = (label && LABEL[label]) || key;
  const d = P[k] || P.rifle;
  return `<span class="kfi" title="${label || ''}">${svg(d)}${fx & 1 ? WALL : ''}${fx & 2 ? COL : ''}${head ? HEAD : ''}</span>`;
}
