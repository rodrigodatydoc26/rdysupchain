// Configuração Supabase (Acesso Direto)
const SUPABASE_URL = 'https://jvwrbrypyrwnaaqijbqm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2d3JicnlweXJ3bmFhcWlqYnFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NjQ3NTcsImV4cCI6MjA5MTM0MDc1N30.qNQw3VOLRVFxuXM7fESkMwPlvc6Hg5qGTVlBepzU85o';

// Estado da aplicação
let state = {
  equipamentoAtual: null,
  mediaAtual: 0,
  opcaoSelecionada: null,
  sugestoes: {}
};

// Utilitário de fetch para Supabase
async function sbFetch(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1${path}`;
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    ...options.headers
  };
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  return res.json();
}

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
    const data = await sbFetch(`/equipamentos?select=serie,patrimonio,secretaria,cliente:clientes(nome)&or=(serie.ilike.*${encodeURIComponent(query)}*,patrimonio.ilike.*${encodeURIComponent(query)}*)&limit=8`);
    
    if (Array.isArray(data) && data.length > 0) {
      renderizarSugestoes(data);
    } else {
      ocultarSugestoes();
    }
  } catch (error) {
    console.debug("Sugestões indisponíveis:", error);
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
  const list = document.getElementById('suggestionsList');
  if (list) list.classList.add('hidden');
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
    const data = await sbFetch(`/equipamentos?or=(serie.ilike.*${encodeURIComponent(query)}*,patrimonio.ilike.*${encodeURIComponent(query)}*)&select=id,serie,patrimonio,modelo,secretaria,media_referencia,cliente:clientes(id,nome,cidade)&limit=1`);

    if (data && data.length > 0) {
      const equip = data[0];
      
      // Buscar último contador
      const osData = await sbFetch(`/ordens_servico?equipamento_id=eq.${equip.id}&select=contador_atual,data_os&order=data_os.desc&limit=1`);
      
      if (osData && osData.length > 0) {
        equip.ultimo_contador = osData[0].contador_atual;
        equip.data_ultimo_contador = osData[0].data_os;
      } else {
        equip.ultimo_contador = 0;
        equip.data_ultimo_contador = null;
      }

      state.equipamentoAtual = equip;
      preencherInfoEquipamento(equip);
      await calcularMedia(equip.id);
    } else {
      alert("Equipamento não encontrado!");
      mostrarLoading(false);
    }
  } catch (error) {
    console.error("Erro ao buscar equipamento:", error);
    alert("Erro ao conectar com o banco de dados. Verifique sua internet.");
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

  // A média projetada agora é usada internamente no cálculo de média se não houver histórico
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
    // Buscar histórico de entregas para calcular média (últimas 3)
    const entregas = await sbFetch(`/balanceamento_entregas?equipamento_id=eq.${id}&status=eq.confirmado&order=data_registro.desc&limit=3`);
    
    let media = 0;
    if (entregas && entregas.length > 0) {
      const soma = entregas.reduce((acc, curr) => acc + parseFloat(curr.media_consumo_mensal || 0), 0);
      media = soma / entregas.length;
    } else {
      // Fallback para a média de referência do equipamento
      media = parseFloat(state.equipamentoAtual.media_referencia) || 0;
    }

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
    
    const card = document.getElementById('lastDeliveriesCard');
    // Mapear para o formato esperado pelo renderizador
    const entregasFormatadas = entregas.map(ent => ({
      data_entrega: ent.data_registro,
      quantidade: ent.quantidade_definida,
      numero_os: ent.numero_os
    }));
    
    renderizarUltimasEntregas(entregasFormatadas);
    
    if (entregasFormatadas.length > 0) {
      card.classList.remove('hidden');
    } else {
      card.classList.add('hidden');
    }

    resetarSelecao();
    mostrarResultado();
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
    observacao: obs,
    status: 'confirmado'
  };

  const btn = document.getElementById('btnConfirmar');
  btn.disabled = true;
  btn.innerHTML = '<i data-lucide="loader" class="spin"></i> SALVANDO...';
  lucide.createIcons();

  try {
    await sbFetch('/balanceamento_entregas', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    // Se houver contador, salvar também na tabela de ordens_servico
    if (contadorAtual) {
      await sbFetch('/ordens_servico', {
        method: 'POST',
        body: JSON.stringify({
          equipamento_id: state.equipamentoAtual.id,
          cliente_id: state.equipamentoAtual.cliente.id,
          numero_os: os,
          contador_atual: contadorAtual
        })
      });
    }

    alert("Balanceamento salvo com sucesso!");
    document.getElementById('searchInput').value = '';
    ocultarResultado();
  } catch (error) {
    console.error("Erro ao salvar:", error);
    alert("Erro ao salvar no banco de dados.");
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

  const filterCliente = document.getElementById('filterCliente').value;
  const filterSerie = document.getElementById('filterSerie').value;

  let query = `/balanceamento_entregas?select=*,cliente:clientes(nome),equipamento:equipamentos(serie,secretaria,media_referencia)&order=data_registro.desc&limit=50`;
  
  if (filterSerie) query += `&equipamento.serie=ilike.*${encodeURIComponent(filterSerie)}*`;
  if (filterCliente) query += `&cliente.nome=ilike.*${encodeURIComponent(filterCliente)}*`;

  try {
    const data = await sbFetch(query);
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
