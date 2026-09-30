# Identidade visual

> Como a marca aparece em tudo que o Closr.exe gera.
> As skills de conteúdo, carrossel e post leem esse arquivo antes de criar qualquer visual.
> Edite quando a marca evoluir.

> **Status (29/07/2026):** o essencial está decidido e em produção — **paleta**
> prata-grafite, **fontes** Cormorant Garamond + Jost, **logo** em vetor. Isso
> não é mais provisório: é o que está no ar no site e no ERP. Continuam a
> validar com a Fernanda e a Luana: os acentos secundários, os detalhes de
> elementos-chave (bordas, raios, sombras) e se as fotos em uso são oficiais da
> marca. Cada item ainda aberto está marcado *(provisório)* no corpo do arquivo.

---

## Cores

Base **confirmada pelo logo** (line art branco sobre preto). Acentos ainda a validar na reunião.

- **Preto (cor de marca):** fundo do logo e âncora da identidade — usar como fundo principal em peças de assinatura (`#000000` / preto quase puro)

- **Branco / off-white:** traço do logo e fundos neutros das fotos (mármore, cristal) — contraste principal

- **Prata / cinza-pérola:** tons neutros de apoio, cards, superfícies

- **Cor de destaque / acento:** **prata-grafite** — luxo monocromático prata (decisão do Bernardo, 22/07/2026, substituiu o dourado que era usado antes). **Em uso no site:** `#B0B5B9` (e variação clara `#C7CBCE`). Usar com parcimônia. ⚠️ Não voltar a usar dourado/champagne como acento.

- **Texto:** branco sobre fundo preto / grafite sobre fundo claro

- **Cor proibida:** cores berrantes, neon, saturadas — quebram o premium monocromático

---

## Tipografia

**Definida e em produção** (site e ERP) desde 22/07/2026 — as famílias abaixo não são mais
palpite. O que resta validar na reunião é se a Fernanda tem preferência declarada por outra
serifada; até ela dizer o contrário, é isto.

- **Títulos e destaques:** serifada elegante (estilo alta joalheria / luxo). **Em uso no site:** Cormorant Garamond

- **Corpo, subtítulos e botões:** sans-serif limpa e discreta. **Em uso no site:** Jost

- **Peso do título:** leve a regular — elegância, não peso

---

## Estilo geral

Sofisticado, minimalista e aspiracional. Muito respiro (espaço negativo), fotografia de produto em destaque com fundos neutros (mármore/cristal). Nada de poluição visual. A peça é a protagonista.

---

## Elementos-chave

*(provisório — refinar com a marca)*

- Bordas: finas ou ausentes
- Border-radius dos cards: suave (cantos levemente arredondados)
- Botões: discretos, sem exagero
- Sombras: sutis, difusas

---

## O que NUNCA fazer

- Visual de varejo popular / "promoção" (selos vermelhos, "OFF", explosões)
- Excesso de cores, gradientes chamativos ou emoji nos visuais
- Poluir a arte — a peça é a protagonista
- Fontes casuais/divertidas que quebram o tom premium

---

## Logo

- **Arquivo:** `identidade/logo.jpg` — monograma em line art branco sobre fundo preto, traço fino e contínuo, com um diamante ao lado.
- **Vetor disponível:** `PROJETO FEPONTO/logo_vetor.pdf` → convertido pra `site/assets/logo.svg` (monoline vertical, `fill=currentColor` / recolorível, off-white). **Em uso centralizado no cabeçalho do site.** O `logo.jpg` de baixa-res fica só como referência.
- **Versão pra fundo escuro:** o logo já é branco — funciona nativamente em fundo preto/escuro. Falta uma versão em preto (ou transparente) pra usar sobre fundo claro.
- **Onde usar:** slide final do carrossel (CTA), header de propostas, slides de apresentação, header/footer do site
- **Tamanho sugerido:** largura entre 120-200px nos HTMLs
- **Regra:** manter o respiro ao redor do logo; nunca esticar, recolorir com cor chamativa, nem aplicar sobre fundo poluído.

---

## Assets fotográficos reais (recebidos 03–04/07/2026)

- `fernanda-alisk.jpg` — retrato editorial da fundadora (em uso na seção **Nossa Essência** do site — a seção se chamava "Curadoria" até 29/07/2026; o `id="curadoria"` ficou no HTML por compatibilidade de link)
- `carrossel-1/` — 9 fotos de peças (quadradas 869×869, em uso no carrossel 360° do site)
- `fundo-hero.png` / `fundo-mobile.png` — **fundos hero antigos**, aposentados em 27/07/2026. No site ficaram como `assets/fundo-hero-antigo.jpg` e `assets/fundo-hero-mobile-antigo.jpg`, fora de uso.

### Fundo hero em uso (trocado em 27/07/2026)

O site usa `assets/fundo-hero.jpg` (desktop) e `assets/fundo-hero-mobile.jpg` (mobile).
A origem, aparentemente, são as duas imagens geradas em 27/07 que estão nesta pasta
com o nome cru do gerador — `ChatGPT Image 27 de jul. de 2026, 20_17_01.png` e
`…20_26_15.png`. O horário casa com o dos JPG do site (20:25 e 20:27), mas é
inferência: **confirmar e renomear** pra `fundo-hero-2.png` / `fundo-mobile-2.png`.

*(Uso aprovado pelo Bernardo no site; confirmar com as sócias se são oficiais da marca.)*

## Observações adicionais

Fonte da leitura de estilo: `identidade/analise-fe-ponto-joias.md` (coleta pública 03/07/2026). Consistência visual já é um ponto forte da marca — manter esse padrão em qualquer peça gerada.
