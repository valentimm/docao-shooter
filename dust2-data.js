// ============================================================
//  Dust 2 (modelo GLB): dados do mapa sem Three.js, usados pelo cliente e pelo servidor.
//  A colisão vem de assets/maps/dust2/dust2-collision.json (caixas [x0, y0, z0, x1, y1, z1] já na escala do jogo).
//  O servidor importa o JSON e chama setGlbBoxes no carregamento; o cliente baixa junto com o GLB (glb-maps.js).
// ============================================================
export const DUST2_ID = 'dust2';

export function dust2() {
  return {
    id: DUST2_ID,
    name: 'Dust 2',
    desc: 'Mapa clássico de Counter-Strike (De_Dust 2 with real light, Neo_minigan / Sketchfab). Baixa ao escolher (~10 MB).',
    glb: 'dust2',
    heavy: true, // heavy: fica fora do sorteio/rodízio (GLB de ~10 MB); entra quando alguém escolhe
    size: [58, 68],
    wallH: 4,
    navSpacing: 1.5,
    navSnap: true,
    palette: {
      sky: '#c9dff0',
      fog: ['#dfcfb4', 120, 280],
      hemi: ['#fff8ec', '#c9a97d', 1.4],
      sun: ['#fff1d6', 0.9],
      shadow: false,
    },
    fall: { y: -15, rects: [[-59, -69, 59, 69]] },
    boxes: [], // preenchido por setGlbBoxes
    // ponte de navegação entre o Túnel B inferior (-2.8 m) e o Meio (-3.2 m) / Túnel B superior (+0.2 m)
    waypoints: [
      [-7, -2.8, -7], [-6, -2.8, -7], [-5, -2.6, -7], [-4.5, -2.6, -7],
      [-4, -3.2, -7], [-3.5, -3.2, -7], [-2.5, -3.2, -7],
      [-20, -1.4, -2.5], [-20, -1.4, -1.5], [-20.5, -0.4, -0.5], [-21, 0.2, 0.5],
    ],
    // spawns [x, z, y]: o 1º é o da Exploração; o resto espalhado pelo mapa (Mata-mata, Dominação, Invasão…)
    spawns: [
      [-0.1, 0.4, -2], [-46.6, 49.9, 3.2], [46.4, -46.1, 3.4], [-43.6, -47.6, 0.8],
      [49.4, 16.9, 1.6], [4.4, 49.9, 1], [-42.1, -2.6, 0.8], [16.4, -34.1, -3.2],
      [-16.6, -29.6, -1], [41.9, -14.6, 0], [19.4, 22.9, 0], [-31.6, 25.9, 0],
      [-19.6, 46.9, 3.2], [17.9, -14.6, 1.6], [-6.1, 21.4, 0], [-39.1, -25.1, 0],
      [-21.1, -5.6, -2.8], [29.9, 3.4, 0],
    ],
    pickups: [
      ['health', -0.1, 46.9, 2.2], ['ammo', 41.9, -47.6, 3.2], ['grenade', -43.6, -29.6, 0], ['ammo', 49.4, 12.4, 1.6],
      ['health', 2.9, -8.6, 0], ['ammo', -42.1, 19.9, 0], ['grenade', -31.6, 49.9, 3.2], ['ammo', 16.4, 19.9, 0],
      ['health', -10.6, -35.6, -2.2], ['ammo', 44.9, -17.6, 0], ['grenade', 19.4, -31.1, -3.2], ['ammo', -24.1, -1.1, 1.2],
      ['health', -9.1, 18.4, 0], ['ammo', 25.4, 0.4, 0], ['grenade', -42.1, -10.1, 0.8], ['ammo', -28.6, -41.6, 0],
    ],
    // Bomba/Competitivo: site A (platô A) e B (site B); Ataque na base TR, Defesa na base CT
    bomb: {
      sites: [[34.4, 2.4, -35.6], [-37.6, 0.8, -34.1]],
      atk: [[-10.6, 45.4, 3.2], [-6.1, 51.4, 3.6], [-3.1, 45.4, 3], [-13.6, 51.4, 3.6], [-16.6, 46.9, 3.2], [-7.6, 48.4, 3.2]],
      def: [[10.4, -28.1, -3.2], [4.4, -25.1, -3.2], [13.4, -34.1, -3.2], [16.4, -26.6, -3.2], [8.9, -23.6, -3.2], [7.4, -26.6, -3.2]],
    },
    // Gunfight 3v3/4v4: Portas da B / Site B ↔ Rampa CT / A Cross, zona no Meio CT; spawns sem linha de visão entre os lados
    gf: {
      a: [[-31.6, -29.6, 0, 1.454], [-33.1, -31.1, 0, 1.406], [-30.1, -31.1, 0, 1.385], [-33.1, -28.1, 0, 1.515], [-31.6, -32.6, 0, 1.34]],
      b: [[20.9, -26.6, -3, -1.571], [22.4, -25.1, -2.6, -1.623], [19.4, -25.1, -3.2, -1.63], [22.4, -28.1, -2.6, -1.518], [19.4, -28.1, -3.2, -1.512]],
      zone: { x: -6.1, z: -26.6, r: 4 },
    },
    showcase: [1.4, 0, 15.4],
    view: [1.4, 2.5, 17.4, 0.1, -0.1],
  };
}
