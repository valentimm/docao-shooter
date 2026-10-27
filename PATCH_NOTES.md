# 🐷 Docão Shooter — Patch Notes

Jogue em **https://docao.mvalentim.dev**

---

## v1.28 — DocHiro no Brechó 🎧🐷 (27/10/2026)
🎧 **DOCHIRO CHEGOU DE FONE.** Fantasia nova no Brechó da Porca Véia, a **1000 Docoins** (o mesmo da Barriguinha e do Bigzão): gorro azul-claro, fone preto por cima, moletom marinho com o **C!** no bolso, calça escura, tênis claro e barba rala no queixo. Id `c12`. O desenho é do **Guilherme Hiroshi** — o porco só emprestou o focinho. Clica no cartão pra ver antes de comprar; o COMPRAR continua pedindo confirmação.
💸 **E o bolso do Matheus?** O catálogo é o mesmo arquivo do Worker (`shared/closet.js`). Sem migration, sem Durable Object novo. O fone não cobra mensalidade.

## v1.27 — Docão Bigzão no Brechó 🤓🐷 (27/10/2026)
🤓 **DOCÃO BIGZÃO.** Fantasia nova no Brechó da Porca Véia, a **1000 Docoins** (o mesmo da Barriguinha): cabelo castanho ondulado, óculos quadrado preto, camisa polo marrom e cordão de pérola. Id `c11`. Clica no cartão pra ver no porco antes de comprar; o COMPRAR continua pedindo confirmação.
💸 **E o bolso do Matheus?** O catálogo é o mesmo arquivo do Worker (`shared/closet.js`). Sem migration, sem Durable Object novo.

## v1.26 — B de Bala na Kill Cam 🔫📹🐷 (26/10/2026)
🙏 **FOI MAL, GRANJA.** No v1.25 a gente limpou a kill cam e a **ficha de armas** sumiu junto, e vocês ficaram sem trocar de arma morto. O Docão ouve a comunidade: voltou, sem tampar a cara de quem te furou.
🔫 **Aperta B:** morto na kill cam, **B** abre e fecha a ficha de armas. Em cima do tempo do **Renasce** fica escrito **B — armas** pra ninguém esquecer.
⎋ **Esc fecha a ficha** sem abrir a pausa. Vivo, o **B** continua igualzinho. No **X1** não tem atalho (lá a arma é sorteada). Veio no **PR #29**.
💸 **E o bolso do Matheus?** Só navegador. Zero Worker, zero Durable Object.

## v1.25 — Kill Cam Limpa 📹🐷 (26/10/2026)
📹 **AGORA DÁ PRA VER QUEM TE FUROU.** Morreu e a **ficha de armas** (#deathpick) subia na cara, tampando a kill cam inteira. Você caía e nem sabia qual porco tinha sido. Fofoca sem rosto não vale.
🐷 **Some na hora certa:** enquanto a câmera está no assassino, a ficha some. Fica só o **Renascer** e o **nome de quem te matou** no canto. Placar, chat e killfeed continuam no lugar.
🔁 **Renasceu, voltou tudo:** depois do respawn o HUD aparece de novo, normalzinho. Hotfix do **PR #28**.
💸 **E o bolso do Matheus?** Só mexeu no navegador. Zero Worker, zero Durable Object. Barato como lavagem de ontem.

## v1.24 — X1 no Curral + Barriguinha no Brechó 🔫🐷 (26/10/2026)
🔫 **X1 · DUELO NO CURRAL.** O **Paulo** (@paulo-cheers) mandou o **PR #26** e abriu a porteira do bang-bang: modo **X1**, no máximo **2** porcos, mapa pequeno sorteado, cada um nascendo de um lado. Vence quem fizer **10 abates** primeiro. No chão só tem munição (sem vida), e os dois usam a **mesma arma**, que sorteia de novo toda vez que alguém cai (no 10º abate não troca: é hora da foto). Offline contra 1 bot e online com sala de 2. Se o anfitrião tenta meter X1 com 3+ na sala, o servidor trava a troca e o start: **"X1 é duelo: só cabem 2 jogadores."**
🐷 **DOCÃO BARRIGUINHA NO BRECHÓ.** Fantasia completa a **1000 Docoins**: camisa vermelha arregaçada, shorts azul e a **barriga de fora**, igual o porco da derrota do Minado. Id `c10` (a Faixa Presidencial grátis continua no `c9`).
🛒 **Confirmação antes de torrar Docoin.** Todo **COMPRAR** do Brechó agora pergunta **"Deseja comprar [item] por X Docoins?"** — Cancelar, Esc ou clique fora não gasta nada.
💸 **E o bolso do Matheus?** Worker atualizado pro X1 e pro catálogo novo. Sem Durable Object novo.

## v1.23 — Faixa e Bolso Cheio 🇧🇷🪙🐷 (26/10/2026)
🇧🇷 **O DOCÃO VIROU PRESIDENTE.** Entrou a fantasia **Faixa Presidencial**, grátis e de graça mesmo: terno escuro, calça, sapato e a faixa verde-amarela-azul no peito, do ombro direito até o quadril esquerdo, com o brasão no meio. Aparece no **Trocar visual** e no **Brechó** como **GRÁTIS / PADRÃO** — convidado e conta logada já podem vestir, sem gastar Docoin e sem botão de compra.
🪙 **Bolso com 500 na entrada.** Conta nova já nasce com **500 Docoins**. Quem já tinha conta ganhou **+500** de uma vez (as quatro contas que existiam no Brechó). Preços do Brechó continuam iguais: Super Porco 900, Docão Dourado 1500, e o resto no mesmo lugar.
💸 **E o bolso do Matheus?** Teve migration no D1 e deploy do Worker (salvar o visual grátis e o saldo inicial). Sem Durable Object novo e sem sala a mais. Barato como discurso de posse.

## v1.22 — Coice na Medida 🎯🐷 (26/10/2026)
🎯 **ACABOU A MOLEZA DO SPRAY.** O **Felipe** (@felipe-cheers) mandou o **PR #23** e foi pro estande de tiro calibrar o coice das armas, uma por uma, e ainda testou tudo antes de entregar:
📈 **Spray que dá pra aprender:** cada arma agora sobe sempre do mesmo jeito. Acabou o tranco aleatório de sorteio de quermesse: treinou o puxão, acertou o puxão. Parou de atirar, a mira volta suave pro lugar. E se você já corrigiu a mira no mouse, o jogo **não puxa de volta** contra a sua mão.
🔫 **Commando da Granja:** era "recuo quase zero", rajada reta feito régua de pedreiro. Agora a rajada **sobe** e pede compensação (recoil 0,002 → 0,025). Dano e cadência continuam iguais, só ficou honesta.
🐗 **Metralhadora do Chiqueiro:** 100 balas de fita e agora com coice de porco bravo (0,012 → 0,032). Segura firme ou vai pintar o teto do celeiro.
🔭 **Canhão e Carabina da Granja sem luneta:** o tranco no quadril ficou bem maior, e a **dispersão sem luneta** das snipers abriu bastante. O "noscope de quermesse" virou loteria de verdade. **Com luneta, nada muda**: quem mira direitinho continua acertando do mesmo jeito. O Torresmo segue sendo o pior no quadril, por tradição.
🧪 Vieram testes novos de recoil, de entrada do mouse e um teste no navegador com e sem luneta. Ninguém mais vai mexer no coice sem a régua do Felipe apitar.
💸 **E o bolso do Matheus?** Tudo roda no navegador. O servidor da Cloudflare nem sabe que a arma pula. Zero centavo a mais.

## v1.21 — Docão Minado 💣🐷 (25/10/2026)
💣 **TEM COISA ENTERRADA, E VOCÊ ESCOLHE O QUÊ.** O **Paulo** (@paulo-cheers) mandou o **PR #22** e abriu mais uma barraca na quermesse: o **Docão Minado**, campo minado clássico com focinho de fazenda. Fica em **Ver outros jogos**, junto do Tênis, do Snooker e do caminho de volta pro Truco.
🫙 **A bomba é a sua:** antes de pisar, escolhe o que está no chão — **Botijão**, **Copo Bomba**, **Granada**, **Pau de choque** ou **Ovo**. O número da casa conta quantos daquele trem tem nos vizinhos.
📐 **Tamanho e formato, os dois, à vontade:** **Chiqueirinho** (9×9), **Granja** (16×16) e **Fazendona** (30×16). E o chão muda de forma: **Cercado**, **Lago**, **Celeiro**, **Silhueta do Docão**, **Ferradura**, **Trilha do milharal**, **Raquete** (a do Tênis), **Mesa do Snooker** (com as caçapas) e **Leque do Truco** (três cartas). Qualquer tamanho combina com qualquer formato.
🚩 O primeiro passo nunca estoura. Bandeirinha marca a desconfiança. Clicar num número já aberto limpa o resto, se as bandeirinhas fecharem a conta.
🐷 **Pisou?** A partida para e a frase é esta, com todas as letras: **o Barriguinha te pegou.** Camisa arregaçada, barriga de fora, na pose — desenho de porco, do focinho ao pé.
💸 **E o bolso do Matheus?** O minado roda inteiro no navegador. O servidor do tiroteio nem fica sabendo. Barato como bandeirinha de festa junina.

## v1.20.1 — Macarena no Chiqueiro 🎶🐷 (24/10/2026)
🎶 **DALE A TU CUERPO ALEGRÍA, MACARENA!** O Brechó mal abriu e a Porca Véia já trouxe mais duas danças pro balcão:
🕺 **Passinho do Jamal** (450 🪙): pé cruzando, ombro gingando, chutinho pra lá e pra cá. O baile funk chegou no chiqueiro.
🎶 **Macarena** (400 🪙): braço, braço, ombro, cabeça, rebola e dá a voltinha. Igual na festa de firma, só que com rabinho enrolado.
🎯 **Desafio que "não contava":** fomos atrás de cada abate de cabeça, da sala até o cofrinho, e a conta está certa. O pulo do gato: **desafio e Docoin só valem em partida online, com a conta logada** (sala só com bots também vale). Offline e Treino não contam, e agora o painel do menu e o fim da partida offline **avisam isso com todas as letras**. E quem sai da sala no meio já vê o progresso e o saldo atualizados no menu, sem precisar recarregar a página.
🧊 **Docão congelado:** abriu a **bancada do Arsenal** no menu, fechou a caixa pelo botão e foi jogar? A bancada continuava aberta escondida e comia o **W e o S** a partida inteira. Agora ela fecha sozinha. E o Enter que te faz renascer não abre mais o chat sem querer, que aí o WASD ia virar textão na caixinha.
📸 **Câmera da vitória com distância de fotógrafo:** quem ganhava mirando de luneta levava o zoom pra dança e só via o focinho do Docão. Agora a câmera volta pro normal, recua e sobe um pouco: dá pra ver o Docão inteiro, do casco ao chapéu (até o Dourado flutuando), no PC e no celular deitado.
💸 **E o bolso do Matheus?** Nenhuma sala nova e nenhuma mensagem a mais na partida. O único extra é uma conferida no saldo quando você sai da sala no meio, o mesmo que já acontecia no fim da partida. A Macarena é de graça pro servidor.

## v1.20 — Brechó da Porca Véia 🧺🐷 (24/10/2026)
🧺 **A PORCA VÉIA ABRIU O BRECHÓ!** Quem tem conta agora tem onde torrar dinheiro. Botão **🧺 BRECHÓ** no menu, e o caixa só aceita a moeda da casa:
🪙 **Docoin:** só se ganha **jogando** (abate, fim de partida, vitória e wave da Invasão), com teto de 80 por partida e 400 por dia, que porco não é agiota. E não, Docoin não cai no chão igual bacon: vai direto pro cofrinho.
🎯 **3 desafios diários:** todo dia à **meia-noite de Brasília** chegam 3 desafios novos (um fácil, um médio e um difícil), sorteados de um banco de **60** que passa por todos os modos online. Plantar botijão, segurar zona, derrubar zumbi, chamar killstreak... Completou, a Docoin cai na hora, **sem teto**.
📋 **Desafios no menu principal:** os 3 do dia aparecem logo na tela inicial, com barra de progresso, prêmio e ✓ quando você completa. Ninguém mais esquece de fazer a lição de casa.
🎭 **8 fantasias completas**, estilo Fortnite: Super Porco, Ninja do Chiqueiro, Peão de Rodeio, Chef Supremo do Rodízio, Estrela do Rock, Capitão Costelinha, Caipira de Festa Junina e o **Docão Dourado**, que flutua (1500 🪙, pra quem é rico de verdade).
🧢 **Bonés e chapéus aos montes:** Boné do Churrasqueiro, Chapéu de Palha da Roça, Fone Gamer Neon, Chifrinhos de Boi, Capuz de Coelhinho e outras peças pra cabeça, rosto, pescoço, corpo, mãos e pés. Monta o visual, salva na conta e desfila.
💃 **6 danças pra comprar**, no mesmo esquema do Moonwalk, do Mewing e do 6 7: Escovinha, Robozão da Granja, Galinha Maluca, Espirro do Porquinho, Rebolado do Leitão e Helicóptero. As três de sempre continuam de graça.
🧍 **Boneco paradinho:** no provador o Docão fica **parado e de frente**, pra você ver o que está vestindo. Quer ver as costas? Arrasta ou usa ◀ Frente ▶. Ele só se mexe quando você experimenta uma dança.
🔤 **Fonte nova: Fredoka** no jogo inteiro. Mais redondinha, mais fazendinha, mais fofa. O Trebuchet foi aposentado com honras.
💸 **E o bolso do Matheus?** O saldo e os desafios são gravados junto com o que o ranking já gravava no fim da partida. O banco nem sentiu.

## v1.19 — Quermesse do Capataz 🎪🤠🐷 (23/10/2026)
🎪 **O JOÃO CHEGOU COM O CAMINHÃO DE MUDANÇA!** O **João** (@rramosjoao) mandou o **PR #21**, o "super PR", e trouxe metade da feira agropecuária junto:
🐷 **Dificuldade dos bots:** **Leitão** (vê pouco e mira mal, ~0,9 s pra reagir), **Ceva** (os bots de sempre), **Javali** e **Cachaço** (~0,19 s, mira no focinho e atira andando). Vale offline, na sala online e na Invasão. Vida e dano **não mudam**: o bot só fica mais esperto, não mais bombado.
🎒 **Classes e acessórios:** cinco classes (teclas **1–5**) com bancada de peças que fazem efeito de verdade no respawn. A **ficha** é a mesma na morte, na pausa, na preparação da Bomba e entre as waves, com o **arsenal** inteiro pra clicar e gravar na classe.
🛡️ **Tampa do Tacho:** escudo primário de **720 de vida**. Segura bala na frente, dá **porrada** e **investida**, mas pé, fresta, flanco, costas e de cima passam. Torresmo e Canhão furam a tampa, que panela não é cofre.
🤠 **Revólver do Capataz** na secundária: 58 no corpo, dobra na cabeça, tambor de 6. E pra quem acha pouco, **Dois Capatazes**, um em cada mão, cada uma no seu tempo. Faroeste no chiqueiro.
⚔️ **Sabres sem castigo:** agora andam na velocidade normal e ganharam kit de duelista: combo, **guarda**, **parry** nos primeiros 0,18 s, **investida (C)**, e o **especial (Z)**: o simples **arremessa**, o duplo **gira** feito ventilador de boteco.
🎯 **Snipers com som de cinema:** Torresmo, Canhão e Carabina ganharam tiro, eco ao longe e ferrolho. Agora o vizinho sabe que você acertou.
✈️ **Grelha (AC-130) mais legível:** dá pra ver os tiros e a troca Espeto / Panela / Caldeirão (**1/2/3**, **F** sai).
🎬 **Cada arma tem trejeito:** cada uma saca, recarrega, corre e descansa do seu jeito, com cápsula pulando e cano que esquenta. Parado uns 8 segundos, a arma faz gracinha, e na inspeção (**I**) às vezes sai a versão ovo. O tempo de tiro, recarga e saque **não mudou**, e quem enjoa liga **Animações reduzidas** nos Ajustes.
🎡 **A QUERMESSE ABRIU!** No menu tem **"Ver outros jogos"**: o **Docão Tênis** (saibro, 15-30-40, vantagem, tie-break, melhor de 3 ou set único) e o **Docão Snooker** (bola 8 na mesa de bar, com bolinho no 1 contra 1). O Truco continua firme no menu.
💸 **E o bolso do Matheus?** O tênis e o snooker rodam no seu navegador. No servidor do tiroteio entrou só regra nova, sem sala nova e sem mensagem a mais. Barato como pastel de quermesse.
🙏 Valeu, João! Um PR desse tamanho merecia uma barraca só pra ele.

## v1.18 — Seis, Marreco! 🃏🐷 (23/10/2026)
🃏 **TRUUUCO, MARRECO!** O **Janor** (@Janor-Neto-Cheers) mandou o **PR #20** e trouxe o **boteco pra dentro da fazendinha**: agora o Docão também joga **Truco Paulista**, no mesmo site, sem baixar nada!
🔀 **Tiroteio | Truco:** no menu tem a chave nova. Cansou de levar bala? Puxa uma cadeira e vai pro carteado.
🤖 **Jogar com bots:** mesa **2v2** (quatro cadeiras) ou **1v1** (duelo), contra porcos que blefam, gritam e às vezes correm de medo. Roda no seu navegador, sem servidor.
🏠 **Sala online:** "Criar sala", manda o **código de 4 letras** ou o **link**, e a turma entra. Faltou gente? "Completar com bots". Alguém caiu? A mesa **pausa**, e se o fujão não voltar em 1 minuto um bot senta no lugar dele (e joga melhor, provavelmente).
📣 **Pede truco, aceita, sobe pra SEIS, NOVE e DOZE, ou corre** com o rabo entre as pernas. Ficou enrolando mais de 25 segundos pra responder? Correu automático, que boteco não espera ninguém.
🙈 **Carta escondida** a partir da segunda rodada, pra quem gosta de um mistério.
😉 **Sinais da dupla:** pisca, sombrancelha, "beber", "mogado" e companhia, mais **chat da mesa ou só da dupla** e **voz** (Mudo, Dupla, Mesa, com Apertar ou Aberto).
🪑 **12 a 0?** Os perdedores **passam por baixo da mesa**. Humilhação garantida, tradição respeitada.
💸 **E o bolso do Matheus?** Truco é por lance, sem o loop do tiroteio, e contra bots nem encosta no servidor. Barato como ficha de boteco.
🙏 Valeu, Janor, pelo PR mais "seis, marreco!" da história do chiqueiro!

## v1.17.1 — Boca Aberta 🎙️🐷 (23/10/2026)
🎙️ **O JANOR ABRIU O MICROFONE!** O **Janor** (@Janor-Neto-Cheers) mandou o **PR #19** e agora a voz do Docão tem dois jeitos de falar, escolha o seu:
🔘 **Apertar:** o clássico. Só fala quem está **segurando K**. Ideal pra quem tem cachorro latindo, panela no fogo ou tio dando opinião ao fundo.
🔓 **Aberto:** microfone **livre**, sem segurar tecla nenhuma. Falou, a sala ouve. E o anel do seu nome **acende** quando você fala, pra todo mundo saber quem é o porco tagarela.
🔇 **Mudo cala nos dois modos.** Nada de "mas eu tava no Aberto!": Mudo manda mais que tudo.
🪟 **Trocou de janela?** Com o mic aberto, sair da aba **corta o áudio na hora** e voltar **religa**. Fim do papo particular vazando pra sala inteira. 🙏
💾 **O Docão lembra da sua escolha** neste navegador. Por padrão continua no **Apertar**, porque porco prevenido não conta o que come no almoço.
🧩 Os botões **Apertar** e **Aberto** aparecem no menu, no lobby e na pausa, ao lado de Mudo, Todos e Time. **Todos** continua falando pra sala e **Time** só pro time. Só cliente: o servidor nem percebeu.

## v1.17 — Crachá do Porquinho 🪪🐷 (23/10/2026)
🪪 **O DOCÃO AGORA TEM CRACHÁ!** Chegou o **login**, e o melhor: ele é **opcional**. Não quer conta? Joga de **convidado** como sempre, sem perguntar nada nem pedir e-mail (o chiqueiro é democrático).
🐷 **Apelido fixo:** criou a conta, o apelido é **seu e só seu**. Ninguém mais entra na sala com o seu nome (quem tentar vira "(conv)", o impostor), e você também não troca de nome no meio do jogo. Reputação de porco se constrói.
🏆 **Ranking do chiqueiro:** abates, mortes, vitórias e partidas **por modo**, com ordem por abates ou por vitórias. Só entra o que você joga logado, e o **Treino não vale** (bater em boneco não dá fama). Fim da chapa vencendo a partida conta como vitória, claro.
🎭 **Skin salva na conta:** a skin que você escolher fica guardada e volta quando você entrar de novo. Só vale **skin que já existe** no jogo, sem inventar fantasia por fora.
🔐 **Segurança de porco esperto:** senha guardada com **PBKDF2** (nunca em texto puro), sessão por **token** (só o hash fica no banco), limite de tentativas contra quem fica chutando senha, e a mensagem de erro não entrega se errou o apelido ou a senha.
💸 **E o bolso do Matheus?** Ranking com cache de 1 minuto e gravação em lote, só ao sair da sala ou no fim da partida. Barato como churrasco de domingo.
🙏 Testado no Mac do Matheus antes de subir.
🤫 Dizem que alguns segredos se escondem no chat... mas o Docão não conta nada.

## v1.16.2 — Granada de Bolso 🎛️💣 (23/10/2026)
🎛️ **A GRANADA AGORA TEM CONTROLE REMOTO!** Antes você tinha que abrir o menu pra calar o "GRANADA!" e o "BANANA!". Agora dá pra decidir no meio do tiroteio:
⌨️ **Aperte H em partida** e as vozes da granada ligam ou desligam na hora, com aviso na tela: "🔊 Vozes da granada: ligadas" ou "🔇 ... desligadas". Funciona em todos os modos (inclusive Invasão, Bomba e online) e não atrapalha chat, painel B, nem nada que você esteja digitando.
⏸️ **Apertou ESC?** O botão **"Vozes da granada"** agora é a primeira coisa da pausa, grandão e destacado, pra clicar sem procurar. Tudo continua sincronizado com o botão dos Ajustes, e o Docão lembra da sua escolha.
🤫 Dizem que alguns segredos se escondem no chat... mas o Docão não conta nada.

## v1.16.1 — Granada Silenciosa 🤫💣 (23/10/2026)
🤫 **CALA A BOCA, GRANADA!** Tem gente que ama o "GRANADA!" e o "BANANA!", e tem gente que quer jogar em paz sem frutas gritando. Agora os dois lados vivem em harmonia:
🔘 **Novo botão "Vozes da granada"** em **Ajustes** (e também no menu de pausa). Desmarcou? O Copo Bomba volta pro som de sempre: o *toc* do arremesso e o *BUM* da explosão, sem ninguém avisando nada.
💾 **O Docão lembra da sua escolha** neste navegador. Por padrão a voz continua **ligada**, porque o Matheus é vaidoso.
🔇 Vale pra tudo: seu copo, o dos outros, bots e online. Silêncio total, só estrondo.
🤫 Dizem que alguns segredos se escondem no chat... mas o Docão não conta nada.

## v1.16 — Grelha na Granja 🔥🐷 (23/10/2026)
🤝 **O JOÃO VOLTOU, E TROUXE UM AVIÃO!** O **João** (@rramosjoao) mandou o **PR #18** e o céu do Docão nunca mais foi o mesmo:
✈️ **NOVO KILLSTREAK: AC-130 «Grelha da granja»!** Chegou nos **13 abates** (entre o Chopper e o nuke). É um avião lá no alto rodando o mapa por **40 segundos**, e você só aponta e manda brasa com três armas: **Espeto** (rajada fina), **Panela** (explosão média) e **Caldeirão** (explosão que dá medo, de recarga lenta). Mas cuidado: o avião tem vida (420) e dá pra derrubar. Funciona online e offline, com tela de mira e tudo. Quem cair pro fogo da Grelha entra no placar como "Grelha da granja".
☢️ **O FIM DA CHAPA AGORA ACABA O JOGO!** Estourou o nuke? A partida **fecha na hora** e **vence quem chamou** (ou o time dele), mesmo perdendo no placar. Na Invasão continua sem killstreak, e na Bomba também vale. Quer dizer: se você está perdendo, só falta fazer 15 abates seguidos. Fácil, né? 😅
🔫 **Arsenal mexido** (o João mexeu na churrasqueira inteira):
  • 🆕 **Commando da Granja:** recuo quase zero, dano baixo e rajada reta como régua. Já está no menu de armas.
  • 🔫 **MP5K da Granja** entrou no lugar da Mini Uzi (mesmo botão): 30/90, mais dano e mais alcance.
  • 🎯 **Carabina da Granja:** agora 7 balas no pente e recarrega mais devagar (2,9 s). Pensa antes de atirar.
  • 💥 **Canhão do Barril:** de 6 para **12** balas de reserva. Mais barril pra todo mundo.
  • 🌀 **Minigun do Galpão:** 600 tiros de uma vez, sem reserva, e agora anda na velocidade normal.
🧟 **Invasão:** a bala do **Fuzil agora atravessa os zumbis**, com dano menor a cada um (e nunca machuca você). Fila de zumbi virou espetinho.
🧪 Tem teste novo pra tudo isso (e o de killstreaks ganhou o AC-130).
🙏 Valeu, João! (PR #18)
🤫 Dizem que alguns segredos se escondem no chat... mas o Docão não conta nada.

## v1.15 — Câmera Lenta no Torresmo 🎬🥓 (23/10/2026)
🤝 **O JOÃO VOLTOU COM CINEMA!** O **João** (@rramosjoao) mandou o **PR #17** e o fim de partida deixou de ser um "pimba, acabou" pra virar **cena de filme**:
📋 **A tela de fim agora parece a comanda do churrasco:** prancheta de madeira, papel creme, prendedor de metal e o título em tinta com pincelada vermelha. Cada time tem a sua cor, e a Invasão tem verde-oliva (venceu) ou roxo (perdeu). Placar igualzinho ao do Tab, botão de **Jogar de novo** em tijolo, **Próximo mapa** em oliva e **Menu** no papel. Até o chat do online foi pro papel.
🎬 **Câmera lenta de 1,5 segundo:** acabou a partida? Tudo desacelera na sua visão, com a mesma posição, direção e zoom, e a arma continua na mão. Dá pra ver a última granada rolando, o último torresmo voando e o último bot com cara de quem não entendeu nada.
🛑 **Placar fechado na hora:** depois do resultado ninguém mais atira, morre, captura nem renasce. Fim é fim, e não adianta reclamar com o juiz.
🏆 **Plaquinha de VITÓRIA!, DERROTA ou EMPATE!** na hora, com o placar entrando uns 0,8 segundo depois. E a **dança da vitória** só começa quando a câmera lenta acaba, pra ninguém dançar no meio da cena.
🤝 **Empate de verdade:** no mata-mata, empatou, é **EMPATE!**. Chega de "vence quem aparecer primeiro na lista".
📶 **Online sem fantasma:** pacotes atrasados que chegam depois do resultado são ignorados até a próxima partida.
🧘 Tem **movimento reduzido** ligado no seu aparelho? O placar abre direto, sem câmera lenta.
🙏 Valeu, João! (PR #17)
🤫 Dizem que alguns segredos se escondem no chat... mas o Docão não conta nada.

## v1.14.1 — Granada, Banana! 🍌💣 (23/10/2026)
📣 **O Copo Bomba agora fala!** E fala com a voz do próprio Matheus, gravada com todo o carinho (e nenhum ensaio):
🗣️ **"GRANADA!"** no exato instante em que o copo sai da sua mão. Não é quando você começa a segurar o botão, é quando solta. Avisar o inimigo faz parte do estilo.
🍌 **"BANANA!"** quando o copo explode. Ninguém sabe por quê. O Docão também não pergunta.
🔊 **Todo mundo ouve:** a granada dos outros jogadores (e dos bots) também grita, com **volume que cai com a distância**. Quem está perto ouve alto; quem está do outro lado do mapa fica em paz (a "granada" some a uns 60 metros e a "banana" a uns 50).
🙅 **Só o Copo Bomba:** a Pokébola, o míssil e o foguete continuam na dieta de sempre, sem frutas.
🤫 Dizem que o chiqueiro ainda guarda segredos... mas o Docão não conta nada.

## v1.14 — Operação Bacon 🥓💣 (23/10/2026)
🚨 **NOVO MODO: BOMBA!** Dois times, um botijão de churrasco e muita pressão. O **Ataque** (Vermelho) leva o **Botijão do Churrasco** até o site **A** ou **B**. A **Defesa** (Azul) tem que impedir, ou desarmar antes de virar torresmo. Estilo "plante e defenda", mas com cheiro de bacon. 🥓
🧯 **Plantar:** segure **E** por **4 segundos** dentro do site. Quanto mais nervoso o time, mais o dedo escorrega.
🔧 **Desarmar:** a Defesa segura **E** por **7 segundos** perto do botijão. Passou da metade, fica salvo (o Docão agradece o esforço).
⏲️ **Plantou, bipou:** o botijão **bipa cada vez mais rápido** e **explode em 45 segundos**, levando todo mundo no raio. Quem está perto vira churrasquinho. Não fique de bobeira, porco assado não joga mais.
🏁 **Primeiro a 13 rodadas vence.** Depois da 12ª rodada vem o aviso **"Troca de lado!"**, e quem atacava agora defende (e vice-versa, sem choro).
🕙 **Preparação de 10 segundos:** todo mundo parado no spawn do seu lado, só olhando e pensando na vida. Só depois do VALENDO a rodada começa de verdade.
🔫 **Painel de armas toda rodada:** na preparação aparece um painel com as armas (primária, secundária e corpo a corpo). Troque na hora com **1–9**, **N**, **M**, **G** e **B**. Respeita as armas liberadas pela sala. Ele some sozinho quando o jogo começa.
🎖️ **Killstreaks guardados:** a sequência e os streaks que você juntou **passam pra rodada seguinte**. Trocar de rodada não é morrer. Só o que ainda está no ar (Gavião, míssil, Fim da chapa) vai embora na virada.
💀 **Morreu? Renasce.** O renascimento continua normal (5 segundos + RENASCER), no spawn do seu lado. A rodada **não acaba por eliminação**, porque aqui ninguém sai do churrasco mais cedo.
🗺️ **Mapa novo: Rodízio do Docão!** Feito pro modo: comprido, com **três rotas** (Rua do Espeto, Avenida da Linguiça e Beco da Farofa). **Sites e spawns feitos à mão** em vários mapas (o **HOTMILK** entrou no rodízio), com o Ataque nascendo longe dos sites. O Pátio Ferrugem ficou de fora por ser pequeno demais e o Estande é só do Treino.
📣 **Instruções na tela:** aviso grande dizendo o que fazer ("Segure E para plantar o botijão", "Leve o botijão até o A ou o B" com a distância), barra de segundos e um **Como jogar** no menu.
💬 **Funciona online e offline,** com chat e voz do time (na Bomba, o time é o seu lado), e com tudo que já existia: Invasão, loadout por sala, killer cam, tela cinza, arcos de dano, SPAS-12 e pau de choque. A explosão do botijão não ativa a câmera do assassino, e trocar de arma no meio da rodada nunca mata.
🙏 Feito e testado pelo **Matheus**, com muitas rodadas de bacon.
🤫 Dizem que alguns segredos se escondem no chat... mas o Docão não conta nada.

## v1.13.1 — Mira de Granada 🎯💣 (23/10/2026)
🤝 **O FELIPE VOLTOU!** O **Felipe Gomes** (@felipe-cheers) estava cansado de jogar copo bomba no escuro, torcendo pra ele cair "mais ou menos ali". Mandou o conserto, e agora o Docão arremessa com a **ficha técnica na mão**:
🎯 **A linha de mira mostra o caminho inteiro do copo, até a explosão:** quicadas, parede, rampa, tudo. Segurou o botão, viu onde vai explodir, soltou, e **explodiu exatamente ali**. Chega de "foi mal, achei que ia passar".
🥤 **O copo sai da mão, não da testa:** a granada agora parte de onde o copo está na tela, com a mesma conta da preview. Funciona agachado, colado na parede, com zoom e mirando pro céu. A Pokébola também ganhou mira de professor.
🧮 **Física igualzinha pra todo mundo:** o arremesso agora anda em passinhos fixos, no seu PC e no servidor. Ping alto, FPS baixo ou computador de cebola não mudam mais onde a granada cai.
✋ O copo ganhou uma **animação de soltura** (o braço joga de verdade, e não só some).
⚡ Levou choque segurando o copo? Nada de arremesso: a granada fica com você.
🙏 Valeu, Felipe!
🤫 Dizem que o chiqueiro ainda guarda segredos... mas o Docão não conta nada.

## v1.13 — Calibre 12 Meteoro ⚡🐗 (23/10/2026)
🤝 **MAIS UMA DO CHIQUEIRO!** O **João** (@rramosjoao) chegou com o **PR #16** e entregou três presentes de uma vez. O Docão agradece, o resto do servidor chora:
🔫 **Calibre 12 virou SPAS-12 (e agora é de verdade):** 9 chumbos por tiro, cone fechado, **acerta andando**, bombeia mais rápido e recarrega cartucho em velocidade de quem tá atrasado pro churrasco. Modelo novinho (preto, protetor de calor furado, coronha dobrada) em 1ª e 3ª pessoa, coice de ombro, tremida de tela e um **estrondo bem mais grave**. Quem leva tiro de perto **sai voando pra trás** (Barrigão e chefe da Invasão são pesados demais pra isso, sorry). A Semi continua sendo a das 2 rajadinhas.
🏹 **Besta consertada:** antes ela atravessava a tela na diagonal, gigante, como se fosse uma antena de TV. Agora aponta **reta pra frente**, centraliza quando você mira, e a mão de apoio só vai na corda na hora de recarregar.
⚡ **Pau de choque (tecla 5), finalmente funciona:** você arremessa uma **estaca elétrica** que finca onde bater (chão, parede, rampa) e dá **choque por 3 segundos** em quem estiver perto. Quem leva fica **lento, sem atirar, com a mira tremendo e a tela azul piscando**. Funciona no online e na Invasão (zumbi também leva um susto!). Você ganha 1 por vida, e a caixa de Copo Bomba dá outro.
😇 **O pau de choque NUNCA mata:** é só um **susto elétrico**. Quem tá com pouca vida fica com 1 de vida, tremendo, mas vivo. O Docão é bagunceiro, não assassino.
🎯 Levou choque? O **arco vermelho de dano aponta pra estaca**, não pra quem jogou. Dá pra fugir sabendo de onde vem o zumbido.
🙏 Valeu, João! (PR #16)
🤫 Dizem que o chiqueiro ainda guarda segredos... mas o Docão não conta nada.

## v1.12.1 — Mira de Elite do Felipe 🎯💥 (23/10/2026)
🤝 **PARCERIA DO CHIQUEIRO!** O **Felipe Gomes** (@felipe-cheers) mandou o **PR #15** com um indicador de dano parecido com o nosso... e, em vez de brigar, o Docão **roubou as melhores ideias dele** (com crédito, claro 🫡🐷):
💥 **Explosão e helicóptero agora apontam pro lugar certo:** antes, se o foguete (ou o Gavião) te acertava, o arco apontava pro *dono* do tiro, que podia estar do outro lado do mapa. Agora o servidor manda **de onde a explosão realmente veio**, e o arco aponta pra ela. Tomou foguete na cara? O arco olha pra fumaça, não pro fofoqueiro.
🧲 **Golpes parecidos viram um arco só:** levou rajada de dois caras do mesmo lado (até 30° de diferença)? Em vez de uma fila de arcos empilhados, o jogo **junta tudo num arco só** e renova o tempo dele. Tela menos poluída, mais tempo pra olhar pro encrenqueiro. (Máximo de 4 arcos ao mesmo tempo.)
🙏 Valeu, Felipe! O resto continua igual: flash leve quando o dano não tem dono, e morreu/renasceu/pausou os arcos somem.
🤫 Dizem que o chiqueiro ainda guarda segredos... mas o Docão não conta nada.

## v1.12 — Ai, de Onde Veio Isso? 🎯🩸 (23/10/2026)
🚨 **NOVIDADE QUENTINHA!** O Docão apanhava calado e sem saber de quem: "ai! quem foi? foi você? foi o vento?" 😵🐷 Chega de levar bala misteriosa. Agora o jogo aponta o dedo pro culpado:
🔴 **Indicador de dano estilo Fortnite:** quando você leva dano, aparece um **arco vermelho na borda da tela apontando de onde veio o golpe**. Vira a câmera e o arco gira junto, então é só olhar pra onde ele aponta e devolver o carinho. 💥
🌀 **Vários inimigos, vários arcos:** levou tiro de três lados? Três arcos, um pra cada vizinho mal-educado. Cada um some sozinho em **1,5 segundo**.
🧟 **Funciona em tudo:** jogador, bot e **zumbi na Invasão** (o Barrigão agora é pego em flagrante).
🌫️ **Dano sem dono** (névoa, queda, você mesmo): só um flash vermelho leve nas bordas, porque aí o culpado é você.
💀 Morreu? Os arcos somem. Não adianta apontar o dedo pro cadáver.
🤫 Dizem que o chiqueiro ainda guarda segredos... mas o Docão não conta nada.

## v1.11.3 — Mouse Fujão 🖱️💀 (23/10/2026)
🚑 **FIX RELÂMPAGO!** Tinha um bug cruel: você morria, ia clicar na arma nova... e o jogo **sequestrava o seu mouse** de volta, o cursor sumia e o painel fugia da sua mão. O Docão morto não tinha nem direito de escolher o armamento em paz. 😭
🖱️ **Morreu? O cursor é seu.** Clicar na tela não prende mais o mouse enquanto você está morto: o cursor fica **livre e visível** pra você clicar na arma que quiser.
📦 **Painel B da Invasão também:** com o painel aberto nas pausas, o clique no jogo não rouba o mouse. Apertou **B** de novo ou renasceu, o mouse volta pra mira.
🎯 Renasceu? A mira volta na hora, como sempre.
🤫 Dizem que o chiqueiro ainda guarda segredos... mas o Docão não conta nada.

## v1.11.2 — Cara de Morto 💀📹 (23/10/2026)
🚑 **FIX RÁPIDO!** Até hoje, quando o Docão virava bacon, ele ficava ali olhando pro nada, sem nem saber quem foi o desgraçado. Agora ele tem **direito à vingança visual**:
📹 **Câmera do assassino:** morreu? A câmera passa a **seguir quem te matou** (jogador, bot ou até zumbi na Invasão), pra você encarar o culpado com a cara que ele merece. Se o assassino sumir ou morrer, a câmera fica no lugar da sua morte, de luto. Renasceu, volta tudo ao normal.
🩶 **Tela de morto:** enquanto você está morto, o mundo fica **cinza e sem graça**, tipo segunda-feira. Renasceu, as cores voltam.
🗂️ **Painel de armas tímido:** a escolha de arma na morte e o painel **B** da Invasão agora ficam **pequenininhos, no cantinho e meio transparentes** (passa o mouse e eles acordam). Dá pra ver quem te matou e a dança da vitória sem um cardápio gigante na cara. 💃
🚫 Na Invasão o B continua só abrindo o painel de armas. Dançar lá? Nem pensar, tem zumbi no meio!
🤫 Dizem que o chiqueiro ainda guarda segredos... mas o Docão não conta nada.

## v1.11.1 — Hotfix da Munição 📦🧟 (23/10/2026)
🚨 **HOTFIX URGENTE!** Os zumbis comeram TODA a munição do chiqueiro. 🧟🍽️ O Docão abriu a gaveta, só achou uma bala mofada e saiu correndo pro mercado. 🐷🛒 Voltou com o carrinho lotado:
📦 **Caixas de munição pra todo lado na Invasão:** **Rodízio 6 → 28** e **Fazenda Mal-Assombrada 4 → 18**, espalhadas pelos spawns, pelo meio e pelas pontas.
⏱️ **Caixa nova em 6 segundos** (antes eram 15). Nem dá tempo de sentir saudade.
🔫 **Cada caixa dá mais:** a reserva vai até **1,5×** o normal, o pente já sai cheio e a bazuca ganha **+2 foguetes**.
🧟 **Zumbi agora solta caixa de munição!** O Barrigão de Gás é o mais generoso (a barriga tá cheia de bala, vai entender), e o chefão larga duas.
✨ **Facho e anel amarelos** em cada caixa, pra você achar de longe e parar de apanhar com a pistola vazia.
🤫 Dizem que o chiqueiro ainda guarda segredos... mas o Docão não conta nada.

## v1.11 — Salão de Festa 💃 (23/10/2026)
Feito pelo **[@paulo-cheers](https://github.com/paulo-cheers)** (PR #14).

**Quem manda na sala escolhe o arsenal**
- Ao criar a sala, o **dono escolhe quais armas e quais power-ups valem**: quer uma sala só de rajada, ou só de pistola e faca? Pode! Os poderes de killstreak e os que caem no chão só funcionam se estiverem liberados.
- Os **bots só sacam armas que a sala permite**, e quem entra no meio da partida já encontra tudo certinho.
- O menu agora **lembra a sua arma padrão** (primária, pistola e corpo a corpo), e o lobby mostra o que a sala liberou.

**Dança da vitória na tecla B** 🕺
- Apertou **B** no meio da partida, o Docão **dança em 3ª pessoa** por uns 3 segundos. Escolha o seu passo no menu inicial ou na pausa:
  - 🌙 **Moonwalk:** desliza pra trás
  - 🤫 **Mewing:** dedo no queixo
  - 6️⃣7️⃣ **Sixseven:** um de cada vez
- Dançando você **não atira**, então escolha bem a hora. 😅
- **Na Invasão não tem dança:** lá o **B continua abrindo o painel de armas** entre as waves. E nada de dançar com o chat aberto ou digitando.

**No menu**
- O **Docão agora gira**: arraste com o mouse pra ver ele de todos os lados. 🐷🔄

🤫 Dizem que alguns segredos se escondem no chat... mas o Docão não conta nada.

## v1.10.1 — Metralhadora do Chiqueiro 🔫 (22/10/2026)
🐷💥 **PATCH v1.10.1: A METRALHADORA DO CHIQUEIRO!** 💥🐷
:alphabet-white-b::alphabet-white-d::alphabet-white-c:
O Docão acordou hoje com uma ideia: "e se eu atirasse **MUITO** mais rápido?" E o João (@rramosjoao) respondeu: "segura essa." 🔫🌽
🔫 **Metralhadora do Chiqueiro**: arma automática nova na categoria Rajada. Fita de 100 balas, 15 de dano por tiro e uma cadência que faz o porquinho suar. Cuidado: ela deixa você um pouquinho mais lento. 🐢
🌾 **HUD da fazenda**: tudo mais bonito e mais fácil de ler:
💀 Killfeed novo
🔫 Munição com ícones
☠️ Tela de morte nova, pra você sofrer com estilo
📊 Barra de streak redesenhada
🦅 Olho da granja com mapa maior
🚀 **Míssil turbinado**: segura o gatilho e o míssil acelera! Dá pra ir mais longe que o vizinho, e mais rápido. 💨
🔄 **Trocou de arma na pausa? Renasce na hora!** Escolheu uma arma nova, você volta pro jogo equipado. Mas segura a ansiedade: só dá pra fazer isso **a cada 10 segundos**, e na Invasão os zumbis não deixam. 🧟 Lá a troca continua só pelo painel **B** entre as waves.
🤫 E sim, o chiqueiro ainda guarda segredos... mas o Docão não conta nada.
👏 Obrigado, João, pela metralhadora e pela caprichada no HUD!
👉 **Joga agora:** [docao.mvalentim.dev](https://docao.mvalentim.dev/)

## v1.10 — Modo Invasão 🎃 (22/10/2026)
**A noite caiu no chiqueiro e os Docões zumbis levantaram!** 🧟🐷 Modo novo, co-op, no menu em **Modo de jogo → Invasão 🎃**.

**Como funciona**
- 👥 **Todo mundo no mesmo time** (até 10 jogadores online, ou solo no offline) contra **hordas de Docões zumbis**. Sem fogo amigo.
- 🌊 **20 waves** cada vez mais difíceis, com mais zumbis, mais vida e mais velocidade. **A cada 5 waves vem o chefão Docão Abóbora.** Sobreviveu à 20, venceu!
- 🧟 Zumbis variados: **Docão Podre**, **Esqueleto Corredor**, **Barrigão de Gás** (explode quando cai) e **Cuspidor** (cospe de longe).
- ❤️ **Só 2 vidas.** Acabou, você fica assistindo até alguém usar a **Ressurreição**. Todo mundo fora, fim de jogo.
- 🌫️ **Névoa Assombrada:** a área segura encolhe e muda de lugar a cada wave. Fora dela você perde vida.
- 😠 O Docão continua fechando a cara quando atira.
- 🚫 Na Invasão não tem killstreak: nada de sequência, rádio, Gavião, Chopper ou Fim da chapa. Aqui quem manda são os poderes.

**Poderes** (caem dos zumbis; passe por cima pra pegar, guarda até 3)
- 🎃 **Abóbora Explosiva:** arremessa uma abóbora que explode em área.
- 🐺 **Uivo do Lobisomem:** empurra e atordoa os zumbis em volta.
- 🧪 **Poção de Cura:** cura você e os aliados perto.
- 🔦 **Lanterna Sagrada:** cone de luz que queima os zumbis.
- 👻 **Fantasma:** invisível pros zumbis e mais rápido por alguns segundos.
- ✨ **Ressurreição** (rara): revive todos os aliados mortos.

**Controles**
- **G** usa o poder selecionado · **X** troca de poder
- **B** abre o painel de armas na pausa entre as waves (troque primária, secundária e corpo a corpo)

**Mapas da Invasão**
- 🏚️ **Fazenda Mal-Assombrada** (novo!): noite de Halloween na fazenda.
- 🍖 **Rodízio do Docão**: o mapa padrão da Invasão.
- Os mapas de sempre também entram, com decoração de Halloween e névoa só nesse modo.

🎶 Trilha de terror própria, que pesa mais na luta contra o chefão.

---

🎃🐷 **ATENÇÃO, CHIQUEIRO!** 🐷🎃

Hoje o Docão não parou: foram **6 atualizações em um dia só!** 🔥

🚀 **v1.8 "Míssil Pilotado"**: 5 abates seguidos e você mesmo guia o míssil até o alvo. Tem camuflagens novas e o F ativa as killstreaks.
💬 **v1.8.2**: o chat foi pro canto da tela.
🌾 **v1.8.3**: menu novo com cara de fazendinha.
🦵 **v1.8.4 "Agachadinha"**: Shift agacha e a mira fica no botão direito.
🌽 **v1.9 "Arsenal da Quermesse"**: FAMAS da Pocilga, Disco Voador, Lança-Milho, Estilingue de Ovo e Sabre Duplo. Tem tiro que atravessa parede, helicóptero com 10 abates e NUKE com 15! ☢️
😠 **v1.9.1 "Docão Bravo"**: agora o Docão fecha a cara toda vez que atira.

🤫 Dizem que alguns segredos se escondem no chat... mas o Docão não conta nada.

## 🧟 MAS HOJE AINDA TEM MAIS... 🧟
Quando a noite cair, os mortos levantam do chiqueiro. 🌫️
# 🎃 MODO INVASÃO 🎃
👥 Até 10 jogadores no mesmo time contra **hordas de Docões zumbis**.
🌊 **20 waves** que vão ficando mais difíceis, com um **chefão a cada 5**.
🔮 Poderes que caem dos zumbis.
❤️ Só **2 vidas**. Depois disso, só um milagre traz você de volta...
🏚️ Mapa novo: **Fazenda Mal-Assombrada**.
🌙 **JÁ ESTÁ NO AR!** Corre pro menu e escolhe a Invasão. 💥
Prepara a lanterna, chama os amigos e não sai do chiqueiro... 👀🐷

---

## Próxima versão

- Menu com nova logo, lettering cartoon, moldura irregular de madeira, campos padronizados e carimbo suíno. A chama do título tem animação discreta.
- Jogar e Juntar a Porcada ficam lado a lado, com menor destaque visual para a ação online.
- Docão fica sobre uma caixa de armas 3D, com madeira quente, ferragens e inscrição pintada. Trocar Visual é uma mala de figurinos apoiada na quina.
- O Arsenal abre a tampa e leva a câmera ao interior da caixa, onde as armas aparecem em bandejas de madeira.
- A mala abre pela lateral e revela um provador com forro verde e prévia 3D do figurino selecionado.
- Chão e paisagem têm profundidade e paralaxe durante as transições. Fechar ou Esc faz o caminho inverso; a preferência por movimento reduzido pula a viagem.
- Layout adaptado para telas estreitas, navegação por teclado e foco restaurado ao sair dos menus.

---

## Resumo de 21 a 23/10/2026
Tudo o que entrou no jogo nesses dias (detalhes em cada versão abaixo):
- **v1.2 · Mapas v2:** os 7 mapas refeitos com casas, andares, escadas e telhados
- **v1.3 · Bacon & Nomes:** morte vira bacon e cada jogador escolhe o nome
- **v1.4 · Pururucado:** kill feed com frases de porco
- **v1.4.1 · Mira, snipers e prêmios** ([@rramosjoao](https://github.com/rramosjoao), PRs #1 e #2): mira no botão direito, três snipers, abates seguidos, fumaça, atordoamento e prêmios de 3, 5 e 7
- **v1.5 · Churrasco Moggado:** faca de churrasqueiro e animações de recarga
- **v1.5.1 a v1.5.7:** botão RENASCER, 3 skins novas, salas com até 10 jogadores, tempo da partida configurável, captura da Dominação mais lenta, Docão não fica mais preso na parede, piso e mira sem piscar
- **v1.6 · Bacon Restaurador:** bacon cura 10 de vida
- **v1.6.1 · Respiro:** vida regenera fora de combate
- **v1.7 · Arsenal do Chiqueiro** ([@rramosjoao](https://github.com/rramosjoao), PR #3): armas novas por categoria, helicóptero Gavião, nuke secreto e mapa Pátio Ferrugem
- **v1.8 · Míssil Pilotado:** chat e voz, campus HOTMILK, modo Exploração, modo Treino no Estande do Docão, killstreaks no F, míssil pilotado e camuflagens
- **v1.8.1 · Streak de verdade:** online o míssil, o Gavião e o Fim da chapa matam de verdade, com o servidor no controle
- **v1.8.2 · Chat no canto** ([@Janor-Neto-Cheers](https://github.com/Janor-Neto-Cheers), PR #7): chat sempre visível no alto e T para falar com todos
- **v1.8.3 · Comanda da Fazendinha** ([@hiro-cheers](https://github.com/hiro-cheers), PR #8): menu inicial novo com cenário de fazendinha ao entardecer
- **v1.8.4 · Agachadinha** ([@felipe-cheers](https://github.com/felipe-cheers), PR #9): Shift agacha com hitbox sincronizada no online, mira só no botão direito e um pulo por toque no Espaço
- **v1.9 · Arsenal da Quermesse** ([@rramosjoao](https://github.com/rramosjoao), PR #12): FAMAS, Disco Voador, Lança-Milho, Estilingue de Ovo e Sabre Duplo, bala que atravessa parede, inspecionar no I e Chopper da granja aos 10
- **v1.9.1 · Docão Bravo:** o Docão faz cara de brava ao atirar e ao golpear com faca ou sabre
- **v1.10 · Modo Invasão:** co-op contra hordas de Docões zumbis em 20 waves, com chefão a cada 5, poderes, 2 vidas e o mapa Fazenda Mal-Assombrada
- **v1.10.1 · Metralhadora do Chiqueiro** ([@rramosjoao](https://github.com/rramosjoao), PR #13): arma nova de 100 balas, HUD da fazenda, míssil que acelera segurando o tiro e troca de arma na pausa
- **v1.11 · Salão de Festa** ([@paulo-cheers](https://github.com/paulo-cheers), PR #14): o dono da sala escolhe as armas e os power-ups, o menu lembra sua arma padrão, dança da vitória no B (moonwalk, mewing e sixseven; fora da Invasão) e o Docão do menu gira ao arrastar
- **v1.11.1 · Hotfix da Munição:** Invasão com bem mais caixas de munição (Rodízio 6 → 28, Fazenda 4 → 18), caixa nova em 6 s, mais munição e +2 foguetes por caixa, zumbi solta caixa e facho amarelo pra achar
- **v1.11.2 · Cara de Morto:** câmera segue quem te matou, tela cinza enquanto está morto e painel de armas discreto no canto
- **v1.11.3 · Mouse Fujão:** morto (ou com o painel B aberto) o clique no jogo não prende mais o mouse, então dá pra clicar nas armas
- **v1.12 · Ai, de Onde Veio Isso?:** arco vermelho na borda da tela mostra de onde veio o dano (jogador, bot e zumbi), gira com a câmera e some em 1,5 s

---

## v1.9.1 — Docão Bravo 😠 (22/10/2026)
- Quando atira, o Docão agora **fecha a cara**: sobrancelhas em V, olhos apertados e dentes cerrados no lugar do sorrisão.
- Vale pra todas as armas, inclusive a rajada da FAMAS, a metralhadora giratória, a bazuca, o Lança-Milho, o Disco Voador e o Estilingue, e também pros golpes de faca e de sabre (simples ou duplo).
- A cara de brava aparece rapidinho no disparo, fica enquanto o Docão continua atirando e some meio segundo depois do último tiro, quando volta o sorriso.
- Dá pra ver nos bots e nos outros jogadores online, com todas as skins (de óculos, de pintura de caveira ou de capuz).

## v1.9 — Arsenal da Quermesse 🌽 (22/10/2026)
Feito pelo **[@rramosjoao](https://github.com/rramosjoao)** (PR #12).

**Armas novas**
- **FAMAS da Pocilga:** rajada de 3 por clique, com o recuo subindo reto.
- **Disco Voador:** um disco-OVNI que quica 3 vezes nas paredes antes de se desfazer.
- **Lança-Milho da Quermesse:** solta 3 grãos por tiro, e cada grão estoura 3 vezes em pipoca.
- **Estilingue de Ovo:** secundária quase silenciosa. Segure o clique pra esticar o elástico, e o ovo suja a tela de quem leva.
- **Sabre Duplo:** um sabre em cada mão, com golpes alternados. O Sabre de Luz agora fica em guarda de cavaleiro e anda só 15% mais devagar.

**Tiroteio**
- **Penetração de parede:** a bala atravessa paredes finas, muretas e caixotes, perdendo dano conforme a espessura. Cada arma tem o seu limite.
- **Collateral:** nas snipers a bala atravessa corpos, perdendo dano a cada um.
- **Inspecionar (I):** gira a arma na mão e mostra a camuflagem e os abates com ela.
- **Kill feed com ícones:** cada abate mostra o ícone da arma ou do killstreak.
- **Animações:** balanço com inércia ao virar e andar de lado, e saque com a arma subindo girando.

**Killstreaks**
- **Chopper da granja aos 10 abates:** você vai pra porta do helicóptero por 60 s, com metralhadora giratória ou sniper.
- **Fim da chapa** agora sai aos **15** abates.
- O streak ganho **fica guardado depois de morrer**, e a barra só brilha no que está pronto.
- O Olho da granja, o Gavião e o Chopper chegam por uma **chamada no rádio**.
- O minimapa não fica mais espelhado.

🤫 Dizem que alguns segredos se escondem no chat... mas o Docão não conta nada.

## v1.8.4 — Agachadinha 🐖 (22/10/2026)
Feito pelo **[@felipe-cheers](https://github.com/felipe-cheers)** (PR #9).
- Segure **Shift** (esquerdo ou direito) para agachar, com animação e câmera mais baixa. O Docão anda mais devagar e só levanta se houver espaço acima da cabeça.
- A mira com zoom agora fica só no **botão direito** do mouse (o Shift virou o agachar).
- A hitbox acompanha a transição ao agachar e levantar, inclusive nos tiros, golpes de faca e explosões. A postura também é sincronizada no multiplayer, e o servidor confere a troca.
- Corrigido o pulo que se repetia ao pular, agachar e soltar o agachar no ar. Cada pressão em Espaço agora dispara apenas um pulo.

## v1.8.3 — Comanda da Fazendinha 🌅 (22/10/2026)
Feito pelo **[@hiro-cheers](https://github.com/hiro-cheers)** (PR #8).
- Os campos da comanda agora usam etiquetas impressas, papel claro e setas pintadas. Os ajustes de mira ganharam marcadores de tampinha e valores visíveis.
- A fazendinha do menu agora tem cenário próprio ao entardecer, luz quente no Docão e um palco de madeira. A comanda ganhou acabamento de papel, carimbo suíno, opções lado a lado e placas com ferragens.
- O menu virou a comanda da fazendinha: papel de açougue, placas de madeira e o botão Jogar. Arsenal e visual são acessados pelas placas junto do Docão; ajustes e áudio ficam no canto superior direito.
- O Docão fica de frente na vitrine. Os botões de jogar continuam à mão, mesmo ao escolher armas ou skins, e o menu se adapta a telas menores.

## v1.8.2 — Chat no canto 💬 (22/10/2026)
Feito pelo **[@Janor-Neto-Cheers](https://github.com/Janor-Neto-Cheers)** (PR #7).
- O histórico do chat fica aberto durante a partida, no canto superior direito, e desce sozinho quando chega mensagem nova
- **T** abre o chat para todos; **Y** ou **U** abre só para o time na Dominação. O Tab volta a ser só o placar
- Os botões de voz saíram de cima do feed de abates e foram para o lado do chat

## v1.8.1 — Streak de verdade 💥 (22/10/2026)

- Online, o míssil pilotado, o Gavião e o Fim da chapa agora matam de verdade. Antes eles apareciam só na tela de quem usou
- Quem decide é o servidor: ele conta a sua sequência, confere se você ganhou o prêmio e se o míssil chegou onde dava pra chegar, e só então aplica o dano
- Todo mundo vê a explosão do míssil, o Gavião voando e atirando e a contagem e o clarão do Fim da chapa
- Os outros jogadores (e os bots) podem atirar no Gavião e derrubá-lo
- O kill feed mostra o nome do prêmio: [Míssil da granja], [Gavião da granja] e [Fim da chapa]
- Igual ao offline: abates do Gavião valem 25 pontos e não contam pra sequência, o Fim da chapa também não conta, e morrer depois de puxar o rádio não cancela

---

## v1.8 — Míssil Pilotado 🚀 (22/10/2026)
Versão de muita gente: valeu, Janor, Paulo e João! 🐷

**Chat, voz e convite** (PR #4, [@Janor-Neto-Cheers](https://github.com/Janor-Neto-Cheers))
- Chat escrito no lobby, na partida e no fim do jogo: Y fala com todos, U só com o time, e Tab troca o canal com a caixa aberta
- Voz: J troca entre Mudo, Todos e Time; segure K para falar
- Convite da sala no lobby e na pausa: copiar link ou código, WhatsApp, Telegram, Slack e compartilhar

**Campus HOTMILK e modo Exploração** (PR #5, [@paulo-cheers](https://github.com/paulo-cheers))
- Mapa HOTMILK com o Bloco 01 e o Bloco 02 (prédios de três andares com corredor, escada e vão entre eles)
- O mapa HOTMILK virou o campus inteiro: Bloco 01, Bloco 02, estacionamento com catraca, praça e portões
- Modo Exploração (offline): mapa sem bots pra andar e testar armas

**Treino · Estande do Docão**
- Novo modo com mapa próprio: alvos que não atacam e voltam em 2 s, números de dano na tela, distâncias de 10 a 50 m, alvos em movimento, área de explosivos, faca/sabre e arena X1
- B/N/M trocam a arma na hora, munição infinita e sem tempo. Funciona offline e online

**Killstreaks no F e camuflagens** (PR #6, [@rramosjoao](https://github.com/rramosjoao))
- O killstreak não dispara sozinho: quando fica pronto, aperte F. Com mais de um guardado, o F usa o mais antigo
- O de 5 abre um laptop e você pilota um míssil em primeira pessoa: sai bem alto, o mouse aponta e a explosão é bem maior
- No menu, cada arma mostra uma miniatura
- Camuflagem por partida: 5 abates com a mesma arma dão a de chiqueiro, 10 a de bacon e 15 deixa dourada. Zera na partida nova

---

## v1.7 — Arsenal do Chiqueiro 🏹🚁 (21/10/2026)
Leva enorme feita pelo **[@rramosjoao](https://github.com/rramosjoao)** (PR #3). Valeu, João! 🐷

**Armas**
- A lista de armas ficou separada por categoria: Rajada, Escopeta, Precisão, Explosivo, Faca e Secundária
- Mini Uzi do Leitão: rajada bem rápida, curta, forte de perto
- P90 da Granja: compacta, carregador grande, rajada mais estável
- Furadeira de Prego: secundária. Um prego por clique
- Escopeta Semi do Leitão: atira mais rápido e é mais fraca. A Calibre 12 (pump) ficou mais forte
- Sniper Torresmo sem luneta espalha mais. Com a luneta e parado, continua no centro
- Sabre de Luz na categoria Faca. As duas mãos seguram o cabo e acompanham o corte. Com ele na mão, você anda 30% mais devagar
- Besta do Leitão e Arco da Granja, as duas na categoria Secundária. Não matam de um tiro no corpo. A besta arma a corda na recarga. No arco, segura o clique para puxar a corda: quanto mais tempo, mais forte a flecha
- A Bazuca do Chiqueiro ficou maior e com cara de RPG: tubo longo, traseira larga, empunhadura e a ogiva na boca

**Killstreaks**
- O killstreak de 5 solta os mísseis do céu, e eles batem mais forte
- O killstreak de 7 agora é o helicóptero Gavião da granja (no máximo 30 segundos, dá para derrubar)
- Cada abate do helicóptero Gavião da granja vale 25 pontos. Não enche a barra de killstreak
- O nuke saiu da barra e virou um streak secreto de 10 abates. Se você morrer depois de puxar o rádio, a contagem não cancela
- A fumaça ficou mais fechada no meio

**Mapa e tela**
- Mapa Pátio Ferrugem, menor, no estilo do Rust: a torre do meio é a mais alta, com rampa do chão até o topo
- A lista de abates (killfeed) foi para o canto esquerdo de baixo, acima da vida e da linha de Abates, sem cobrir o resto
- Quando você morre, a câmera fica parada olhando para quem te matou

## v1.6.1 — Respiro 💚 (21/10/2026)
- **Vida regenera fora de combate:** levou dano de outro Docão e ficou **5 segundos** sem apanhar? A vida volta sozinha, **+10 por segundo**, até 100. Levou dano de novo, os 5 segundos recomeçam.
- **Mas só se o dano não foi seu:** se o último dano veio de você mesmo (foguete da bazuca no pé, seu próprio Copo Bomba, seu míssil), não regenera, e isso cancela a regeneração que ia começar. Quer a vida de volta? Fica longe da própria explosão.
- Enquanto regenera, a barra de vida brilha verdinho com um "+" pulsando.
- Vale pros bots também. No online quem decide é o servidor.

## v1.6 — Bacon Restaurador 🥓❤️ (21/10/2026)
O bacon agora serve pra alguma coisa: **quem pisar no bacon de um Docão morto ganha +10 de vida!**
- Vale pra qualquer um que estiver vivo: inimigo, aliado ou quem fez a vítima virar bacon. Só o próprio morto não come o bacon dele.
- Comeu: aparece **"+10 de vida (bacon!)"**, toca um "nhac nhac" e o bacon some numa nuvenzinha rosada. A vida não passa de 100. Se você já está com 100, o bacon fica no chão pra outro.
- Dá pra pegar enquanto o bacon estiver no chão (uns 3 segundos). Se ninguém pegar, ele some como antes. Agora ele cai pertinho de onde o Docão morreu.
- Os bots também comem: pegam quando passam por cima e, com pouca vida, vão atrás de um bacon que esteja perto.
- No online quem decide é o servidor, então todo mundo vê o mesmo bacon sumir.

## v1.5.7 (21/10/2026)
- **Piso e telhado não piscam mais:** onde duas superfícies ficavam exatamente no mesmo plano (laje em cima da parede, faixa no piso, asfalto, meio-fio…) a imagem ficava trocando de cor quando você mexia a câmera. Agora cada uma fica no seu lugar. A colisão continua igualzinha.
- **Bacon não afunda mais no chão:** quando um Docão morre, a tira de bacon fica deitada por cima do piso (no chão ou num telhado), sem afundar nem no fim da animação.
- **RENASCER já trava o mouse:** clicar em RENASCER (ou apertar Espaço/Enter) já volta a mirar na hora. O aviso "Clique pra voltar a mirar" só aparece se o navegador não deixar, e some assim que o mouse trava.
- **A mira do centro da tela não pisca mais.**
- Bots não ficam mais parados no meio da rampa achando que já chegaram no telhado.

## v1.5.6 (21/10/2026)
- **Correção: Docão preso na parede** em todos os mapas. Quem saía da borda de um telhado, caixa ou rampa caía "dentro" da lateral dela, e quem subia escada/rampa debaixo de viga ou verga de porta enfiava a cabeça nela. Daí nenhuma direção funcionava.
  - O chão agora usa a mesma largura do corpo, então você para na borda em vez de afundar na parede.
  - Degrau e rampa só sobem se a cabeça couber.
  - Se por algum motivo o Docão ficar dentro de alguma coisa, ele é empurrado pra fora na hora (sem atravessar parede).
  - Empurrões fortes (explosão) não atravessam mais parede fina.
- O jogo e o servidor usam exatamente a mesma física agora, então no online o servidor não te "puxa de volta" quando você encosta no teto ou numa parede.

## v1.5.5 (21/10/2026)
- **Captura bem mais demorada na Dominação:** sozinho na zona agora leva **25 s**, e cada aliado a mais tira 1 s: 2 → 24 s, 3 → 23 s… até **16 s com 10**. Neutralizar o progresso do outro time vai na mesma velocidade.
- Zona vazia continua perdendo 10% por segundo (zera em até 10 s).

## v1.5.4 (21/10/2026)
- **Tempo da partida configurável:** ao criar a sala (e no lobby, só o anfitrião) tem o campo **Tempo**: Padrão, 3, 5, 7, 10, 15 ou 20 min. "Padrão" continua 5 min no Mata-mata e 7 min na Dominação. Quem não é anfitrião vê o tempo escolhido no lobby. Mudou no meio da partida? Vale a partir da próxima. O menu offline também ganhou o campo **Tempo**.
- **Captura mais demorada na Dominação:** sozinho na zona leva **15 s** (antes 8 s); com 2 do time, 7,5 s; com 3 ou mais, 5 s.

## v1.5.3 (21/10/2026)
- **Salas online com até 10 jogadores:** ao criar a sala ou no lobby, o máximo agora vai até **10** (com bots completando, se quiser). Dois bots novos, **Coxinha** e **Pururuca**, e o placar do canto mostra até 10 linhas.

## v1.5.2 — Skins novas (21/10/2026)
Agora são **17 skins**. Chegaram três novas no fim da lista:
- **Boi Caprichoso:** chifrinhos brancos, túnica azul com estrela branca no peito, franja nos ombros e saiote de fitas azuis e brancas.
- **Docão Felipe:** cabelo bagunçado, óculos pretos grossos, camisa grafite com listras verde-água, short preto e tênis preto de sola branca.
- **Docão Matheus:** topete curto, bigodinho e barba rala, olhos verdes, moletom preto de capuz, crachá vermelho da Cheers com o "C!", calça preta e tênis branco.
- No online as skins novas aparecem certinho pra todo mundo (servidor atualizado junto).

## v1.5.1 (21/10/2026)
- **Renascimento agora leva 5 s e tem botão:** depois de morrer o botão mostra a contagem ("Renascer em 4.2s") e, liberado, você volta clicando em **RENASCER** (ou Espaço/Enter). Dá tempo de escolher a arma com calma.
- Bots continuam renascendo sozinhos; no online vale o mesmo (o servidor só te traz de volta quando você clica).

## v1.5 — "Churrasco Moggado" (21/10/2026)
- **Faca de churrasqueiro:** nova arma no **slot 3** (tecla 3, rodinha ou **V** pra troca rápida; no cartão da tela de morte o atalho é **V**).
  - **Clique esquerdo:** golpe (segurando, repete).
  - **Botão direito:** estocada, só com a faca na mão. Nas armas de fogo o botão direito continua sendo a mira.
  - **Pelas costas mata na hora.**
  - Kill feed novo: **"X moggou Y [Faca]"**, tela de morte com **MOGGADO!** e "Você foi moggado por [nome]".
- **Animações de recarga** em todas as armas: pente caindo, cartuchos entrando, ferrolho das snipers, bazuca no ombro (também em 3ª pessoa).
- Correção: as armas voltam a dar dano depois de **Próximo mapa** e **Jogar de novo** no online.
- Correção: a skin do Docão volta a aparecer no menu logo no começo.
- Correção: na **Vizinhança Cheers** a câmera do menu ficava dentro do ônibus e a skin não aparecia; agora ela procura um ângulo livre em qualquer mapa. A barra de prêmios por abate não aparece mais por cima do Docão no menu.
- **Tela de morte compacta**, ancorada embaixo: todas as armas cabem mesmo em telas menores.

## v1.4.1 — Mira, snipers e prêmios 🎯 (21/10/2026)
Feito pelo **[@rramosjoao](https://github.com/rramosjoao)** (PRs #1 e #2).
- O botão direito mira em todas as armas. Na sniper abre a luneta, e no ferrolho a mão do Docão puxa o ferrolho
- Três snipers: Torresmo (meio), Canhão do Barril (pesada, pouca bala) e Carabina da Granja (leve e rápida), cada uma com a sua luneta. O menu ganhou o slider Mirando
- Acerto mostra o X, os pontos (+10, +100, +150) e medalhas. Abates seguidos: Dupla na chapa, Trio frito, Ultra na brasa, Fantástico e Incrível
- Granada de fumaça (tecla 4) e de atordoamento (tecla 5)
- Prêmios por abates sem morrer: no 3 um minimapa que gira com você, no 5 um tablet para marcar 3 mísseis, no 7 o rádio que derruba todo mundo

## v1.4 — "Pururucado" (21/10/2026)
- **Kill feed novo:** "carimbou" virou **"pururucou"**, com frases engraçadas sorteadas a cada abate:
  *fritou, transformou em torresmo, mandou pra chapa, defumou, fez virar bacon, serviu no café da manhã, botou no espeto, temperou com chumbo…*
- Tela de morte agora mostra **PURURUCADO!** e "Você foi pururucado por [nome]".
- Suicídio: "se pururucou", "virou bacon sozinho", "se jogou na frigideira", "fritou no próprio óleo".
- Tiro na cabeça: **"direto no focinho!"**

## v1.3 — Bacon & Nomes (21/10/2026)
- **Animação de morte:** o Docão estoura e vira **bacon** fritando no chão (com fumaça, brilho de gordura e chiado).
- Câmera de morte em 3ª pessoa mostrando o seu bacon antes de escolher as armas.
- **Nome do jogador:** campo no menu, na janela online e no lobby (botão "Trocar"). Fica salvo e aparece na plaquinha, no placar, no kill feed e na tela final. Nomes repetidos viram "Nome (2)".

## v1.2 — Mapas v2 (21/10/2026)
Os 7 mapas foram refeitos com construções de verdade: casas com interior, escadas, andares, telhados, becos, cobertura e corredores longos pra AWP. Bots sobem e descem andares.
- **Duas Pocilgas** (estilo Dust2): túneis do B, portas do meio, catwalk, longo do A, casas de 2 andares.
- **Mercadão** (estilo Mirage): palácio com sacada, apartamentos, conector, sala da janela, mercearia.
- **Vizinhança Cheers** (estilo Nuketown): duas casas de 2 andares com varanda, telhado da garagem, quintais, ônibus.
- **Celeiro Industrial** (estilo Rust/Office): galpão com mezanino, escritórios, ponte, contêineres, guarita, silos.
- **Bar Cheers Noturno** (estilo Office): ala de 2 andares, VIP com sacada, terraço, banheiros, sinuca, palco do DJ.
- **Arena da Fazendinha** (3 corredores): bases de 2 andares com terraço, celeiro com jirau, túnel do galinheiro.
- **Torres Gêmeas do Barril** (mapa de sniper): torres de 3 níveis, ruínas, trincheira, ponte e casamata.
- Correção: quem entra no meio da partida sempre escolhe o time antes de nascer.

## v1.1 — Dominação (20/10/2026)
- **Novo modo Dominação:** dois times (Vermelho × Azul). Zonas aparecem em pontos aleatórios; quanto mais gente do time dentro, mais rápido captura (até 3×). Zona disputada pausa. Primeiro time a **5 zonas** vence.
- Seta na borda da tela com a **distância em metros** até a zona.
- **Placar sempre visível** no canto superior esquerdo.
- **Escolha de time** (Vermelho / Azul / Automático) antes da partida e ao entrar no meio.
- **Tela de morte clicável:** escolha as armas com o mouse (teclas continuam funcionando).
- **Explosões melhores:** bazuca e granada medem a distância até o corpo (não o centro) e pegam quem está meio escondido; foguete direto sempre acerta.
- **AWP mais precisa:** dispersão zero com luneta parado, tiro sai exatamente do centro da mira.

## v1.0 — Multiplayer online (20/10/2026)
- **Jogar online com amigos** (grátis, servidor na Cloudflare): crie uma sala e mande o link `docao.mvalentim.dev/?sala=ABCD`.
- Até 8 jogadores, bots completam a sala, o dono escolhe mapa e quantidade.
- Servidor decide tiros, dano, granadas, foguetes, placar e respawn (com anti-cheat básico e compensação de lag).
- Reconexão automática mantendo o placar.

## v0.x — Lançamento
- FPS do Docão inspirado no Shell Shockers, contra bots.
- 14 skins: Clássico, Clube Cheers, Rei do Pop, Rapper da Hora, Bruxinho, Mestre do Kung Fu, Cabeludo, Pescador, Choquinho, Boné da Firma, Fantasminha, Esqueletão, Cavaleiro Galáctico e Nômade do Deserto.
- Armas: fuzil, AWP, 12, bazooka e pistola (1 primária + 1 secundária).
- **Granada Red Cup** com o logo Cheers: até 3 cargas, segure Q pra dosar a força.
- Zoom no Shift.
