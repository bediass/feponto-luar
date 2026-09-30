# Fê Ponto Joias e Luar Acessórios

Código-fonte e identidade visual de duas operações independentes de joalheria
e acessórios, em Nova Lima e Belo Horizonte, Minas Gerais.

As duas marcas são separadas. Compartilham a arquitetura, não o negócio: cada
uma tem seu próprio banco, seu próprio domínio e sua própria identidade.

## Estrutura

```
feponto/
  site/         loja pública (HTML, CSS e JavaScript, sem framework)
  gestao/       ERP em React + Vite + Supabase
  identidade/   paleta, tipografia, logo e guia de marca
luar/
  site/         loja pública
  gestao/       ERP em React + Vite + Supabase
  identidade/   paleta, tipografia, logo e guia de marca
```

## Arquitetura

Cada marca roda sobre um projeto Supabase próprio, compartilhado entre a loja e
o ERP: a peça cadastrada no sistema aparece na loja quando marcada como
visível. A loja lê o catálogo ao vivo, no navegador, com chave publicável e
leitura restrita por RLS e por privilégio de coluna.

Nenhuma das duas lojas tem checkout. O carrinho fecha no WhatsApp com a lista
de peças. Os quatro projetos são publicados como sites estáticos no Cloudflare
Pages.

### Fê Ponto Joias

ERP com estoque, vendas, clientes, financeiro, produção, consertos,
consignação, etiquetas e certificado de garantia em PDF. O preço de venda é
recalculado a partir da cotação do ouro, por rotina diária no banco.

### Luar Acessórios

ERP com catálogo, kits, vendas, envios e cartão de garantia em PDF. O preço sai
de um markup sobre o custo, com arredondamento em múltiplos de cinco reais.

## O que não está aqui

Este repositório traz código e identidade visual. Ficam de fora a memória
operacional das duas marcas, os documentos internos, as notas de infraestrutura
e a análise de segurança.

Não há segredo neste repositório. As chaves de Supabase presentes no código da
loja são publicáveis por definição: elas já viajam no JavaScript que qualquer
visitante baixa, e o que protege os dados é a política de acesso no banco, não
o sigilo da chave. As chaves privadas vivem em arquivos `.env.local`, que nunca
foram versionados.

## Como rodar um ERP localmente

```bash
cd feponto/gestao   # ou luar/gestao
npm install
cp .env.example .env.local   # preencha com as suas credenciais
npm run dev
```
