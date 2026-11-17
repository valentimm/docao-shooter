// ============================================================
//  Breeze Standoff (modelo GLB): dados do mapa sem Three.js, usados pelo cliente e pelo servidor.
//  A colisão vem de assets/maps/breeze/breeze-collision.json (caixas [x0, y0, z0, x1, y1, z1] já na escala do jogo).
//  O servidor importa o JSON e chama setBreezeBoxes no carregamento; o cliente baixa junto com o GLB (breeze-map.js).
//  Spawns, sites da Bomba e Gunfight saíram do grafo de navegação gerado dessa colisão (pontos com chão e teto livres).
// ============================================================
export const BREEZE_ID = 'breeze-standoff';

export function breezeStandoff() {
  return {
    id: BREEZE_ID, name: 'Breeze Standoff',
    desc: 'Vila mediterrânea do Standoff 2: becos, escadarias e dois sites. Modelo de frostychaos144 (Sketchfab). Arquivo grande: baixa ao escolher.',
    glb: 'breeze', heavy: true, // heavy: fica fora do sorteio/rodízio (o GLB tem 32 MB); entra quando alguém escolhe
    size: [110, 95], wallH: 4, navSpacing: 2, navSnap: true,
    palette: {
      sky: '#a6c8de', fog: ['#a6c8de', 135, 295], hemi: ['#ffffff', '#c8bdb3', 1.7],
      sun: ['#fff5e5', 0.8], shadow: false,
    },
    fall: { y: -18, rects: [[-111, -96, 111, 96]] },
    boxes: [], // preenchido por setBreezeBoxes
    // spawns [x, z, y]: o 1º é o da Exploração; o resto espalhado pelas ruas (Mata-mata, Dominação, Invasão…)
    spawns: [[-27.1, 11.9, -0.6], [10.9, -40.1, -4.8], [34.9, 17.9, 1.4], [-85.1, 3.9, -0.4], [-43.1, -38.1, -3.8], [-51.1, 53.9, 2], [-11.1, 51.9, 0.4], [6.9, -2.1, -2.8], [-53.1, -10.1, -1], [-21.1, -14.1, -3.8], [-55.1, 23.9, 2], [8.9, 29.9, 0.6], [-27.1, 35.9, 2.6], [-25.1, -44.1, -7], [-9.1, -34.1, -3.8], [-5.1, 11.9, -0.6], [14.9, -20.1, -1.8], [-65.1, 9.9, -0.6]],
    pickups: [["health", -19.1, 1.9, -0.6], ["ammo", -85.1, 11.9, -0.4], ["grenade", -45.1, 53.9, 2], ["ammo", 34.9, 13.9, 1.4], ["health", 10.9, -36.1, -4.8], ["ammo", -39.1, -38.1, -3.8], ["grenade", -5.1, 35.9, 2.4], ["ammo", -53.1, -6.1, -0.6], ["health", 6.9, -6.1, -2.8], ["ammo", -51.1, 25.9, 2], ["grenade", 16.9, 29.9, 0], ["ammo", -13.1, -30.1, -3.8], ["health", -19.1, 53.9, 1], ["ammo", -31.1, 19.9, 1], ["grenade", -63.1, 13.9, -0.6], ["ammo", -25.1, -12.1, -3.8]],
    // Bomba/Competitivo: site A (deque de madeira ao norte) e B (praça do sul); Ataque a leste, Defesa na praça da fonte a oeste
    bomb: { sites: [[-39.1, -3.8, -24.1], [-45.1, 2, 43.9]], atk: [[20.9, 5.9, -0.4], [18.9, 7.9, -0.4], [18.9, 3.9, -0.4], [20.9, 9.9, -0.4], [20.9, 1.9, -0.4], [16.9, 1.9, -0.4]], def: [[-79.1, 7.9, -0.4], [-77.1, 9.9, -0.4], [-81.1, 9.9, -0.4], [-77.1, 5.9, -0.4], [-81.1, 5.9, -0.4], [-79.1, 11.9, -0.4]] },
    // Gunfight 3v3/4v4: um trecho do meio (oeste ↔ leste), zona no beco central; spawns sem linha de visão entre os lados
    gf: { a: [[-53.1, -6.1, -0.6, 1.344], [-53.1, -8.1, -0.6, 1.272], [-53.1, -4.1, -0.6, 1.418], [-51.1, -6.1, -0.6, 1.326], [-51.1, -8.1, -0.6, 1.249]], b: [[-5.1, 9.9, -0.6, -1.997], [-5.1, 7.9, -0.6, -1.92], [-5.1, 11.9, -0.6, -2.07], [-3.1, 9.9, -0.6, -1.966], [-3.1, 7.9, -0.6, -1.893]], zone: {"x":-27.1, "z":-0.1, "r":4} },
    showcase: [-29, -0.6, 12],
  };
}

// caixas cruas do JSON → formato de maps.js ({ b, c }); idempotente
export function setBreezeBoxes(map, raw) {
  if (!map || !Array.isArray(raw) || (map.boxes && map.boxes.length)) return map;
  map.boxes = raw.map((b) => ({ b }));
  return map;
}
