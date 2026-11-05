# Créditos de áudio

Nada nesta pasta veio de Call of Duty, da Activision ou de vídeo de gameplay.
O repositório é público: sample extraído de jogo comercial não entra aqui.

## Snipers (Sniper Torresmo, Canhão do Barril, Carabina da Granja)

| Arquivo | O que é | Fonte | Licença |
| --- | --- | --- | --- |
| `sniper/torresmo-*.ogg` | tiro perto (2 variações), tiro longe, ferrolho, recarga | síntese original | obra do projeto, redistribuível com o jogo |
| `sniper/canhao-*.ogg` | idem, sniper pesada | síntese original | obra do projeto, redistribuível com o jogo |
| `sniper/carabina-*.ogg` | idem, sniper leve | síntese original | obra do projeto, redistribuível com o jogo |

Gerados por `tools/synth-sniper-audio.py` (numpy). Cada tiro é síntese procedural:
onda N do estalo supersônico, ruído de choque, corpo com queda de pitch, saturação
leve e cauda de terreiro (reflexos borrados que decaem — não um segundo tiro).
O ferrolho é atrito de aço e impacto curto, no tempo da animação. Codificado em
Ogg Vorbis com ffmpeg (`libvorbis`, qualidade 8). Não há sample de banco
(Freesound, Sonniss ou outro) nem áudio de terceiros: a licença é a do próprio jogo.

O tiro não tem eco nem slapback. O peso é o thump (cerca de 40–120 Hz) e o crack.
A Carabina é a mais curta e aguda, o Torresmo fica no meio, o Canhão é o grave
mais longo. A recarga da Carabina tem um assobio bem baixo, de propósito.

Para regerar:

```bash
python3 tools/synth-sniper-audio.py
```

O ferrolho segue as frações da animação em `sniper-view.js` (abre, puxa, cápsula, fecha).
A recarga segue os momentos já usados em `main.js` (abre, três cartuchos, fecha).

## Vozes do Copo Bomba (já existiam)

| Arquivo | Fonte | Licença |
| --- | --- | --- |
| `granada.mp3` | gravação do Matheus, ver `grenade-voice.js` | não documentada no repositório; arquivo anterior a este trabalho |
| `banana.mp3` | gravação do Matheus, ver `grenade-voice.js` | não documentada no repositório; arquivo anterior a este trabalho |

Este trabalho não altera esses dois arquivos.
