// ============================================================
//  SKINS DO DOCÃO: só dados. Para criar uma skin nova, copie um
//  bloco abaixo, mude o `id` e os campos que quiser. Nada mais.
//  A identidade (formato de porquinho, focinho, orelhas, bochechas,
//  olhos, contorno) NUNCA muda: só roupa, acessórios e um leve ajuste
//  de tom da pele, que é travado dentro da faixa amarelo-laranja.
// ============================================================
//
// Campos (todos opcionais exceto id e name):
//   id        string único (vai pro localStorage)
//   name      nome exibido no menu (pt-BR)
//   shirt: {
//     color   cor base da camiseta              ex '#d8261c'
//     trim    cor da gola e punhos das mangas    ex '#1d1410'
//     pattern null | { type: 'stripes', colors: ['#c8102e', '#111111'], count: 10 }
//                  | { type: 'hoops',   colors: [...], count: 6 }   (listras horizontais)
//     logo    null | { text: 'C!', color: '#f5e6d0', outline: null | '#hex', sub: null | 'cheers' }
//              (text 'C!' é desenhado como o logo Cheers; outro texto vira letra/número)
//   }
//   pants     cor do shorts                         ex '#1d1410'
//   body:  { tone: '#f8b22e' }  tom da pele (travado em amarelo-laranja)
//   shirt.sleeves      'short' (padrão) | 'long' | 'puffy'
//   shirt.sleeveColor  cor das mangas (padrão = cor da camiseta)
//   shirt.logo.size / .x / .y   tamanho (0.3), deslocamento lateral em rad (0 = centro; +0.4 = peito esquerdo) e altura (0.76)
//   shirt.details: [ { type: 'military' | 'frogs' | 'clouds' | 'tie' | 'zipper' | 'backStripes', color / colors } ]
//   parts: [ { type: ..., ...opções } ]  peças 3D por cima do Docão:
//     chapéus:   cap {color, brim, logo} · fedora {color, band} · bucketHat {color, band} · roundCap {color, knot} · hood {color, tip, cheeks}
//     cabelo:    longHair {color, headband}
//     rosto:     glasses {color} · sunglasses {color, lens}
//     mãos/pés:  glove {hand: 'right'|'left'|'both', color, sparkle} · shoes {color} · socks {color}
//     corpo:     epaulettes {color} · puffer {color, zipper} · chain {color} · robe {color, lining} · scarf {colors}
//                wand {color} · mandarinCollar {color, edge} · vest {color, pocket} · fish {color} · boltTail {color, base}
//                bandana {color} · headphones {color, accent}
//     fantasia:  ghostSheet {color, rim, opacity} · boneLimbs {color, glow, suit} · sash {color, belt, buckle, tabard}
//                laserSword {blade} · armWraps {color, ys} · hoodDown {color, inner} · noseTube {color, plug} · desertScarf {color}
//   shirt.details também aceita: 'bones' {color, glow} · 'tunicWrap' {color, inner} · 'stillsuit' {rib, tube, panel}
//                       · 'star' {color, outline, x, y, size, small: [[θ, y, size]...]} · 'zigzag' {color, y} · 'diagStripes' {color} · 'hoodie' {color, zip} · 'polo' {color, button}
//   peças das skins novas: boiHorns {color, band} · ribbonSkirt {colors, band} · messyHair {color} · squareGlasses {color}
//                sleeveStripes {color} · shortsStripes {color} · quiffHair {color, side} · beard {color, stubble, soul} (bigode 3D; barba por fazer no rosto, salvo stubble:false; soul = mosquinha)
//                hoodStrings {color} · lanyard {color, logo} · longPants {color} · shoes também aceita {sole}
//                faixa {colors:[verde, amarelo, azul], color}  faixa presidencial no peito (verde em cima, brasão no centro)
//                bellyOut {roll, rollDark}  camisa arregaçada com a barriga de fora (Docão Barriguinha)
//                wavyHair {color, highlight}  cabelo médio ondulado (Docão Bigzão)
//                pearl {color, pearl}  cordão fino prateado com pérola redonda
//                beachRacket {face, rim, accent, handle}  raquete de beach tennis nas costas (DocOny)
//   face:  { paint: 'skull' }   pintura leve no rosto (bochechas/focinho continuam)
//   eyes:  { iris: '#hex', ring: '#hex' }  tom da íris e anel escuro em volta (opcionais)
//   float: true                 flutua de leve (bob) e solta um rastro fraquinho no jogo
//   Peças novas: crie uma função em PARTS (costumes.js).

import { lookToSkin, isLookCode, parseLook, itemById } from './shared/closet.js';

export const SKINS = [
  {
    id: 'classico',
    name: 'Clássico',
    shirt: { color: '#d8261c', trim: '#1d1410', logo: { text: 'C!', color: '#f5e6d0' } },
    pants: '#1d1410',
  },
  {
    id: 'clube',
    name: 'Clube Cheers',
    shirt: { color: '#7DF9FF', trim: '#12233a', logo: { text: 'C!', color: '#12233a', sub: 'clube' } },
    pants: '#12233a',
    parts: [{ type: 'socks', color: '#7DF9FF' }],
  },
  {
    id: 'rei-do-pop',
    name: 'Rei do Pop',
    shirt: { color: '#c0121e', trim: '#e8b830', sleeves: 'long', details: [{ type: 'military', color: '#e8b830' }] },
    pants: '#15151a',
    parts: [
      { type: 'fedora', color: '#15151a', band: '#f4f4f4' },
      { type: 'glove', hand: 'right', color: '#ffffff', sparkle: true },
      { type: 'epaulettes', color: '#e8b830' },
      { type: 'socks', color: '#ffffff' },
      { type: 'shoes', color: '#111114' },
    ],
  },
  {
    id: 'rapper',
    name: 'Rapper da Hora',
    shirt: { color: '#f2f2f2', trim: '#2b2f38', sleeves: 'puffy', sleeveColor: '#2b2f38' },
    pants: '#5a5f6a',
    parts: [
      { type: 'puffer', color: '#2b2f38', zipper: '#c9c9c9' },
      { type: 'chain', color: '#f2c230' },
      { type: 'shoes', color: '#f4f4f4', strap: '#d0d0d0' },
    ],
  },
  {
    id: 'bruxinho',
    name: 'Bruxinho',
    shirt: { color: '#ecebe6', trim: '#1b1b22', sleeves: 'long', sleeveColor: '#1b1b22', details: [{ type: 'tie', colors: ['#8b1a1a', '#d4a537'] }] },
    pants: '#2a2a30',
    parts: [
      { type: 'robe', color: '#1b1b22', lining: '#8b1a1a' },
      { type: 'scarf', colors: ['#8b1a1a', '#d4a537'] },
      { type: 'glasses', color: '#2a1408' },
      { type: 'wand', color: '#6b4423' },
    ],
  },
  {
    id: 'kung-fu',
    name: 'Mestre do Kung Fu',
    shirt: {
      color: '#b3121b', trim: '#f2c14e', sleeves: 'long',
      details: [{ type: 'frogs', color: '#f2c14e' }, { type: 'clouds', color: '#f2c14e', y: 0.5 }],
      logo: { text: 'C!', color: '#f2c14e', size: 0.12, x: 0.62, y: 0.9 },
    },
    pants: '#15151a',
    parts: [
      { type: 'roundCap', color: '#15151a', knot: '#d0202a' },
      { type: 'mandarinCollar', color: '#b3121b', edge: '#f2c14e' },
      { type: 'shoes', color: '#15151a' },
    ],
  },
  {
    id: 'cabeludo',
    name: 'JanorDoc',
    shirt: { color: '#f6f6f4', trim: '#111114', sleeveColor: '#f6f6f4', details: [{ type: 'jersey', trim: '#111114' }] },
    pants: '#141416',
    parts: [
      { type: 'longHair', color: '#5a3518' },
      { type: 'cap', color: '#1a1a1d', brim: '#111114', logo: 'arcs', logoColor: '#2ec4b6', scale: 1.14, lift: 0.06 },
      { type: 'sunglasses', color: '#111114', lens: '#1b2a3a' },
      { type: 'beard', color: '#5a3518', stubble: false, goatee: true },
      { type: 'sleeveStripes', color: '#111114' },
      { type: 'shortsStripes', color: '#f4f4f4' },
      { type: 'watch', color: '#2f8a3c' },
      { type: 'shoes', color: '#141416', sole: '#f4f4f4', strap: '#f4f4f4' },
    ],
  },
  {
    id: 'pescador',
    name: 'Pescador',
    shirt: { color: '#6f9cc4', trim: '#4a6f90', logo: { text: 'C!', color: '#f5e6d0', size: 0.14, y: 0.66 } },
    pants: '#5a4a32',
    parts: [
      { type: 'bucketHat', color: '#8a8a5c', band: '#5a5a38' },
      { type: 'vest', color: '#c2ae7e', pocket: '#a8925e' },
      { type: 'fish', color: '#7fb3d5' },
    ],
  },
  {
    id: 'choquinho',
    name: 'Choquinho',
    shirt: { color: '#ffd23a', trim: '#e0a800', sleeves: 'long', details: [{ type: 'backStripes', color: '#7a4a1c' }], logo: { text: 'C!', color: '#7a4a1c', size: 0.16 } },
    pants: '#ffd23a',
    parts: [
      { type: 'hood', color: '#ffd23a', tip: '#1a1a1a', cheeks: '#e8322a' },
      { type: 'boltTail', color: '#ffd23a', base: '#7a4a1c' },
    ],
  },
  {
    id: 'bone',
    name: 'Boné da Firma',
    shirt: { color: '#d8261c', trim: '#1d1410', logo: { text: 'C!', color: '#f5e6d0' } },
    pants: '#2a3550',
    parts: [{ type: 'cap', color: '#7DF9FF', brim: '#12233a', logo: true }, { type: 'glasses', color: '#2a1408' }],
  },
  {
    id: 'fantasminha',
    name: 'Fantasminha',
    shirt: { color: '#f6fbff', trim: '#d6eef5', sleeves: 'long', sleeveColor: '#f6fbff' },
    pants: '#e8f4f8',
    float: true,
    parts: [{ type: 'ghostSheet', color: '#f6fbff', rim: '#bff8ff' }],
  },
  {
    id: 'esqueletao',
    name: 'Esqueletão',
    shirt: { color: '#16161a', trim: '#8dff6a', sleeves: 'long', sleeveColor: '#16161a', details: [{ type: 'bones', color: '#f7f7f2', glow: '#4f9a3c' }] },
    pants: '#16161a',
    face: { paint: 'skull' },
    parts: [{ type: 'boneLimbs', color: '#f7f7f2', glow: '#8dff6a', suit: '#16161a' }, { type: 'shoes', color: '#16161a', strap: '#8dff6a' }],
  },
  {
    id: 'cavaleiro-galactico',
    name: 'Cavaleiro Galáctico',
    shirt: { color: '#d9c7a0', trim: '#6b4a2b', sleeves: 'long', sleeveColor: '#cdb88e', details: [{ type: 'tunicWrap', color: '#bfa77a', inner: '#efe3c6' }] },
    pants: '#7a5a38',
    parts: [
      { type: 'robe', color: '#5a3b22', lining: '#3e2716' },
      { type: 'hoodDown', color: '#5a3b22', inner: '#3e2716' },
      { type: 'sash', color: '#6b4a2b', belt: '#3e2a18', buckle: '#c9c2b0', tabard: '#bfa77a' },
      { type: 'laserSword', blade: '#7DF9FF' },
      { type: 'armWraps', color: '#6b4a2b', ys: [-0.3, -0.4] },
      { type: 'shoes', color: '#3e2a18' },
    ],
  },
  {
    id: 'nomade-do-deserto',
    name: 'Nômade do Deserto',
    shirt: { color: '#2c2f33', trim: '#1b1d20', sleeves: 'long', sleeveColor: '#2c2f33', details: [{ type: 'stillsuit', rib: '#1b1d20', tube: '#8a8f96', panel: '#3a3e44' }] },
    pants: '#2c2f33',
    eyes: { iris: '#2f6fc9' },
    parts: [
      { type: 'robe', color: '#c9a66b', lining: '#9c7d48' },
      { type: 'hoodDown', color: '#c9a66b', inner: '#9c7d48' },
      { type: 'desertScarf', color: '#d4b37a' },
      { type: 'noseTube', color: '#3a3e44', plug: '#8a8f96' },
      { type: 'armWraps', color: '#1b1d20', ys: [-0.12, -0.2, -0.28, -0.36] },
      { type: 'shoes', color: '#3a3026' },
    ],
  },
  {
    id: 'boi-caprichoso',
    name: 'Boi Caprichoso',
    shirt: {
      color: '#1446b8', trim: '#ffffff', sleeveColor: '#0f3a9e',
      details: [
        { type: 'zigzag', color: '#ffffff', y: 0.47 },
        { type: 'star', color: '#ffffff', outline: '#0b2a78', y: 0.8, size: 0.2, small: [[0.75, 0.95, 0.06], [-0.75, 0.95, 0.06], [1.4, 0.7, 0.07], [-1.4, 0.7, 0.07], [Math.PI, 0.85, 0.16], [2.4, 0.62, 0.06], [-2.4, 0.62, 0.06]] },
      ],
    },
    pants: '#0b2a78',
    parts: [
      { type: 'boiHorns', color: '#fbfbf6', band: '#1446b8' },
      { type: 'epaulettes', color: '#ffffff' },
      { type: 'ribbonSkirt', colors: ['#1446b8', '#ffffff', '#0b2a78', '#ffffff', '#4f9bff'], band: '#ffffff' },
      { type: 'socks', color: '#ffffff' },
      { type: 'shoes', color: '#0b2a78', strap: '#ffffff' },
    ],
  },
  {
    id: 'docao-felipe',
    name: 'Docão Felipe',
    shirt: {
      color: '#2c2c30', trim: '#1a1a1d', sleeveColor: '#2c2c30',
      details: [{ type: 'diagStripes', color: '#17b394' }],
      logo: { text: 'C!', color: '#f2f2f2', size: 0.11, x: -0.42, y: 0.92 },
    },
    pants: '#131315',
    parts: [
      { type: 'messyHair', color: '#3a2416' },
      { type: 'squareGlasses', color: '#121214' },
      { type: 'sleeveStripes', color: '#17b394' },
      { type: 'shortsStripes', color: '#17b394' },
      { type: 'shoes', color: '#141416', sole: '#f4f4f4', strap: '#f4f4f4' },
    ],
  },
  {
    id: 'docao-matheus',
    name: 'Docão Matheus',
    shirt: { color: '#1a1a1d', trim: '#0e0e10', sleeves: 'long', sleeveColor: '#1a1a1d', details: [{ type: 'hoodie', color: '#0e0e10', zip: '#a8acb2' }] },
    pants: '#121214',
    eyes: { iris: '#1f6b35', ring: '#0f3d1c' },
    parts: [
      { type: 'quiffHair', color: '#2e1c12', side: '#2a1b12' },
      { type: 'beard', color: '#43291a' },
      { type: 'hoodDown', color: '#1a1a1d', inner: '#0b0b0d' },
      { type: 'hoodStrings', color: '#f4f4f4' },
      { type: 'lanyard', color: '#d81e2a', logo: '#d81e2a' },
      { type: 'longPants', color: '#121214' },
      { type: 'shoes', color: '#f4f4f4', sole: '#d4d4d4', strap: '#e2e2e2' },
    ],
  },
];

// Fantasia grátis do Brechó, também na lista de skins (convidado e conta equipam sem comprar).
const faixaItem = itemById('c9');
if (faixaItem && faixaItem.costume) SKINS.push({ id: 'faixa-presidencial', name: faixaItem.name, ...JSON.parse(JSON.stringify(faixaItem.costume)) });

export const DEFAULT_SKIN = 'classico';
export const getSkin = (id) => SKINS.find((s) => s.id === id) || lookToSkin(id) || SKINS[0]; // id também pode ser um visual personalizado ("x1....", ver shared/closet.js)
export const skinOk = (id) => SKINS.some((s) => s.id === id) || isLookCode(id) && !!parseLook(id); // id existente ou visual personalizado bem formado
