// ============================================================
//  BRECHÓ DA PORCA VÉIA 🧺 (loja do Docão): partes de skin à venda (moeda do jogo: Docoins 🪙) e "visual personalizado".
//  Só dados e funções puras: o cliente (prévia, loja) e o Worker (validação, compra, equipar) usam este mesmo arquivo.
//  O visual personalizado vira um CÓDIGO curto de texto (ex.: "x1.3.5.h3.f2.s1") que viaja pela rede no lugar do id da skin.
//  Cores da camiseta e do shorts são grátis (paleta fixa). As PARTES pagas custam Docoins e só entram na mochila (D1).
//  Item com free:true e price 0 é padrão: todo mundo equipa, sem compra e sem linha na mochila.
//  As peças 3D são as que já existem em costumes.js/docao.js, só com cores novas: nada de modelo novo, nada de alterar skins atuais.
// ============================================================
export const CURRENCY = 'Docoins', CURRENCY_ONE = 'Docoin', COIN_ICON = '🪙'; // moeda do jogo (escolhida pelo Matheus)
export const START_COINS = 500; // saldo ao criar a conta. Quem já tinha conta ganha o mesmo valor uma vez (migração 0004).
export const SHOP_NAME = 'Brechó da Porca Véia', SHOP_EMOJI = '🧺', SHOP_BUTTON = 'BRECHÓ'; // nome da loja (escolhido pelo Matheus): título da janela e botão do menu usam estas constantes
export const coinsText = (n) => `${COIN_ICON} ${n | 0} ${(n | 0) === 1 ? CURRENCY_ONE : CURRENCY}`;
export const COLORS = ['#d8261c', '#e8702a', '#f2c94c', '#6fbf3b', '#17b394', '#2b8fd8', '#1446b8', '#7a3fb5', '#e66fa8', '#f4f4f4', '#8a8a8a', '#2c2c30', '#1d1410', '#7a4a24'];
export const SLOTS = [['c', 'Fantasia completa'], ['h', 'Cabeça'], ['f', 'Rosto'], ['n', 'Pescoço'], ['b', 'Corpo'], ['w', 'Cintura'], ['g', 'Mãos'], ['s', 'Pés']];
// Seções da loja que juntam itens (de qualquer espaço). O item aponta com team = id; teamOrder é a ordem no balcão.
export const SHOP_TEAMS = [['tech', 'Time Tech']];
// id = letra do espaço + número. price em Docoins. part = peça 3D (type + opções) já existente no modelo do Docão.
export const ITEMS = [
  { id: 'h1', name: 'Boné do Churrasqueiro', emoji: '🧢', price: 60, part: { type: 'cap', color: '#d8261c', brim: '#7d1f19' } },
  { id: 'h2', name: 'Boné Verde Granja', emoji: '🧢', price: 60, part: { type: 'cap', color: '#203e35', brim: '#12261f' } },
  { id: 'h3', name: 'Fedora do Mafioso do Chiqueiro', emoji: '🎩', price: 150, part: { type: 'fedora', color: '#15151a', band: '#d8261c' } },
  { id: 'h4', name: 'Chapéu de Pescador de Linguiça', emoji: '🎣', price: 110, part: { type: 'bucketHat', color: '#8a8a5c', band: '#5a5a38' } },
  { id: 'h5', name: 'Gorro do Inverno Sulista', emoji: '🧶', price: 90, part: { type: 'roundCap', color: '#2a6f4a', knot: '#f2c94c' } },
  { id: 'h6', name: 'Cabeleira de Roqueiro', emoji: '🎸', price: 180, part: { type: 'longHair', color: '#3b2414' } },
  { id: 'h7', name: 'Cabeleira Pimenta com Faixa', emoji: '🌶️', price: 200, part: { type: 'longHair', color: '#b3261e', headband: '#f4f4f4' } },
  { id: 'h8', name: 'Boné Dourado de Dono da Granja', emoji: '👑', price: 150, part: { type: 'cap', color: '#d4a82a', brim: '#8a6a14' } },
  { id: 'h9', name: 'Boné Rosa Choque', emoji: '🩷', price: 60, part: { type: 'cap', color: '#e66fa8', brim: '#a8487a' } },
  { id: 'h10', name: 'Chapéu de Palha da Roça', emoji: '👒', price: 70, part: { type: 'bucketHat', color: '#e2c97a', band: '#b3261e' } },
  { id: 'h11', name: 'Fone Gamer Neon', emoji: '🎧', price: 130, part: { type: 'headphones', color: '#15151a', accent: '#7dff6a' } },
  { id: 'h12', name: 'Chifrinhos de Boi', emoji: '🐂', price: 160, part: { type: 'boiHorns', color: '#fbfbf6', band: '#1b4fbf' } },
  { id: 'h13', name: 'Topete Rockabilly', emoji: '🎸', price: 140, part: { type: 'quiffHair', color: '#1d1410', side: '#2a1a10' } },
  { id: 'h14', name: 'Cabelo Bagunçado de Madrugada', emoji: '💤', price: 100, part: { type: 'messyHair', color: '#4a2a18' } },
  { id: 'h15', name: 'Gorro de Natal do Chiqueiro', emoji: '🎄', price: 90, part: { type: 'roundCap', color: '#d8261c', knot: '#f4f4f4' } },
  { id: 'h16', name: 'Fedora Branco de Domingo', emoji: '🤍', price: 160, part: { type: 'fedora', color: '#f4f4f4', band: '#15151a' } },
  { id: 'h17', name: 'Capuz de Coelhinho', emoji: '🐰', price: 200, part: { type: 'hood', color: '#f4f4f4', tip: '#e66fa8', cheeks: '#e66fa8' } },
  { id: 'f1', name: 'Óculos de Intelectual', emoji: '👓', price: 50, part: { type: 'glasses', color: '#15151a' } },
  { id: 'f2', name: 'Óculos Escuros de Churrasco', emoji: '🕶️', price: 90, part: { type: 'sunglasses', color: '#15151a', lens: '#1a1a1a' } },
  { id: 'f3', name: 'Óculos Quadrado de Dev', emoji: '🤓', price: 70, part: { type: 'squareGlasses', color: '#121214' } },
  { id: 'f4', name: 'Bigode de Açougueiro', emoji: '🥩', price: 80, part: { type: 'beard', color: '#43291a' } },
  { id: 'f5', name: 'Óculos Radical Azul', emoji: '😎', price: 120, part: { type: 'sunglasses', color: '#d8261c', lens: '#5ad1ff' } },
  { id: 'n1', name: 'Corrente de Porco Rico', emoji: '💰', price: 250, part: { type: 'chain', color: '#d4a82a' } },
  { id: 'n2', name: 'Cachecol Vermelho e Branco', emoji: '🧣', price: 70, part: { type: 'scarf', colors: ['#d8261c', '#f4f4f4'] } },
  { id: 'n3', name: 'Bandana do Churrasco', emoji: '🏴‍☠️', price: 55, part: { type: 'bandana', color: '#d8261c' } },
  { id: 'n4', name: 'Cordão de Crachá', emoji: '🪪', price: 65, part: { type: 'lanyard', color: '#2b5c8a', logo: '#2b5c8a' } },
  { id: 'n5', name: 'Lenço do Deserto', emoji: '🏜️', price: 80, part: { type: 'desertScarf', color: '#c9ad78' } },
  { id: 'b1', name: 'Colete de Pescador', emoji: '🦺', price: 120, part: { type: 'vest', color: '#8a8a5c', pocket: '#5a5a38' } },
  { id: 'b2', name: 'Dragonas Douradas', emoji: '🎖️', price: 130, part: { type: 'epaulettes', color: '#d4a82a' } },
  { id: 'b3', name: 'Faixa Larga do Peão', emoji: '🤠', price: 100, part: { type: 'sash', color: '#6b4a2a', belt: '#3a2412', buckle: '#d4a82a' } },
  { id: 'b4', name: 'Faixas de Lutador', emoji: '🥊', price: 60, part: { type: 'armWraps', color: '#f4f4f4' } },
  { id: 'b5', name: 'Jaqueta Bufante Azul', emoji: '🧥', price: 220, part: { type: 'puffer', color: '#2b5c8a', zipper: '#f4f4f4' } },
  { id: 'w1', name: 'Varinha do Chef', emoji: '🪄', price: 120, part: { type: 'wand', color: '#6b4a2a' } },
  { id: 'w2', name: 'Peixe de Cinto', emoji: '🐟', price: 90, part: { type: 'fish', color: '#2b8fd8' } },
  { id: 'w3', name: 'Espeto Laser Verde', emoji: '⚔️', price: 300, part: { type: 'laserSword', blade: '#7dff6a' } },
  { id: 'g1', name: 'Luvas Brancas', emoji: '🧤', price: 70, part: { type: 'glove', hand: 'both', color: '#f4f4f4' } },
  { id: 'g2', name: 'Luvas Pretas', emoji: '🧤', price: 70, part: { type: 'glove', hand: 'both', color: '#15151a' } },
  { id: 'g3', name: 'Luvas Brilhantes', emoji: '✨', price: 260, part: { type: 'glove', hand: 'both', color: '#f4f4f4', sparkle: true } },
  { id: 'g4', name: 'Luvas Rainbow', emoji: '🌈', weight: 1250, loot: true, part: { type: 'glove', hand: 'both', color: '#ffffff', rainbow: true, sparkle: true } },
  { id: 'g5', name: 'Luvas Docão Gold', emoji: '👑', weight: 2000, loot: true, part: { type: 'glove', hand: 'both', color: '#f3d78a', gold: true, sparkle: true } },
  { id: 's1', name: 'Tênis do Torresmo', emoji: '👟', price: 80, part: { type: 'shoes', color: '#141416', sole: '#f4f4f4' } },
  { id: 's2', name: 'Botinha Vermelha', emoji: '🥾', price: 80, part: { type: 'shoes', color: '#7d1f19', sole: '#f2c94c' } },
  { id: 's3', name: 'Meiões Brancos', emoji: '🧦', price: 40, part: { type: 'socks', color: '#f4f4f4' } },
  { id: 's4', name: 'Tênis Azul Royal', emoji: '👟', price: 80, part: { type: 'shoes', color: '#1446b8', sole: '#f4f4f4' } },
];
// ---------- FANTASIAS COMPLETAS (espaço "c"): trocam camiseta e shorts, e as peças da fantasia continuam. Acessório equipado entra junto e, se for do mesmo tipo, fica por cima. ----------
// costume = mesmo formato de skins.js (shirt, pants, parts, face, eyes), só com peças que o modelo já tem.
ITEMS.push(
  { id: 'c1', name: 'Super Porco', emoji: '🦸', price: 900, costume: { shirt: { color: '#1446b8', trim: '#d8261c', details: [{ type: 'star', color: '#f2c94c', outline: '#7d1f19', size: 0.3 }] }, pants: '#d8261c',
    parts: [{ type: 'robe', color: '#d8261c', lining: '#f2c94c' }, { type: 'glove', hand: 'both', color: '#d8261c' }, { type: 'shoes', color: '#d8261c', sole: '#f2c94c' }] } },
  { id: 'c2', name: 'Ninja do Chiqueiro', emoji: '🥷', price: 750, costume: { shirt: { color: '#15151a', trim: '#15151a', sleeves: 'long', details: [{ type: 'backStripes', color: '#b3261e' }] }, pants: '#15151a',
    parts: [{ type: 'roundCap', color: '#15151a', knot: '#b3261e' }, { type: 'bandana', color: '#b3261e' }, { type: 'sash', color: '#15151a', belt: '#b3261e', buckle: '#8a8a8a' }, { type: 'armWraps', color: '#b3261e' }, { type: 'shoes', color: '#15151a', sole: '#b3261e' }] } },
  { id: 'c3', name: 'Peão de Rodeio', emoji: '🤠', price: 650, costume: { shirt: { color: '#c8102e', trim: '#7d1f19', sleeves: 'long', pattern: { type: 'stripes', colors: ['#c8102e', '#f4f4f4'], count: 10 } }, pants: '#2e3a55',
    parts: [{ type: 'bucketHat', color: '#7a4a24', band: '#3a2412' }, { type: 'bandana', color: '#1446b8' }, { type: 'sash', color: '#6b4a2a', belt: '#3a2412', buckle: '#d4a82a' }, { type: 'shoes', color: '#5a3a1c', sole: '#2a1a0c' }] } },
  { id: 'c4', name: 'Chef Supremo do Rodízio', emoji: '👨‍🍳', price: 600, costume: { shirt: { color: '#f4f4f4', trim: '#d8d8d8', sleeves: 'long' }, pants: '#2c2c30',
    parts: [{ type: 'roundCap', color: '#f4f4f4', knot: '#f4f4f4' }, { type: 'scarf', colors: ['#d8261c', '#f4f4f4'] }, { type: 'vest', color: '#f4f4f4', pocket: '#cfcfcf' }, { type: 'shoes', color: '#15151a', sole: '#f4f4f4' }] } },
  { id: 'c5', name: 'Estrela do Rock', emoji: '🎤', price: 800, costume: { shirt: { color: '#15151a', trim: '#7a3fb5', sleeves: 'long', details: [{ type: 'star', color: '#e66fa8', outline: '#f4f4f4', size: 0.28 }] }, pants: '#7a3fb5',
    parts: [{ type: 'longHair', color: '#e66fa8' }, { type: 'sunglasses', color: '#d4a82a', lens: '#2a1a4a' }, { type: 'chain', color: '#d4a82a' }, { type: 'glove', hand: 'right', color: '#15151a' }, { type: 'shoes', color: '#15151a', sole: '#e66fa8' }] } },
  { id: 'c6', name: 'Capitão Costelinha', emoji: '🏴‍☠️', price: 850, costume: { shirt: { color: '#f4f4f4', trim: '#1446b8', sleeves: 'long', pattern: { type: 'hoops', colors: ['#f4f4f4', '#1446b8'], count: 8 } }, pants: '#2c2c30',
    parts: [{ type: 'fedora', color: '#15151a', band: '#d4a82a' }, { type: 'beard', color: '#2a1a10' }, { type: 'sash', color: '#b3261e', belt: '#3a2412', buckle: '#d4a82a' }, { type: 'epaulettes', color: '#d4a82a' }, { type: 'shoes', color: '#2a1a10', sole: '#15151a' }] } },
  { id: 'c7', name: 'Caipira de Festa Junina', emoji: '🌽', price: 550, costume: { shirt: { color: '#c8102e', trim: '#f2c94c', pattern: { type: 'stripes', colors: ['#c8102e', '#17203a'], count: 12 } }, pants: '#2b5c8a',
    parts: [{ type: 'bucketHat', color: '#e2c97a', band: '#b3261e' }, { type: 'bandana', color: '#f2c94c' }, { type: 'socks', color: '#f4f4f4' }, { type: 'shoes', color: '#5a3a1c', sole: '#2a1a0c' }] } },
  { id: 'c8', name: 'Docão Dourado', emoji: '🏆', price: 1500, costume: { shirt: { color: '#d4a82a', trim: '#8a6a14', logo: { text: 'C!', color: '#fff3c4' } }, pants: '#d4a82a', float: true,
    parts: [{ type: 'fedora', color: '#d4a82a', band: '#8a6a14' }, { type: 'sunglasses', color: '#8a6a14', lens: '#2a1a0a' }, { type: 'chain', color: '#f4f4f4' }, { type: 'epaulettes', color: '#fff3c4' }, { type: 'glove', hand: 'both', color: '#fff3c4', sparkle: true }, { type: 'shoes', color: '#8a6a14', sole: '#fff3c4' }] } },
  { id: 'c9', name: 'Faixa Presidencial', emoji: '🇧🇷', price: 0, free: true, costume: {
    shirt: { color: '#2c333c', trim: '#f4f1ea', sleeves: 'long', sleeveColor: '#2c333c' }, pants: '#1c1f26',
    parts: [
      { type: 'faixa', color: '#009c3b', colors: ['#009c3b', '#ffdf00', '#002776'] },
      { type: 'longPants', color: '#1c1f26' },
      { type: 'shoes', color: '#141416', sole: '#2a2a2e' },
    ] } },
  // Barriguinha: o porco da derrota do Docão Minado (camisa arregaçada, barriga de fora). Cores do desenho; a barriga usa a pele do Docão (peça bellyOut).
  { id: 'c10', name: 'Docão Barriguinha', emoji: '🐷', price: 1000, costume: { shirt: { color: '#b73c28', trim: '#8e2c1e' }, pants: '#2c5f92',
    parts: [{ type: 'bellyOut', roll: '#c44b36', rollDark: '#8e2c1e' }] } },
  // Docão Bigzão: o porco de óculos do castelo (cabelo ondulado, camisa polo marrom, pérola). Time Tech inteiro é de graça.
  { id: 'c11', name: 'Docão Bigzão', emoji: '🤓', price: 0, free: true, team: 'tech', teamOrder: 4, aka: 'Paulo', line: 'Paulo — cabelo ondulado, óculos quadrado, camisa marrom e pérola', costume: {
    shirt: { color: '#3f291c', trim: '#24160e', details: [{ type: 'polo', color: '#24160e', button: '#e6d3b0' }] }, pants: '#243044',
    parts: [
      { type: 'wavyHair', color: '#a56b3c', highlight: '#d7a15a' },
      { type: 'squareGlasses', color: '#121214' },
      { type: 'pearl', color: '#d5dbe3', pearl: '#f7f3ea' },
    ] } },
  // DocHiro: gorro azul, fone preto, moletom marinho com C! e barba rala (conceito do Guilherme Hiroshi). Time Tech inteiro é de graça.
  { id: 'c12', name: 'DocHiro', emoji: '🎧', price: 0, free: true, team: 'tech', teamOrder: 3, aka: 'Hiro', line: 'Gorro azul-claro, fone preto, moletom marinho e barba rala', costume: {
    shirt: { color: '#1a1f2e', trim: '#15151a', sleeves: 'long', sleeveColor: '#1a1f2e',
      details: [{ type: 'hoodie', color: '#15151a', zip: '#a8acb2' }],
      logo: { text: 'C!', color: '#f4f4f4', outline: '#d8261c', size: 0.12, x: -0.28, y: 0.58 } },
    pants: '#15151a',
    parts: [
      { type: 'roundCap', color: '#7EB8D8', band: '#6aa8cc', knot: '#7EB8D8' },
      { type: 'headphones', color: '#15151a', accent: '#1c1c22' },
      { type: 'beard', color: '#2a1a10' },
      { type: 'hoodDown', color: '#1a1f2e', inner: '#12151c' },
      { type: 'hoodStrings', color: '#f4f4f4' },
      { type: 'longPants', color: '#15151a' },
      { type: 'shoes', color: '#b8b4c8', sole: '#f4f4f4', strap: '#f7f6fa' },
    ] } },
  // DocYuri: cabelo bagunçado castanho, bigode fino (sem barba no queixo) e moletom azul com C!. Conceito do Yuri do Nascimento Grigoletti.
  // stubble:false deixa só o bigode 3D da peça beard; a barba por fazer no rosto (docao.js) continua nas outras skins.
  { id: 'c13', name: 'DocYuri', emoji: '💙', price: 0, free: true, team: 'tech', teamOrder: 6, aka: 'Yuri', line: 'Cabelo bagunçado, bigode fino e moletom azul com C!', costume: {
    shirt: { color: '#2b6cb0', trim: '#1e4e8c', sleeves: 'long', sleeveColor: '#2b6cb0',
      details: [{ type: 'hoodie', color: '#1a4f8c', zip: '#d5dde8' }],
      logo: { text: 'C!', color: '#d8261c', outline: '#f7f4ea', size: 0.15, x: -0.62, y: 0.84 } },
    pants: '#1a1c20',
    parts: [
      { type: 'messyHair', color: '#6a4428' },
      { type: 'beard', color: '#1a120c', stubble: false },
      { type: 'longPants', color: '#1a1c20' },
      { type: 'shoes', color: '#141416', sole: '#e8dfd0', strap: '#141416' },
    ] } },
  // DocOny: camiseta neon de manga curta, shorts cinza, cabelo bagunçado, bigode + mosquinha, sapato escuro e raquete nas costas. Conceito do Ony.
  // stubble:false = só o bigode 3D; soul:true acrescenta a mosquinha sem pintar barba no queixo (não muda as outras skins).
  { id: 'c14', name: 'DocOny', emoji: '🎾', price: 0, free: true, team: 'tech', teamOrder: 5, aka: 'Ony', line: 'Camiseta neon, shorts cinza e raquete nas costas', costume: {
    shirt: { color: '#d4ff00', trim: '#8fbf00' }, pants: '#3a3e46',
    parts: [
      { type: 'messyHair', color: '#3b2618' },
      { type: 'beard', color: '#3a2818', stubble: false, soul: true },
      { type: 'beachRacket', face: '#e10600', rim: '#141416', accent: '#2fce4a' },
      { type: 'shoes', color: '#16181c', sole: '#3a3c40' },
    ] } },
  // Time Tech de graça: Matheus, Felipe e JanorDoc já eram skins padrão (skins.js). O visual do Brechó copia a malha; o id da lista continua o mesmo.
  { id: 'c15', name: 'Matheus', emoji: '🧔', price: 0, free: true, team: 'tech', teamOrder: 1, line: 'Topete, bigode, moletom preto e crachá', costume: {
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
    ] } },
  { id: 'c16', name: 'Felipe', emoji: '👓', price: 0, free: true, team: 'tech', teamOrder: 2, line: 'Cabelo bagunçado, óculos quadrado e listra verde-água', costume: {
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
    ] } },
  { id: 'c17', name: 'JanorDoc', emoji: '💇', price: 0, free: true, team: 'tech', teamOrder: 7, line: 'Cabelão, boné preto, óculos escuros e camisa de futebol', costume: {
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
  } },
);
// Docão Coelho: cabeça de coelho (capuz de pelúcia com orelhonas, dentinhos e bigodes) + dreads com contas rasta. Fantasia paga do Brechó.
ITEMS.push(
  { id: 'c18', name: 'SARKAO', emoji: '🐰', price: 0, free: true, line: 'Cabeça de coelho com orelhonas, dentinhos e dreads com contas', costume: {
    shirt: { color: '#2a7a3a', trim: '#f2c230', logo: { text: 'C!', color: '#f2c230' } }, pants: '#2c2c30',
    parts: [
      { type: 'dreads', color: '#3a2414', beads: ['#d81e2a', '#f2c230', '#2a9a3a'] },
      { type: 'rabbitHead', color: '#f1ece4', inner: '#f3a6b8', nose: '#f07a96' },
      { type: 'shoes', color: '#f4f4f4', sole: '#2a2a2e', strap: '#d81e2a' },
    ] } },
);
// Docão Boizão: boi comum (marrom, chifres creme), nada de Caprichoso. Fantasia paga do Brechó.
ITEMS.push(
  { id: 'c19', name: 'Boizão', emoji: '🐂', price: 0, free: true, line: 'Cabeça de boi com chifrões, focinho largo e camisa de peão', costume: {
    shirt: { color: '#8a5a2b', trim: '#3a2414' }, pants: '#3b4a63',
    parts: [
      { type: 'bullHead', color: '#6b3e22', dark: '#2b1a10', horn: '#efe2c4', muzzle: '#3a2a22' },
      { type: 'shoes', color: '#5a3518', sole: '#2a1a10', strap: '#3a2414' },
    ] } },
);
// Docão Él Big: bonezinho preto, jaqueta escura e camisa com BIG 67 nas costas. Fantasia paga do Brechó.
ITEMS.push(
  { id: 'c20', name: 'Él Big', emoji: '🧢', price: 0, free: true, line: 'Bonezinho preto e camisa escura com BIG 67 nas costas', costume: {
    shirt: { color: '#1c1c20', trim: '#0e0e10', sleeveColor: '#26262b', details: [{ type: 'backNumber', name: 'BIG', number: 67, color: '#f4f4f4', outline: '#c9a23a', nameY: 0.92, nameSize: 44, numY: 0.62, numSize: 96 }] },
    pants: '#2a2f3a',
    parts: [
      { type: 'cap', color: '#141416', brim: '#0c0c0e', scale: 1.1, lift: 0.04 },
      { type: 'hideTail' },
      { type: 'shoes', color: '#f4f4f4', sole: '#141416', strap: '#141416' },
    ] } },
);
// Docão Neymar: camisa amarela da Seleção com NEYMAR -10 nas costas, de muleta e gesso na perna. Fantasia do Brechó.
ITEMS.push(
  { id: 'c21', name: 'Neymar', emoji: '🩼', price: 1, line: 'Pronto Pedro, o Neymar do jeito que ele é, camisa -10', costume: {
    shirt: { color: '#f7d417', trim: '#0f8a3c', sleeveColor: '#f7d417', logo: { text: 'BR', color: '#0f8a3c' }, details: [{ type: 'backNumber', name: 'NEYMAR', number: '-10', color: '#0f8a3c', outline: '#1d3f9a', nameY: 0.96, nameSize: 36, numY: 0.7, numSize: 80 }] },
    pants: '#1d3f9a',
    parts: [
      { type: 'socks', color: '#f4f4f4' },
      { type: 'legCast' },
      { type: 'crutch' },
      { type: 'babyMavi' },
      { type: 'hideTail' },
      { type: 'shoes', color: '#f4f4f4', sole: '#0f8a3c', strap: '#f7d417' },
    ] } },
);
// ---------- DANÇAS (espaço "d"): não entram no visual (código), vão pra mochila e a escolhida é a do botão B. As 3 de sempre continuam grátis. ----------
ITEMS.push(
  { id: 'd1', name: 'Escovinha', emoji: '🪥', price: 400, dance: 'floss', line: 'Braços varrendo o quadril' },
  { id: 'd2', name: 'Robozão da Granja', emoji: '🤖', price: 450, dance: 'robot', line: 'Travadinho e mecânico' },
  { id: 'd3', name: 'Galinha Maluca', emoji: '🐔', price: 350, dance: 'chicken', line: 'Asinhas e pescoço de galinha' },
  { id: 'd4', name: 'Espirro do Porquinho', emoji: '🤧', price: 300, dance: 'dab', line: 'Atchim no cotovelo' },
  { id: 'd5', name: 'Rebolado do Leitão', emoji: '💃', price: 400, dance: 'wiggle', line: 'Quadril solto e mãos pro alto' },
  { id: 'd6', name: 'Helicóptero', emoji: '🚁', price: 500, dance: 'spin', line: 'Gira, gira, gira' },
  { id: 'd7', name: 'Passinho do Jamal', emoji: '🕺', price: 450, dance: 'jamal', line: 'Pé cruzando e ombro gingando' },
  { id: 'd8', name: 'Macarena', emoji: '🎶', price: 400, dance: 'macarena', line: 'Braço, braço, ombro, cabeça e rebola' },
);
// Facas (espaço "k"): não entram no visual do Docão. Cada modelo tem as mesmas cores; quem equipa escolhe uma.
export const KNIFE_MODELS = [
  { knife: 'skeleton', name: 'Skeleton Knife', emoji: '🔪', line: 'Três furos pequenos na lâmina e um furo grande no meio.' },
  { knife: 'karambit', name: 'Karambit', emoji: '🪝', line: 'Garra curva e argola no dedo.' },
  { knife: 'bayonet', name: 'Bayonetta', emoji: '🗡️', line: 'Baioneta: lâmina reta, guarda cruzada e anel do cano.' },
  { knife: 'butterfly', name: 'Butterfly', emoji: '🦋', line: 'Cabo duplo: a lâmina gira no pino e abre.' },
];
// Peso = raridade no Caixote (não é preço). Skin de arma/faca não se compra: loot:true.
export const KNIFE_COLORS = [
  { finish: 'factory', name: 'Fábrica', weight: 500, line: 'Cor de fábrica.' },
  { finish: 'rusty', name: 'Rusty', weight: 750, line: 'Aspecto enferrujado.' },
  { finish: 'rainbow', name: 'Rainbow', weight: 1250, line: 'Aspecto de arco-íris.' },
  { finish: 'sapphire', name: 'Sapphire', weight: 1000, line: 'Aspecto de safira.' },
  { finish: 'emerald', name: 'Emerald', weight: 1000, line: 'Aspecto de esmeralda.' },
  { finish: 'ruby', name: 'Ruby', weight: 1000, line: 'Aspecto de rubi.' },
  { finish: 'camo', name: 'Camuflagem', weight: 500, line: 'Verde de exército, manchas de camuflagem.' },
  { finish: 'obsidian', name: 'Obsidian', weight: 1250, line: 'Preto metálico com detalhes roxos.' },
];
const KNIFE_ID = {
  skeleton: ['k1', 'k4', 'k7', 'k10', 'k13', 'k16', 'k25', 'k29'],
  karambit: ['k2', 'k5', 'k8', 'k11', 'k14', 'k17', 'k26', 'k30'],
  bayonet: ['k3', 'k6', 'k9', 'k12', 'k15', 'k18', 'k27', 'k31'],
  butterfly: ['k19', 'k20', 'k21', 'k22', 'k23', 'k24', 'k28', 'k32'],
};
ITEMS.push(...KNIFE_MODELS.flatMap((model) => KNIFE_COLORS.map((color, i) => ({
  id: KNIFE_ID[model.knife][i],
  name: `${model.name} · ${color.name}`,
  emoji: color.finish === 'camo' ? '🪖' : model.emoji,
  weight: color.weight,
  loot: true,
  knife: model.knife,
  finish: color.finish,
  line: `${model.line} ${color.line}`,
}))));
// Sniper Torresmo (espaço "t"): não entra no código do visual. A equipada troca a pintura da arma.
export const SNIPER_SKINS = [
  { id: 't1', name: 'A Docão Lore', emoji: '🐉', weight: 2000, loot: true, gun: 'sniper', paint: 'lore', sniper: 'lore', line: 'Dourada no jeito da Dragon Lore, com dragão, focinho, orelha e o C! do Docão.' },
];
ITEMS.push(...SNIPER_SKINS);
// Pinturas de arma do Caixote da Primeira Safra. sniper também preenche o campo sniper (a coluna da conta continua uma só).
const GUN_LABEL = { pistol: 'Pistola', sniper: 'Sniper Torresmo', p90: 'P90', carabina: 'Carabina', rifle: 'Fuzil' };
const GUN_PAINTS = [
  { paint: 'camo', name: 'Camuflagem', weight: 500, emoji: '🪖', line: 'Verde de exército, manchas de camuflagem.', guns: ['pistol', 'sniper', 'p90', 'carabina', 'rifle'] },
  { paint: 'rust', name: 'Ferrugem', weight: 750, emoji: '🪨', line: 'Aspecto enferrujado.', guns: ['pistol', 'sniper', 'p90', 'carabina', 'rifle'] },
  { paint: 'waves', name: 'Ferrugem Waves', weight: 750, emoji: '🌊', line: 'Tema aquático, com desenho de onda.', guns: ['pistol', 'sniper', 'p90', 'carabina', 'rifle'] },
  { paint: 'rainbow', name: 'Rainbow', weight: 1250, emoji: '🌈', line: 'Arco-íris na Pistolinha.', guns: ['pistol'] },
  { paint: 'gold', name: 'Gold Docão', weight: 2000, emoji: '👑', line: 'Fuzil dourado com focinho, orelha e o C! do Docão.', guns: ['rifle'] },
  { paint: 'obsidian', name: 'Obsidian', weight: 1000, emoji: '🖤', line: 'Preto metálico com detalhes roxos.', guns: ['pistol', 'sniper', 'p90', 'carabina', 'rifle'] },
  { paint: 'onca', name: 'Onça', weight: 500, emoji: '🐆', line: 'Amarelo de onça com rosetas pretas.', guns: ['pistol', 'sniper', 'p90', 'carabina', 'rifle'] },
  { paint: 'cheers', name: 'Cheers Base', weight: 750, emoji: '🔴', line: 'Vermelho da Cheers com o símbolo C!.', guns: ['pistol', 'sniper', 'p90', 'carabina', 'rifle'] },
];
GUN_PAINTS.forEach((paint) => paint.guns.forEach((gun) => {
  const it = {
    id: 'a' + (ITEMS.filter((i) => i.gun && i.id[0] === 'a').length + 1),
    name: `${GUN_LABEL[gun]} · ${paint.name}`,
    emoji: paint.emoji,
    weight: paint.weight,
    loot: true,
    gun,
    paint: paint.paint,
    line: paint.line,
  };
  if (gun === 'sniper') it.sniper = paint.paint;
  ITEMS.push(it);
}));
// Linhas que já existiam em outra arma ou na faca, e não tinham o Fuzil Pururuca. Entram no fim para não deslocar os ids a1–a32.
const RIFLE_GAPS = [
  { paint: 'rainbow', name: 'Rainbow', weight: 1250, emoji: '🌈', line: 'Arco-íris no Fuzil Pururuca.' },
  { paint: 'sapphire', name: 'Sapphire', weight: 1000, emoji: '💎', line: 'Azul de safira no Fuzil Pururuca.' },
  { paint: 'emerald', name: 'Emerald', weight: 1000, emoji: '💚', line: 'Verde de esmeralda no Fuzil Pururuca.' },
  { paint: 'ruby', name: 'Ruby', weight: 1000, emoji: '♦️', line: 'Vermelho de rubi no Fuzil Pururuca.' },
  { paint: 'lore', name: 'A Docão Lore', weight: 2000, emoji: '🐉', line: 'Dourada no jeito da Dragon Lore, no Fuzil Pururuca.' },
];
for (const paint of RIFLE_GAPS) {
  ITEMS.push({
    id: 'a' + (ITEMS.filter((i) => i.gun && i.id[0] === 'a').length + 1),
    name: `Fuzil · ${paint.name}`,
    emoji: paint.emoji,
    weight: paint.weight,
    loot: true,
    gun: 'rifle',
    paint: paint.paint,
    line: paint.line,
  });
}
for (const it of ITEMS) it.slot = it.id[0];
export const COSTUME_SLOT = 'c', DANCE_SLOT = 'd', KNIFE_SLOT = 'k';
export const isLookSlot = (k) => SLOTS.some(([x]) => x === k);
export const danceItems = () => ITEMS.filter((i) => i.slot === DANCE_SLOT);
export const itemForDance = (dance) => ITEMS.find((i) => i.dance === dance) || null;
export const itemById = (id) => ITEMS.find((i) => i.id === id) || null;
export const GUN_GROUPS = [['pistol', 'Pistola'], ['sniper', 'Sniper Torresmo'], ['p90', 'P90'], ['carabina', 'Carabina'], ['rifle', 'Fuzil']];
export const GUN_EQUIP_KEYS = ['pistol', 'p90', 'carabina', 'rifle']; // a Torresmo fica na coluna sniper
export const knifeKind = (id) => { const i = itemById(id); return (i && i.knife) || ''; };
export const knifeFinish = (id) => { const i = itemById(id); return (i && i.finish) || ''; };
export const sniperKind = (id) => { const i = itemById(id); return (i && i.sniper) || ''; };
export const gunKey = (id) => { const i = itemById(id); return (i && i.gun) || ''; };
export const gunPaint = (id) => { const i = itemById(id); return (i && i.paint) || ''; };
export function parseGuns(raw) {
  let o = null; try { o = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { o = null; }
  const out = {};
  if (!o || typeof o !== 'object') return out;
  for (const k of GUN_EQUIP_KEYS) { const id = o[k]; if (typeof id === 'string' && gunKey(id) === k) out[k] = id; }
  return out;
}
export const teamItems = (team) => ITEMS.filter((i) => i.team === team).sort((a, b) => (a.teamOrder | 0) - (b.teamOrder | 0) || (a.id < b.id ? -1 : 1));
export const itemPrice = (id) => { const i = itemById(id); return i && !i.loot && i.price > 0 ? i.price : 0; };
export const itemWeight = (id) => { const i = itemById(id); return i && i.weight > 0 ? i.weight : 0; };
// Padrão de graça: não passa pela compra nem precisa de linha na mochila. Preço 0 sozinho também conta, pra não cobrar por engano.
// Skin de caixote (loot) nunca é grátis: sem a linha na mochila, não equipa.
export const isLootItem = (id) => { const i = itemById(id); return !!(i && i.loot); };
export const isFreeItem = (id) => { const i = itemById(id); return !!(i && !i.loot && (i.free || !(i.price > 0))); };

// ---------- visual personalizado ----------
export const LOOK_PREFIX = 'x1.';
const LOOK_RE = /^x1\.[0-9a-d]\.[0-9a-d](\.[a-z][0-9]{1,2}){0,8}$/;
export const DEFAULT_LOOK = { shirt: 0, pants: 12, items: {} }; // camiseta vermelha, shorts escuro (igual ao Clássico), sem partes
export const isLookCode = (s) => typeof s === 'string' && s.length <= 48 && LOOK_RE.test(s);
export function encodeLook(look) {
  const sh = Math.max(0, Math.min(COLORS.length - 1, look.shirt | 0)), pn = Math.max(0, Math.min(COLORS.length - 1, look.pants | 0));
  const its = SLOTS.map(([k]) => look.items && look.items[k]).filter((id) => id && itemById(id) && isLookSlot(itemById(id).slot));
  return LOOK_PREFIX + sh.toString(16) + '.' + pn.toString(16) + its.map((i) => '.' + i).join('');
}
// Devolve { shirt, pants, items:{slot:id} } ou null se o código for inválido (formato, cor fora da paleta, item inexistente, dois itens no mesmo espaço).
export function parseLook(code) {
  if (!isLookCode(code)) return null;
  const f = code.split('.'); const shirt = parseInt(f[1], 16), pants = parseInt(f[2], 16);
  if (!(shirt < COLORS.length) || !(pants < COLORS.length)) return null;
  const items = {};
  for (const id of f.slice(3)) { const it = itemById(id); if (!it || !isLookSlot(it.slot) || items[it.slot]) return null; items[it.slot] = id; }
  if (encodeLook({ shirt, pants, items }) !== code) return null; // só a forma canônica (ordem dos espaços fixa)
  return { shirt, pants, items };
}
export const lookItemIds = (code) => { const l = parseLook(code); return l ? Object.values(l.items) : []; };
// Skin pronta pro modelo (mesmo formato de skins.js). O id é o próprio código.
export function lookToSkin(code) {
  const l = typeof code === 'string' ? parseLook(code) : code; if (!l) return null;
  const cid = l.items[COSTUME_SLOT];
  if (cid) {
    const c = JSON.parse(JSON.stringify(itemById(cid).costume));
    const extras = Object.entries(l.items).filter(([slot]) => slot !== COSTUME_SLOT).map(([, id]) => ({ ...itemById(id).part }));
    const types = new Set(extras.map((p) => p.type));
    c.parts = [...(c.parts || []).filter((p) => !types.has(p.type)), ...extras];
    return { ...c, id: typeof code === 'string' ? code : encodeLook(l), name: itemById(cid).name, custom: true };
  }
  const parts = Object.values(l.items).map((id) => ({ ...itemById(id).part }));
  return { id: typeof code === 'string' ? code : encodeLook(l), name: 'Visual personalizado', custom: true,
    shirt: { color: COLORS[l.shirt], trim: '#1d1410', logo: { text: 'C!', color: '#f5e6d0' } }, pants: COLORS[l.pants], parts };
}
export const priceOfLook = (code, owned = []) => lookItemIds(code).filter((i) => !owned.includes(i)).reduce((s, i) => s + itemPrice(i), 0);

// ---------- ganho de Docoins (regras; quem aplica é o servidor) ----------
export const EARN = {
  killHuman: 2, killBot: 1,        // por abate (adversário humano / bot ou zumbi)
  finish: 10, win: 15,             // fim de partida jogada (>= minSecs) e vitória
  invWave: 3, invWin: 25,          // Invasão: por wave alcançada e vitória
  minSecs: 60,                     // partida precisa ter durado isso pra o jogador ganhar bônus de fim
  matchCap: 80,                    // máximo por partida
  dayCap: 400,                     // máximo por dia (dia UTC) por conta
};
