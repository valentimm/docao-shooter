# Direção visual do menu

Referência aprovada: `logo-madeira-cartoon.webp`. Usar essa linguagem nos próximos visuais do menu. Os rasters do menu estão em WebP, no tamanho em que a interface os mostra.

- Formas robustas e ligeiramente irregulares, com personalidade de fazendinha.
- Contornos escuros, limpos e legíveis em tamanhos pequenos.
- Volume gráfico discreto, com uma face principal, uma luz e uma sombra.
- Materiais sugeridos por poucos traços amplos; evitar veios realistas, arranhões finos, ferrugem fotográfica, brilhos metálicos e ruído de textura.
- Manter o desenho largo e brincalhão das letras da logo. Os letterings são artes, não uma fonte instalável.
- Botões continuam com nomes acessíveis em texto; imagens e ícones são o acabamento visual.

## Cores

- Dourado e creme: letras principais da logo e destaques sobre madeira escura.
- Vermelho de tijolo: placa da logo e ação principal de jogar.
- Ações secundárias: letras e camiseta em creme (`#fff0cc`) sobre fundo verde-escuro (`#294b36`), com contorno profundo (`#172d22`). Evitar letras marrons diretamente sobre madeira clara, combinação rejeitada por baixa separação visual.
- Madeira e papel em tons quentes. Conferir leitura no tamanho real do botão, inclusive em tela estreita.

## Ativos

- Logo: `logo-madeira-cartoon.webp`.
- Arsenal: `lettering-arsenal.webp`.
- Trocar Visual: `lettering-trocar-visual-creme.webp`.
- Ícones das placas: SVG no `index.html`, com faces e contornos editáveis em código.

## Comanda

- Fundo de tábuas claras, com poucos traços amplos, e moldura de madeira marrom escura com encaixes e pregos. Sem textura fotográfica.
- Prendedor e seta de jogar são SVGs com volumes em poucos tons.
- Título e ações usam `lettering-bora-pra-chapa.webp`, `lettering-jogar.webp` e `lettering-juntar-porcada-creme.webp`. Prompts em `COMANDA_CARTOON.md`.
- Campos, nomes de mapa e instruções continuam em texto para permitir edição e leitura clara. O nome usa a mesma etiqueta, tipografia e acabamento dos seletores.
- A rolagem do painel permanece funcional, sem uma barra visível sobre a moldura.

## Moldura e ações

- Contorno externo de madeira com pequenos desvios e lascas desenhados; não usar um retângulo perfeito. Ativo: `clipboard-wood-irregular.svg`.
- Separador do título como traço de tinta com espessura variável: `paint-divider.svg`.
- Jogar e Juntar a Porcada compartilham uma linha e têm o mesmo tamanho. Diferenciar a ação secundária pela cor verde-oliva menos saturada (`#536044`), não pela redução do botão.

## Caixa de armas

- No desktop, a caixa é um modelo 3D com madeira quente, veios largos, nós e lascas discretas, próximos ao assoalho do cenário.
- A inscrição creme é tinta gasta aplicada na face da madeira, sem a extrusão do lettering dos botões. Ela recebe a luz e a perspectiva do modelo.
- O botão HTML transparente mantém o acesso por clique e teclado; em telas pequenas, permanece a placa compacta.

## Entrada no Arsenal

- A tampa gira nas dobradiças depois que o Docão dá espaço. A câmera entra no interior oco da caixa antes de revelar o equipamento.
- O interior usa bandejas de madeira escura (`arsenal-interior.svg`), com seleção marcada em dourado. A comanda e as placas externas ficam ocultas.
- Fechar caixa ou Esc percorre o caminho inverso. Esc também cancela uma abertura em andamento. Durante a viagem, os controles ficam inativos para evitar ações duplicadas.
- A preferência por movimento reduzido pula o deslocamento e mantém o acesso ao mesmo menu.

## Mala de figurinos

- Trocar Visual é uma mala verde de couro envelhecido apoiada na quina direita da caixa, com alça, frisos marrons e fechos de latão fosco.
- Modelo em `menu-wardrobe.js`, com lettering creme pintado na frente, luz e perspectiva da cena. A área clicável acompanha sua posição projetada.
- Em telas estreitas, a ação compacta usa `wardrobe-suitcase.svg`.

## Cenário durante o mergulho

- A ilustração é projetada em uma superfície distante e em um assoalho horizontal (`menu-backdrop.js`), alinhados ao enquadramento inicial.
- O cenário fica ancorado no mundo enquanto a câmera entra na caixa. Chão e paisagem se deslocam em profundidades diferentes, em vez de manter uma imagem fixa na tela.
- O enquadramento é recalibrado com a caixa fechada, inclusive depois de redimensionar a janela.

## Entrada na mala

- Trocar Visual abre a frente articulada da mala, aproxima a câmera e mantém a paralaxe do cenário. A caixa de armas permanece fechada.
- O provador usa forro verde com costuras discretas, seleção dos figurinos e prévia 3D do Docão que acompanha a escolha.
- Fechar Mala e Esc retornam ao enquadramento inicial; movimento reduzido pula a viagem.
