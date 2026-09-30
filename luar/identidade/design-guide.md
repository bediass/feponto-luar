# Design Guide — Luar Acessórios

> Referência visual da marca. Todo material da Luar (site, post, etiqueta) segue este guia.
> Marca **independente** — não usar elementos, cores ou assinatura da Fê Ponto.
> **Status:** paleta definida ✅ · logo e fontes a chegar/aprovar 🔜

---

## Essência

**Elegante, atemporal e refinada — com um toque de luxo (decisão da Luana, jul/2026).**
Madura sem ser velha, sofisticada sem ser fria. Estética de joalheria de bom gosto aplicada a
preço acessível ("quiet luxury"): o produto é acessível, a apresentação é de luxo. Muito respiro,
branco dominante, dourado como toque discreto, serifa dando o ar premium. Nada de varejo gritão,
nada de infantil. **Importante:** o luxo é do VISUAL/tom — o posicionamento comercial segue
acessível e e-commerce (Pix, parcelamento, frete), diferente da venda consultiva da Fê Ponto.

---

## Paleta

### Base (definida)

| Cor | Hex | Papel |
|---|---|---|
| **Fendi (dourado)** | `#BD9F7B` | Cor-assinatura. Botões (CTA), destaques, detalhes, ícones, linhas |
| **Branco** | `#FFFFFF` | Fundo base, respiro |

> Nome dado pela Luana: **"Fendi"** — dourado amendoado/taupe, mais sóbrio e sofisticado que o
> champagne. Trocado em jul/2026 (era `#d8b779`).

### Apoio (em uso no site)

| Papel | Hex | Uso |
|---|---|---|
| Texto (near-black quente) | `#221F1B` | Todo texto principal, títulos, ícones |
| Marfim quente | `#F7F3EC` | Fundo de seções alternadas |
| Hairline / borda | `#E7E0D4` | Bordas, divisórias, inputs |
| Texto secundário | `#7A746B` | Legendas, texto de apoio |
| Fendi escuro | `#A0855F` | Hover/pressed dos elementos dourados |
| Fendi suave | `#EDE4D6` | Fundo de ícones, badges, chips |
| Sucesso | `#2E7D5B` | "Pagamento aprovado", confirmações |
| Erro | `#B3261E` | Erros de formulário / checkout |

### ⚠️ Regra de acessibilidade (importante — não pular)

O Fendi `#BD9F7B` é uma cor **clara/média**. Texto dourado sobre branco dá contraste **~2.5:1**,
que ainda **reprova** em acessibilidade (WCAG pede 4.5:1). Então a regra da casa:

- ✅ **Botão dourado com texto escuro** (`#221F1B`) → contraste ~6.6:1. Lindo **e** acessível.
- ✅ Dourado como **preenchimento, detalhe, ícone grande, linha decorativa, borda de destaque**.
- ✅ Fendi escuro `#A0855F` só em **texto grande** (títulos/itálico de destaque ≥24px), nunca em corpo.
- ❌ **Nunca** dourado como cor de **texto** de corpo sobre branco, nem para info que precise ser lida.
- Texto e links sempre no **near-black**; link se distingue por sublinhado/peso, não só por cor.

Isso mantém o visual elegante **e** passa na `web-design-guidelines` (que a gente roda antes de entregar).

---

## Tipografia (DEFINIDA — jul/2026)

Direção **A — Sofisticada / luxo atemporal** (decisão da Luana):

- **Títulos:** **Fraunces** — serifa moderna, calorosa, com contraste elegante. Dá o ar premium
  sem ficar "velho". Usar peso mais leve (400–500) nos tamanhos grandes; itálico para ênfase.
- **Corpo:** **Inter** — sans limpa e legível, ideal pro texto de e-commerce (preço, descrição).
- **Labels/botões/eyebrows:** Inter em **maiúsculas com tracking** (`.12em`–`.18em`) — cara de boutique.

> ⚠️ Evitar **Cormorant** de propósito: é a fonte da Fê Ponto. A Luar é marca independente —
> Fraunces entrega a mesma elegância com identidade própria.

---

## Logo

**Logotipo manuscrito "Luar"** — script elegante, com o **"u" desenhado como uma lua crescente**.
Conceito forte: *Luar = luz da lua*. A lua embutida no nome abre um universo de marca
(brilho, luminosidade, noite, "seu brilho").

**Arquivo recebido:** um render com **letra branca + glow (neon) sobre fundo preto**
(`identidade/ChatGPT Image ...png`). Ótimo como imagem de impacto sobre fundo escuro, mas
**não é asset final** pro uso geral: é raster, com brilho, sem transparência.

**Versões provisórias** (extraídas do render, em `identidade/logo/luar-*-provisorio.png`):
near-black, champagne e branca, com fundo transparente. Servem pra destravar o site, mas têm
véu/bordas suaves — **não são o logo final**.

**Falta (pro asset definitivo):** uma versão **flat/vetor** (SVG) do "Luar" sem o glow —
re-exportada da fonte/ferramenta, ou redesenhada. Aí eu completo as regras (área de proteção,
tamanho mínimo, versões oficiais claro/escuro).

> Observação de direção: como a logo **brilha no escuro**, ela pede fundo noturno — o que
> combina com o conceito "luar". Ver decisão de direção visual na conversa/estratégia.

---

## Look & feel

- **Branco é o fundo**; o dourado entra com parcimônia (acento, não base). Dourado demais pesa.
- Fotografia limpa, fundo claro/neutro, produto em destaque; lifestyle jovem.
- Cantos suaves, sombras leves, bastante espaço em branco.

## Faça / Não faça

| ✅ Faça | ❌ Não faça |
|---|---|
| Branco como base, dourado nos CTAs e detalhes | Dourado como cor de texto |
| Texto near-black, alto contraste | Fundo inteiro dourado / gradiente berrante |
| Espaço, respiro, calma | Tom de varejo gritão ("imperdível!!!") |
| Identidade própria da Luar | Elementos ou assinatura da Fê Ponto |
