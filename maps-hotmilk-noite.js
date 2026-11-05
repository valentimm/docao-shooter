// ============================================================
//  HOTMILK à Noite — único mapa do Survival da Invasão.
//  Mesma identidade do campus (bloco 01, bloco 02, praça, verde #1f6b45,
//  letreiro HOTMILK, caixotes de leite), maior e fechado pra horda.
//  Geometria estática SEM as folhas das portas: o teste de mapa e os outros
//  modos, se alguém forçar o id, andam o prédio inteiro. No Survival,
//  shared/survival.js soma door.block na colisão até a compra.
//
//  A física (shared/physics.js) trata y = 0 como o chão mais baixo.
//  A garagem é um anexo de pé-direito baixo no mesmo nível, não um buraco
//  negativo — senão o corpo é puxado de volta pro zero.
//
//  Integração com a branch do Survival: ver docs/HOTMILK-NOITE.md
//  e map.survival (áreas, portas, playerSpawns, anchors).
// ============================================================

export function addHotmilkNoite(MAPS, kit) {
  const { B, R, building, fin, crate } = kit;
  const H = 3.4;
  const col = {
    wall: '#cfc6b6', wall2: '#b7ad9c', inner: '#a89884', floor: '#d5cec2',
    roof: '#2a3142', roof2: '#1b2333', stair: '#8d3a3a', trim: '#1f6b45',
  };
  const wood = '#c4a574', green = '#1f6b45', steel = '#3e4654', cream = '#d7c4a4';
  const boxes = [];
  const props = [];

  // ---------- Bloco 01: térreo é o saguão; andares 2 e 3 são a área andar2 ----------
  // Pegada 56 × 40 m. Saguão central largo (x -16..16), cozinha a oeste, estoque a leste,
  // câmara fria no fundo (norte) ligando as duas alas.
  boxes.push(...building(-28, 8, 28, 48, {
    col, floors: 3, H, t: 0.45, parapet: 1.9,
    roofGaps: [{ s: 'n', a: -2.6, b: 2.6 }], // sul do bloco (z = 8), emenda da passarela. n = lado z0
    ops: [
      { s: 'n', a: -2.2, b: 2.2 }, // porta da praça, fachada sul
      { s: 'e', a: 30, b: 33.8 }, // porta da garagem
      { s: 'w', a: 18, b: 21.2, k: 'win' }, { s: 'w', a: 26, b: 29.2, k: 'win' }, { s: 'w', a: 34, b: 37.2, k: 'win' },
      { s: 'e', a: 16, b: 19.2, k: 'win' }, { s: 'e', a: 36, b: 39.2, k: 'win' },
      { s: 'n', a: -22, b: -18.6, k: 'win' }, { s: 'n', a: -10, b: -6.4, k: 'win' }, { s: 'n', a: 6.4, b: 10, k: 'win' }, { s: 'n', a: 16, b: 19.6, k: 'win' },
      { s: 'n', a: -22, b: -18, f: 1, k: 'win' }, { s: 'n', a: -10, b: -6, f: 1, k: 'win' }, { s: 'n', a: 6, b: 10, f: 1, k: 'win' }, { s: 'n', a: 16, b: 20, f: 1, k: 'win' },
      { s: 'n', a: -18, b: -14, f: 2, k: 'win' }, { s: 'n', a: 12, b: 16, f: 2, k: 'win' },
      { s: 's', a: -18, b: -14, k: 'win' }, { s: 's', a: -4, b: 0, k: 'win' }, { s: 's', a: 8, b: 12, k: 'win' }, { s: 's', a: 16, b: 20, f: 1, k: 'win' },
      { s: 'w', a: 16, b: 20, f: 1, k: 'win' }, { s: 'w', a: 28, b: 32, f: 1, k: 'win' },
      { s: 'e', a: 16, b: 20, f: 1, k: 'win' }, { s: 'e', a: 28, b: 32, f: 2, k: 'win' },
    ],
    inner: [
      // alas do térreo
      { axis: 'z', s0: 8.7, s1: 42, line: -16, f: 0, ops: [{ a: 23.2, b: 26.6 }] },
      { axis: 'z', s0: 8.7, s1: 42, line: 16, f: 0, ops: [{ a: 23.2, b: 26.6 }] },
      // fundo: saguão não entra; cozinha e estoque abrem pra câmara fria
      { axis: 'x', s0: -27.4, s1: 27.4, line: 42, f: 0, ops: [{ a: -27.2, b: -16.4, k: 'wide' }, { a: 16.4, b: 27.2, k: 'wide' }] },
      { axis: 'z', s0: 42.35, s1: 47.45, line: 0, f: 0, ops: [{ a: 43.6, b: 46.4 }] },
      // caixa da escada, no norte do saguão
      { axis: 'x', s0: -5.8, s1: 5.8, line: 33.6, f: 0, ops: [{ a: -1.55, b: 1.55 }] },
      { axis: 'z', s0: 33.6, s1: 41.4, line: -5.8, f: 0, ops: [] },
      { axis: 'z', s0: 33.6, s1: 41.4, line: 5.8, f: 0, ops: [] },
      { axis: 'x', s0: -5.8, s1: 5.8, line: 41.4, f: 0, ops: [] },
      // anel do 2º e do 3º: sala central com quatro portas, corredor em volta (loop)
      ...[1, 2].flatMap((f) => [
        { axis: 'z', s0: 14, s1: 31, line: -12, f, ops: [{ a: 20, b: 23.2 }] },
        { axis: 'z', s0: 14, s1: 31, line: 12, f, ops: [{ a: 20, b: 23.2 }] },
        { axis: 'x', s0: -12, s1: 12, line: 14.4, f, ops: [{ a: -1.6, b: 1.6 }] },
        { axis: 'x', s0: -12, s1: 12, line: 30.6, f, ops: [{ a: -1.6, b: 1.6 }] },
      ]),
    ],
    stairs: [
      { f: 0, r: [-5.1, 34.5, -1.15, 40.6], axis: 'z', dir: 1 },
      { f: 1, r: [1.15, 34.5, 5.1, 40.6], axis: 'z', dir: -1 },
      { f: 2, r: [15.2, 20.2, 23.4, 26.2], axis: 'x', dir: 1 },
    ],
  }));

  // ---------- Bloco 02, três andares, escada livre dentro da área ----------
  boxes.push(...building(-26, -42, 26, -12, {
    col, floors: 3, H, t: 0.45, parapet: 1.9,
    roofGaps: [{ s: 's', a: -2.6, b: 2.6 }], // norte do bloco 02 (z = -12), emenda da passarela. s = lado z1
    ops: [
      { s: 's', a: -2.2, b: 2.2 },
      { s: 's', a: -16, b: -12.4, k: 'win' }, { s: 's', a: 8, b: 12, k: 'win' },
      { s: 'w', a: -34, b: -30.4, k: 'win' }, { s: 'e', a: -28, b: -24.4, k: 'win' },
      { s: 'n', a: -16, b: -12, f: 1, k: 'win' }, { s: 'n', a: 8, b: 12, f: 1, k: 'win' },
      { s: 's', a: -8, b: -4, f: 2, k: 'win' }, { s: 's', a: 6, b: 10, f: 2, k: 'win' },
    ],
    inner: [0, 1, 2].flatMap((f) => [
      { axis: 'z', s0: -38, s1: -16, line: -10, f, ops: [{ a: -30, b: -26.6 }] },
      { axis: 'z', s0: -38, s1: -16, line: 10, f, ops: [{ a: -30, b: -26.6 }] },
      { axis: 'x', s0: -10, s1: 10, line: -16.6, f, ops: [{ a: -1.6, b: 1.6 }] },
      { axis: 'x', s0: -10, s1: 10, line: -37.2, f, ops: [{ a: -1.6, b: 1.6 }] },
    ]),
    stairs: [
      { f: 0, r: [-23.4, -38.2, -19.2, -31.6], axis: 'z', dir: 1 },
      { f: 1, r: [-18.6, -38.2, -14.6, -31.6], axis: 'z', dir: -1 },
      { f: 2, r: [-3.4, -22.4, 3.4, -14.2], axis: 'z', dir: 1 },
    ],
  }));

  // Laje do térreo. O building() só fecha o piso a partir do 2º andar,
  // e sem isso o asfalto da rua aparece dentro do bloco.
  boxes.push(B(-27.5, 8.5, 27.5, 47.5, 0.06, col.floor));
  boxes.push(B(-2.15, 8.02, 2.15, 8.55, 0.06, col.floor)); // soleira da praça
  boxes.push(B(27.5, 30.05, 28.25, 33.75, 0.06, col.floor)); // soleira da garagem
  boxes.push(B(-25.5, -41.5, 25.5, -12.5, 0.06, col.floor));
  boxes.push(B(-2.15, -12.55, 2.15, -11.95, 0.06, col.floor)); // soleira do bloco 02

  // ---------- passarela dos telhados (y = 10.2), porta no meio ----------
  boxes.push(B(-2.5, -12, 2.5, 8, 0.28, col.floor, 9.92));
  boxes.push(B(-2.7, -12, -2.35, 8, 1.05, col.roof2, 10.2));
  boxes.push(B(2.35, -12, 2.7, 8, 1.05, col.roof2, 10.2));
  for (let z = -10; z <= 6; z += 4) boxes.push({ wp: [0, 10.2, z] });

  // ---------- praça fechada entre os blocos (cerca leste tem o portão) ----------
  boxes.push(B(-26.35, -12, -25.85, 8, 2.7, col.wall2));
  boxes.push(B(25.85, -12, 26.35, -1.7, 2.7, col.wall2));
  boxes.push(B(25.85, 1.7, 26.35, 8, 2.7, col.wall2));
  // mureta baixa no meio da praça, com vão, pra loop de kite e cobertura
  boxes.push(B(-8, -2.3, -1.4, -1.7, 1.15, cream));
  boxes.push(B(1.4, -2.3, 8, -1.7, 1.15, cream));
  boxes.push(B(-1.2, -7.2, 1.2, -4.6, 1.15, wood));
  boxes.push(B(-10, 2.2, -7.4, 4.6, 1.15, cream), B(7.4, 2.2, 10, 4.6, 1.15, cream));
  for (let x = -18; x <= 18; x += 9) for (let z = -8; z <= 4; z += 6) {
    if (Math.abs(x) < 3.2) continue; // corredor norte-sul entre as duas portas dos blocos
    if (z > -2 && z < 2 && x > 12) continue; // caminho do portão da rua
    boxes.push(B(x - 0.55, z - 0.4, x + 0.55, z + 0.4, 1.15, cream));
  }

  // ---------- garagem anexa (pé-direito baixo), a leste do estoque ----------
  const gY = 2.75, gWall = '#6a7384', gCeil = '#aeb6c2';
  boxes.push(B(28.15, 20, 50, 20.4, gY, gWall));
  boxes.push(B(28.15, 41.6, 50, 42, gY, gWall));
  boxes.push(B(49.6, 20, 50, 27.6, gY, gWall));
  boxes.push(B(49.6, 31.2, 50, 42, gY, gWall));
  boxes.push(B(28.15, 20, 28.55, 29.7, gY, gWall));
  boxes.push(B(28.15, 34.1, 28.55, 42, gY, gWall));
  boxes.push(B(28.2, 20.15, 49.7, 41.85, 0.22, gCeil, gY - 0.22)); // teto baixo, claro o bastante pra ler o vão
  boxes.push(B(28.25, 20.5, 49.5, 41.5, 0.06, '#6a7384')); // piso de concreto, claro o bastante pra ler o chão
  boxes.push(B(49.45, 27.7, 50.2, 31.15, 0.06, '#4c5668')); // soleira da cancela
  // carros e pilares: corredor central e volta pelos lados
  for (const [x, z] of [[34, 24.5], [34, 37], [42, 24.5], [42, 37], [46.5, 30.5]]) boxes.push(B(x - 0.35, z - 0.35, x + 0.35, z + 0.35, 2.3, steel));
  boxes.push(B(33.2, 26.8, 37.4, 28.6, 1.15, '#2c4d6e'), B(33.2, 33.2, 37.4, 35.0, 1.15, '#8d3a3a'));
  boxes.push(B(40.6, 27.2, 44.8, 29.0, 1.15, '#c4a574'), B(40.6, 33.6, 44.8, 35.4, 1.15, '#3c4654'));

  // ---------- anel da rua (cerca interna + postes). O vão longo do leste é a linha da sniper ----------
  const fence = (x0, z0, x1, z1) => boxes.push(B(x0, z0, x1, z1, 1.25, '#4a5344'));
  fence(32, 50.2, 54, 50.6);
  fence(-54, 50.2, -32, 50.6);
  fence(-32.4, 48.2, -31.9, 62);
  fence(31.9, 48.2, 32.4, 62);
  fence(-54, -52.2, 54, -51.8);
  fence(-54.4, -62, -54, 50);
  fence(54, -62, 54.4, 62);
  // postes a cada 8 m, fora do corredor x=46 (linha limpa de ~40 m entre z=-8 e z=32)
  for (let z = -58; z <= 58; z += 8) {
    if (z > -10 && z < 34) continue;
    boxes.push(B(45.4, z - 0.35, 46.2, z + 0.35, 1.35, steel));
    boxes.push(B(51.6, z - 0.35, 52.4, z + 0.35, 1.35, steel));
  }
  for (let z = -8; z <= 32; z += 8) boxes.push(B(51.6, z - 0.35, 52.4, z + 0.35, 1.2, steel));
  // faixa entre o prédio e a rua: sem isso o meio fica a mais de 7 m de qualquer cobertura
  for (let z = -8; z <= 16; z += 6) boxes.push(B(35.4, z - 0.35, 36.2, z + 0.35, 1.3, steel));
  for (let z = 44; z <= 52; z += 6) boxes.push(B(35.4, z - 0.35, 36.2, z + 0.35, 1.3, steel));
  for (let z = -8; z <= 16; z += 6) boxes.push(B(-36.2, z - 0.35, -35.4, z + 0.35, 1.3, steel));
  for (let z = 44; z <= 52; z += 6) boxes.push(B(-36.2, z - 0.35, -35.4, z + 0.35, 1.3, steel));
  for (let z = -48; z <= 56; z += 8) {
    boxes.push(B(-43.4, z - 0.3, -42.6, z + 0.3, 1.2, steel));
    if (z < 18 || z > 44) boxes.push(B(42.6, z - 0.3, 43.4, z + 0.3, 1.2, steel));
  }
  for (let z = -40; z <= 46; z += 8) {
    boxes.push(B(-33.8, z - 0.35, -33.0, z + 0.35, 1.25, steel));
    if (z < 18 || z > 44) boxes.push(B(33.0, z - 0.35, 33.8, z + 0.35, 1.25, steel));
  }
  for (let x = -24; x <= 24; x += 8) {
    boxes.push(B(x - 0.35, -47.2, x + 0.35, -46.4, 1.25, steel));
    boxes.push(B(x - 0.35, 50.2, x + 0.35, 51.0, 1.25, steel));
  }
  // anel a 6 m da borda: o limite do mapa conta como cobertura, e o canto não pode passar de 7 m
  for (let z = -66; z <= 66; z += 8) {
    boxes.push(B(-52.4, z - 0.3, -51.6, z + 0.3, 1.2, steel));
    boxes.push(B(51.6, z - 0.3, 52.4, z + 0.3, 1.2, steel));
  }
  for (let x = -48; x <= 48; x += 8) {
    boxes.push(B(x - 0.3, -68.4, x + 0.3, -67.6, 1.2, steel));
    boxes.push(B(x - 0.3, 67.6, x + 0.3, 68.4, 1.2, steel));
  }
  for (let x = -48; x <= 48; x += 8) boxes.push(B(x - 0.35, -58.2, x + 0.35, -57.4, 1.3, steel));
  for (let z = -48; z <= 46; z += 8) boxes.push(B(-51.4, z - 0.35, -50.6, z + 0.35, 1.3, steel));
  for (let x = -40; x <= 40; x += 8) boxes.push(B(x - 0.35, 56.2, x + 0.35, 57.0, 1.3, steel));
  // caminhões cortam a visão do anel, menos o vão do leste
  props.push({ t: 'truck', x: 40, z: -46, c: '#c44536' });
  props.push({ t: 'truck', x: -40, z: -46, c: '#3d6ea8' });
  props.push({ t: 'truck', x: -48, z: 20, c: '#8d3a3a' });
  props.push({ t: 'truck', x: 36, z: 56, c: '#2c4d6e' });

  // ---------- cobertura dentro dos prédios (campo aberto do audit ≤ 7 m) ----------
  const post = (x, z, h, c, y0 = 0) => boxes.push(B(x - 0.32, z - 0.32, x + 0.32, z + 0.32, h, c, y0));
  // saguão: ilha da recepção + quatro pilares. Spawns ficam a ≥ 4 m deles.
  boxes.push(B(-1.7, 19.6, 1.7, 24.8, 1.12, cream));
  post(-8, 16.5, 2.6, green); post(8, 16.5, 2.6, green); post(-8, 28.5, 2.6, green); post(8, 28.5, 2.6, green);
  boxes.push(B(-1.15, 12.55, 1.15, 13.7, 1.05, wood));
  // cozinha: bancada central com vão nas pontas (volta nos dois lados)
  boxes.push(B(-23.4, 16, -20.4, 21.5, 1.05, '#e7e1d6'));
  boxes.push(B(-23.4, 28.2, -20.4, 36.5, 1.05, '#e7e1d6'));
  boxes.push(crate(-25.6, 18.5, 1.15, 1.05, wood), crate(-18.2, 33, 1.15, 1.05, green));
  boxes.push(B(-24.8, 43.4, -22.2, 46.6, 1.15, '#9bb0c4')); // câmara fria
  // estoque: duas prateleiras, corredor no meio e nas laterais
  boxes.push(B(18.4, 15.5, 20.2, 21.2, 1.7, wood), B(18.4, 28.4, 20.2, 36.2, 1.7, wood));
  boxes.push(B(23.2, 15.5, 25.0, 21.2, 1.7, cream), B(23.2, 28.4, 25.0, 36.2, 1.7, cream));
  boxes.push(crate(21.6, 44.8, 1.2, 1.1, wood), crate(24.4, 43.8, 1.1, 1.0, green));
  // andares de cima: pilares no corredor largo
  for (const y of [H, 2 * H]) {
    for (const x of [-20, 20]) for (const z of [18, 26]) post(x, z, 2.4, steel, y);
    post(0, 22, 1.3, wood, y);
    boxes.push(crate(-4, 20, 1.2, 1.05, wood, y), crate(4, 26, 1.2, 1.05, cream, y));
    post(-20, 36, 2.2, steel, y); post(20, 36, 2.2, steel, y);
    post(-10, 38, 2.2, steel, y); post(10, 38, 2.2, steel, y);
    post(-20, 43, 2.2, steel, y); post(20, 43, 2.2, steel, y); post(0, 44.2, 2.2, steel, y);
  }
  // orelhas da escada do telhado: a folha sozinha deixa o 3º andar contornar e subir
  boxes.push(B(14.3, 19.35, 23.7, 20.12, 2.7, col.inner, 6.8));
  boxes.push(B(14.3, 26.28, 23.7, 27.05, 2.7, col.inner, 6.8));
  // telhado do bloco 01
  for (const [x, z] of [[-16, 18], [-16, 32], [0, 20], [0, 36], [16, 30], [10, 16], [-8, 44]]) boxes.push(crate(x, z, 1.5, 1.15, steel, 3 * H));
  for (let x = -18; x <= 18; x += 9) for (let z = 18; z <= 42; z += 9) {
    if (x >= 13 && x <= 25 && z >= 19 && z <= 27) continue; // vão da escada do telhado
    boxes.push(crate(x, z, 1.35, 1.1, steel, 3 * H));
  }
  // bloco 02: móveis no anel
  for (const y of [0, H, 2 * H]) {
    boxes.push(crate(-16, -22, 1.25, 1.1, wood, y), crate(16, -22, 1.25, 1.1, wood, y));
    boxes.push(crate(-16, -34, 1.25, 1.1, cream, y), crate(16, -34, 1.25, 1.1, cream, y));
    post(0, -26, 1.2, green, y);
  }
  for (const [x, z] of [[-14, -20], [14, -28], [0, -34], [-8, -38]]) boxes.push(crate(x, z, 1.4, 1.1, steel, 3 * H));
  for (let x = -16; x <= 16; x += 8) for (let z = -36; z <= -18; z += 8) {
    if (x > -8 && x < 8 && z > -26) continue; // escada pro telhado, perto da passarela
    boxes.push(crate(x, z, 1.25, 1.05, steel, 3 * H));
  }

  // ---------- letreiros (identidade Hotmilk, tom de fazenda) ----------
  const sign = (x, y, z, w, h, rot, text, bg = '#1e3d28') => props.push({ t: 'sign', x, y, z, w, h, rot, text, bg, fg: '#ffffff' });
  sign(0, 2.5, 9.15, 3.4, 0.7, 0, 'BLOCO 01');
  sign(0, 4.3, 7.7, 6.2, 1.15, 0, 'HOTMILK');
  sign(-22, 2.15, 14.2, 3.6, 0.7, 0, 'COZINHA DO LEITE');
  sign(22, 2.15, 14.2, 3.8, 0.7, 0, 'ESTOQUE');
  sign(-6, 2.0, 44.2, 3.2, 0.62, Math.PI / 2, 'CÂMARA FRIA', '#1a3a4a');
  sign(0, 2.4, -11.35, 3.2, 0.7, Math.PI, 'BLOCO 02');
  sign(0, 2.2, -4.2, 3.6, 0.7, 0, 'PRAÇA DO COPO');
  sign(36, 2.1, 22.4, 3.4, 0.66, Math.PI / 2, 'GARAGEM');
  sign(47.5, 2.3, 0, 4.2, 0.7, -Math.PI / 2, 'RUA DO LEITE');
  sign(47.2, 1.7, 18, 3.2, 0.6, -Math.PI / 2, 'MILKSHAKE 24H', '#8d3a3a');
  props.push({ t: 'keg', x: -4.5, z: 17 }, { t: 'keg', x: 4.5, z: 17 }, { t: 'keg', x: -21.2, z: 24 }, { t: 'keg', x: 21.2, z: 40 });
  props.push({ t: 'hay', x: 47.5, z: -20 }, { t: 'hay', x: -50, z: -20 }, { t: 'tree', x: 40, z: -36 }, { t: 'tree', x: -40, z: 40 }, { t: 'tree', x: 40, z: 44 });
  // janelas com luz de lua (plano sem colisão; world.js prop 'moon')
  const moonWin = (x, y, z, rot) => props.push({ t: 'moon', x, y, z, w: 2.3, h: 1.15, rot, c: '#9eb6e4' });
  for (const x of [-20, -6, 8, 18]) { moonWin(x, 1.55, 8.7, 0); moonWin(x, 1.55 + H, 8.7, 0); }
  for (const z of [18, 28, 36]) moonWin(-27.3, 1.55 + H, z, Math.PI / 2);
  for (const x of [-14, 0, 12]) moonWin(x, 1.55, -41.3, Math.PI);

  // ---------- waypoints de rampa e vão (o building já marca as portas) ----------
  boxes.push({ wp: [-3.1, 1.6, 37.5] }, { wp: [-3.1, 3.4, 40.5] }, { wp: [3.1, 5.0, 37.5] }, { wp: [3.1, 6.8, 34.8] });
  boxes.push({ wp: [18, 8.4, 23.2] }, { wp: [23.6, 10.2, 23.2] });
  boxes.push({ wp: [-21.2, 1.6, -34.8] }, { wp: [-21.2, 3.4, -31.8] }, { wp: [-16.6, 5.1, -35] }, { wp: [-16.6, 6.8, -33] });
  boxes.push({ wp: [0, 8.6, -18] }, { wp: [0, 10.2, -13.6] });

  const built = fin(boxes);

  // Folhas: não entram em boxes. block é a colisão enquanto fechada.
  // at é o ponto do prompt (os dois lados, a ≤ USE_R). swing é só visual.
  const doors = [
    { id: 'porta-cozinha', areas: ['saguao', 'cozinha'], price: 750, name: 'Cozinha do Leite', prompt: 'Abrir a Cozinha do Leite', at: [-16, 1.1, 24.9], block: [-16.35, 0, 23.05, -15.65, 2.7, 26.75], swing: 1 },
    { id: 'porta-estoque', areas: ['saguao', 'estoque'], price: 1000, name: 'Estoque de Caixinha', prompt: 'Abrir o Estoque', at: [16, 1.1, 24.9], block: [15.65, 0, 23.05, 16.35, 2.7, 26.75], swing: -1 },
    { id: 'porta-escada', areas: ['saguao', 'andar2'], price: 1250, name: 'Escada do Bloco 01', prompt: 'Subir pro segundo andar', at: [0, 1.1, 32.7], block: [-1.7, 0, 33.35, 1.7, 2.7, 33.95], swing: 1 },
    { id: 'porta-praca', areas: ['saguao', 'praca'], price: 1500, name: 'Praça do Copo', prompt: 'Sair pra Praça do Copo', at: [0, 1.1, 8.15], block: [-2.35, 0, 7.9, 2.35, 2.7, 8.55], swing: 1 },
    { id: 'porta-servico', areas: ['cozinha', 'estoque'], price: 1750, name: 'Porta de serviço', prompt: 'Abrir a porta de serviço', at: [0, 1.1, 45], block: [-0.32, 0, 43.45, 0.32, 2.7, 46.55], swing: 1 },
    { id: 'porta-bloco2', areas: ['praca', 'bloco2'], price: 2000, name: 'Bloco 02', prompt: 'Entrar no Bloco 02', at: [0, 1.1, -11.35], block: [-2.35, 0, -12.55, 2.35, 2.7, -11.85], swing: 1 },
    { id: 'porta-telhado', areas: ['andar2', 'telhado'], price: 2250, name: 'Telhado', prompt: 'Subir pro telhado', at: [13.4, 7.9, 23.2], block: [14.15, 6.8, 20.05, 15.95, 9.7, 26.35], swing: 1 },
    { id: 'porta-garagem', areas: ['estoque', 'garagem'], price: 2500, name: 'Garagem', prompt: 'Abrir a garagem', at: [27.15, 1.1, 31.9], block: [27.45, 0, 29.85, 28.15, 2.7, 33.95], swing: 1 },
    { id: 'porta-rua', areas: ['praca', 'rua'], price: 2750, name: 'Portão da rua', prompt: 'Abrir o portão da Rua do Leite', at: [25.2, 1.1, 0], block: [25.75, 0, -1.65, 26.45, 2.7, 1.65], swing: 1 },
    { id: 'porta-cancela', areas: ['garagem', 'rua'], price: 3000, name: 'Cancela', prompt: 'Abrir a cancela da garagem', at: [49.2, 1.1, 29.4], block: [49.45, 0, 27.55, 50.15, 2.7, 31.25], swing: -1 },
    { id: 'porta-passarela', areas: ['telhado', 'bloco2'], price: 3250, name: 'Passarela do Leite', prompt: 'Abrir a passarela', at: [0, 11.3, -2], block: [-2.35, 10.2, -2.35, 2.35, 12.9, -1.65], swing: 1 },
  ];

  // zspawns: [x, z, y]. Longe do vão da porta pra não nascer na cara de quem abre.
  const areas = [
    { id: 'saguao', name: 'Saguão do Bloco 01', start: true, floor: 0, box: [-15.5, 12, 15.5, 33, 0, 3.2],
      zspawns: [[-12, 14.5, 0], [12, 14.5, 0], [-12, 30.5, 0], [12, 30.5, 0], [0, 30.8, 0]] },
    { id: 'cozinha', name: 'Cozinha do Leite', floor: 0, box: [-27.4, 12.5, -16.5, 47.4, 0, 3.2],
      zspawns: [[-25.2, 15.2, 0], [-18.8, 24.6, 0], [-25.2, 32, 0], [-18.8, 38, 0], [-26, 44.6, 0]] },
    { id: 'estoque', name: 'Estoque de Caixinha', floor: 0, box: [16.5, 12.5, 27.4, 47.4, 0, 3.2],
      zspawns: [[21.6, 14.2, 0], [21.6, 24.4, 0], [26.2, 32, 0], [18.8, 39, 0], [26.2, 44.8, 0]] },
    { id: 'andar2', name: 'Andares de cima', floor: 1, box: [-27, 12, 27, 46, 3.4, 10],
      zspawns: [[-24, 16, H], [24, 16, H], [-6, 22, H], [24, 28, H], [6, 16, 2 * H], [-8, 28, 2 * H], [22, 36, 2 * H]] },
    { id: 'praca', name: 'Praça do Copo', floor: 0, box: [-25, -11, 25, 7.5, 0, 3],
      zspawns: [[-14, 4, 0], [14, 4, 0], [-14, -8, 0], [14, -8, 0], [0, 5.5, 0]] },
    { id: 'bloco2', name: 'Bloco 02', floor: 0, box: [-25, -41, 25, -13, 0, 10.2],
      zspawns: [[-18, -20, 0], [18, -20, 0], [0, -28, 0], [-22, -28, H], [18, -26, 2 * H], [20, -30, 3 * H]] },
    { id: 'telhado', name: 'Telhado do Bloco 01', floor: 3, box: [-27, -12, 27, 47, 10.2, 13],
      zspawns: [[-12, 16, 3 * H], [12, 22, 3 * H], [-6, 36, 3 * H], [8, 42, 3 * H], [0, 4, 10.2]] },
    { id: 'garagem', name: 'Garagem', floor: 0, box: [29, 21, 49, 41, 0, 2.7],
      zspawns: [[32, 23.2, 0], [46, 23.2, 0], [32, 39, 0], [46, 39, 0], [38, 31, 0]] },
    { id: 'rua', name: 'Rua do Leite', floor: 0, box: [-56, -64, 56, 66, 0, 3],
      zspawns: [[48.6, -4, 0], [48.6, 24, 0], [48.6, -36, 0], [-50, 4, 0], [-50, -40, 0], [8, -60, 0], [8, 60, 0], [48.6, 44, 0]] },
  ];

  // 12 vagas no saguão, grade de 6–7 m. Cabe 8 jogadores sem se empilhar.
  const playerSpawns = [
    [-12, 15, 0], [-6, 15, 0], [6, 15, 0], [12, 15, 0],
    [-12, 22, 0], [-6, 22, 0], [6, 22, 0], [12, 22, 0],
    [-12, 30, 0], [-6, 30, 0], [6, 30, 0], [12, 30, 0],
  ];
  // Spawns do grafo (audit / mapa aberto). O Survival nasce só em playerSpawns.
  const spawns = [
    ...playerSpawns,
    [-25.4, 24.6, 0], [22, 18, 0], [-18.7, 39.2, 0], [22, 36, 0],
    [0, 4, 0], [-18, -6, 0], [18, -6, 0],
    [-24, 22, H], [20, 22, H], [0, 26, 2 * H], [-16, -24, 0], [16, -32, H], [8, -24, 2 * H],
    [-10, 24, 3 * H], [12, 30, 3 * H], [0, 0, 10.2],
    [36, 24, 0], [44, 36, 0], [48, 8, 0], [-50, 10, 0], [0, -56, 0],
  ];

  const anchors = {
    // Máquina de upgrade: o outro agente instancia o mesh e o débito em ent.points.
    upgrade: [
      { id: 'upg-saguao', area: 'saguao', x: 0, y: 0, z: 27.4, yaw: Math.PI, note: 'de frente pra ilha, visível no começo' },
      { id: 'upg-bloco2', area: 'bloco2', x: 0, y: 0, z: -24, yaw: 0, note: 'térreo do bloco 02' },
      { id: 'upg-rua', area: 'rua', x: 47.2, y: 0, z: 12, yaw: -Math.PI / 2, note: 'calçada da Rua do Leite' },
    ],
    // Três pontos. start: true é o lugar inicial da caixa; os outros são os cantos pra onde ela pode mudar.
    mystery: [
      { id: 'box-cozinha', area: 'cozinha', x: -21.8, y: 0, z: 26, yaw: Math.PI / 2, start: true },
      { id: 'box-andar2', area: 'andar2', x: 0, y: H, z: 18, yaw: Math.PI },
      { id: 'box-rua', area: 'rua', x: 48, y: 0, z: -16, yaw: Math.PI, note: 'ao lado do caminhão vermelho' },
    ],
    // Arma de parede. suggestedPrice é sugestão; quem debita é a outra branch, no mesmo ent.points.
    // weapon é a key de shared/rules.js (WEAPONS[].key).
    wall: [
      { id: 'wall-saguao-shotgun', area: 'saguao', weapon: 'shotgun', suggestedPrice: 500, x: -14.6, y: 1.3, z: 18, yaw: Math.PI / 2, note: 'parede oeste do saguão. Pistola o jogador já traz.' },
      { id: 'wall-estoque-rifle', area: 'estoque', weapon: 'rifle', suggestedPrice: 1200, x: 17.2, y: 1.3, z: 20, yaw: -Math.PI / 2 },
      { id: 'wall-andar2-commando', area: 'andar2', weapon: 'commando', suggestedPrice: 1500, x: -14, y: 1.3 + H, z: 16, yaw: Math.PI / 2 },
      { id: 'wall-bloco2-carabina', area: 'bloco2', weapon: 'carabina', suggestedPrice: 1800, x: 12, y: 1.3, z: -15.2, yaw: Math.PI },
    ],
  };

  const lights = [
    ['#ffd2a8', 0, 2.6, 20, 7, 20],
    ['#ffd2a8', -8, 2.5, 26, 5, 14],
    ['#ffd2a8', 8, 2.5, 26, 5, 14],
    ['#ffd8b0', -22, 2.5, 24, 5.5, 16, 'buzz'],
    ['#ffd8b0', 22, 2.5, 24, 5.5, 16, 'buzz'],
    ['#ffd2a8', -22, 2.4, 40, 4, 12],
    ['#ffd2a8', 22, 2.4, 40, 4, 12],
    ['#ffb45a', -16, 2.2, 24.9, 3.2, 8, 'alarm'],
    ['#ffb45a', 16, 2.2, 24.9, 3.2, 8, 'alarm'],
    ['#ffb45a', 0, 2.2, 32.4, 3.2, 8, 'alarm'],
    ['#ffe0b8', 0, 2.4 + H, 22, 6, 18],
    ['#ffe0b8', 0, 2.4 + 2 * H, 22, 6, 18],
    ['#c5d4ff', -8, 2.2 + 3 * H, 28, 4, 16],
    ['#c5d4ff', 8, 2.2 + 3 * H, 28, 4, 16],
    ['#ffd2a8', 0, 2.5, -2, 5, 16],
    ['#ffd2a8', 0, 2.5, -26, 6, 18],
    ['#ffe0b8', 0, 2.4 + H, -26, 5, 16],
    ['#d0dcff', 0, 2.2 + 3 * H, -24, 4, 14],
    ['#d7e4ff', 0, 12.2, -2, 3.5, 12],
    ['#ffe0b0', 34, 1.85, 25.5, 14, 18],
    ['#ffe0b0', 44, 1.85, 25.5, 14, 18],
    ['#d7e4ff', 34, 1.85, 36.5, 12, 18],
    ['#d7e4ff', 44, 1.85, 36.5, 12, 18],
    ['#ffd8b0', 21.6, 2.2, 33, 6, 14],
    ['#ffb45a', 30, 1.8, 31.9, 4.5, 10, 'alarm'],
    ['#c9d7ff', 48, 3.2, 0, 3.5, 18],
    ['#c9d7ff', 48, 3.2, -28, 3, 16],
    ['#c9d7ff', -50, 3.2, 8, 3, 16],
  ];

  MAPS.push({
    id: 'hotmilk-noite',
    name: 'HOTMILK à Noite',
    mode: 'survival',
    survivalOnly: true,
    desc: 'Campus da HOTMILK de madrugada, só no Survival: saguão do Bloco 01, portas compradas, cozinha, estoque, andares, telhado, Bloco 02, garagem e a Rua do Leite.',
    size: [58, 74], wallH: 4.2, wallColor: ['#1a2436', '#141c2c'],
    navSpacing: 2, openMax: 7.5, laneMin: 36, expMax: 0.32,
    palette: {
      sky: '#10182e', fog: ['#1c2944', 38, 128], hemi: ['#8ea4d4', '#2a2118', 0.82], sun: ['#c5d4ff', 0.58], shadow: false,
      ground: '#2a3038', tiles: ['#343b46', '#262c34', 64, 16], clouds: false, stars: true,
      lights,
    },
    ...built, props,
    spawns,
    pickups: [
      ['health', 0, 17.2], ['health', -25.4, 33], ['health', 22, 30], ['health', 0, -4], ['health', -16, -28, H], ['health', 0, 24, 3 * H],
      ['ammo', -10, 26], ['ammo', 10, 20], ['ammo', -18.8, 24.6], ['ammo', 24, 22], ['ammo', 0, 20, H], ['ammo', 22, 34, 2 * H], ['ammo', 38, 30], ['ammo', 48, -8], ['ammo', -18, -22],
      ['grenade', 4, 28], ['grenade', -20, 44], ['grenade', 0, -8], ['grenade', 0, 18, 2 * H], ['grenade', 44, 26],
    ],
    showcase: [0, 0, 18],
    view: [0, 1.6, 16.5, Math.PI, -0.06],
    survival: {
      version: 1,
      playerSpawns,
      areas,
      doors,
      anchors,
    },
    test: {
      stairs: { from: [0, 0, 32.1], via: [[0, 34.3], [-3.1, 36.2]], to: [-3.1, H, 40.1], level: H },
      roof: { from: [12.2, 2 * H, 23.2], to: [24.2, 3 * H, 23.2], level: 3 * H },
      under: { from: [-8, 0, 18], to: [8, 0, 18], ceil: 3.2 },
    },
  });
}
