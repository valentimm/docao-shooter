# Notas de mapas — Docão Shooter

## Escala

**1 unidade do jogo = 1 metro.**

O código trata a unidade como metro o tempo todo (raios de explosão de 5 m e 6 m, cobertura a até 7 m, rocket jump de cerca de 2,5 m). As constantes em `shared/rules.js` fecham com um Docão um pouco mais alto que um soldado real:

| Medida | Valor | Em metros |
|---|---|---|
| Altura do corpo (`HEIGHT`) | 2,0 | 2,0 m |
| Olho (`EYE`) | 1,6 | 1,6 m |
| Raio do corpo (`RADIUS`) | 0,42 | largura 0,84 m |
| Corrida (`SPEED`) | 6,8 | 6,8 m/s |
| Passo automático (`STEP`) | 0,45 | sobe até 0,45 m sem pular |
| Pulo | `JUMP` 8,5, `GRAV` −24 | altura ≈ 1,5 m |
| Parede típica | 0,5 | 0,5 m de espessura |
| Porta dos prédios | vão ≥ 2,6, altura 2,6 | cabe o Docão de 2,0 m com folga |
| Pé-direito de andar | 3,3–3,6 | laje de 0,3 m; vão livre ≈ 3,0–3,3 m |

Uma porta real de 2,1 m bateria na cabeça. Por isso as portas daqui são mais altas e mais largas que as do CoD, e os corredores apertados ficam perto de 2,5–3,5 m em vez de 1,5 m: abaixo disso o corpo trava.

O chão padrão é y = 0. O limite do mapa continua sendo uma parede com colisão de 40 m (`WALL_COLLIDE_H`).

Queda fatal é opt-in, em `map.fall`:

- `y`: se o corpo fica abaixo disso, morre (sem atacante; o feed diz que despencou).
- `margin`: faixa interna da borda, em metros, sem chão.
- `rects`: retângulos extras `[x0, z0, x1, z1]` sem chão.
- Onde não há chão, a física usa um piso fantasma em y = −40. A morte acontece em `fall.y` (nos mapas atuais, −8), antes de encostar nesse piso.
- O servidor valida: aceita a queda (não devolve o jogador pra cima) e mata. O mesmo vale para bot. Offline o cliente mata na hora; online espera o evento do servidor pra não contar duas vezes.

## Posto Nevasca (rodada 1) — referência Summit (BO1)

Nome original. Layout em linha, não cópia: planta lida do minimapa com grid A1–E5 e do bird's eye do dossiê (`summit/DOSSIE.md`). Escala adotada lá: área jogável ≈ 50 × 120 m, tolerância ±20%.

Eixo longo no Z. Norte (+Z) = lab / spawn 1. Sul (−Z) = galpão e estrada / spawn 2. Oeste (−X) = penhasco. Leste (+X) = salas estreitas.

| Área | Caixa (m) | Notas |
|---|---|---|
| Mapa | 52 × 120 (`size` [26, 60]) | dentro do ±20% de 50 × 120 |
| Lab norte | x −14…10, z 48…58 (24 × 10), altura 3,5 | 1 andar, duas portas pro pátio, divisória em z = 53,2 |
| Prédio do meio (B3) | x −12…2, z 33…45 (14 × 12) | 2 andares, mezanino a +3,4 m, rampa interna no eixo X |
| Garagem | x 8…18, z 34…46 (10 × 12), altura 3,6 | portão largo no sul |
| Sala Fria (control room) | x −2…20, z 6…28 (22 × 22) | dossiê pedia ~25 × 20. 5 portas. Mezanino a **+3,4 m** (dossiê +3 m). Átrio aberto no meio. Claraboia ~7 × 7 m no teto a +6,8 m. Guarda-corpo de 1,0 m |
| Salas leste | x 20…26, z 8…32 (6 × 24), altura 3,3 | CQB, duas divisórias, a parede oeste é a da Sala Fria |
| Passarela do penhasco | x −24,6…−21,2 (vão ~3,4), z −6…36 | dossiê: corredor de 2,5–3,5 m. Muro de rocha de 8 m no oeste. Guarda-corpo de 1,05 m (não tampa o olho a 1,6 m) |
| Teleférico | cabine x −26…−22,7, z 42…47 | piso a **+2,37 m**, vão interno 2,6 m, rampa a partir do pátio. O rasgo do penhasco fica entre z 41,5 e 48,2 |
| Torre do cabo | plataforma x −20,5…−15,5, z 37…42 | piso a **+8,15 m** (dossiê +8…12 m). Duas rampas (0→4,05→8,15), porque o pulo só sobe 1,5 m |
| Pátio sul | z −30…6, com caminhão, tanque e barris | cobertura a ≤ 7,2 m |
| Galpão sul | x −12…12, z −46…−30 (24 × 16), altura 3,6 | telhado andável, mureta de 1,15 m, rampa pelo sul, antena |
| Neve no telhado | 0,28–0,35 | dossiê: 20–40 cm |
| Montes | 0,55–1,0, base ≤ 2 m | dossiê: 0,5–1 m. Base pequena para o teste de “campo aberto” não contar o topo do monte |
| Neblina | `#C9D3DC`, linear 48→170 m | dossiê: some por volta de 150–200 m |
| Céu | `#D5DEE6`, sol frio e fraco | nublado |
| Neve caindo | 1400 pontos, um draw call, vento +x | flocos param em cima dos telhados listados. Sem malha por floco (Safari) |
| Pinheiros | `InstancedMesh`, 2 draw calls | 6 árvores |

Spawns: 6 no norte (z 38…52) e 6 no sul (z −58…−44), distância mínima 4,5 m. O jogo não tem lista separada por time: na Dominação o renascimento ignora aliado e foge da linha de visão inimiga, então as duas pontas funcionam como os spawns dos times. Travessia reta das pontas ≈ 100 m / 6,8 m/s ≈ 15 s; com o miolo, perto dos 18–22 s do dossiê.

Linha longa medida na auditoria: cerca de 100 m (a passarela ainda está reta demais; a meta do dossiê é 40–60 m). Visão quebrada: ~22% dos pares a ≥ 10 m se enxergam (teto do teste: 30%). Ponto mais aberto: 7,2 m.

## Posto Nevasca — rodada 4

A linha de 77,8 m da rodada 3 era no chão: origem x 23,9 z −59,1, olho 1,6 m; destino x −0,1 z 14,9, olho 1,6 m. Um contêiner no pátio sul, a cerca de 39 m da origem, corta essa linha. O novo máximo da mesma amostra é **57 m**, pelo nível dos telhados: x 5,9 z −45,1 olho 5,2 até x −6,1 z 10,9 olho 5,0.

Sala Fria 28 × 22 m em x −16…12, z −6…16 (pesquisador x 10…38, y 44…66), alinhada à borda oeste do prédio do meio. Lab 15 × 10 m em x −8…7, z 36…46. Prédio leste 13 × 14 m em x 1,2…14,2, z 18…32. A passarela fica a oeste, por fora da Sala Fria. Planta em `screenshots/18-mapa-posto-nevasca-planta.png`. Log em `screenshots/18-mapa-posto-nevasca-raycast.txt`.

As bordas leste e oeste não desenham o muro do limite. Fica a borda de rocha de 1,15 m em #4A4E54, o colisor invisível de 4 m e a encosta até −30 m.

## Posto Nevasca — rodada 3

Coordenadas atuais, no motor (x oeste negativo, z norte positivo) e na convenção do pesquisador (x_p = x + 26, y_p = 60 − z):

| Volume | motor | pesquisador |
|---|---|---|
| Lab | x −14…10, z 36…46 | x 12…36, y 14…24 |
| Bloco oeste (prédio do meio) | x −16…−2, z 19…31, 2º piso +3,4 m | x 10…24, y 29…41 |
| Bloco leste | x 1,6…19,6, z 18…32 | x 27,6…45,6, y 28…42 |
| Sala Fria | x −2…20, z −6…16 | x 24…46, y 44…66 |
| Corredor entre os blocos | x −2…1,6 (3,6 m) | — |

Na rodada 2 o lab estava em z 48…58 (y 2…12) e a Sala Fria em z 6…28 (y 32…54), cerca de 12 m mais ao norte do que a leitura do pesquisador. Os dois, mais os prédios do meio, desceram 12 m. Alas de um andar colam o lab nos prédios do meio, e um telhado liga o bloco leste à Sala Fria, para o miolo ler como um conjunto e não como caixas soltas.

Visada da rampa da torre para o sudeste: **nenhuma linha livre** (origem na rampa, y > 1, x −24…−17, z 20…46; alvo com x > 5 e z < −5). O painel de 1,1 m fecha o flanco leste; a janela de 2 m ficou no norte, entre x −21,6 e −19,6. A do corredor oeste no chão é **36 m**. A amostra do auditor (a mesma que media ~112 m na rodada 1) ainda acha uma linha de **78 m** cruzando o mapa; não é mais a reta do penhasco nem a rampa.

Penhasco: o muro oeste do limite do mapa não é desenhado. Aparecem a borda de rocha de 1,15 m, o mastro com a placa e a encosta até −30 m, com pinheiros. O colisor de 4 m continua invisível, com abertura no pico da curva. Morte em y < −6.

## Posto Nevasca — rodada 2

Coordenadas do pesquisador: x 0 oeste → 52 leste, y 0 lab → 120 galpão. No motor, x = x_pesquisa − 26 e z = 60 − y_pesquisa. O vão entre o lab e a Sala Fria, lido no print como y 32–48, no motor é z ≈ 30–46 (o lab está em z 48–58, y de pesquisa 2–12, não 12–28).

O prédio do meio de 14×12 m da rodada 1 era x −12…2, z 33…45. Na vista de cima ele colava no lab. Na rodada 2 ele foi refeito como o bloco oeste do pátio: **x −16…−2, z 31…43** (14×12 m), dois andares, piso a +3,4 m. Ao lado, o bloco com escada: **x 1,6…19,6, z 30…44** (18×14 m). O corredor entre eles tem 3,6 m.

Passarela: curva de até 5 m para oeste, pico em z = −2 (y de pesquisa 62). Rochas de 5×4×4,2 m em z 13–17 e z −34…−30 (y 43–47 e 90–94). Cobertura de 1 m a cada ~12 m. A visada no chão do oeste, medida olho a olho, ficou em **34 m**. A maior visada do mapa inteiro ainda passa de 60 m: é a rampa da torre (y ≈ 4) olhando o sudeste, não o corredor oeste.

Penhasco: borda de rocha de 1,15 m, colisor invisível de 4 m no resto do trecho, e um vão no pico da curva onde dá para cair. Kill em y < −6. Encosta visual até −30 m, pinheiros no fundo, neblina de altura abaixo de −10 m. A placa PENHASCO está num mastro na borda. Neblina de distância: 40–120 m. Montanhas claras no horizonte. Sombras suaves.

Sala Fria: claraboia de vidro em quatro panos, 8×12 m, a +6,8 m. A neve para no vidro e não entra. Consoles de 1,1 m, seis arquivos de 2 m, parede de relógios no mezanino, guarda-corpo de 1 m, seis luzes `#F2D9A0`.

Pátio sul a −1,5 m, com escada metálica. Teleférico com janela e dois cabos até a torre treliçada e para fora, na neblina. Silhueta de helicóptero a leste.

## Morro do Leitão (rodada 1) — referência Favela (MW2)

Nome original. Planta do guia `Favela.png` (dossiê): eixo leste–oeste ~130 m, norte–sul ~110 m. Aqui o retângulo é **132 × 112 m** (`size` [66, 56]), com **5 m de borda sem chão** (`fall.margin`). A faixa jogável fica perto de 122 × 102 m.

| Área | Caixa (m) | Notas |
|---|---|---|
| Rua principal | z −36…−26, x −52…54, asfalto | ~10 m de largura. Carros e caixotes nas calçadas; o miolo fica livre. Dossiê pedia 8–10 m e ~90 m de comprimento |
| Casa de tijolo | x −22…6, z −50…−39 | 2 andares de 3 m, telhado |
| Sorvete (azulejo) | x −10…8, z −24…−8 | 2 andares |
| Bar | x 10…26, z −8…12 | 3 andares (0 / +3 / +6), telhado a +9 m |
| Casa verde | x 16…36, z −24…−8 | 3 andares |
| Barbeiro | x 38…54, z −24…−12 | 2 andares, reboco |
| Lavanderia | x 40…58, z −6…10 | 3 andares, caixa d'água no teto |
| Prédio amarelo | x −34…−16, z 2…20 | 2 andares |
| Crackhouse | x −36…−18, z −22…−2 | 2 andares, tijolo |
| Campinho | x 28…52, z 14…34 (24 × 20) | dossiê ~25 × 20. Traves de 2,3 m |
| Platô norte | x −40…24, z 26…46, topo a **+4 m** | a vala de cima. Três rampas de 8,5 m sobem 4 m |
| Jardim da laje | x −18…2, z 30…44, em cima do platô | 2 andares (pisos +4 e +7) |
| Barracos | x 6…22, z 32…44, no platô | 1 andar + rampa pro teto |
| Cemitério | x 46…58, z −42…−30 | mureta e túmulos |
| Vielas | ≥ 3,2 m entre prédios | o dossiê pede 1,5–2,5 m; abaixo de ~2,6 m o Docão (0,84 m) trava |
| Pé-direito | 3,0 m por andar | laje de 0,3 m; vão livre 2,7 m. L2 = +3 m, L3 = +6 m, como no dossiê |

Spawns: 6 na rua sul (z ≈ −31) e 6 no platô norte (y = 4). Distância mínima 8,9 m. Times nas duas pontas, do mesmo jeito do Posto Nevasca.

Auditoria: ponto mais aberto a 7,9 m; linha longa de 110 m (os flancos do dossiê são longos de propósito; dá para quebrar na rodada 2); 9% dos pares a ≥ 10 m se enxergam; os 7 bots sobem. Queda na borda: y < −8.

Manhã clara: céu `#9ec4ea`, sol forte, neblina só a 210 m. Cores de tijolo `#a0503a`, azulejo `#8fc4b8`, reboco `#e6d7b8`, grama do campo `#7a8a45`.
