// Narrador do Modo história. Uma fala por wave, lida no começo dela.
// A invasão clássica não importa este arquivo. As waves 21–30 só tocam se a noite continuar.

export const STORY_LINES = [
  'A Hotmilk apagou as luzes sozinha. O leite da geladeira já tinha coalhado antes de vocês atravessarem a porta.',
  'Os corredores repetem um passo que não é o de vocês. O prédio aprendeu o nome da Cheers e agora chama baixinho.',
  'A névoa entrou pela porta da frente como se tivesse chave. O turno da noite não atende mais.',
  'As câmeras do saguão mostram vocês duas vezes. A segunda imagem não pisca.',
  'A corrupção escolheu o primeiro corpo. Ele sobe do fundo do prédio com a boca cheia de leite preto.',
  'As paredes começam a suar. O que escorre tem cheiro de festa que acabou do jeito errado.',
  'Um rádio no estoque ainda toca a musiquinha da loja. A letra mudou. Agora ela pede para vocês ficarem.',
  'Os quadros do corredor sorriram juntos. Nenhum daqueles Docões está vivo.',
  'A barraca da sorte gira sem ninguém por perto. Toda vez o prêmio é o mesmo: mais noite.',
  'O segundo monstro conhece a cozinha. Alguém alimentou essa coisa aqui dentro.',
  'As luzes de emergência desenham uma palavra no chão. Não leiam em voz alta.',
  'O interfone chama com a voz de um amigo. O amigo está ao lado de vocês, e está calado.',
  'A névoa fecha o campus. Do lado de fora, a cidade já esqueceu que a Hotmilk existia.',
  'Os cascos no andar de cima não descem a escada. Eles nascem no teto.',
  'O terceiro corpo corrompido ainda usa o crachá de um gerente. Ele conhece cada sala melhor do que vocês.',
  'O leite nas canecas ferveu sem fogo. Quem bebeu ontem caminha hoje no meio da horda.',
  'O prédio conta as waves junto com vocês. E está com pressa de chegar na última.',
  'As janelas mostram o dia. É mentira. Dentro da Hotmilk a noite não andou um minuto.',
  'A corrupção para de se esconder. Ela veste a marca da Cheers e anda no meio de vocês.',
  'O fogo sobe pelas paredes. A Hotmilk queima, e mesmo assim a horda não sai. Esta noite não aceita um fim.',
  'Vocês ficaram. As crias do Barriguinha ouviram isso e cercaram o prédio. O menor veio na frente.',
  'A noite reabriu porque o prédio foi atendido. O agradecimento dele é mais morto no corredor.',
  'Cada sala que estava quieta agora respira. O que esperava no escuro saiu com fome.',
  'A sinuca do segundo andar virou altar. Eles batem o taco no feltro e chamam o nome de vocês.',
  'O Oclinhos sobe com o taco gigante e a camisa do link. A mesa inteira pode cair em quem ainda está de pé.',
  'Depois do altar, o campus fica quieto por um segundo. É nesse segundo que a corrupção troca de pele.',
  'Os Docões das fotos começam a sair das molduras. A roupa é familiar. O resto, não.',
  'A horda para de imitar zumbi de filme. Agora imita jogador. Mira, atira, e o pente não acaba.',
  'As skins do Docão Shooter atravessaram a porta. Vestem o que vocês vestem e atiram de volta.',
  'O Big da Cheers foi o último a ceder. Libertem ele, ou a Hotmilk fica presa nesta noite para sempre.',
];

export function storyLine(wave) {
  const i = (wave | 0) - 1;
  return i >= 0 && i < STORY_LINES.length ? STORY_LINES[i] : '';
}
