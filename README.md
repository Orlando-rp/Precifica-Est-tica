# Precifica Estética

App web (PWA) para precificar serviços de estética automotiva.
Sem backend, sem banco de dados: todos os dados ficam salvos no `localStorage` do próprio navegador/celular.

## Como rodar localmente

O Service Worker exige um servidor (não funciona abrindo o arquivo direto):

```
cd Precifica-Est-tica
python3 -m http.server 8080
```

Depois abra `http://localhost:8080` no computador ou no celular (mesma rede Wi-Fi).

## Como instalar no celular

- **Android** (Chrome, Edge, Samsung Internet, Firefox): menu do navegador → "Instalar app" / "Adicionar à tela inicial".
- **iPhone**: botão de compartilhar **⬆️** → "Adicionar à Tela de Início". Funciona no Safari e também no Chrome, Edge e Firefox — desde o **iOS 16.4** os navegadores de terceiros podem adicionar à tela de início (antes disso, só pelo Safari).

Depois de instalado, o app abre em tela cheia, com ícone próprio, e funciona offline.

O próprio app tem essas instruções em **Ajustes → Como instalar no celular**, detectando sistema e navegador (`obterInstrucoes()` em `app.js`).

## Como o app se atualiza

O Service Worker busca **a rede primeiro** e usa o cache só como reserva — assim o app instalado não fica preso numa versão antiga, mas continua abrindo sem internet.

Para detectar uma versão nova, o app usa dois sinais:

1. a **assinatura do `app.js` publicado** (`ETag` ou `Last-Modified`, lida com `HEAD` + `no-store`) — pega qualquer deploy, mesmo os que não mexem no `sw.js`;
2. a checagem normal de atualização do Service Worker.

A verificação roda ao abrir o app, ao voltar para o primeiro plano e a cada hora aberto. Quando acha algo novo, aparece a barra **"Nova versão disponível / Atualizar"**; um toque recarrega com os arquivos novos (os dados salvos não se perdem).

**Ajustes → Versão do app** mostra a data da versão em uso e, ao tocar, procura atualização na hora.

> Ao mexer no app, suba a versão do cache em `sw.js` (`const CACHE = 'precifica-estetica-vN'`) para que os caches antigos sejam descartados.

## Publicação

É só HTML/CSS/JS estático. Este projeto é publicado na **Vercel** a partir da branch `main` — todo push no `main` gera um deploy, e cada pull request ganha uma URL de preview. Também funcionaria em Netlify ou GitHub Pages.

Publicar não muda o "sem banco de dados": os dados continuam salvos só no aparelho de quem acessa. Para trocar de aparelho, use **Ajustes → Backup dos dados** (exportar/importar arquivo).

## Arquivos

- `index.html` — estrutura das telas
- `styles.css` — visual mobile-first; tema claro por padrão e escuro automático conforme o sistema
- `app.js` — cálculo, persistência (`localStorage`), telas e atualização do PWA
- `manifest.json` + `sw.js` — instalação e funcionamento offline
- `icons/` — ícones do app:
  - `icon-192.png`, `icon-512.png` — ícone normal (`purpose: any`)
  - `icon-maskable-512.png` — versão que o Android recorta em círculo/losango, com a arte dentro da área segura
  - `apple-touch-icon.png` — 180×180, usado pelo iPhone
  - `icone-fonte.svg` — desenho fonte; edite este arquivo para gerar os PNGs de novo

## Telas

| Tela | O que faz |
| --- | --- |
| Contas fixas | despesas mensais + dias/mês e horas/dia → custo fixo por hora |
| Produtos e insumos | o que você compra (quantidade e valor pago) → custo por ml/g/unidade |
| Taxas e margem | taxa da maquininha, comissão, imposto e margem desejada |
| Serviços precificados | resultado: custo, preço mínimo, preço sugerido e lucro real |
| Ajustes | backup, tutorial, instalação, versão do app |

Na primeira vez o app roda essas telas como um passo a passo guiado (`ORDEM_PASSOS` em `app.js`).

## Lógica de cálculo

1. **Custos fixos mensais** (aluguel, combustível, produtos, telefone, MEI, seguro, manutenção, marketing) são somados e divididos por dias trabalhados/mês e depois por horas/dia → **custo fixo por hora**.
2. Cada serviço tem um **tempo em horas** → `custo fixo do serviço = tempo × custo fixo por hora`.
3. Soma-se o **custo variável** — os produtos usados naquele serviço, calculados pelo custo por unidade de cada insumo, mais "Outros produtos/custos" → **custo total**.
4. **Preço mínimo** = custo total (abaixo disso é prejuízo).
5. **Preço sugerido** = `custo total ÷ (1 − margem desejada %)` — markup sobre o preço final, mais preciso que "custo × multiplicador fixo".
6. Sobre o **valor efetivamente cobrado**, descontam-se taxa de cartão, comissão e imposto → **recebido líquido** → **lucro** e **% de lucro real**.

### Atendimento a domicílio

O app não guarda distância no cadastro do serviço: km é característica do cliente e do atendimento, não do serviço — o mesmo "Lavagem Detalhada" pode ser feito na sua oficina ou a 20 km dali.

Quando houver deslocamento, lance o valor da viagem (combustível + desgaste) em **"Outros produtos/custos"** do serviço naquele orçamento.

## Boas práticas de mercado usadas no app

- Separar custo fixo, custo variável e hora técnica antes de definir preço (não "chutar" preço olhando concorrente).
- Definir margem de lucro **sobre o preço final**, não como um "adicional" sobre o custo — evita o erro clássico de subprecificação.
- Sinalizar serviços vendidos abaixo do preço mínimo para não vender no prejuízo sem perceber.
- Precificar por categoria (lavagem, higienização, polimento, vitrificação, PPF) ajuda a comunicar valor e aumentar o ticket médio.
