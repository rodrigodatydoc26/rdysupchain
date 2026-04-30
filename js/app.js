// RDY DOC CONTROL - App Logic (Direct Supabase)
const SUPABASE_URL = 'https://jvwrbrypyrwnaaqijbqm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2d3JicnlweXJ3bmFhcWlqYnFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NjQ3NTcsImV4cCI6MjA5MTM0MDc1N30.qNQw3VOLRVFxuXM7fESkMwPlvc6Hg5qGTVlBepzU85o';

// Estado global
let state = {
    equipamento: null,
    media: 0,
    opcao: null,
    historico: []
};

// Funções de API
const API = {
    async fetch(endpoint) {
        const url = `${SUPABASE_URL}/rest/v1${endpoint}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

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

// Inicialização
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

    document.getElementById('searchBtn').addEventListener('click', () => buscarEquipamento(input.value));
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
        const data = await API.fetch(`/equipamentos?serie=eq.${serie}&select=*,cliente:clientes(id,nome,cidade)&limit=1`);
        if (data.length === 0) {
            alert("Equipamento não encontrado!");
            return;
        }

        const equip = data[0];
        
        // Buscar último contador
        const os = await API.fetch(`/ordens_servico?equipamento_id=eq.${equip.id}&order=data_os.desc&limit=1`);
        equip.ultimo_contador = os[0]?.contador_atual || 0;
        equip.data_ultimo_contador = os[0]?.data_os || null;

        state.equipamento = equip;
        
        // Preencher UI
        document.getElementById('resCliente').innerText = `Cliente: ${equip.cliente?.nome || 'N/D'}`;
        document.getElementById('resSecretaria').innerText = `SETOR: ${equip.secretaria || 'OUTROS'}`;
        document.getElementById('resPatrimonio').innerText = equip.patrimonio || 'N/D';
        document.getElementById('resSerie').innerText = equip.serie;
        document.getElementById('resModelo').innerText = equip.modelo || 'N/D';
        document.getElementById('resContador').innerText = equip.ultimo_contador;
        document.getElementById('sumContadorAnterior').innerText = equip.ultimo_contador;

        // Calcular Média
        const entregas = await API.fetch(`/balanceamento_entregas?equipamento_id=eq.${equip.id}&status=eq.confirmado&order=data_registro.desc&limit=3`);
        let media = parseFloat(equip.media_referencia) || 0;
        if (entregas.length > 0) {
            const soma = entregas.reduce((a, b) => a + parseFloat(b.media_consumo_mensal), 0);
            media = soma / entregas.length;
        }
        
        updateMedia(media);
        document.getElementById('resultContainer').classList.remove('hidden');

    } catch (e) {
        console.error(e);
        alert(`Erro de conexão: ${e.message}\n\nVerifique se você está conectado à internet ou se o firewall está bloqueando o acesso.`);
    } finally {
        setLoading(false);
    }
}

function updateMedia(val) {
    state.media = val;
    const txt = val.toFixed(1).replace('.', ',');
    document.getElementById('resMedia').innerText = txt;
    document.getElementById('sumMedia').innerText = txt;
    document.getElementById('resPaginas').innerText = (val * 500).toLocaleString('pt-BR');

    // Opções
    const margem = val * 1.15;
    const s1 = Math.ceil(val) + 1;
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

function updateProxima() {
    const cont = parseInt(document.getElementById('inputContador').value) || 0;
    let qtd = 0;
    if (state.opcao === 0) qtd = parseInt(document.getElementById('inputManualQtd').value) || 0;
    else if (state.opcao !== null) qtd = state.sugestoes[state.opcao] || 0;

    const el = document.getElementById('resProximaSolicitacao');
    if (cont > 0 && qtd > 0) el.innerText = (cont + (qtd * 500)).toLocaleString('pt-BR');
    else el.innerText = '---';
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
        // Ajuste de média automático se houver contador
        let finalMedia = state.media;
        if (cont && state.equipamento.ultimo_contador && state.equipamento.data_ultimo_contador) {
            const dias = Math.ceil(Math.abs(new Date() - new Date(state.equipamento.data_ultimo_contador)) / (1000*60*60*24)) || 1;
            finalMedia = Math.ceil(((cont - state.equipamento.ultimo_contador) / dias * 30 / 500) * 10) / 10;
        }

        await API.post('/balanceamento_entregas', {
            equipamento_id: state.equipamento.id,
            cliente_id: state.equipamento.cliente.id,
            numero_os: os,
            media_consumo_mensal: finalMedia,
            opcao_entrega: state.opcao,
            quantidade_definida: qtd,
            contador_atual: cont,
            observacao: obs,
            status: 'confirmado'
        });

        if (cont) {
            await API.post('/ordens_servico', {
                equipamento_id: state.equipamento.id,
                cliente_id: state.equipamento.cliente.id,
                numero_os: os,
                contador_atual: cont
            });
        }

        alert("Sucesso!");
        window.location.reload();

    } catch (e) {
        alert("Erro ao salvar.");
    } finally {
        setBtnLoading(false);
    }
}

async function carregarHistorico() {
    const tbody = document.getElementById('historicoTbody');
    tbody.innerHTML = '<tr><td colspan="9">Carregando...</td></tr>';
    
    try {
        const data = await API.fetch('/balanceamento_entregas?select=*,cliente:clientes(nome),equipamento:equipamentos(serie,secretaria)&order=data_registro.desc&limit=50');
        tbody.innerHTML = data.map(i => `
            <tr>
                <td>${new Date(i.data_registro).toLocaleDateString()}</td>
                <td>${i.cliente?.nome || 'N/D'}</td>
                <td>${i.equipamento?.secretaria || 'N/D'}</td>
                <td>${i.equipamento?.serie || 'N/D'}</td>
                <td>${i.media_consumo_mensal}</td>
                <td>${i.opcao_entrega === 0 ? 'Manual' : i.opcao_entrega+'x'}</td>
                <td>${i.quantidade_definida}</td>
                <td>${i.numero_os}</td>
                <td><span class="status-badge status-${i.status}">${i.status}</span></td>
            </tr>
        `).join('');
        
        const total = data.reduce((a, b) => a + (b.quantidade_definida || 0), 0);
        document.getElementById('totalResmas').innerText = total;
        document.getElementById('historicoTfoot').classList.remove('hidden');
    } catch (e) { tbody.innerHTML = '<tr><td colspan="9">Erro.</td></tr>'; }
}

async function carregarRelatorios() {
    const tbody = document.getElementById('rankingTbody');
    tbody.innerHTML = '<tr><td colspan="7">Carregando...</td></tr>';
    try {
        const data = await API.fetch('/view_top_equipamentos?limit=20');
        tbody.innerHTML = data.map((i, idx) => `
            <tr class="rank-${idx+1}">
                <td><span class="rank-badge">${idx+1}º</span></td>
                <td>${i.serie}</td>
                <td>${i.secretaria}</td>
                <td>${i.cliente_nome}</td>
                <td class="text-center">${i.total_chamados}</td>
                <td class="text-center">${i.total_resmas}</td>
                <td class="text-center">${parseFloat(i.media_media).toFixed(1)}</td>
            </tr>
        `).join('');
    } catch (e) { tbody.innerHTML = '<tr><td colspan="7">Erro.</td></tr>'; }
}

function exportarExcel(id, name) {
    const table = document.getElementById(id);
    const wb = XLSX.utils.table_to_book(table);
    XLSX.writeFile(wb, `${name}.xlsx`);
}

function setLoading(s) { document.getElementById('loadingIndicator').classList.toggle('hidden', !s); }
function setBtnLoading(s) { 
    const b = document.getElementById('btnSalvar');
    b.disabled = s;
    b.innerText = s ? "SALVANDO..." : "CONFIRMAR BALANCEAMENTO";
}
function resetUI() {
    document.getElementById('resultContainer').classList.add('hidden');
    document.getElementById('formLineOs').classList.add('hidden');
    document.getElementById('formLineObs').classList.add('hidden');
    document.getElementById('actionRow').classList.add('hidden');
}
