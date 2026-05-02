// RDY DOC CONTROL - App Logic (Direct Supabase)
const SUPABASE_URL = 'https://jvwrbrypyrwnaaqijbqm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2d3JicnlweXJ3bmFhcWlqYnFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NjQ3NTcsImV4cCI6MjA5MTM0MDc1N30.qNQw3VOLRVFxuXM7fESkMwPlvc6Hg5qGTVlBepzU85o';

let state = {
    equipamento: null,
    media: 0,
    opcao: null
};

const API = {
    async fetch(endpoint) {
        const url = `${SUPABASE_URL}/rest/v1${endpoint}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        try {
            const res = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                }
            });
            clearTimeout(timeoutId);
            if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
            return res.json();
        } catch (e) {
            clearTimeout(timeoutId);
            if (e.name === 'AbortError') throw new Error("Timeout: A conexão com o banco demorou demais.");
            throw e;
        }
    },

    async post(endpoint, data) {
        const url = `${SUPABASE_URL}/rest/v1${endpoint}`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
        return res.json();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    initTabs();
    initSearch();
});

function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === `tab-${tabId}`));
            if (tabId === 'historico') carregarHistorico();
            if (tabId === 'relatorios') carregarRelatorios();
            if (tabId === 'cadastrar') carregarClientesParaCadastro();
            if (tabId === 'consultar') carregarClientesParaConsulta();
        });
    });
}

function initSearch() {
    const input = document.getElementById('searchInput');
    const list = document.getElementById('suggestionsList');
    let timeout;

    input.addEventListener('input', () => {
        clearTimeout(timeout);
        const q = input.value.trim();
        if (q.length < 3) return list.classList.add('hidden');
        timeout = setTimeout(async () => {
            try {
                const data = await API.fetch(`/equipamentos?select=serie,patrimonio,secretaria,cliente:clientes(nome)&or=(serie.ilike.*${q}*,patrimonio.ilike.*${q}*)&limit=8`);
                if (data.length > 0) {
                    list.innerHTML = data.map(item => `
                        <div class="suggestion-item" onclick="selecionarSugestao('${item.serie}')">
                            <div class="sugg-main">
                                <strong>${item.serie}</strong>
                                <span class="tag-sm">${item.secretaria || 'OUTROS'}</span>
                            </div>
                            <span class="sub">${item.cliente ? item.cliente.nome : ''}</span>
                        </div>
                    `).join('');
                    list.classList.remove('hidden');
                } else {
                    list.classList.add('hidden');
                }
            } catch (e) {
                console.warn("Search error:", e);
            }
        }, 300);
    });

    document.getElementById('searchBtn').addEventListener('click', () => buscarEquipamento(input.value.trim()));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') buscarEquipamento(input.value.trim()); });
    document.addEventListener('click', (e) => { if (!e.target.closest('.autocomplete-container')) list.classList.add('hidden'); });
}

async function selecionarSugestao(serie) {
    document.getElementById('searchInput').value = serie;
    document.getElementById('suggestionsList').classList.add('hidden');
    buscarEquipamento(serie);
}

async function buscarEquipamento(serie) {
    if (!serie) return;
    setLoading(true);
    resetUI();

    try {
        const data = await API.fetch(`/equipamentos?serie=eq.${encodeURIComponent(serie)}&select=*,cliente:clientes(id,nome,cidade)&limit=1`);
        if (data.length === 0) {
            alert("Equipamento não encontrado!");
            return;
        }

        const equip = data[0];

        const os = await API.fetch(`/ordens_servico?equipamento_id=eq.${equip.id}&order=data_os.desc&limit=1`);
        equip.ultimo_contador = os[0]?.contador_atual || 0;
        equip.data_ultimo_contador = os[0]?.data_os || null;

        state.equipamento = equip;

        document.getElementById('resCliente').innerText = `Cliente: ${equip.cliente?.nome || 'N/D'}`;
        document.getElementById('resSecretaria').innerText = `SETOR: ${equip.secretaria || 'OUTROS'}`;
        document.getElementById('resPatrimonio').innerText = equip.patrimonio || 'N/D';
        document.getElementById('resSerie').innerText = equip.serie;
        document.getElementById('resModelo').innerText = equip.modelo || 'N/D';
        document.getElementById('resContador').innerText = equip.ultimo_contador;
        document.getElementById('sumContadorAnterior').innerText = equip.ultimo_contador;

        // Busca todo o histórico confirmado para calibrar a média
        const entregas = await API.fetch(`/balanceamento_entregas?equipamento_id=eq.${equip.id}&status=eq.confirmado&order=data_registro.asc`);
        const media = calcularMediaCalibrada(entregas, parseFloat(equip.media_referencia) || 0);

        updateMedia(media);
        document.getElementById('resultContainer').classList.remove('hidden');

        // Últimas entregas (as 3 mais recentes para exibição)
        const card = document.getElementById('lastDeliveriesCard');
        const tbody = document.getElementById('lastDeliveriesTbody');
        if (entregas.length > 0) {
            tbody.innerHTML = [...entregas].reverse().slice(0, 3).map(e => `
                <tr>
                    <td>${new Date(e.data_registro).toLocaleDateString('pt-BR')}</td>
                    <td>${e.quantidade_definida}</td>
                    <td>${e.numero_os || '-'}</td>
                </tr>
            `).join('');
            card.classList.remove('hidden');
        } else {
            card.classList.add('hidden');
        }

    } catch (e) {
        console.error(e);
        alert(`Erro de conexão: ${e.message}\n\nVerifique sua internet ou se o firewall está bloqueando o acesso.`);
    } finally {
        setLoading(false);
    }
}

// Calibra a média de consumo usando todo o histórico disponível.
// Prioridade 1: delta real entre leituras de contador consecutivas (média ponderada, meses recentes valem mais).
// Prioridade 2: média simples dos valores de media_consumo_mensal salvos.
// Prioridade 3: media_referencia do cadastro do equipamento.
function calcularMediaCalibrada(entregas, mediaReferencia) {
    if (!entregas || entregas.length === 0) return mediaReferencia;

    // Ordenar crescente por data (já vem ordenado, mas garante)
    const ordenadas = [...entregas].sort((a, b) => new Date(a.data_registro) - new Date(b.data_registro));

    // Passo 1: calcular consumo real entre leituras consecutivas de contador
    const comContador = ordenadas.filter(e => e.contador_atual != null && e.contador_atual > 0);
    if (comContador.length >= 2) {
        const consumos = [];
        for (let i = 1; i < comContador.length; i++) {
            const deltaPages = comContador[i].contador_atual - comContador[i - 1].contador_atual;
            const deltaDias = Math.ceil(
                Math.abs(new Date(comContador[i].data_registro) - new Date(comContador[i - 1].data_registro)) / (1000 * 60 * 60 * 24)
            ) || 1;
            const resmasMes = (deltaPages / deltaDias) * 30 / 500;
            if (resmasMes > 0) consumos.push(resmasMes);
        }

        if (consumos.length > 0) {
            // Média ponderada: o mês mais recente tem peso N, o mais antigo tem peso 1
            let totalPeso = 0, somaTotal = 0;
            consumos.forEach((v, i) => {
                const peso = i + 1;
                somaTotal += v * peso;
                totalPeso += peso;
            });
            return Math.round((somaTotal / totalPeso) * 10) / 10;
        }
    }

    // Passo 2: sem contador suficiente — média dos valores históricos salvos
    const valores = ordenadas.map(e => parseFloat(e.media_consumo_mensal)).filter(v => v > 0);
    if (valores.length > 0) {
        return Math.round((valores.reduce((s, v) => s + v, 0) / valores.length) * 10) / 10;
    }

    // Passo 3: fallback para referência inicial do cadastro
    return mediaReferencia;
}

function updateMedia(val) {
    state.media = val;
    const txt = val.toFixed(1).replace('.', ',');
    document.getElementById('resMedia').innerText = txt;
    document.getElementById('sumMedia').innerText = txt;
    document.getElementById('resPaginas').innerText = (val * 500).toLocaleString('pt-BR');

    const margem = val * 1.15;
    const s1 = Math.floor(val + 1);
    const s2 = Math.ceil(margem / 2);
    const s3 = Math.ceil(margem / 3);

    document.getElementById('opt1Qtd').innerText = s1;
    document.getElementById('opt2Qtd').innerText = s2;
    document.getElementById('opt3Qtd').innerText = s3;

    state.sugestoes = { 1: s1, 2: s2, 3: s3 };
}

function selecionarOpcao(n) {
    state.opcao = n;
    let qtd = state.sugestoes[n] || 0;
    if (n === 0) qtd = parseInt(document.getElementById('inputManualQtd').value) || 1;

    document.querySelectorAll('.option-card').forEach(c => c.classList.toggle('selected', parseInt(c.dataset.opcao) === n));
    document.getElementById('sumOpcaoText').innerText = n === 0 ? `Entrega Manual (${qtd} resmas)` : `${n}x por mês (${qtd} resmas/visita)`;

    document.getElementById('formLineOs').classList.remove('hidden');
    document.getElementById('formLineObs').classList.remove('hidden');
    document.getElementById('actionRow').classList.remove('hidden');

    updateProxima();
}

function atualizarQtdManual(v) {
    if (state.opcao === 0) {
        document.getElementById('sumOpcaoText').innerText = `Entrega Manual (${v} resmas)`;
        updateProxima();
    }
}

// Chamado pelo oninput do campo de contador no HTML
function atualizarProximaSolicitacao() {
    updateProxima();
}

function updateProxima() {
    const cont = parseInt(document.getElementById('inputContador').value) || 0;
    let qtd = 0;
    if (state.opcao === 0) qtd = parseInt(document.getElementById('inputManualQtd').value) || 0;
    else if (state.opcao !== null) qtd = state.sugestoes[state.opcao] || 0;

    const el = document.getElementById('resProximaSolicitacao');
    if (cont > 0 && qtd > 0) el.innerText = (cont + (qtd * 500)).toLocaleString('pt-BR');
    else el.innerText = '---';
}

// Recalcula a média de consumo com base no contador informado
function recalcularComContador() {
    const cont = parseInt(document.getElementById('inputContador').value);
    if (!cont || !state.equipamento) return;

    if (state.equipamento.ultimo_contador && state.equipamento.data_ultimo_contador) {
        const dias = Math.ceil(Math.abs(new Date() - new Date(state.equipamento.data_ultimo_contador)) / (1000 * 60 * 60 * 24)) || 1;
        const novaMedia = Math.ceil(((cont - state.equipamento.ultimo_contador) / dias * 30 / 500) * 10) / 10;
        if (novaMedia > 0) updateMedia(novaMedia);
    }
    updateProxima();
}

async function salvarBalanceamento() {
    const os = document.getElementById('inputOs').value.trim();
    const cont = parseInt(document.getElementById('inputContador').value) || null;
    const obs = document.getElementById('inputObs').value.trim();

    let qtd = 0;
    if (state.opcao === 0) qtd = parseInt(document.getElementById('inputManualQtd').value) || 0;
    else qtd = state.sugestoes[state.opcao] || 0;

    if (!qtd) return alert("Selecione uma opção de entrega!");

    setBtnLoading(true);

    try {
        let finalMedia = state.media;
        if (cont && state.equipamento.ultimo_contador && state.equipamento.data_ultimo_contador) {
            const dias = Math.ceil(Math.abs(new Date() - new Date(state.equipamento.data_ultimo_contador)) / (1000 * 60 * 60 * 24)) || 1;
            finalMedia = Math.ceil(((cont - state.equipamento.ultimo_contador) / dias * 30 / 500) * 10) / 10;
        }

        await API.post('/balanceamento_entregas', {
            equipamento_id: state.equipamento.id,
            cliente_id: state.equipamento.cliente.id,
            numero_os: os || null,
            media_consumo_mensal: finalMedia,
            opcao_entrega: state.opcao,
            quantidade_definida: qtd,
            contador_atual: cont,
            observacao: obs || null,
            status: 'confirmado'
        });

        if (cont) {
            await API.post('/ordens_servico', {
                equipamento_id: state.equipamento.id,
                cliente_id: state.equipamento.cliente.id,
                numero_os: os || null,
                contador_atual: cont
            });
        }

        alert("Balanceamento confirmado com sucesso!");
        window.location.reload();

    } catch (e) {
        alert("Erro ao salvar: " + e.message);
    } finally {
        setBtnLoading(false);
    }
}

// CADASTRO
async function carregarClientesParaCadastro() {
    const select = document.getElementById('cadCliente');
    select.innerHTML = '<option value="">Carregando clientes...</option>';
    try {
        const data = await API.fetch('/clientes?select=id,nome&order=nome.asc');
        select.innerHTML = '<option value="">Selecione um cliente</option>' +
            data.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');

        if (!document.getElementById('formCadastro').dataset.init) {
            // Toggle para adicionar novo cliente
            document.getElementById('toggleNovoCliente').addEventListener('click', () => {
                const isSelect = !select.classList.contains('hidden');
                select.classList.toggle('hidden', isSelect);
                document.getElementById('cadNovoCliente').classList.toggle('hidden', !isSelect);
                document.getElementById('toggleNovoCliente').innerHTML = isSelect
                    ? '<i data-lucide="list"></i> Listar Clientes'
                    : '<i data-lucide="plus-circle"></i> Novo Cliente';
                lucide.createIcons();
            });

            document.getElementById('formCadastro').addEventListener('submit', salvarEquipamento);
            document.getElementById('formCadastro').dataset.init = "true";
        }
    } catch (e) { select.innerHTML = '<option value="">Erro ao carregar</option>'; }
}

async function salvarEquipamento(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;

    const select = document.getElementById('cadCliente');
    const inputNovo = document.getElementById('cadNovoCliente');
    const isNovo = !inputNovo.classList.contains('hidden');

    let clienteId = select.value;
    const novoNome = inputNovo.value.trim();

    if (isNovo && !novoNome) return alert("Digite o nome do novo cliente!");
    if (!isNovo && !clienteId) return alert("Selecione um cliente!");

    btn.disabled = true;
    btn.innerHTML = 'PROCESSANDO...';

    try {
        if (isNovo) {
            const res = await API.post('/clientes', { nome: novoNome });
            clienteId = res[0].id;
        }

        await API.post('/equipamentos', {
            cliente_id: clienteId,
            serie: document.getElementById('cadSerie').value.trim(),
            patrimonio: document.getElementById('cadPatrimonio').value.trim() || null,
            modelo: document.getElementById('cadModelo').value.trim() || null,
            secretaria: document.getElementById('cadSecretaria').value.trim() || null
        });

        alert("Equipamento cadastrado com sucesso!");
        e.target.reset();
        // Recarregar lista de clientes para incluir o novo
        if (isNovo) {
            document.getElementById('cadNovoCliente').classList.add('hidden');
            select.classList.remove('hidden');
            document.getElementById('toggleNovoCliente').innerHTML = '<i data-lucide="plus-circle"></i> Novo Cliente';
            lucide.createIcons();
            document.getElementById('formCadastro').dataset.init = '';
            carregarClientesParaCadastro();
        }
    } catch (err) {
        alert("Erro ao cadastrar: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// CONSULTA
async function carregarClientesParaConsulta() {
    const select = document.getElementById('filterConsultaCliente');
    if (select.dataset.init) return;

    try {
        const data = await API.fetch('/clientes?select=id,nome&order=nome.asc');
        select.innerHTML = '<option value="">Filtrar por Cliente...</option>' +
            data.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');

        select.addEventListener('change', realizarConsulta);

        let searchTimeout;
        document.getElementById('globalSearchInput').addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(realizarConsulta, 400);
        });

        select.dataset.init = "true";
    } catch (e) { console.error(e); }
}

async function realizarConsulta() {
    const clienteId = document.getElementById('filterConsultaCliente').value;
    const q = document.getElementById('globalSearchInput').value.trim();
    const dataInicio = document.getElementById('consultarDataInicio').value;
    const dataFim = document.getElementById('consultarDataFim').value;
    
    if (!clienteId && !q && !dataInicio) return document.getElementById('consultarDashboard').classList.add('hidden');
    
    setLoading(true);
    const tbody = document.getElementById('consultarTbody');
    tbody.innerHTML = '<tr><td colspan="6">Buscando...</td></tr>';
    
    try {
        // Construir query de equipamentos
        let endpoint = `/equipamentos?select=*,cliente:clientes(nome),balanceamento_entregas(media_consumo_mensal,status,data_registro)&order=serie.asc`;
        
        if (clienteId) endpoint += `&cliente_id=eq.${clienteId}`;
        if (q) endpoint += `&or=(serie.ilike.*${q}*,patrimonio.ilike.*${q}*,modelo.ilike.*${q}*,secretaria.ilike.*${q}*)`;

        // Se houver datas, aplicamos o filtro na sub-query via parâmetro de URL
        if (dataInicio) endpoint += `&balanceamento_entregas.data_registro=gte.${dataInicio}`;
        if (dataFim) endpoint += `&balanceamento_entregas.data_registro=lte.${dataFim}T23:59:59`;

        const data = await API.fetch(endpoint);
        
        // Filtro manual para o nome do cliente se houver busca por texto
        const filteredData = q ? data.filter(item => {
            const matchFields = (item.serie + (item.patrimonio||'') + (item.modelo||'') + (item.secretaria||'')).toLowerCase();
            const matchClient = (item.cliente?.nome || '').toLowerCase();
            return matchFields.includes(q.toLowerCase()) || matchClient.includes(q.toLowerCase());
        }) : data;

        document.getElementById('consultarDashboard').classList.remove('hidden');
        document.getElementById('dashTotalEquip').innerText = filteredData.length;
        
        let totalMediaGeral = 0;
        
        tbody.innerHTML = filteredData.map(eq => {
            const entregas = eq.balanceamento_entregas || [];
            // Filtrar apenas confirmados
            const confirmadas = entregas.filter(e => e.status === 'confirmado');
            
            let mediaEquip = 0;
            if (confirmadas.length > 0) {
                const soma = confirmadas.reduce((a, b) => a + parseFloat(b.media_consumo_mensal), 0);
                mediaEquip = soma / confirmadas.length;
            }

            totalMediaGeral += mediaEquip;

            return `
                <tr>
                    <td><strong>${eq.serie}</strong></td>
                    <td>${eq.patrimonio || '-'}</td>
                    <td>${eq.modelo || '-'}</td>
                    <td>${eq.secretaria || '-'} <br><small class="text-dim">${eq.cliente?.nome || 'N/D'}</small></td>
                    <td class="text-center">
                        <span class="gold-text"><strong>${mediaEquip.toFixed(1).replace('.', ',')}</strong></span> 
                        <br><small class="text-dim">${confirmadas.length} reg.</small>
                    </td>
                    <td class="text-center">
                        <button class="btn-primary btn-sm" onclick="selecionarParaBalancear('${eq.serie}')">
                            <i data-lucide="scale"></i> BALANCEAR
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
        
        document.getElementById('dashTotalConsumo').innerText = totalMediaGeral.toFixed(1).replace('.', ',');
        lucide.createIcons();

    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="6">Erro ao carregar dados.</td></tr>';
    } finally {
        setLoading(false);
    }
}

function selecionarParaBalancear(serie) {
    document.querySelector('.tab-btn[data-tab="balancear"]').click();
    document.getElementById('searchInput').value = serie;
    buscarEquipamento(serie);
}

// HISTÓRICO com filtros
async function carregarHistorico() {
    const tbody = document.getElementById('historicoTbody');
    tbody.innerHTML = '<tr><td colspan="9">Carregando...</td></tr>';

    const dataInicio = document.getElementById('filterDataInicio').value;
    const dataFim = document.getElementById('filterDataFim').value;
    const cliente = document.getElementById('filterCliente').value.trim().toLowerCase();
    const serie = document.getElementById('filterSerie').value.trim().toLowerCase();

    let endpoint = '/balanceamento_entregas?select=*,cliente:clientes(nome),equipamento:equipamentos(serie,patrimonio,secretaria)&order=data_registro.desc&limit=100';
    if (dataInicio) endpoint += `&data_registro=gte.${dataInicio}`;
    if (dataFim) endpoint += `&data_registro=lte.${dataFim}T23:59:59`;

    try {
        let data = await API.fetch(endpoint);

        if (cliente) data = data.filter(i => (i.cliente?.nome || '').toLowerCase().includes(cliente));
        if (serie) data = data.filter(i =>
            (i.equipamento?.serie || '').toLowerCase().includes(serie) ||
            (i.equipamento?.patrimonio || '').toLowerCase().includes(serie)
        );

        tbody.innerHTML = data.map(i => `
            <tr>
                <td>${new Date(i.data_registro).toLocaleDateString('pt-BR')}</td>
                <td>${i.cliente?.nome || 'N/D'}</td>
                <td>${i.equipamento?.secretaria || 'N/D'}</td>
                <td>${i.equipamento?.serie || 'N/D'}</td>
                <td>${parseFloat(i.media_consumo_mensal).toFixed(1).replace('.', ',')}</td>
                <td>${i.opcao_entrega === 0 ? 'Manual' : i.opcao_entrega + 'x'}</td>
                <td>${i.quantidade_definida}</td>
                <td>${i.numero_os || '-'}</td>
                <td><span class="status-badge status-${i.status}">${i.status}</span></td>
            </tr>
        `).join('');

        const total = data.reduce((a, b) => a + (b.quantidade_definida || 0), 0);
        document.getElementById('totalResmas').innerText = total;
        document.getElementById('historicoTfoot').classList.remove('hidden');
    } catch (e) { tbody.innerHTML = '<tr><td colspan="9">Erro ao carregar histórico.</td></tr>'; }
}

async function carregarRelatorios() {
    const tbody = document.getElementById('rankingTbody');
    tbody.innerHTML = '<tr><td colspan="7">Carregando...</td></tr>';
    try {
        const data = await API.fetch('/view_top_equipamentos?limit=20');
        tbody.innerHTML = data.map((i, idx) => `
            <tr class="rank-${idx + 1}">
                <td><span class="rank-badge">${idx + 1}º</span></td>
                <td>${i.serie}</td>
                <td>${i.secretaria}</td>
                <td>${i.cliente_nome}</td>
                <td class="text-center">${i.total_chamados}</td>
                <td class="text-center">${i.total_resmas}</td>
                <td class="text-center">${parseFloat(i.media_media).toFixed(1)}</td>
            </tr>
        `).join('');
    } catch (e) { tbody.innerHTML = '<tr><td colspan="7">Erro ao carregar relatório.</td></tr>'; }
}

function exportarExcel(id, name) {
    const table = document.getElementById(id);
    const wb = XLSX.utils.table_to_book(table);
    XLSX.writeFile(wb, `${name}.xlsx`);
}

function setLoading(s) { document.getElementById('loadingIndicator').classList.toggle('hidden', !s); }

function setBtnLoading(s) {
    const b = document.getElementById('btnConfirmar');
    b.disabled = s;
    b.innerHTML = s
        ? '<i data-lucide="loader" class="spin"></i> SALVANDO...'
        : '<i data-lucide="check-circle"></i> CONFIRMAR BALANCEAMENTO';
    lucide.createIcons();
}

function resetUI() {
    document.getElementById('resultContainer').classList.add('hidden');
    document.getElementById('lastDeliveriesCard').classList.add('hidden');
    document.getElementById('formLineOs').classList.add('hidden');
    document.getElementById('formLineObs').classList.add('hidden');
    document.getElementById('actionRow').classList.add('hidden');
}
