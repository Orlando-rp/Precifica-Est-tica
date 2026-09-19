/* Precifica Estética — calculadora de precificação local (sem backend)
   Todos os dados ficam salvos em localStorage, neste navegador/celular.
   Navegação em formato de processo: Contas fixas -> Taxas e margem -> Serviços precificados (resultado). */

const STORAGE_KEY = 'precifica_estetica_v1';
const ONBOARD_KEY = 'precifica_estetica_onboarded';

const DEFAULT_STATE = {
  setupConcluido: false,
  diasUteis: 25,
  horasDia: 9,
  taxaOperacao: 5,
  comissao: 0,
  imposto: 0,
  margemDesejada: 40,
  insumos: [
    { id: uid(), nome: 'Shampoo automotivo', unidade: 'ml', qtdComprada: 1000, valorPago: 0 },
    { id: uid(), nome: 'Cera / selante', unidade: 'ml', qtdComprada: 500, valorPago: 0 },
    { id: uid(), nome: 'Pano de microfibra', unidade: 'un', qtdComprada: 10, valorPago: 0 },
    { id: uid(), nome: 'Pretinho de pneu', unidade: 'ml', qtdComprada: 500, valorPago: 0 },
  ],
  custosFixos: [
    { id: uid(), nome: 'Aluguel', valor: 0 },
    { id: uid(), nome: 'Combustível', valor: 0 },
    { id: uid(), nome: 'Produtos / insumos', valor: 0 },
    { id: uid(), nome: 'Telefone / internet', valor: 0 },
    { id: uid(), nome: 'MEI / contador', valor: 0 },
    { id: uid(), nome: 'Seguro (loja/carro)', valor: 0 },
    { id: uid(), nome: 'Manutenção de equipamentos', valor: 0 },
    { id: uid(), nome: 'Marketing', valor: 0 },
  ],
  servicos: [
    { id: uid(), nome: 'Lavagem Essencial', categoria: 'lavagem', tempoHoras: 1, custoVariavel: 15, valorCobrado: 80, exemplo: true },
    { id: uid(), nome: 'Lavagem Detalhada', categoria: 'lavagem', tempoHoras: 2.5, custoVariavel: 30, valorCobrado: 180, exemplo: true },
    { id: uid(), nome: 'Higienização de bancos', categoria: 'higienizacao', tempoHoras: 3, custoVariavel: 40, valorCobrado: 450, exemplo: true },
  ],
};

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function money(v) {
  if (isNaN(v)) v = 0;
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function pct(v) {
  if (isNaN(v)) v = 0;
  return (v * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
}

// ---------- estado / persistência ----------
let state = load();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    const carregado = Object.assign(structuredClone(DEFAULT_STATE), parsed);
    // o campo pode ter sido salvo vazio enquanto a pessoa digitava
    if (!(Number(carregado.diasUteis) >= 1)) carregado.diasUteis = DEFAULT_STATE.diasUteis;
    if (!(Number(carregado.horasDia) >= 1)) carregado.horasDia = DEFAULT_STATE.horasDia;
    // margem de 100% ou mais é impossível: pode ter sido salva assim antes desta correção
    const maxMargem = margemMaximaDe(carregado);
    if (!(Number(carregado.margemDesejada) >= 0)) carregado.margemDesejada = DEFAULT_STATE.margemDesejada;
    if (Number(carregado.margemDesejada) > maxMargem) carregado.margemDesejada = maxMargem;
    return carregado;
  } catch (e) {
    console.warn('Falha ao carregar dados salvos, usando padrão.', e);
    return structuredClone(DEFAULT_STATE);
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    mostrarToast('Não foi possível salvar os dados neste dispositivo (armazenamento cheio ou bloqueado).');
  }
}

// ---------- cálculos ----------
function calcCustoFixoHora() {
  const totalMes = state.custosFixos.reduce((s, c) => s + (Number(c.valor) || 0), 0);
  const dias = Number(state.diasUteis) || 1;
  const horas = Number(state.horasDia) || 1;
  const totalDia = totalMes / dias;
  const totalHora = totalDia / horas;
  return { totalMes, totalDia, totalHora };
}

function deducoesDe(estado) {
  const taxa = (Number(estado.taxaOperacao) || 0) / 100;
  const comissao = (Number(estado.comissao) || 0) / 100;
  const imposto = (Number(estado.imposto) || 0) / 100;
  return taxa + (1 - taxa) * comissao + imposto;
}

// A margem é uma fatia do preço: 100% significaria custo zero. O que sobra para
// ela é o que as taxas não levam, menos uma folga para o preço não disparar.
function margemMaximaDe(estado) {
  return Math.max(1, Math.floor((1 - deducoesDe(estado)) * 100) - 1);
}

function calcServico(svc) {
  const { totalHora } = calcCustoFixoHora();
  const custoFixo = (Number(svc.tempoHoras) || 0) * totalHora;
  const custoVariavel = Number(svc.custoVariavel) || 0;
  const custoTotal = custoFixo + custoVariavel;

  const taxa = (Number(state.taxaOperacao) || 0) / 100;
  const comissao = (Number(state.comissao) || 0) / 100;
  const imposto = (Number(state.imposto) || 0) / 100;
  // fatia do valor cobrado que nunca chega na sua mão (maquininha, comissão, imposto).
  // A comissão incide sobre o que sobra depois da maquininha, igual ao cálculo do recebido.
  const deducoes = taxa + (1 - taxa) * comissao + imposto;

  const margemDesejada = (Number(state.margemDesejada) || 0) / 100;
  // preço de empate: o que você RECEBE precisa cobrir o custo, não o que você cobra
  const precoMinimo = deducoes < 1 ? custoTotal / (1 - deducoes) : custoTotal;
  // preço que deixa a margem pedida DEPOIS de descontadas as taxas
  const precoSugerido = (margemDesejada + deducoes) < 1
    ? custoTotal / (1 - margemDesejada - deducoes)
    : precoMinimo;

  const valorCobrado = Number(svc.valorCobrado) || 0;
  const taxaOp = valorCobrado * taxa;
  const comissaoVal = (valorCobrado - taxaOp) * comissao;
  const impostoVal = valorCobrado * imposto;
  const recebido = valorCobrado - taxaOp - comissaoVal - impostoVal;
  const lucro = recebido - custoTotal;
  const margemReal = valorCobrado > 0 ? lucro / valorCobrado : 0;

  return {
    custoFixo, custoVariavel, custoTotal,
    precoMinimo, precoSugerido,
    valorCobrado, taxaOp, comissaoVal, impostoVal, recebido, lucro, margemReal,
  };
}

function custoPorUnidade(insumo) {
  const qtd = Number(insumo.qtdComprada) || 0;
  const valor = Number(insumo.valorPago) || 0;
  return qtd > 0 ? valor / qtd : 0;
}

const UNIDADES = { ml: 'ml', l: 'litro', g: 'g', kg: 'kg', un: 'unidade' };

function margemClasse(m) {
  if (m < 0) return 'negativa';
  if (m < 0.2) return 'baixa';
  return 'ok';
}

// ======================================================================
// NAVEGAÇÃO — a configuração inicial é um processo: Contas fixas (1/2) ->
// Taxas e margem (2/2) -> pousa no resultado (Serviços precificados).
// Depois de concluída, o app abre direto no resultado, e os mesmos passos
// ficam disponíveis em "Ajustes" para revisar quando quiser.
// ======================================================================

const TELAS = {
  custos: 'Contas fixas',
  insumos: 'Produtos e insumos',
  taxas: 'Taxas e margem',
  backup: 'Backup dos dados',
  apoie: 'Apoie o projeto',
};
const SUBTELAS = Object.keys(TELAS);
const ORDEM_PASSOS = ['custos', 'insumos', 'taxas', 'apoie'];

let wizardAtivo = false;
let telaAtual = 'servicos';
let telaAoFecharTutorial = 'servicos';

const els = {
  brandArea: document.getElementById('brandArea'),
  backBtn: document.getElementById('btnVoltarHeader'),
  tituloTela: document.getElementById('tituloTela'),
  tabbar: document.getElementById('tabs'),
  wizardFooter: document.getElementById('wizardFooter'),
  btnWizardContinuar: document.getElementById('btnWizardContinuar'),
  stepper: document.getElementById('stepper'),
  stepperLabel: document.getElementById('stepperLabel'),
  stepperFill: document.getElementById('stepperFill'),
  fab: document.getElementById('btnNovoServico'),
};

function mostrarTela(tela) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.getElementById('view-' + tela).classList.add('active');
  telaAtual = tela;

  const ehSubTela = SUBTELAS.includes(tela);

  if (wizardAtivo) {
    els.brandArea.hidden = false;
    els.backBtn.hidden = true;
    els.tabbar.hidden = true;
    els.wizardFooter.hidden = false;
    els.stepper.hidden = false;
    const total = ORDEM_PASSOS.length;
    const passo = ORDEM_PASSOS.indexOf(tela) + 1;
    els.stepperLabel.textContent = `Passo ${passo} de ${total}`;
    els.stepperFill.style.width = (passo / total * 100) + '%';
    els.btnWizardContinuar.textContent = passo === total ? 'Concluir e ver meus preços' : 'Continuar';
  } else {
    els.stepper.hidden = true;
    els.wizardFooter.hidden = true;
    if (ehSubTela) {
      els.brandArea.hidden = true;
      els.backBtn.hidden = false;
      els.tituloTela.textContent = TELAS[tela];
      els.tabbar.hidden = true;
    } else {
      els.brandArea.hidden = false;
      els.backBtn.hidden = true;
      els.tabbar.hidden = false;
      document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tela));
    }
  }

  els.fab.hidden = !(tela === 'servicos' && !wizardAtivo);

  if (tela === 'custos') renderCustos();
  if (tela === 'insumos') renderInsumos();
  if (tela === 'servicos') { renderServicos(); renderResultStrip(); }
  if (tela === 'ajustes') renderAjustesSubtitles();

  document.getElementById('views').scrollTo?.(0, 0);
  window.scrollTo(0, 0);
}

document.getElementById('tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if (!btn) return;
  mostrarTela(btn.dataset.tab);
});

document.getElementById('btnVoltarHeader').addEventListener('click', () => mostrarTela('ajustes'));

document.getElementById('btnWizardContinuar').addEventListener('click', () => {
  const idx = ORDEM_PASSOS.indexOf(telaAtual);
  if (idx < ORDEM_PASSOS.length - 1) {
    mostrarTela(ORDEM_PASSOS[idx + 1]);
  } else {
    wizardAtivo = false;
    state.setupConcluido = true;
    save();
    mostrarTela('servicos');
  }
});

document.getElementById('rowCustos').addEventListener('click', () => mostrarTela('custos'));
document.getElementById('rowInsumos').addEventListener('click', () => mostrarTela('insumos'));
document.getElementById('rowTaxas').addEventListener('click', () => mostrarTela('taxas'));
document.getElementById('rowBackup').addEventListener('click', () => mostrarTela('backup'));
document.getElementById('rowTutorial').addEventListener('click', () => abrirOnboard());
document.getElementById('rowApoie').addEventListener('click', () => mostrarTela('apoie'));

document.getElementById('rowReiniciar').addEventListener('click', () => {
  mostrarConfirm('Isso vai apagar contas fixas, produtos e serviços cadastrados neste celular e abrir o guia de configuração do zero. Deseja continuar?', () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    try { localStorage.removeItem(ONBOARD_KEY); } catch (e) {}
    state = structuredClone(DEFAULT_STATE);
    recarregarTudo();
    abrirOnboard();
  });
});

// ---------- APOIE / PIX ----------
document.getElementById('btnCopiarPix').addEventListener('click', async () => {
  const chave = document.getElementById('pixKey').textContent.trim();
  const nota = document.getElementById('pixNote');
  const restaurar = () => {
    nota.textContent = 'Cole no app do seu banco, na opção "Pix" → "chave aleatória".';
    nota.classList.remove('copiado');
  };
  try {
    await navigator.clipboard.writeText(chave);
    nota.textContent = '✅ Chave copiada! Cole no Pix do seu banco.';
    nota.classList.add('copiado');
    setTimeout(restaurar, 4000);
  } catch (e) {
    // fallback para navegadores/contextos sem permissão de clipboard
    const temp = document.createElement('textarea');
    temp.value = chave;
    temp.style.position = 'fixed';
    temp.style.opacity = '0';
    document.body.appendChild(temp);
    temp.focus();
    temp.select();
    try {
      document.execCommand('copy');
      nota.textContent = '✅ Chave copiada! Cole no Pix do seu banco.';
      nota.classList.add('copiado');
      setTimeout(restaurar, 4000);
    } catch (e2) {
      nota.textContent = 'Não foi possível copiar automaticamente — selecione e copie a chave acima.';
    }
    document.body.removeChild(temp);
  }
});

function renderAjustesSubtitles() {
  const { totalHora } = calcCustoFixoHora();
  document.getElementById('subCustos').textContent = `Sua hora de trabalho custa ${money(totalHora)}`;
  document.getElementById('subInsumos').textContent = state.insumos.length
    ? `${state.insumos.length} produto(s) cadastrado(s)`
    : 'Nenhum produto cadastrado ainda';
  document.getElementById('subTaxas').textContent = `Margem desejada de ${state.margemDesejada}% · maquininha ${state.taxaOperacao}%`;
}

// atalho: sempre que os serviços/resultado mudam, atualiza as duas partes juntas
function atualizarResultado() {
  renderServicos();
  renderResultStrip();
}

// ---------- botões de ajuda (info) ----------
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.info-btn');
  if (!btn) return;
  const pop = document.getElementById(btn.dataset.info);
  if (pop) pop.hidden = !pop.hidden;
});

// ---------- CONTAS FIXAS ----------
const diasUteisInput = document.getElementById('diasUteis');
const horasDiaInput = document.getElementById('horasDia');
// enquanto a pessoa digita, o campo pode ficar vazio: guardamos '' em vez de forçar 1,
// senão o 1 volta sozinho e atrapalha a digitação. Os cálculos já tratam vazio como 1.
function lerCampoNumerico(input) {
  const raw = input.value.trim();
  if (raw === '') return '';
  const n = Number(raw);
  return Number.isFinite(n) ? n : '';
}

// só escreve no campo quando ele não está em uso, para não mexer no que está sendo digitado
function preencherCampo(input, valor) {
  if (document.activeElement === input) return;
  input.value = valor;
}

function normalizarCampoMinimo(input, chave) {
  const n = Number(state[chave]);
  const valido = Number.isFinite(n) && n >= 1 ? n : 1;
  state[chave] = valido;
  input.value = valido;
  save();
  renderTotaisFixos();
  atualizarResultado();
}

diasUteisInput.addEventListener('input', () => { state.diasUteis = lerCampoNumerico(diasUteisInput); save(); renderTotaisFixos(); atualizarResultado(); });
horasDiaInput.addEventListener('input', () => { state.horasDia = lerCampoNumerico(horasDiaInput); save(); renderTotaisFixos(); atualizarResultado(); });
diasUteisInput.addEventListener('blur', () => normalizarCampoMinimo(diasUteisInput, 'diasUteis'));
horasDiaInput.addEventListener('blur', () => normalizarCampoMinimo(horasDiaInput, 'horasDia'));

function renderCustos() {
  preencherCampo(diasUteisInput, state.diasUteis);
  preencherCampo(horasDiaInput, state.horasDia);

  const wrap = document.getElementById('listaCustos');
  wrap.innerHTML = '';
  state.custosFixos.forEach((c) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="field-row">
        <input type="text" value="${escapeAttr(c.nome)}" data-id="${c.id}" data-field="nome" />
        <div style="display:flex;align-items:center;gap:8px;">
          <span>R$</span>
          <input type="number" step="0.01" min="0" value="${c.valor}" data-id="${c.id}" data-field="valor" inputmode="decimal" style="width:100px" />
          <button class="icon-btn del-custo" data-id="${c.id}" title="remover">✕</button>
        </div>
      </div>`;
    wrap.appendChild(card);
  });

  wrap.querySelectorAll('input').forEach((inp) => {
    inp.addEventListener('input', () => {
      const item = state.custosFixos.find((c) => c.id === inp.dataset.id);
      if (!item) return;
      if (inp.dataset.field === 'nome') item.nome = inp.value;
      else item.valor = Number(inp.value) || 0;
      save();
      renderTotaisFixos();
      atualizarResultado();
    });
  });
  wrap.querySelectorAll('.del-custo').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.custosFixos = state.custosFixos.filter((c) => c.id !== btn.dataset.id);
      save();
      renderCustos();
      renderTotaisFixos();
      atualizarResultado();
    });
  });

  renderTotaisFixos();
}

function renderTotaisFixos() {
  const { totalMes, totalDia, totalHora } = calcCustoFixoHora();
  document.getElementById('totalFixoMes').textContent = money(totalMes);
  document.getElementById('totalFixoDia').textContent = money(totalDia);
  document.getElementById('totalFixoHora').textContent = money(totalHora);
}

document.getElementById('btnNovoCusto').addEventListener('click', () => {
  state.custosFixos.push({ id: uid(), nome: 'Nova despesa', valor: 0 });
  save();
  renderCustos();
});

// ---------- PRODUTOS E INSUMOS ----------
function renderInsumos() {
  const wrap = document.getElementById('listaInsumos');
  wrap.innerHTML = '';

  if (state.insumos.length === 0) {
    wrap.innerHTML = '<div class="empty-state"><strong>Nenhum produto cadastrado</strong>Toque em "+ Adicionar produto" para começar.</div>';
    return;
  }

  state.insumos.forEach((i) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="field-row">
        <input type="text" value="${escapeAttr(i.nome)}" data-id="${i.id}" data-field="nome" placeholder="Nome do produto" />
      </div>
      <div class="field-row">
        <label>Vem em qual unidade?</label>
        <select data-id="${i.id}" data-field="unidade">
          ${Object.entries(UNIDADES).map(([v, l]) => `<option value="${v}" ${i.unidade === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
      </div>
      <div class="field-row">
        <label>Quantidade que você compra</label>
        <input type="number" step="1" min="0" value="${i.qtdComprada}" data-id="${i.id}" data-field="qtdComprada" inputmode="decimal" style="width:90px" />
      </div>
      <div class="field-row">
        <label>Valor pago (R$)</label>
        <input type="number" step="0.01" min="0" value="${i.valorPago}" data-id="${i.id}" data-field="valorPago" inputmode="decimal" style="width:90px" />
      </div>
      <div class="total-line highlight" style="padding-top:10px;border-top:1px solid var(--border);margin-top:4px;">
        <span>Custo por ${UNIDADES[i.unidade] || i.unidade}</span>
        <strong class="custo-unidade" data-id="${i.id}">${money(custoPorUnidade(i))}</strong>
      </div>
      <button class="btn-edit del-insumo" data-id="${i.id}" style="margin-top:10px;width:100%">🗑️ Remover produto</button>
    `;
    wrap.appendChild(card);
  });

  wrap.querySelectorAll('input, select').forEach((inp) => {
    inp.addEventListener('input', () => {
      const item = state.insumos.find((i) => i.id === inp.dataset.id);
      if (!item) return;
      const campo = inp.dataset.field;
      if (campo === 'nome' || campo === 'unidade') item[campo] = inp.value;
      else item[campo] = Number(inp.value) || 0;
      save();
      const linha = wrap.querySelector(`.custo-unidade[data-id="${item.id}"]`);
      if (linha) linha.textContent = money(custoPorUnidade(item));
    });
  });
  wrap.querySelectorAll('.del-insumo').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.insumos = state.insumos.filter((i) => i.id !== btn.dataset.id);
      save();
      renderInsumos();
    });
  });
}

document.getElementById('btnNovoInsumo').addEventListener('click', () => {
  state.insumos.push({ id: uid(), nome: 'Novo produto', unidade: 'ml', qtdComprada: 0, valorPago: 0 });
  save();
  renderInsumos();
});

// ---------- TAXAS ----------
const taxaFields = ['taxaOperacao', 'comissao', 'imposto', 'margemDesejada'];

function deducoesAtuais() {
  return deducoesDe(state);
}

function margemMaxima() {
  return margemMaximaDe(state);
}

function atualizarDicaMargem() {
  const el = document.getElementById('dicaMargem');
  if (!el) return;
  const max = margemMaxima();
  const m = (Number(state.margemDesejada) || 0) / 100;
  const sobra = 1 - m - deducoesAtuais();
  if (m <= 0 || sobra <= 0) {
    el.textContent = `Máximo possível com suas taxas: ${max}%.`;
    return;
  }
  const vezes = (1 / sobra).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  el.textContent = `Equivale a cobrar ${vezes}× o custo · máximo possível com suas taxas: ${max}%`;
}

// 100% (ou mais) é impossível: corrige ao sair do campo e explica o porquê
function limitarMargem() {
  const max = margemMaxima();
  if ((Number(state.margemDesejada) || 0) > max) {
    state.margemDesejada = max;
    document.getElementById('margemDesejada').value = max;
    save();
    atualizarResultado();
    mostrarToast(`A margem é uma fatia do preço, então não chega a 100%. Com suas taxas, o máximo é ${max}% — ajustado. Para cobrar várias vezes o custo, toque no "i".`);
  }
  atualizarDicaMargem();
}

taxaFields.forEach((f) => {
  const el = document.getElementById(f);
  el.addEventListener('input', () => {
    state[f] = Number(el.value) || 0;
    save();
    atualizarDicaMargem();
    atualizarResultado();
  });
  // as taxas mudam o teto da margem, então qualquer um dos campos revalida
  el.addEventListener('blur', limitarMargem);
});
function preencherTaxas() {
  taxaFields.forEach((f) => { document.getElementById(f).value = state[f]; });
  atualizarDicaMargem();
}

// ---------- RESULTADO: faixa de resumo ----------
function renderResultStrip() {
  const wrap = document.getElementById('resultStrip');
  if (state.servicos.length === 0) { wrap.innerHTML = ''; return; }

  const servicosCalc = state.servicos.map((s) => ({ svc: s, calc: calcServico(s) }));
  const faturamento = servicosCalc.reduce((s, x) => s + x.calc.valorCobrado, 0);
  const lucroTotal = servicosCalc.reduce((s, x) => s + x.calc.lucro, 0);
  const ticketMedio = faturamento / servicosCalc.length;
  // lucro total sobre faturamento total: a média simples dos percentuais daria o mesmo
  // peso a um serviço de R$ 80 e a um de R$ 450
  const lucroMedio = faturamento > 0 ? lucroTotal / faturamento : 0;
  const abaixoMinimo = servicosCalc.filter((x) => x.calc.valorCobrado < x.calc.precoMinimo);

  wrap.innerHTML = `
    <div class="result-tile"><div class="k">Ticket médio</div><div class="v">${money(ticketMedio)}</div></div>
    <div class="result-tile"><div class="k">Margem média de lucro</div><div class="v">${pct(lucroMedio)}</div></div>
    ${abaixoMinimo.length
      ? `<div class="result-tile warn"><div class="k">⚠️ ${abaixoMinimo.length} serviço(s) no prejuízo</div><div class="v">${abaixoMinimo.map((x) => escapeHtml(x.svc.nome)).join(', ')}</div></div>`
      : `<div class="result-tile good"><span>✅</span><div class="v">Nenhum serviço abaixo do preço mínimo</div></div>`}
  `;
}

// ---------- SERVIÇOS ----------
function renderServicos() {
  const wrap = document.getElementById('listaServicos');
  wrap.innerHTML = '';

  if (state.servicos.length === 0) {
    wrap.innerHTML = '<div class="empty-state"><strong>Nenhum serviço cadastrado ainda</strong>Toque no botão "+ Novo serviço" abaixo para cadastrar o primeiro.</div>';
    return;
  }

  state.servicos.forEach((svc) => {
    const calc = calcServico(svc);
    const card = document.createElement('div');
    card.className = 'card svc-card';
    card.innerHTML = `
      <div class="svc-head" data-toggle="${svc.id}">
        <div>
          <div class="svc-title">${escapeHtml(svc.nome)}${svc.exemplo ? '<span class="chip exemplo">exemplo</span>' : ''}</div>
          <div class="svc-sub">${svc.tempoHoras}h de trabalho · custo total ${money(calc.custoTotal)}</div>
        </div>
        <div class="svc-price">
          <div class="valor">${money(calc.valorCobrado)}</div>
          <div class="margem ${margemClasse(calc.margemReal)}">lucro ${pct(calc.margemReal)}</div>
        </div>
      </div>
      <div class="svc-body" id="body-${svc.id}" style="display:none">
        <div class="svc-grid">
          <div class="mini-stat"><div class="k">Preço mínimo (empata, já com as taxas)</div><div class="v">${money(calc.precoMinimo)}</div></div>
          <div class="mini-stat"><div class="k">Preço sugerido (sobram ${state.margemDesejada}% depois das taxas)</div><div class="v">${money(calc.precoSugerido)}</div></div>
          <div class="mini-stat"><div class="k">Você recebe líquido</div><div class="v">${money(calc.recebido)}</div></div>
          <div class="mini-stat"><div class="k">Lucro final</div><div class="v">${money(calc.lucro)}</div></div>
        </div>
        <div class="svc-actions">
          <button class="btn-edit" data-edit="${svc.id}">✏️ Editar</button>
          <button class="btn-del" data-del="${svc.id}">🗑️ Excluir</button>
        </div>
      </div>
    `;
    wrap.appendChild(card);
  });

  wrap.querySelectorAll('[data-toggle]').forEach((head) => {
    head.addEventListener('click', () => {
      const body = document.getElementById('body-' + head.dataset.toggle);
      body.style.display = body.style.display === 'none' ? 'block' : 'none';
    });
  });
  wrap.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); abrirModalServico(btn.dataset.edit); });
  });
  wrap.querySelectorAll('[data-del]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      mostrarConfirm('Excluir este serviço?', () => {
        state.servicos = state.servicos.filter((s) => s.id !== btn.dataset.del);
        save();
        atualizarResultado();
      });
    });
  });
}

document.getElementById('btnNovoServico').addEventListener('click', () => abrirModalServico(null));

function abrirModalServico(id) {
  const editando = !!id;
  const svc = editando ? state.servicos.find((s) => s.id === id) : {
    id: uid(), nome: '', categoria: 'lavagem', tempoHoras: 1, custoVariavel: 0, valorCobrado: 0,
  };

  const root = document.getElementById('modalRoot');
  root.innerHTML = `
    <div class="modal-backdrop" id="backdrop">
      <div class="modal">
        <h2>${editando ? 'Editar serviço' : 'Novo serviço'}</h2>
        <div class="card">
          <div class="field-row"><label for="f-nome">Nome do serviço</label><input type="text" id="f-nome" placeholder="ex.: Lavagem Detalhada" value="${escapeAttr(svc.nome)}" /></div>
          <div class="field-row"><label for="f-categoria">Categoria</label>
            <select id="f-categoria">
              ${['lavagem','higienizacao','polimento','vitrificacao','ppf','outros'].map(c =>
                `<option value="${c}" ${svc.categoria===c?'selected':''}>${labelCategoria(c)}</option>`).join('')}
            </select>
          </div>
          <div class="field-row"><label for="f-tempo">Quanto tempo leva (horas)</label><input type="number" id="f-tempo" min="0" step="0.25" inputmode="decimal" value="${svc.tempoHoras}" /></div>
          <div class="field-row"><label for="f-valor">Valor que você cobra do cliente (R$)</label><input type="number" id="f-valor" min="0" step="1" inputmode="decimal" value="${svc.valorCobrado}" /></div>
        </div>

        <p class="group-label" style="margin-top:18px">Produtos usados neste serviço</p>
        <div class="card">
          ${state.insumos.length === 0
            ? '<p class="hint" style="margin:0">Você ainda não cadastrou produtos em Ajustes → Produtos e insumos. Por enquanto, lance um valor manual abaixo.</p>'
            : state.insumos.map((i) => `
              <div class="field-row">
                <label>${escapeHtml(i.nome)}<span class="hint-inline" style="margin:0">${money(custoPorUnidade(i))}/${UNIDADES[i.unidade] || i.unidade}</span></label>
                <input type="number" class="f-insumo" data-insumo="${i.id}" min="0" step="1" inputmode="decimal" placeholder="0 ${i.unidade}" value="${(svc.insumosUsados && svc.insumosUsados[i.id]) || ''}" style="width:74px" />
              </div>`).join('')
          }
          <div class="field-row"><label for="f-outros">Outros produtos/custos (R$)</label><input type="number" id="f-outros" min="0" step="0.5" inputmode="decimal" value="${svc.custoExtra != null ? svc.custoExtra : (svc.insumosUsados ? 0 : (svc.custoVariavel || 0))}" /></div>
        </div>

        <div class="preview-calc" id="previewCalc"></div>
        <div class="modal-actions">
          <button class="btn-cancel" id="btnCancelar">Cancelar</button>
          <button class="btn-primary" id="btnSalvar">Salvar</button>
        </div>
      </div>
    </div>
  `;

  const calcularCustoVariavelForm = () => {
    let soma = 0;
    root.querySelectorAll('.f-insumo').forEach((inp) => {
      const insumo = state.insumos.find((i) => i.id === inp.dataset.insumo);
      const qtd = Number(inp.value) || 0;
      if (insumo) soma += custoPorUnidade(insumo) * qtd;
    });
    const outrosEl = document.getElementById('f-outros');
    return soma + (outrosEl ? Number(outrosEl.value) || 0 : 0);
  };

  const preview = () => {
    const tmp = {
      ...svc,
      nome: document.getElementById('f-nome').value,
      tempoHoras: Number(document.getElementById('f-tempo').value) || 0,
      custoVariavel: calcularCustoVariavelForm(),
      valorCobrado: Number(document.getElementById('f-valor').value) || 0,
    };
    const c = calcServico(tmp);
    document.getElementById('previewCalc').innerHTML =
      `💡 Esse serviço custa <strong>${money(c.custoTotal)}</strong> pra você.<br/>Preço sugerido (sua margem): <strong>${money(c.precoSugerido)}</strong>.<br/>Cobrando ${money(tmp.valorCobrado)}, seu lucro fica em <strong class="margem ${margemClasse(c.margemReal)}">${money(c.lucro)} (${pct(c.margemReal)})</strong>.`;
  };

  root.querySelectorAll('input, select').forEach((el) => el.addEventListener('input', preview));
  preview();

  document.getElementById('btnCancelar').addEventListener('click', fecharModal);
  document.getElementById('backdrop').addEventListener('click', (e) => { if (e.target.id === 'backdrop') fecharModal(); });
  document.getElementById('btnSalvar').addEventListener('click', () => {
    const nome = document.getElementById('f-nome').value.trim();
    if (!nome) { mostrarToast('Dê um nome ao serviço.'); document.getElementById('f-nome').focus(); return; }
    const insumosUsados = {};
    root.querySelectorAll('.f-insumo').forEach((inp) => {
      const qtd = Number(inp.value) || 0;
      if (qtd > 0) insumosUsados[inp.dataset.insumo] = qtd;
    });
    const outrosEl = document.getElementById('f-outros');
    const custoExtra = outrosEl ? Number(outrosEl.value) || 0 : 0;
    const novo = {
      id: svc.id,
      nome,
      categoria: document.getElementById('f-categoria').value,
      tempoHoras: Number(document.getElementById('f-tempo').value) || 0,
      custoVariavel: calcularCustoVariavelForm(),
      insumosUsados,
      custoExtra,
      valorCobrado: Number(document.getElementById('f-valor').value) || 0,
    };
    if (editando) {
      const idx = state.servicos.findIndex((s) => s.id === id);
      state.servicos[idx] = novo; // editar remove o rótulo "exemplo"
    } else {
      state.servicos.push(novo);
    }
    save();
    fecharModal();
    atualizarResultado();
  });
}

function fecharModal() {
  document.getElementById('modalRoot').innerHTML = '';
}

// ---------- diálogos próprios (o navegador bloqueia confirm()/alert() dentro do artifact) ----------
function mostrarToast(mensagem) {
  let toast = document.getElementById('toastMsg');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toastMsg';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = mensagem;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 3500);
}

function mostrarConfirm(mensagem, aoConfirmar) {
  const root = document.getElementById('modalRoot');
  root.innerHTML = `
    <div class="modal-backdrop" id="confirmBackdrop">
      <div class="modal">
        <h2>Confirmar</h2>
        <p class="hint" style="margin:0">${escapeHtml(mensagem)}</p>
        <div class="modal-actions">
          <button class="btn-cancel" id="btnConfirmCancelar">Cancelar</button>
          <button class="btn-primary" id="btnConfirmOk">Confirmar</button>
        </div>
      </div>
    </div>`;
  document.getElementById('btnConfirmCancelar').addEventListener('click', fecharModal);
  document.getElementById('confirmBackdrop').addEventListener('click', (e) => { if (e.target.id === 'confirmBackdrop') fecharModal(); });
  document.getElementById('btnConfirmOk').addEventListener('click', () => { fecharModal(); aoConfirmar(); });
}

function labelCategoria(c) {
  return {
    lavagem: 'Lavagem',
    higienizacao: 'Higienização',
    polimento: 'Polimento',
    vitrificacao: 'Vitrificação / Coating',
    ppf: 'PPF / Película',
    outros: 'Outros',
  }[c] || c;
}

// ---------- EXPORT / IMPORT ----------
document.getElementById('btnExport').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `precifica-estetica-backup-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

document.getElementById('btnImport').addEventListener('click', () => document.getElementById('inputImport').click());
document.getElementById('inputImport').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      state = Object.assign(structuredClone(DEFAULT_STATE), parsed);
      save();
      recarregarTudo();
      mostrarTela('servicos');
      mostrarToast('Backup importado com sucesso!');
    } catch (err) {
      mostrarToast('Arquivo inválido.');
    }
  };
  reader.readAsText(file);
});

// ---------- utils ----------
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function escapeAttr(s) { return escapeHtml(s); }

if (typeof structuredClone !== 'function') {
  window.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}

// ======================================================================
// ONBOARDING — tutorial curto explicando o processo (aparece na 1ª visita)
// ======================================================================
const ONBOARD_SLIDES = [
  {
    emoji: '👋',
    titulo: 'Bem-vindo(a) ao Precifica Estética',
    texto: 'Este app ajuda a descobrir o preço certo de cada serviço, sem passar aperto no fim do mês. São só alguns passos rápidos.',
  },
  {
    emoji: '🧾',
    titulo: '1. Suas contas fixas',
    texto: 'Você informa o que paga todo mês (aluguel, MEI, internet...). O app calcula sozinho quanto custa cada hora do seu trabalho.',
  },
  {
    emoji: '🧴',
    titulo: '2. Produtos que você usa',
    texto: 'Diga quanto veio e quanto pagou em cada produto (shampoo, cera...). O app calcula o custo por ml/g/unidade e, depois, é só informar quanto usou em cada serviço.',
  },
  {
    emoji: '%',
    titulo: '3. Taxas e sua margem',
    texto: 'Você diz o quanto quer de lucro e o que é descontado em cada venda (cartão, imposto).',
  },
  {
    emoji: '💰',
    titulo: '4. O resultado: preços prontos',
    texto: 'Você cadastra cada serviço (tempo + produtos usados) e o app mostra na hora o preço mínimo e o preço sugerido, já com seu lucro.',
  },
  {
    emoji: '🔒',
    titulo: 'Seus dados são só seus',
    texto: 'Tudo fica salvo neste celular, sem internet e sem cadastro. Exporte um backup de vez em quando em <strong>Ajustes</strong>, caso troque de aparelho.',
  },
];

const DEVICE_KEY = 'precifica_estetica_dispositivo';

// ---------- detecta sistema/navegador pelo user agent ----------
function detectarAmbiente() {
  const ua = navigator.userAgent || '';
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/.test(ua);
  const sistema = ios ? 'ios' : android ? 'android' : 'desktop';

  let navegador = 'outro';
  if (/Instagram/i.test(ua)) navegador = 'instagram';
  else if (/FBAN|FBAV|FB_IAB/i.test(ua)) navegador = 'facebook';
  else if (/\bLine\//i.test(ua)) navegador = 'line';
  else if (/MicroMessenger/i.test(ua)) navegador = 'wechat';
  else if (/SamsungBrowser/i.test(ua)) navegador = 'samsung';
  else if (/EdgiOS|Edg\//i.test(ua)) navegador = 'edge';
  else if (/CriOS|(Chrome(?!ium))/i.test(ua)) navegador = 'chrome';
  else if (/FxiOS|Firefox/i.test(ua)) navegador = 'firefox';
  else if (/OPR\//i.test(ua)) navegador = 'opera';
  else if (/Safari/i.test(ua)) navegador = 'safari';

  return { sistema, navegador };
}

const NOMES_NAVEGADOR = {
  chrome: 'Chrome', safari: 'Safari', firefox: 'Firefox', samsung: 'Samsung Internet',
  edge: 'Edge', opera: 'Opera', instagram: 'navegador do Instagram', facebook: 'navegador do Facebook',
  line: 'navegador do Line', wechat: 'navegador do WeChat', outro: 'seu navegador',
};

const NAVEGADORES_EMBUTIDOS = ['instagram', 'facebook', 'line', 'wechat'];

function obterInstrucoes(sistema, navegador) {
  const nomeNav = NOMES_NAVEGADOR[navegador] || 'seu navegador';
  // quando não sabemos o navegador, o título não leva nome nenhum
  const sufixoNav = NOMES_NAVEGADOR[navegador] && navegador !== 'outro' ? ` (${nomeNav})` : '';

  // apps como Instagram/Facebook abrem um navegador embutido sem opção de instalar —
  // é preciso abrir no navegador de verdade primeiro
  if (NAVEGADORES_EMBUTIDOS.includes(navegador)) {
    return {
      emoji: '↗️',
      titulo: `Abra fora do ${nomeNav}`,
      aviso: `Links abertos dentro do ${nomeNav} não deixam instalar apps. Primeiro precisa abrir num navegador de verdade.`,
      passos: [
        'Toque nos <strong>⋯</strong> ou <strong>⋮</strong> no canto superior da tela.',
        `Escolha <strong>"Abrir no ${sistema === 'ios' ? 'Safari' : 'Chrome'}"</strong> (ou "Abrir no navegador").`,
        'O link vai abrir de novo, agora no navegador certo — repita esse passo por lá.',
      ],
    };
  }

  if (sistema === 'ios') {
    if (navegador !== 'safari') {
      return {
        emoji: '🍎',
        titulo: `Instalando no iPhone${sufixoNav}`,
        passos: [
          'Toque no ícone de compartilhar <strong>⬆️</strong> (na barra de baixo ou dentro do menu <strong>⋯</strong>).',
          'Role para baixo e toque em <strong>"Adicionar à Tela de Início"</strong>.',
          'Toque em <strong>"Adicionar"</strong>, no canto superior direito.',
        ],
        aviso: 'Não achou a opção? Ela existe desde o iOS 16.4 — atualize o iPhone ou faça o mesmo pelo Safari.',
      };
    }
    return {
      emoji: '🍎',
      titulo: 'Instalando no iPhone (Safari)',
      passos: [
        'Toque no ícone de compartilhar <strong>⬆️</strong> na barra do navegador.',
        'Role para baixo e toque em <strong>"Adicionar à Tela de Início"</strong>.',
        'Toque em <strong>"Adicionar"</strong>, no canto superior direito.',
      ],
    };
  }

  if (sistema === 'android') {
    if (navegador === 'samsung') {
      return {
        emoji: '🤖', titulo: 'Instalando no Android (Samsung Internet)',
        passos: [
          'Toque no menu <strong>☰</strong>, embaixo à direita.',
          'Toque em <strong>"Adicionar página a"</strong>.',
          'Escolha <strong>"Tela Inicial"</strong> e depois <strong>"Adicionar"</strong>.',
        ],
      };
    }
    if (navegador === 'firefox') {
      return {
        emoji: '🤖', titulo: 'Instalando no Android (Firefox)',
        passos: [
          'Toque no menu <strong>⋮</strong>, no canto superior.',
          'Toque em <strong>"Instalar"</strong> (ou "Adicionar à tela inicial").',
          'Confirme tocando em <strong>"Adicionar"</strong>.',
        ],
      };
    }
    return {
      emoji: '🤖', titulo: `Instalando no Android${sufixoNav}`,
      passos: [
        'Toque no menu <strong>⋮</strong>, no canto superior do navegador.',
        'Toque em <strong>"Adicionar à tela inicial"</strong> (ou "Instalar app" — às vezes o próprio navegador já sugere isso sozinho).',
        'Toque em <strong>"Adicionar"</strong> ou <strong>"Instalar"</strong>.',
      ],
    };
  }

  // desktop / não identificado
  return {
    emoji: '💻',
    titulo: 'Abra pelo celular',
    aviso: 'Instalar como app só faz sentido no celular. Envie este link pro seu WhatsApp e abra por lá.',
    passos: [
      'No celular, abra este mesmo link.',
      'Toque no menu do navegador e escolha <strong>"Adicionar à tela inicial"</strong> (Android) ou use o botão de compartilhar no Safari (iPhone).',
    ],
  };
}

function renderBoasVindas(aoConcluir) {
  const root = document.getElementById('modalRoot');
  const detectado = detectarAmbiente();

  function passoEscolha() {
    root.innerHTML = `
      <div class="modal-backdrop" id="boasVindasBackdrop">
        <div class="onboard">
          <div class="emoji">👋</div>
          <h2>Bem-vindo(a) ao Precifica Estética!</h2>
          <p>Pra usar como um aplicativo de verdade no celular — com ícone próprio, tela cheia e funcionando offline — qual é o seu aparelho?</p>
          <div class="device-choice">
            <button class="btn-device" data-dev="android"><span>🤖</span>Android</button>
            <button class="btn-device" data-dev="ios"><span>🍎</span>iPhone</button>
          </div>
          <button class="btn-skip" id="btnPularInstalacao">Pular por enquanto</button>
        </div>
      </div>`;
    root.querySelectorAll('.btn-device').forEach((b) => {
      b.addEventListener('click', () => {
        try { localStorage.setItem(DEVICE_KEY, b.dataset.dev); } catch (e) {}
        mostrarPasso(b.dataset.dev, 'outro', false);
      });
    });
    document.getElementById('btnPularInstalacao').addEventListener('click', aoConcluir);
  }

  function mostrarPasso(sistema, navegador, autoDetectado) {
    const info = obterInstrucoes(sistema, navegador);
    root.innerHTML = `
      <div class="modal-backdrop" id="boasVindasBackdrop">
        <div class="onboard">
          <div class="emoji">${info.emoji}</div>
          ${autoDetectado ? `<p class="deteccao-tag">Detectamos ${sistema === 'ios' ? 'iPhone' : sistema === 'android' ? 'Android' : 'computador'} · ${NOMES_NAVEGADOR[navegador] || navegador}</p>` : ''}
          <h2>${info.titulo}</h2>
          ${info.aviso ? `<p class="hint-inline" style="text-align:left;background:var(--accent-soft);padding:10px 12px;border-radius:var(--radius-sm);margin:0 0 4px">${info.aviso}</p>` : ''}
          <ol class="install-steps">${info.passos.map((p) => `<li>${p}</li>`).join('')}</ol>
          <button class="btn-primary" id="btnInstalacaoContinuar">Entendi, continuar</button>
          <button class="btn-skip" id="btnTrocarDispositivo">${autoDetectado ? 'Não é isso? Escolher manualmente' : 'Escolher outro aparelho'}</button>
        </div>
      </div>`;
    document.getElementById('btnInstalacaoContinuar').addEventListener('click', aoConcluir);
    document.getElementById('btnTrocarDispositivo').addEventListener('click', passoEscolha);
  }

  if (detectado.sistema === 'ios' || detectado.sistema === 'android') {
    mostrarPasso(detectado.sistema, detectado.navegador, true);
  } else {
    let dispositivoSalvo = null;
    try { dispositivoSalvo = localStorage.getItem(DEVICE_KEY); } catch (e) {}
    if (dispositivoSalvo) mostrarPasso(dispositivoSalvo, 'outro', false);
    else mostrarPasso('desktop', 'outro', true);
  }
}

document.getElementById('rowComoInstalar').addEventListener('click', () => {
  renderBoasVindas(fecharModal);
});

let onboardIndex = 0;

function renderOnboard() {
  const root = document.getElementById('modalRoot');
  const total = ONBOARD_SLIDES.length;
  const s = ONBOARD_SLIDES[onboardIndex];
  const ultimo = onboardIndex === total - 1;
  const textoFinal = state.setupConcluido ? 'Fechar' : 'Vamos começar';
  root.innerHTML = `
    <div class="modal-backdrop" id="onboardBackdrop">
      <div class="onboard">
        <div class="emoji">${s.emoji}</div>
        <h2>${s.titulo}</h2>
        <p>${s.texto}</p>
        <div class="onboard-dots">
          ${ONBOARD_SLIDES.map((_, i) => `<span class="${i === onboardIndex ? 'on' : ''}"></span>`).join('')}
        </div>
        <button class="btn-primary" id="btnOnboardNext">${ultimo ? textoFinal : 'Próximo'}</button>
        ${!ultimo ? '<button class="btn-skip" id="btnOnboardSkip">Pular introdução</button>' : ''}
      </div>
    </div>
  `;
  document.getElementById('btnOnboardNext').addEventListener('click', () => {
    if (ultimo) { fecharOnboard(); return; }
    onboardIndex++;
    renderOnboard();
  });
  const skip = document.getElementById('btnOnboardSkip');
  if (skip) skip.addEventListener('click', fecharOnboard);
}

function fecharOnboard() {
  try { localStorage.setItem(ONBOARD_KEY, '1'); } catch (e) {}
  document.getElementById('modalRoot').innerHTML = '';
  onboardIndex = 0;

  if (!state.setupConcluido) {
    wizardAtivo = true;
    mostrarTela('custos');
  } else {
    mostrarTela(telaAoFecharTutorial);
  }
}

function abrirOnboard() {
  telaAoFecharTutorial = telaAtual;
  renderBoasVindas(() => {
    onboardIndex = 0;
    renderOnboard();
  });
}

document.getElementById('btnAjuda').addEventListener('click', abrirOnboard);

// ---------- init ----------
function recarregarTudo() {
  preencherTaxas();
  renderCustos();
  renderInsumos();
  renderServicos();
  renderResultStrip();
}
recarregarTudo();

let jaViuIntroducao = true;
try { jaViuIntroducao = localStorage.getItem(ONBOARD_KEY) === '1'; } catch (e) {}

if (!jaViuIntroducao) {
  abrirOnboard();
} else if (!state.setupConcluido) {
  wizardAtivo = true;
  mostrarTela('custos');
} else {
  mostrarTela('servicos');
}

// ---------- atualização do app instalado (PWA) ----------
// Mostra uma barra avisando quando existe versão nova; um toque recarrega com os arquivos novos.
function mostrarAvisoAtualizacao() {
  if (document.getElementById('updateBar')) return;
  const bar = document.createElement('div');
  bar.id = 'updateBar';
  bar.className = 'update-bar';
  bar.innerHTML = '<span>Nova versão disponível.</span><button type="button" id="btnAtualizarApp">Atualizar</button>';
  document.body.appendChild(bar);
  requestAnimationFrame(() => bar.classList.add('show'));
  document.getElementById('btnAtualizarApp').addEventListener('click', () => window.location.reload());
}

// A "assinatura" do app.js publicado (ETag ou Last-Modified) muda a cada deploy.
// Comparar isso é mais confiável do que esperar o sw.js mudar: um deploy que só
// mexe no app.js ou no index.html também é detectado.
let assinaturaApp = null;

function lerAssinaturaApp() {
  // no-store: nunca responde do cache, sempre pergunta ao servidor
  return fetch('app.js', { method: 'HEAD', cache: 'no-store' })
    .then((res) => (res.ok ? { etag: res.headers.get('etag'), data: res.headers.get('last-modified') } : null))
    .catch(() => null);
}

function mostrarVersaoNosAjustes(data) {
  const el = document.getElementById('subVersao');
  if (!el) return;
  if (!data) { el.textContent = 'não foi possível verificar agora'; return; }
  const d = new Date(data);
  el.textContent = isNaN(d) ? 'atualizada' : 'atualizada em ' + d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function verificarVersaoNova() {
  return lerAssinaturaApp().then((atual) => {
    // sem rede: mantém a data que já estava na tela, se houver
    if (!atual) { if (assinaturaApp === null) mostrarVersaoNosAjustes(null); return; }
    const marca = atual.etag || atual.data;
    if (assinaturaApp === null) {
      assinaturaApp = marca;
      mostrarVersaoNosAjustes(atual.data);
      return;
    }
    if (marca && marca !== assinaturaApp) mostrarAvisoAtualizacao();
  });
}

// procura atualização ao abrir, ao voltar para o app e a cada hora aberto
function procurarAtualizacao() {
  verificarVersaoNova();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistration().then((reg) => { if (reg) reg.update().catch(() => {}); }).catch(() => {});
  }
}

document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') procurarAtualizacao(); });
setInterval(procurarAtualizacao, 60 * 60 * 1000);
document.getElementById('rowVersao').addEventListener('click', () => {
  mostrarToast('Procurando atualização…');
  procurarAtualizacao();
});

// registra o service worker (funciona offline após primeira visita)
window.addEventListener('load', () => {
  verificarVersaoNova();
  if (!('serviceWorker' in navigator)) return;
  // updateViaCache: 'none' garante que o próprio sw.js seja sempre buscado na rede
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
    // já havia uma versão nova pronta de uma visita anterior
    if (reg.waiting && navigator.serviceWorker.controller) mostrarAvisoAtualizacao();

    reg.addEventListener('updatefound', () => {
      const novo = reg.installing;
      if (!novo) return;
      novo.addEventListener('statechange', () => {
        // com um service worker já no controle, "installed" significa atualização (não primeira visita)
        if (novo.state === 'installed' && navigator.serviceWorker.controller) mostrarAvisoAtualizacao();
      });
    });

    reg.update().catch(() => {});
  }).catch(() => {});
});
