// Estado da aplicação
let state = {
  equipamentoAtual: null,
  mediaAtual: 0,
  opcaoSelecionada: null,
  sugestoes: {}
};

// Alternância de abas
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    e.target.classList.add('active');
    document.getElementById(`tab-${e.target.dataset.tab}`).classList.add('active');

    if(e.target.dataset.tab === 'historico') {
      carregarHistorico();
    }
  });
});

// Busca com debounce
let searchTimeout;
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');

searchInput.addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  const query = e.target.value.trim();
  
  if (query.length > 2) {
    searchTimeout = setTimeout(() => buscarSugestoes(query), 300);
  } else {
    ocultarSugestoes();
  }
});

async function buscarSugestoes(query) {
  try {
    const res = await fetch(`api/buscar-equipamento.php?type=list&q=${encodeURIComponent(query)}`);
    const data = await res.json();
    
    if (Array.isArray(data) && data.length > 0) {
      renderizarSugestoes(data);
    } else {
      ocultarSugestoes();
    }
  } catch (error) {
    console.debug("Sugestões indisponíveis (servidor offline)");
    ocultarSugestoes();
  }
}

function renderizarSugestoes(itens) {
  const list = document.getElementById('suggestionsList');
  list.innerHTML = itens.map(item => `
    <div class="suggestion-item" onclick="selecionarSugestao('${item.serie}')">
      <div class="sugg-main">
        <strong>${item.serie}</strong>
        <span class="tag-sm">${item.secretaria || 'OUTROS'}</span>
      </div>
      <span class="sub">${item.cliente ? item.cliente.nome : ''}</span>
    </div>
  `).join('');
  list.classList.remove('hidden');
}

function selecionarSugestao(serie) {
  searchInput.value = serie;
  ocultarSugestoes();
  buscarEquipamento(serie);
}

function ocultarSugestoes() {
  document.getElementById('suggestionsList').classList.add('hidden');
}

// Fechar sugestões ao clicar fora
document.addEventListener('click', (e) => {
  if (!e.target.closest('.autocomplete-container')) {
    ocultarSugestoes();
  }
});

searchBtn.addEventListener('click', () => {
  if (searchInput.value.length > 2) {
    buscarEquipamento(searchInput.value);
  }
});

async function buscarEquipamento(query) {
  mostrarLoading(true);
  ocultarResultado();

  try {
    const res = await fetch(`api/buscar-equipamento.php?q=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (data && data.id) {
      state.equipamentoAtual = data;
      preencherInfoEquipamento(data);
      await calcularMedia(data.id);
    } else {
      alert("Equipamento não encontrado!");
      mostrarLoading(false);
    }
  } catch (error) {
    console.error("Erro ao buscar equipamento:", error);
    alert("Erro na comunicação com o servidor. Verifique se o Apache/PHP está rodando e se os arquivos estão na pasta correta.");
    mostrarLoading(false);
  }
}

function renderizarUltimasEntregas(entregas) {
  const tbody = document.getElementById('lastDeliveriesTbody');
  tbody.innerHTML = '';
  
  if (!entregas || entregas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="text-center" style="padding: 20px; color: var(--text-dim);">Nenhuma entrega recente.</td></tr>';
    return;
  }
  
  tbody.innerHTML = entregas.map(e => `
    <tr>
      <td>${new Date(e.data_entrega).toLocaleDateString('pt-BR')}</td>
      <td>${e.quantidade}</td>
      <td>${e.numero_os}</td>
    </tr>
  `).join('');
}

function preencherInfoEquipamento(eq) {
  document.getElementById('resCliente').textContent = `Cliente: ${eq.cliente ? eq.cliente.nome : 'Não informado'}`;
  document.getElementById('resSecretaria').textContent = `SETOR: ${eq.secretaria || 'OUTROS'}`;
  document.getElementById('resPatrimonio').textContent = eq.patrimonio || 'Não informado';
  document.getElementById('resSerie').textContent = eq.serie || '---';
  document.getElementById('resModelo').textContent = eq.modelo || 'Não informado';
  
  const contador = eq.ultimo_contador || 0;
  document.getElementById('resContador').textContent = contador;

  // Preencher média projetada do Excel
  const mediaExcel = parseFloat(eq.media_referencia) || 0;
  const inputMedia = document.getElementById('inputMediaProjetada');
  inputMedia.value = mediaExcel.toFixed(1);
  
  // Se houver média no Excel, já sugerir com base nela
  if (mediaExcel > 0) {
    usarMediaProjetada(mediaExcel);
  }
  
  document.getElementById('sumContadorAnterior').textContent = contador;
  document.getElementById('inputContador').value = '';
}

function recalcularComContador() {
  const novo = parseInt(document.getElementById('inputContador').value);
  const antigo = state.equipamentoAtual.ultimo_contador || 0;
  const dataAntiga = state.equipamentoAtual.data_ultimo_contador;
  
  if (!novo || novo <= antigo) {
    alert("Insira um contador válido (maior que o anterior).");
    return;
  }
  
  if (!dataAntiga) {
    alert("Não há data de leitura anterior para calcular o intervalo.");
    return;
  }
  
  const dataInicio = new Date(dataAntiga);
  const dataFim = new Date();
  const diffTime = Math.abs(dataFim - dataInicio);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
  
  const consumoPaginas = novo - antigo;
  const consumoDiario = consumoPaginas / diffDays;
  const consumoMensalPaginas = consumoDiario * 30;
  const consumoMensalResmas = consumoMensalPaginas / 500;
  
  const mediaCalculada = Math.ceil(consumoMensalResmas * 10) / 10;
  aplicarNovaMedia(mediaCalculada);
}

function aplicarNovaMedia(media) {
  state.mediaAtual = media;
  const comMargem = media * 1.15;
  state.sugestoes = {
    1: Math.ceil(comMargem),
    2: Math.ceil(comMargem / 2),
    3: Math.ceil(comMargem / 3)
  };
  
  setMedia(media);
  document.getElementById('opt1Qtd').textContent = state.sugestoes[1];
  document.getElementById('opt2Qtd').textContent = state.sugestoes[2];
  document.getElementById('opt3Qtd').textContent = state.sugestoes[3];
  
  resetarSelecao();
}

async function calcularMedia(id) {
  try {
    const res = await fetch(`api/calcular-media.php?equipamento_id=${id}`);
    const data = await res.json();
    
    if (data && data.media !== undefined) {
      state.mediaAtual = data.media;
      state.sugestoes = data.sugestoes;
      
      setMedia(data.media);
      document.getElementById('opt1Qtd').textContent = data.sugestoes[1];
      document.getElementById('opt2Qtd').textContent = data.sugestoes[2];
      document.getElementById('opt3Qtd').textContent = data.sugestoes[3];
      
      const card = document.getElementById('lastDeliveriesCard');
      renderizarUltimasEntregas(data.entregas);
      
      if (data.entregas && data.entregas.length > 0) {
        card.classList.remove('hidden');
      } else {
        card.classList.add('hidden');
      }

      resetarSelecao();
      mostrarResultado();
    }
  } catch (error) {
    console.error("Erro ao calcular média:", error);
  } finally {
    mostrarLoading(false);
  }
}

function selecionarOpcao(opcao) {
  state.opcaoSelecionada = opcao;
  let qtd = state.sugestoes[opcao] || 0;
  
  if (opcao === 0) qtd = 1;
  
  document.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
  document.querySelector(`.option-card[data-opcao="${opcao}"]`).classList.add('selected');
  
  if (opcao === 0) {
    document.getElementById('sumOpcaoText').textContent = `Entrega Manual (Avulsa)`;
  } else {
    document.getElementById('sumOpcaoText').textContent = `${opcao}x por mês (${qtd} resmas por visita)`;
  }
  
  document.getElementById('editLine').classList.remove('hidden');
  document.getElementById('formLineOs').classList.remove('hidden');
  document.getElementById('formLineObs').classList.remove('hidden');
  document.getElementById('actionRow').classList.remove('hidden');
  document.getElementById('inputQtd').value = qtd;
}

async function salvarBalanceamento() {
  const os = document.getElementById('inputOs').value.trim();
  const qtd = parseInt(document.getElementById('inputQtd').value);
  const obs = document.getElementById('inputObs').value.trim();
  const contadorAtual = parseInt(document.getElementById('inputContador').value) || null;

  if (!os) { alert("O número da O.S. é obrigatório!"); return; }
  if (!qtd || qtd <= 0) { alert("Quantidade inválida!"); return; }

  const payload = {
    equipamento_id: state.equipamentoAtual.id,
    cliente_id: state.equipamentoAtual.cliente.id,
    numero_os: os,
    media_consumo_mensal: state.mediaAtual,
    opcao_entrega: state.opcaoSelecionada,
    quantidade_sugerida: state.sugestoes[state.opcaoSelecionada] ?? null,
    quantidade_definida: qtd,
    contador_atual: contadorAtual,
    observacao: obs
  };

  const btn = document.getElementById('btnConfirmar');
  btn.disabled = true;
  btn.innerHTML = '<i data-lucide="loader" class="spin"></i> SALVANDO...';
  lucide.createIcons();

  try {
    const res = await fetch('api/salvar-balanceamento.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (result.success) {
      alert("Balanceamento salvo com sucesso!");
      document.getElementById('searchInput').value = '';
      ocultarResultado();
    } else {
      alert("Erro ao salvar: " + (result.error || "Desconhecido"));
    }
  } catch (error) {
    console.error("Erro ao salvar:", error);
    alert("Erro ao conectar com o servidor.");
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="check-circle"></i> CONFIRMAR BALANCEAMENTO';
    lucide.createIcons();
  }
}

async function renderizarHistorico(dados) {
  const tbody = document.getElementById('historicoTbody');
  const tfoot = document.getElementById('historicoTfoot');
  const totalEl = document.getElementById('totalResmas');
  tbody.innerHTML = '';
  
  if (!dados || dados.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center" style="padding: 40px; color: var(--text-dim);">Nenhum registro de balanceamento encontrado.</td></tr>';
    tfoot.classList.add('hidden');
    return;
  }

  let totalResmas = 0;
  dados.forEach(item => {
    totalResmas += parseFloat(item.quantidade_definida || 0);
    const tr = document.createElement('tr');
    const dataFormatada = new Date(item.data_registro).toLocaleDateString('pt-BR');
    const nomeCliente = item.cliente ? item.cliente.nome : 'N/D';
    const localSetor = item.equipamento ? item.equipamento.secretaria : 'N/D';
    const serieEquip = item.equipamento ? item.equipamento.serie : 'N/D';

    tr.innerHTML = `
      <td>${dataFormatada}</td>
      <td>${nomeCliente}</td>
      <td>${localSetor}</td>
      <td>${serieEquip}</td>
      <td>${item.media_consumo_mensal}</td>
      <td>${item.opcao_entrega === 0 ? 'Manual' : item.opcao_entrega + 'x'}</td>
      <td>${item.quantidade_definida}</td>
      <td>${item.numero_os}</td>
      <td><span class="status-badge status-${item.status}">${item.status}</span></td>
    `;
    tbody.appendChild(tr);
  });

  totalEl.textContent = totalResmas.toLocaleString('pt-BR');
  tfoot.classList.remove('hidden');
}

function usarMediaProjetada(valor) {
  const mediaVal = parseFloat(valor) || 0;
  if (mediaVal > 0) {
    state.mediaAtual = mediaVal;
    aplicarNovaMedia(mediaVal);
  }
}

async function carregarHistorico() {
  const tbody = document.getElementById('historicoTbody');
  tbody.innerHTML = '<tr><td colspan="9" class="text-center">Carregando... <i data-lucide="loader" class="spin"></i></td></tr>';
  lucide.createIcons();

  const filterDataInicio = document.getElementById('filterDataInicio').value;
  const filterDataFim = document.getElementById('filterDataFim').value;
  const filterCliente = document.getElementById('filterCliente').value;
  const filterSerie = document.getElementById('filterSerie').value;

  const params = new URLSearchParams();
  if (filterDataInicio) params.append('data_inicio', filterDataInicio);
  if (filterDataFim) params.append('data_fim', filterDataFim);
  if (filterCliente) params.append('cliente', filterCliente);
  if (filterSerie) params.append('serie', filterSerie);

  try {
    const res = await fetch(`api/listar-balanceamentos.php?${params.toString()}`);
    const data = await res.json();
    renderizarHistorico(data);
  } catch (error) {
    console.error("Erro ao carregar histórico:", error);
  }
}

function exportarExcel() {
  const table = document.querySelector(".data-table");
  if (!table || table.rows.length <= 2 && table.rows[1].cells.length < 5) {
    alert("Não há dados para exportar.");
    return;
  }

  const wb = XLSX.utils.table_to_book(table, { sheet: "Balanceamentos" });
  XLSX.writeFile(wb, `Balanceamentos_${new Date().toISOString().split('T')[0]}.xlsx`);
}

function setMedia(valor) {
  const mediaVal = parseFloat(valor);
  const txt = mediaVal.toFixed(1).replace('.', ',');
  
  if(document.getElementById('resMedia')) document.getElementById('resMedia').textContent = txt;
  if(document.getElementById('sumMedia')) document.getElementById('sumMedia').textContent = txt;
  
  const paginas = Math.round(mediaVal * 500);
  if(document.getElementById('resPaginas')) {
    document.getElementById('resPaginas').textContent = paginas.toLocaleString('pt-BR');
  }
}

function mostrarLoading(show) {
  const loader = document.getElementById('loadingIndicator');
  if (show) loader.classList.remove('hidden');
  else loader.classList.add('hidden');
}

function mostrarResultado() {
  document.getElementById('resultContainer').classList.remove('hidden');
}

function ocultarResultado() {
  document.getElementById('resultContainer').classList.add('hidden');
  resetarSelecao();
}

function resetarSelecao() {
  state.opcaoSelecionada = null;
  document.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('sumOpcaoText').textContent = 'Selecione uma opção acima';
  document.getElementById('editLine').classList.add('hidden');
  document.getElementById('formLineOs').classList.add('hidden');
  document.getElementById('formLineObs').classList.add('hidden');
  document.getElementById('actionRow').classList.add('hidden');
  document.getElementById('inputOs').value = '';
  document.getElementById('inputObs').value = '';
}
