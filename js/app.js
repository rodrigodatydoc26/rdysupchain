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
  if (e.target.value.length > 2) {
    searchTimeout = setTimeout(() => buscarEquipamento(e.target.value), 400);
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
    const res = await fetch(`/api/buscar-equipamento.php?q=${encodeURIComponent(query)}`);
    
    // Se falhar o fetch (ex: arquivo não encontrado ou sem servidor PHP)
    if (!res.ok && window.location.protocol === 'file:') {
       throw new Error('Ambiente local sem PHP');
    }

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
    console.warn("API PHP não detectada. Ativando MODO DEMONSTRAÇÃO para visualização.", error);
    ativarModoDemo(query);
  }
}

function ativarModoDemo(query) {
  // Dados mockados para teste sem servidor
  const mockEquip = {
    id: 'demo-uuid-123',
    serie: query.toUpperCase(),
    patrimonio: 'DEMO-001',
    modelo: 'HP LaserJet Pro M404n (DEMO)',
    cliente: { id: 'cli-1', nome: 'CLIENTE DEMONSTRAÇÃO LTDA' }
  };
  
  state.equipamentoAtual = mockEquip;
  preencherInfoEquipamento(mockEquip);
  
  // Simular resposta de média
  const mockMedia = {
    media: 4.5,
    sugestoes: {
      1: 6,
      2: 3,
      3: 2
    },
    entregas: [
      { data_entrega: new Date().toISOString(), quantidade: 5, numero_os: 'OS-DEMO-A' },
      { data_entrega: new Date(Date.now() - 30*24*60*60*1000).toISOString(), quantidade: 4, numero_os: 'OS-DEMO-B' },
      { data_entrega: new Date(Date.now() - 60*24*60*60*1000).toISOString(), quantidade: 5, numero_os: 'OS-DEMO-C' }
    ]
  };
  
  setTimeout(() => {
    state.mediaAtual = mockMedia.media;
    state.sugestoes = mockMedia.sugestoes;
    
    setMedia(mockMedia.media);
    document.getElementById('opt1Qtd').textContent = mockMedia.sugestoes[1];
    document.getElementById('opt2Qtd').textContent = mockMedia.sugestoes[2];
    document.getElementById('opt3Qtd').textContent = mockMedia.sugestoes[3];
    
    const tbody = document.getElementById('lastDeliveriesTbody');
    tbody.innerHTML = mockMedia.entregas.map(e => `
      <tr>
        <td>${new Date(e.data_entrega).toLocaleDateString('pt-BR')}</td>
        <td>${e.quantidade}</td>
        <td>${e.numero_os}</td>
      </tr>
    `).join('');
    document.getElementById('lastDeliveriesCard').classList.remove('hidden');

    mostrarResultado();
    mostrarLoading(false);
    
    // Notificação discreta
    const notify = document.createElement('div');
    notify.style = "position:fixed; bottom:20px; right:20px; background:var(--gold); color:#000; padding:10px 20px; border-radius:30px; font-weight:bold; font-size:12px; z-index:9999;";
    notify.innerHTML = "✨ MODO DEMONSTRAÇÃO ATIVO";
    document.body.appendChild(notify);
    setTimeout(() => notify.remove(), 4000);
  }, 800);
}

function preencherInfoEquipamento(eq) {
  document.getElementById('resCliente').textContent = `Cliente: ${eq.cliente ? eq.cliente.nome : 'Não informado'}`;
  document.getElementById('resSecretaria').textContent = `SETOR: ${eq.secretaria || 'OUTROS'}`;
  document.getElementById('resPatrimonio').textContent = eq.patrimonio || '---';
  document.getElementById('resSerie').textContent = eq.serie || '---';
  document.getElementById('resModelo').textContent = eq.modelo || '---';
  
  const contador = eq.ultimo_contador || 0;
  document.getElementById('resContador').textContent = contador;
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
  
  // Arredondar conforme regra (1 casa decimal)
  const mediaCalculada = Math.ceil(consumoMensalResmas * 10) / 10;
  
  aplicarNovaMedia(mediaCalculada);
}

function aplicarNovaMedia(media) {
  state.mediaAtual = media;
  
  // Recalcular sugestões com margem de 15%
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
  alert("Média recalculada com base no consumo do numerador!");
}

async function calcularMedia(id) {
  try {
    const res = await fetch(`/api/calcular-media.php?equipamento_id=${id}`);
    const data = await res.json();
    
    if (data && data.media !== undefined) {
      state.mediaAtual = data.media;
      state.sugestoes = data.sugestoes;
      
      setMedia(data.media);
      document.getElementById('opt1Qtd').textContent = data.sugestoes[1];
      document.getElementById('opt2Qtd').textContent = data.sugestoes[2];
      document.getElementById('opt3Qtd').textContent = data.sugestoes[3];
      
      // Preencher últimas entregas
      const tbody = document.getElementById('lastDeliveriesTbody');
      const card = document.getElementById('lastDeliveriesCard');
      
      if (data.entregas && data.entregas.length > 0) {
        tbody.innerHTML = data.entregas.map(e => `
          <tr>
            <td>${new Date(e.data_entrega || e.created_at).toLocaleDateString('pt-BR')}</td>
            <td>${e.quantidade}</td>
            <td>${e.numero_os || '---'}</td>
          </tr>
        `).join('');
        card.classList.remove('hidden');
      } else {
        card.classList.add('hidden');
      }

      resetarSelecao();
      mostrarResultado();
    }
  } catch (error) {
    console.error("Erro ao calcular média:", error);
    alert("Erro ao calcular média de consumo.");
  } finally {
    mostrarLoading(false);
  }
}

function selecionarOpcao(opcao) {
  state.opcaoSelecionada = opcao;
  let qtd = state.sugestoes[opcao] || 0;
  
  if (opcao === 0) {
    qtd = 1; // Inicializar com 1 para manual
  }
  
  // Atualiza UI dos cards
  document.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
  document.querySelector(`.option-card[data-opcao="${opcao}"]`).classList.add('selected');
  
  // Atualiza sumário
  if (opcao === 0) {
    document.getElementById('sumOpcaoText').textContent = `Entrega Manual (Avulsa)`;
  } else {
    document.getElementById('sumOpcaoText').textContent = `${opcao}x por mês (${qtd} resmas por visita)`;
  }
  
  // Mostra campos adicionais
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

  if (!os) {
    alert("O número da O.S. é obrigatório!");
    return;
  }

  if (!qtd || qtd <= 0) {
    alert("Quantidade inválida!");
    return;
  }

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
    const res = await fetch('/api/salvar-balanceamento.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    // Fallback para modo demo se o PHP falhar
    if (!res.ok && window.location.protocol === 'file:') {
       throw new Error('Offline');
    }

    const result = await res.json();
    if (result.success) {
      alert("Balanceamento salvo com sucesso!");
      document.getElementById('searchInput').value = '';
      ocultarResultado();
    } else {
      alert("Erro ao salvar: " + (result.error || "Desconhecido"));
    }
  } catch (error) {
    console.warn("Erro ao salvar (Modo Demo Ativo):", error);
    alert("✨ [MODO DEMO] Balanceamento simulado com sucesso!");
    document.getElementById('searchInput').value = '';
    ocultarResultado();
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="check-circle"></i> CONFIRMAR BALANCEAMENTO';
    lucide.createIcons();
  }
}

async function carregarHistorico() {
  const tbody = document.getElementById('historicoTbody');
  tbody.innerHTML = '<tr><td colspan="8" class="text-center">Carregando... <i data-lucide="loader" class="spin"></i></td></tr>';
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
    const res = await fetch(`/api/listar-balanceamentos.php?${params.toString()}`);
    
    if (!res.ok && window.location.protocol === 'file:') {
       throw new Error('Offline');
    }

    const data = await res.json();

    if (data && data.length > 0) {
      tbody.innerHTML = '';
      data.forEach(item => {
        const tr = document.createElement('tr');
        const dataFormatada = new Date(item.data_registro).toLocaleDateString('pt-BR');
        
        // Evitar erro se não tiver a relação cliente / equipamento retornado
        const nomeCliente = item.cliente ? item.cliente.nome : 'N/D';
        const serieEquip = item.equipamento ? item.equipamento.serie : 'N/D';

        tr.innerHTML = `
          <td>${dataFormatada}</td>
          <td>${nomeCliente}</td>
          <td>${serieEquip}</td>
          <td>${item.media_consumo_mensal}</td>
          <td>${item.opcao_entrega === 0 ? 'Manual' : item.opcao_entrega + 'x'}</td>
          <td>${item.quantidade_definida}</td>
          <td>${item.numero_os}</td>
          <td><span class="status-badge status-${item.status}">${item.status}</span></td>
        `;
        tbody.appendChild(tr);
      });
    } else {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center">Nenhum histórico encontrado.</td></tr>';
    }
  } catch (error) {
    console.warn("Erro ao carregar histórico (Modo Demo Ativo):", error);
    mostrarHistoricoDemo();
  }
}

function mostrarHistoricoDemo() {
  const tbody = document.getElementById('historicoTbody');
  const mockData = [
    { data_registro: new Date().toISOString(), cliente: {nome: 'CLIENTE DEMO 1'}, equipamento: {serie: 'SERIE123'}, media_consumo_mensal: 10.5, opcao_entrega: 2, quantidade_definida: 6, numero_os: 'OS-123', status: 'confirmado' },
    { data_registro: new Date().toISOString(), cliente: {nome: 'SECRETARIA ADM'}, equipamento: {serie: 'BRB456'}, media_consumo_mensal: 4.2, opcao_entrega: 1, quantidade_definida: 5, numero_os: 'OS-456', status: 'confirmado' }
  ];
  
  tbody.innerHTML = '';
  mockData.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${new Date(item.data_registro).toLocaleDateString('pt-BR')}</td>
      <td>${item.cliente.nome}</td>
      <td>${item.equipamento.serie}</td>
      <td>${item.media_consumo_mensal}</td>
      <td>${item.opcao_entrega === 0 ? 'Manual' : item.opcao_entrega + 'x'}</td>
      <td>${item.quantidade_definida}</td>
      <td>${item.numero_os}</td>
      <td><span class="status-badge status-${item.status}">${item.status}</span></td>
    `;
    tbody.appendChild(tr);
  });
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
  const txt = parseFloat(valor).toFixed(1).replace('.', ',');
  document.getElementById('resMedia').textContent = txt;
  document.getElementById('sumMedia').textContent = txt;
}

// Utilitários de UI
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
