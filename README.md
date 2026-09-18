# Precifica Estética

App web (PWA) para precificar serviços de estética automotiva — loja fixa ou delivery/mobile.
Sem backend, sem banco de dados: todos os dados ficam salvos no `localStorage` do próprio navegador/celular.

## Como usar agora (mais rápido)

1. Baixe/descompacte a pasta.
2. Rode um servidor local (necessário por causa do Service Worker):
   ```
   cd precifica-estetica
   python3 -m http.server 8080
   ```
3. Abra `http://localhost:8080` no celular (mesma rede Wi-Fi) ou no computador.
4. No celular: menu do navegador → "Adicionar à tela inicial" → vira um app com ícone próprio, funciona offline depois da primeira abertura.

## Como continuar/editar este projeto no Claude Code

Abra esta pasta com o Claude Code (`claude` no terminal, dentro da pasta `precifica-estetica`) e peça ajustes, por exemplo:
- "adicione categoria de PPF com preço por m²"
- "quero gráfico de lucro por serviço"
- "mude as cores para..."

Arquivos:
- `index.html` — estrutura das telas (Serviços, Custos Fixos, Taxas, Resumo)
- `styles.css` — visual (tema escuro, mobile-first)
- `app.js` — toda a lógica de cálculo e persistência (`localStorage`)
- `manifest.json` + `sw.js` — deixam o app instalável e funcionando offline
- `icons/` — ícone do app

## Como publicar para acessar de qualquer celular com link fixo

Como é só HTML/CSS/JS estático, pode subir grátis em:
- **Netlify** ou **Vercel**: arraste a pasta no painel (drag-and-drop deploy)
- **GitHub Pages**: suba a pasta num repositório e ative Pages

Isso não muda a lógica de "sem banco de dados": os dados continuam salvos só no aparelho de quem acessa.

## Lógica de cálculo (baseada na planilha original)

1. **Custos fixos mensais** (aluguel, combustível, produtos, telefone, MEI, seguro, manutenção, marketing) são somados e divididos por dias úteis/mês e depois por horas/dia → **custo fixo por hora**.
2. Cada serviço tem um **tempo em horas** → `custo fixo do serviço = tempo × custo fixo por hora`.
3. Some o **custo variável** (produtos usados) e, no modo delivery, o **custo de deslocamento** (km × custo por km) → **custo total**.
4. **Preço mínimo** = custo total (abaixo disso é prejuízo).
5. **Preço sugerido** = `custo total ÷ (1 − margem desejada %)` — método de markup recomendado (mais preciso que "custo × multiplicador fixo").
6. Sobre o **valor efetivamente cobrado**, descontam-se taxa de cartão, comissão e imposto → **recebido líquido** → **lucro** e **% de lucro real**.

### Diferença loja fixa × delivery/mobile
No modo **Delivery/Mobile**, cada serviço ganha um campo de distância (km, ida e volta) e o app soma automaticamente o custo de deslocamento (combustível + desgaste do veículo) ao custo do serviço — prática recomendada para não "engolir" essa despesa e descobrir depois que o atendimento a domicílio dá menos lucro que parecia.

## Boas práticas de mercado usadas no app
- Separar custo fixo, custo variável e hora técnica antes de definir preço (não "chutar" preço olhando concorrente).
- Definir margem de lucro **sobre o preço final**, não como um "adicional" sobre o custo — evita erro clássico de subprecificação.
- Sinalizar serviços vendidos abaixo do preço mínimo (aba Resumo) para não vender no prejuízo sem perceber.
- Precificar por nível/categoria (lavagem, higienização, polimento, vitrificação, PPF) ajuda a comunicar valor e aumentar ticket médio.
