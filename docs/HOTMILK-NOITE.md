# HOTMILK à Noite — contrato com o Survival

Mapa exclusivo do Survival da Invasão. A branch das portas não mexe no seletor, na pistola inicial, na máquina de upgrade, na mystery box nem na arma de parede. Esses quatro pontos já têm lugar no mapa e saldo pra debitar.

## Ligar o modo

Qualquer um destes três liga o Survival. Os três passam por `isSurvivalMode` em `shared/survival.js`:

- `cfg.mode = 'survival'`
- `cfg.mode = 'inv'` e `cfg.variant = 'survival'`
- `cfg.survival = true`

Com o modo ligado, `Game.mapList` é `SURVIVAL_MAPS`. Hoje essa lista tem só `hotmilk-noite`. Pedir outro mapa cai nele. A Invasão padrão (`mode: 'inv'` sem variant) continua com `INV_MAPS` e não vê este mapa. Mata-mata, Bomba e X1 também não.

No cliente, `menuPool('survival')` devolve a mesma lista. O `<option value="survival">` do seletor fica na outra branch. `fillMapSelect` já trata o valor.

## Saldo

`ent.points` é o saldo da partida, por jogador. Não é Docoins.

- Começa em `SURVIVAL.START_POINTS` (500).
- Acerto em zumbi: `pointsForHit` — 10, no máximo 4 por corpo.
- Abate: `pointsForKill(zt, { head, knife })`. Andador 70, corredor 90, cuspidor 110, barrigão 160, chefão 500. Cabeça +40. Faca +30.
- `trySpendPoints(ent, preço)` debita. Upgrade, caixa e parede devem usar esta função, no mesmo campo. Não somar de novo no abate: o servidor já credita em `killZombie` / `damage`.

Porta é o servidor. Mensagem `{ t: 'door', id }`. Perto do `door.at` (2,35 m), com um dos lados já aberto e saldo bastante, debita, abre pra sala inteira e libera a área do outro lado. Evento `['door', id, buyerId, points, areasLiberadas]`. Saldo novo chega no pessoal `['pts', total, delta]`.

## O que o mapa já traz

`map.survival` em `maps-hotmilk-noite.js`:

| campo | uso |
| --- | --- |
| `playerSpawns` | onde a partida nasce (12 vagas no saguão). `map.spawns` é o grafo do mapa aberto, pro audit. |
| `areas[]` | `id`, `name`, `start`, `box`, `zspawns` |
| `doors[]` | `id`, `areas`, `price`, `prompt`, `at`, `block` |
| `anchors.upgrade[]` | máquina. `{ id, area, x, y, z, yaw }` |
| `anchors.mystery[]` | caixa. A de `start: true` é a primeira. As outras são os cantos pra onde ela pode mudar. |
| `anchors.wall[]` | arma de parede. `weapon` é `WEAPONS[].key`. `suggestedPrice` é sugestão. |

Áreas, da mais barata pra mais cara: cozinha 750, estoque 1000, escada 1250, praça 1500, serviço 1750, bloco 02 2000, telhado 2250, garagem 2500, portão 2750, cancela 3000, passarela 3250. Cada área tem duas portas, então o circuito fecha.

Zumbi só nasce em `unlockedZombieSpawns`. Abrir a porta chama `rebuildDoors`: a folha sai da colisão e o grafo (`nav.js`) passa a entrar na área.

A garagem é um anexo de teto baixo no y = 0. A física não aceita chão negativo (`groundAt` começa em 0), então não há subsolo de verdade. O térreo dos dois blocos e a garagem têm uma laje fina (6 cm): o `building()` só fecha o piso a partir do segundo andar, e sem a laje o asfalto da rua aparecia dentro. `palette.shadow: false` desliga a sombra do sol neste mapa. O frustum cobria o campus inteiro, escurecia todo interior e pesava o quadro.
