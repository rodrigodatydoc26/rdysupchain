// RDY DOC CONTROL - App Logic (Direct Supabase)
if (typeof lucide === 'undefined') {
    window.lucide = {
        createIcons: function() { console.warn("Lucide fallback: icons not loaded."); }
    };
}
const SUPABASE_URL = 'https://iedkbtceqgrawgubxslh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllZGtidGNlcWdyYXdndWJ4c2xoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NjgwNjYsImV4cCI6MjA5MzE0NDA2Nn0.O29RYcYN2NOAz8pZUCa0ntBHXDEFRLmbeojpwdAArBo';

// ════════════════════════════════════════════════════════
// SEGURANÇA — Previne XSS em todos os innerHTML
// ════════════════════════════════════════════════════════
function esc(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
const escAttr = esc;

function getLocalOffsetString() {
    const offset = new Date().getTimezoneOffset();
    const absOffset = Math.abs(offset);
    const h = String(Math.floor(absOffset / 60)).padStart(2, '0');
    const m = String(absOffset % 60).padStart(2, '0');
    const sign = offset <= 0 ? '+' : '-';
    return `${sign}${h}:${m}`;
}

let currentUser = null;

function obterUsuarioAtual() {
    if (currentUser) {
        return currentUser.label || currentUser.username;
    }
    try {
        const rdyUserStr = localStorage.getItem('rdyUser');
        if (rdyUserStr) {
            const parsed = JSON.parse(rdyUserStr);
            if (parsed) return parsed.label || parsed.username;
        }
    } catch (e) {}
    try {
        const admUserStr = localStorage.getItem('adm_user');
        if (admUserStr) {
            const parsed = JSON.parse(admUserStr);
            if (parsed) return parsed.label || parsed.username;
        }
    } catch (e) {}

    // Fallback if in iframe and storage is blocked/partitioned
    try {
        if (window !== window.parent) {
            const parent = window.parent;
            if (parent.currentUser) {
                return parent.currentUser.label || parent.currentUser.username;
            }
            if (parent.localStorage) {
                const parentRdyUser = parent.localStorage.getItem('rdyUser');
                if (parentRdyUser) {
                    const parsed = JSON.parse(parentRdyUser);
                    if (parsed) return parsed.label || parsed.username;
                }
                const parentAdmUser = parent.localStorage.getItem('adm_user');
                if (parentAdmUser) {
                    const parsed = JSON.parse(parentAdmUser);
                    if (parsed) return parsed.label || parsed.username;
                }
            }
            if (parent.adminState && parent.adminState.user) {
                return parent.adminState.user;
            }
        }
    } catch (e) {}

    return null;
}


async function initLogin() {
    // 1. Sessão salva no localStorage (caminho rápido)
    const saved = localStorage.getItem('rdyUser');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (parsed && parsed.username && parsed.role) {
                currentUser = parsed;
                showApp();

                // Background refresh user profile to reflect database updates
                if (navigator.onLine) {
                    API.fetch(`/balanceamento_usuarios?username=eq.${encodeURIComponent(parsed.username.toLowerCase())}&select=*`)
                        .then(result => {
                            const found = result[0];
                            if (found) {
                                const changed = found.role !== parsed.role ||
                                                found.cidade !== parsed.cidade ||
                                                found.label !== parsed.label;
                                if (changed) {
                                    const { password: _pw, ...foundSafe } = found;
                                    currentUser = foundSafe;
                                    localStorage.setItem('rdyUser', JSON.stringify(foundSafe));
                                    const { role } = currentUser;
                                    if (role === 'cto') {
                                        showAdmin();
                                    } else {
                                        showTech();
                                    }
                                }
                            }
                        })
                        .catch(err => console.warn("Error refreshing user profile in background:", err));
                }
                return;
            }
        } catch (e) {}
        localStorage.removeItem('rdyUser');
        localStorage.removeItem('adm_user');
        localStorage.removeItem('adm_tk');
    }

    // 2. Auto-login via parâmetro URL ?u=username (integração com portal)
    // O portal passa o username do técnico na URL: .../index.html?u=david.jesus
    try {
        const autoU = new URLSearchParams(window.location.search).get('u');
        if (autoU) {
            const result = await API.fetch(
                `/balanceamento_usuarios?username=eq.${encodeURIComponent(autoU.trim().toLowerCase())}&select=username,label,role,cidade`
            );
            const found = result?.[0];
            // Só permite roles técnico/gestor — CTO requer login com senha
            if (found && (found.role === 'tecnico' || found.role === 'gestor')) {
                currentUser = { ...found };
                localStorage.setItem('rdyUser', JSON.stringify(currentUser));
                history.replaceState({}, '', window.location.pathname);
                showApp();
                return;
            }
        }
    } catch (e) {}

    // 3. Exibir tela de login
    const screen = document.getElementById('loginScreen');
    if (screen) screen.style.display = 'flex';
    const userIn = document.getElementById('loginUser');
    if (userIn) { userIn.value = ''; userIn.focus(); }
    const passIn = document.getElementById('loginPass');
    if (passIn) passIn.value = '';
}

async function doLogin() {
    const errEl = document.getElementById('loginError');

    // Proteção contra força bruta: bloqueia após 5 tentativas por 15 minutos
    const lockUntil = parseInt(localStorage.getItem('loginLockUntil') || 0);
    if (Date.now() < lockUntil) {
        const minutos = Math.ceil((lockUntil - Date.now()) / 60000);
        errEl.textContent = `Acesso bloqueado. Tente novamente em ${minutos} minuto(s).`;
        errEl.classList.remove('hidden');
        return;
    }

    const username = document.getElementById('loginUser').value.trim().toLowerCase();
    const password = document.getElementById('loginPass').value;

    try {
        const result = await API.fetch(`/balanceamento_usuarios?username=eq.${username}&select=*`);
        const found = result[0];

        if (!found || found.password !== password) {
            const tentativas = parseInt(localStorage.getItem('loginTentativas') || 0) + 1;
            localStorage.setItem('loginTentativas', tentativas);

            if (tentativas >= 5) {
                const bloqueioAte = Date.now() + 15 * 60 * 1000;
                localStorage.setItem('loginLockUntil', bloqueioAte);
                localStorage.removeItem('loginTentativas');
                errEl.textContent = 'Acesso bloqueado por 15 minutos após múltiplas tentativas.';
            } else {
                errEl.textContent = `Usuário ou senha incorretos. (${tentativas}/5 tentativas)`;
            }
            errEl.classList.remove('hidden');
            document.getElementById('loginPass').value = '';
            document.getElementById('loginPass').focus();
            return;
        }

        localStorage.removeItem('loginTentativas');
        localStorage.removeItem('loginLockUntil');
        errEl.textContent = 'Usuário ou senha incorretos.';
        errEl.classList.add('hidden');
        const { password: _pw, ...userSafe } = found;
        currentUser = userSafe;
        localStorage.setItem('rdyUser', JSON.stringify(userSafe));
        showApp();
    } catch(err) {
        console.error("Login error:", err);
        errEl.textContent = 'Erro ao se conectar ao servidor.';
        errEl.classList.remove('hidden');
    }
}

function doLogout() {
    localStorage.removeItem('rdyUser');
    localStorage.removeItem('adm_user');
    localStorage.removeItem('adm_tk');
    currentUser = null;
    window.location.reload();
}

function toggleLoginPass() {
    const input = document.getElementById('loginPass');
    const isPass = input.type === 'password';
    input.type = isPass ? 'text' : 'password';
    const btn = document.querySelector('.btn-eye');
    btn.innerHTML = `<i data-lucide="${isPass ? 'eye-off' : 'eye'}" id="loginEyeIcon"></i>`;
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: btn });
}

function showApp() {
    if (!currentUser) {
        currentUser = null;
        localStorage.removeItem('rdyUser');
        const screen = document.getElementById('loginScreen');
        if (screen) {
            screen.style.display = 'flex';
            const userIn = document.getElementById('loginUser');
            if (userIn) userIn.focus();
        }
        return;
    }
    const { role } = currentUser;
    if (role === 'cto') { showAdmin(); } else { showTech(); }
}

function showTech() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
    applyRoleRestrictions();
    if (window.techAppInitialized) return;
    window.techAppInitialized = true;
    lucide.createIcons();
    initTabs();
    initSearch();
    initModalEdicao();
    initTheme();
    verificarAutoSync();
}

function applyRoleRestrictions() {
    const { role, cidade, label } = currentUser;

    // Exibir badge do usuário logado
    document.getElementById('userLabel').innerText = label;
    document.getElementById('userBadge').classList.remove('hidden');

    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (role === 'tecnico' || role === 'gestor') {
            if (!['balancear', 'historico'].includes(btn.dataset.tab)) {
                btn.style.display = 'none';
            } else {
                btn.style.display = '';
            }
        } else {
            btn.style.display = '';
        }
    });

    // Ocultar opções de entrega e resumo de balanceamento para técnicos, gestores ou usuários regionais (exceto no Sistema Original)
    const isSistemaOriginal = window !== window.top;
    const hideOptions = !isSistemaOriginal && (role === 'tecnico' || role === 'gestor' || cidade === 'LIMEIRA' || cidade === 'INDAIATUBA');
    document.querySelectorAll('.options-section, .summary-column').forEach(el => {
        el.style.display = hideOptions ? 'none' : '';
    });

    // Ocultar card "Recomendado" no Sistema Original
    const recCard = document.querySelector('.option-card[data-opcao="rec"]');
    if (recCard) {
        recCard.style.display = isSistemaOriginal ? 'none' : '';
    }

    // Controlar exibição dos chips de filtros rápidos de cidade no histórico
    const chipLimeira = document.getElementById('chip-limeira');
    const chipIndaiatuba = document.getElementById('chip-indaiatuba');
    if (chipLimeira && chipIndaiatuba) {
        if (cidade === 'LIMEIRA') {
            chipLimeira.style.display = '';
            chipIndaiatuba.style.display = 'none';
        } else if (cidade === 'INDAIATUBA') {
            chipLimeira.style.display = 'none';
            chipIndaiatuba.style.display = '';
        } else {
            chipLimeira.style.display = '';
            chipIndaiatuba.style.display = '';
        }
    }
}

function canEdit() {
    return currentUser?.role !== 'tecnico';
}

// Retorna o filtro de cidade do usuário atual (para consultas)
function getCidadeFiltro() {
    return currentUser?.cidade || null;
}

// ── STATE ───────────────────────────────────────────────
let state = {
    equipamento: null,
    media: 0,
    opcao: null,
    entregas: [],
    sugestoes: {},
    historico: { pagina: 1, tamanho: 15, total: 0 }
};

const API = {
    async fetch(endpoint, fullResponse = false) {
        const url = `${SUPABASE_URL}/rest/v1${endpoint}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        try {
            const headers = {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            };

            if (endpoint.includes('balanceamento_entregas')) {
                headers['Prefer'] = 'count=exact';
            }

            const res = await fetch(url, {
                signal: controller.signal,
                headers: headers
            });
            clearTimeout(timeoutId);
            if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);

            if (fullResponse) return res;
            return res.json();
        } catch (e) {
            clearTimeout(timeoutId);
            if (e.name === 'AbortError') throw new Error("Timeout: A conexão com o banco demorou demais.");
            throw e;
        }
    },

    async _mutate(method, endpoint, data) {
        const sep = endpoint.includes('?') ? '&' : '?';
        const url = `${SUPABASE_URL}/rest/v1${endpoint}${sep}apikey=${SUPABASE_KEY}`;
        const headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
        };
        if (data !== undefined) headers['Prefer'] = 'return=representation';
        const res = await fetch(url, {
            method, headers, body: data !== undefined ? JSON.stringify(data) : undefined
        });
        if (!res.ok) {
            const errBody = await res.text();
            throw new Error(`HTTP ${res.status}: ${errBody}`);
        }
        return res.json();
    },

    post(endpoint, data)  { return this._mutate('POST',  endpoint, data); },
    patch(endpoint, data) { return this._mutate('PATCH', endpoint, data); },

    async delete(endpoint) {
        const sep = endpoint.includes('?') ? '&' : '?';
        const url = `${SUPABASE_URL}/rest/v1${endpoint}${sep}apikey=${SUPABASE_KEY}`;
        const res = await fetch(url, {
            method: 'DELETE',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        return true;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // Esconde a barra de rolagem horizontal das abas no Firefox programaticamente
    document.querySelectorAll('.nav-tabs').forEach(el => {
        el.style.scrollbarWidth = 'none';
    });
    lucide.createIcons();
    initLogin();
});

function initModalEdicao() {
    const form = document.getElementById('formEdicao');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.innerText = 'SALVANDO...';

        const novoContador = parseInt(document.getElementById('editContador').value) || 0;

        const payload = {
            serie: document.getElementById('editSerie').value.trim(),
            patrimonio: document.getElementById('editPatrimonio').value.trim(),
            modelo: document.getElementById('editModelo').value.trim(),
            secretaria: document.getElementById('editSecretaria').value.trim(),
            media_referencia: parseFloat(document.getElementById('editMediaRef').value) || 0
        };

        try {
            await API.patch(`/equipamentos?id=eq.${currentEditingId}`, payload);

            if (novoContador > 0) {
                const equip = state._editEquip;
                await API.post('/ctrl_os', {
                    equipment_id: currentEditingId,
                    os_number: '',
                    counter_reading: novoContador,
                    os_date: new Date().toISOString().slice(0, 10)
                });
            }

            alert("Equipamento atualizado com sucesso!");
            fecharModalEdicao();
            realizarConsulta();
        } catch (err) {
            alert("Erro ao atualizar: " + err.message);
        } finally {
            btn.disabled = false;
            btn.innerText = 'SALVAR ALTERAÇÕES';
        }
    });
}

function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === `tab-${tabId}`));
            if (tabId === 'historico') carregarHistorico();
            if (tabId === 'relatorios') carregarRelatorios();
            if (tabId === 'cadastrar') carregarClientesParaCadastro();
        });
    });
}

function initSearch() {
    setupAutocomplete('searchInput', 'suggestionsList', 'equip');
    setupAutocomplete('globalSearchInput', 'globalSearchSuggestions', 'equip');
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('filterDataInicio').value = today;
    document.getElementById('filterDataFim').value = today;

    setupAutocomplete('filterSerie', 'filterSerieSuggestions', 'equip');
    setupAutocomplete('filterCliente', 'filterClienteSuggestions', 'cliente');
    setupAutocomplete('consultarCliente', 'consultarClienteSuggestions', 'cliente');

    document.getElementById('searchBtn').addEventListener('click', () => {
        const val = document.getElementById('searchInput').value.trim();
        buscarEquipamento(val);
    });

    document.getElementById('searchInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') buscarEquipamento(e.target.value.trim());
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.autocomplete-container') && !e.target.closest('.search-input-group')) {
            document.querySelectorAll('.suggestions-list').forEach(l => l.classList.add('hidden'));
        }
    });
}

function setupAutocomplete(inputId, listId, type) {
    const input = document.getElementById(inputId);
    const list = document.getElementById(listId);
    if (!input || !list) return;

    // Delegação de clique segura: sem onclick inline com dados da API
    list.addEventListener('click', e => {
        const item = e.target.closest('.suggestion-item');
        if (!item) return;
        const valor = item.dataset.value || '';
        selecionarSugestaoGeral(inputId, listId, valor, item.dataset.type || type);
    });

    let debounceTimer;
    input.addEventListener('input', () => {
        fecharTodasSugestoes();
        clearTimeout(debounceTimer);
        const val = input.value.trim();
        if (val.length < 2) {
            list.classList.add('hidden');
            return;
        }

        debounceTimer = setTimeout(async () => {
            try {
                const cidade = getCidadeFiltro();
                const valEnc = encodeURIComponent(val);

                const renderItems = (data) => {
                    if (!data.length) { list.classList.add('hidden'); return; }
                    list.innerHTML = data.map(item => {
                        if (type === 'equip') {
                            return `<div class="suggestion-item" data-value="${escAttr(item.serie)}" data-type="equip"><div class="sugg-main"><strong>${esc(item.serie)}</strong><span class="tag-sm">${esc(item.secretaria || 'OUTROS')}</span></div><span class="sub">${esc(item.cliente ? item.cliente.nome : (item.patrimonio || ''))}</span></div>`;
                        }
                        return `<div class="suggestion-item" data-value="${escAttr(item.nome)}" data-type="cliente"><strong>${esc(item.nome)}</strong></div>`;
                    }).join('');
                    list.classList.remove('hidden');
                };

                if (type === 'equip') {
                    // 1. Mostra cache local imediatamente (< 1ms)
                    const local = await buscarEquipamentosLocal(val);
                    if (local.length > 0) renderItems(local);

                    if (!navigator.onLine) return;

                    // 2. Busca na rede em paralelo (série/patrimônio + cliente)
                    const cidadeParam = cidade ? `&cliente.cidade=eq.${encodeURIComponent(cidade)}` : '';
                    const joinType    = cidade ? '!inner' : '';
                    const [porSerie, porCliente] = await Promise.all([
                        API.fetch(`/equipamentos?or=(serie.ilike.*${valEnc}*,patrimonio.ilike.*${valEnc}*)&select=*,cliente:clientes${joinType}(nome,cidade)${cidadeParam}&limit=10`).catch(() => []),
                        cidade ? Promise.resolve([]) : API.fetch(`/equipamentos?select=*,cliente:clientes!inner(nome)&cliente.nome=ilike.*${valEnc}*&limit=10`).catch(() => [])
                    ]);
                    const ids  = new Set(porSerie.map(i => i.id));
                    const merged = [...porSerie, ...porCliente.filter(i => !ids.has(i.id))].slice(0, 10);
                    if (merged.length > 0) renderItems(merged);

                } else {
                    const cidadeParam = cidade ? `&cidade=eq.${encodeURIComponent(cidade)}` : '';
                    const data = await API.fetch(`/clientes?nome=ilike.*${valEnc}*&select=id,nome${cidadeParam}&limit=10`).catch(() => []);
                    renderItems(data);
                }
            } catch (e) { console.warn("Autocomplete error:", e); }
        }, 200);
    });
}

function selecionarSugestaoGeral(inputId, listId, valor, type) {
    document.getElementById(inputId).value = valor;
    document.getElementById(listId).classList.add('hidden');

    if (inputId === 'searchInput') {
        buscarEquipamento(valor);
    } else if (inputId === 'globalSearchInput' || inputId === 'consultarCliente') {
        realizarConsulta();
    } else if (inputId === 'filterSerie' || inputId === 'filterCliente') {
        carregarHistorico();
    }
}

async function buscarEquipamento(serie) {
    if (!serie) return;
    setLoading(true);
    resetUI();

    let equip = null;
    let osHistory = [];
    let entregas = [];
    let analiseEmAberto = null;
    const cidade = getCidadeFiltro();

    try {
        let data = [];
        try {
            data = await API.fetch(`/equipamentos?serie=eq.${encodeURIComponent(serie)}&select=*,cliente:clientes(id,nome,cidade)&limit=1`);
        } catch (apiErr) {
            console.warn("Supabase fetch failed, trying local IndexedDB cache:", apiErr);
        }

        if (!data || data.length === 0) {
            const localEquips = await lerCacheStore('equipamentos');
            const foundLocal = localEquips.find(e => 
                (e.serie || '').toLowerCase() === serie.toLowerCase() || 
                (e.patrimonio || '').toLowerCase() === serie.toLowerCase()
            );

            if (foundLocal) {
                equip = foundLocal;
                
                if (cidade) {
                    const cidadeCliente = (equip.cliente?.cidade || '').toUpperCase();
                    if (cidadeCliente !== cidade.toUpperCase()) {
                        alert(`Acesso negado. Você só pode consultar equipamentos de ${cidade}.`);
                        setLoading(false);
                        return;
                    }
                }

                state.equipamento = equip;
                document.getElementById('resCliente').innerText = `Cliente: ${equip.cliente?.nome || 'N/D'}`;
                document.getElementById('resSecretaria').innerText = `SETOR: ${equip.secretaria || 'OUTROS'}`;
                document.getElementById('resPatrimonio').innerText = equip.patrimonio || 'N/D';
                document.getElementById('resSerie').innerText = equip.serie;
                document.getElementById('resModelo').innerText = equip.modelo || 'N/D';
                document.getElementById('resContador').innerText = equip.ultimo_contador || 0;
                document.getElementById('sumContadorAnterior').innerText = equip.ultimo_contador || 0;

                const media = parseFloat(equip.media_referencia) || 0;
                updateMedia(media);
                document.getElementById('resultContainer').classList.remove('hidden');
                document.getElementById('resUltimaEntrega').innerText = 'N/D (Offline)';
                state.entregas = [];

                const isSistemaOriginal = window !== window.top;
                if (isSistemaOriginal) {
                    document.getElementById('analiseImediataBtn').classList.add('hidden');
                    document.getElementById('analiseAbertaCard').classList.add('hidden');
                    document.getElementById('analiseFecharCard').classList.add('hidden');
                    const tbody = document.getElementById('historicoOriginalTbody');
                    if (tbody) tbody.innerHTML = '<tr><td colspan="5" class="text-center text-dim">Offline. Histórico indisponível.</td></tr>';
                    document.getElementById('historicoOriginalCard').classList.remove('hidden');
                } else {
                    document.getElementById('historicoOriginalCard').classList.add('hidden');
                    abrirAnaliseImediata();
                }
                setLoading(false);
                return;
            } else {
                alert("Equipamento não encontrado!");
                setLoading(false);
                return;
            }
        }

        equip = data[0];

        if (cidade) {
            const cidadeCliente = (equip.cliente?.cidade || '').toUpperCase();
            if (cidadeCliente !== cidade.toUpperCase()) {
                alert(`Acesso negado. Você só pode consultar equipamentos de ${cidade}.`);
                setLoading(false);
                return;
            }
        }

        [osHistory, entregas, analiseEmAberto] = await Promise.all([
            API.fetch(`/ctrl_os?equipment_id=eq.${equip.id}&select=counter_reading,os_date&order=os_date.asc`).catch(() => []),
            API.fetch(`/balanceamento_entregas?equipamento_id=eq.${equip.id}&status=in.(confirmado,analise_aberta)&order=data_registro.asc`).catch(() => []),
            verificarAnaliseAberta(equip.id).catch(() => null)
        ]);

        const ultimaOs = osHistory.length > 0 ? osHistory[osHistory.length - 1] : null;
        equip.ultimo_contador = ultimaOs?.counter_reading || equip.ultimo_contador || equip.current_counter || 0;
        equip.data_ultimo_contador = ultimaOs?.os_date || null;

        state.equipamento = equip;
        state.entregas = entregas;

        document.getElementById('resCliente').innerText = `Cliente: ${equip.cliente?.nome || 'N/D'}`;
        document.getElementById('resSecretaria').innerText = `SETOR: ${equip.secretaria || 'OUTROS'}`;
        document.getElementById('resPatrimonio').innerText = equip.patrimonio || 'N/D';
        document.getElementById('resSerie').innerText = equip.serie;
        document.getElementById('resModelo').innerText = equip.modelo || 'N/D';
        document.getElementById('resContador').innerText = equip.ultimo_contador;
        document.getElementById('sumContadorAnterior').innerText = equip.ultimo_contador;

        updateMedia(calcularMediaCalibrada(osHistory, entregas, parseFloat(equip.media_referencia) || 0));
        document.getElementById('resultContainer').classList.remove('hidden');

        const ultimaEntrega = entregas.length > 0 ? entregas[entregas.length - 1] : null;
        const resUltima = document.getElementById('resUltimaEntrega');
        if (ultimaEntrega) {
            const dt = new Date(ultimaEntrega.data_registro).toLocaleDateString('pt-BR');
            resUltima.innerText = `${dt} (${ultimaEntrega.quantidade_definida} resmas)`;
        } else {
            resUltima.innerText = 'Nenhuma';
        }

        const isSistemaOriginal = window !== window.top;
        if (isSistemaOriginal) {
            document.getElementById('analiseImediataBtn').classList.add('hidden');
            document.getElementById('analiseAbertaCard').classList.add('hidden');
            document.getElementById('analiseFecharCard').classList.add('hidden');
            
            // Renderiza e mostra as Últimas 4 Entregas
            const ultimasEntregas = [...entregas]
                .filter(e => e.status === 'confirmado')
                .sort((a, b) => new Date(b.data_registro) - new Date(a.data_registro))
                .slice(0, 4);

            const tbody = document.getElementById('historicoOriginalTbody');
            if (tbody) {
                if (ultimasEntregas.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-dim">Nenhuma entrega registrada.</td></tr>';
                } else {
                    tbody.innerHTML = ultimasEntregas.map(e => {
                        const dt = new Date(e.data_registro).toLocaleDateString('pt-BR');
                        const cont = (e.contador_atual !== null && e.contador_atual !== undefined) ? parseInt(e.contador_atual).toLocaleString('pt-BR') : '—';
                        const qtd = parseFloat(e.quantidade_definida) || 0;
                        const os = e.numero_os || '—';
                        let obs = e.observacao || '—';
                        obs = obs.replace(/\[ACIMA DO LIMITE\]/g, '')
                                 .replace(/\[SUPERIOR A ULTIMA\]/g, '')
                                 .replace(/\[RECOMENDADO\]/g, '')
                                 .trim() || '—';
                        return `
                            <tr>
                                <td>${esc(dt)}</td>
                                <td>${esc(cont)}</td>
                                <td class="text-center"><strong>${esc(String(qtd))}</strong></td>
                                <td>${esc(os)}</td>
                                <td><span class="text-dim" style="font-size:0.75rem;">${esc(obs)}</span></td>
                            </tr>
                        `;
                    }).join('');
                }
            }
            document.getElementById('historicoOriginalCard').classList.remove('hidden');
        } else {
            document.getElementById('historicoOriginalCard').classList.add('hidden');
            if (analiseEmAberto) {
                mostrarFecharAnalise(analiseEmAberto);
            } else {
                abrirAnaliseImediata();
            }
        }

    } catch (e) {
        console.error(e);
        alert(`Erro de conexão: ${e.message}\n\nVerifique sua internet ou se o firewall está bloqueando o acesso.`);
    } finally {
        setLoading(false);
    }
}

function verTodoHistorico() {
    if (!state.equipamento) return;
    document.querySelector('.tab-btn[data-tab="historico"]').click();
    document.getElementById('filterDataInicio').value = '';
    document.getElementById('filterDataFim').value    = '';
    document.getElementById('filterCliente').value    = '';
    document.getElementById('filterSerie').value      = state.equipamento.serie;
    carregarHistorico();
}

function calcularMediaCalibrada(osHistory, entregas, mediaReferencia) {
    if (osHistory && osHistory.length >= 2) {
        const ordenadas = [...osHistory].sort((a, b) => new Date(a.data_os) - new Date(b.data_os));
        const consumos = [];
        for (let i = 1; i < ordenadas.length; i++) {
            const deltaPages = ordenadas[i].contador_atual - ordenadas[i - 1].contador_atual;
            const deltaDias = Math.ceil(
                Math.abs(new Date(ordenadas[i].data_os) - new Date(ordenadas[i - 1].data_os)) / (1000 * 60 * 60 * 24)
            ) || 1;
            const resmasMes = (deltaPages / deltaDias) * 30 / 500;
            if (resmasMes > 0) consumos.push(resmasMes);
        }

        if (consumos.length > 0) {
            let totalPeso = 0, somaTotal = 0;
            consumos.forEach((v, i) => {
                const peso = i + 1;
                somaTotal += v * peso;
                totalPeso += peso;
            });
            return Math.round((somaTotal / totalPeso) * 10) / 10;
        }
    }

    if (entregas && entregas.length > 0) {
        const valores = entregas.map(e => parseFloat(e.media_consumo_mensal)).filter(v => v > 0);
        if (valores.length > 0) {
            return Math.round((valores.reduce((s, v) => s + v, 0) / valores.length) * 10) / 10;
        }
    }

    return mediaReferencia;
}

function updateMedia(val) {
    state.media = val;
    const txt = val.toFixed(1).replace('.', ',');
    document.getElementById('resMedia').innerText = txt;
    document.getElementById('sumMedia').innerText = txt;
    document.getElementById('resPaginas').innerText = (val * 500).toLocaleString('pt-BR');

    const s1 = Math.floor(val + 1);
    const s2 = Math.ceil(val / 2);
    const s3 = Math.ceil(val / 3);

    document.getElementById('opt1Qtd').innerText = s1;
    document.getElementById('opt2Qtd').innerText = s2;
    document.getElementById('opt3Qtd').innerText = s3;

    state.sugestoes[1] = s1;
    state.sugestoes[2] = s2;
    state.sugestoes[3] = s3;

    // Pré-popula rec com a média mensal enquanto contador não é digitado
    const contAtual = parseInt(document.getElementById('inputContador')?.value) || 0;
    if (!contAtual) {
        const recPreview = Math.max(1, Math.ceil(val));
        const optRecEl = document.getElementById('optRecQtd');
        if (optRecEl) optRecEl.innerText = recPreview;
        state.sugestoes['rec'] = recPreview;
    }

    // Seleciona Recomendado por padrão ao carregar
    selecionarOpcao('rec', true);

    atualizarBarraConsumo(0);
}

function calcularEntregasMes() {
    if (!state.entregas || state.entregas.length === 0) return 0;
    const agora = new Date();
    return state.entregas.filter(e => {
        if (e.status === 'cancelado') return false;
        const d = new Date(e.data_registro);
        return d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear();
    }).reduce((sum, e) => sum + (parseFloat(e.quantidade_definida) || 0), 0);
}

function atualizarBarraConsumo(qtdAdicional = 0) {
    const totalMes = calcularEntregasMes();
    const media = state.media || 0;
    const totalAtual = totalMes + qtdAdicional;
    
    const resTotalMes = document.getElementById('resTotalMes');
    if(resTotalMes) resTotalMes.innerText = totalAtual;
    
    const bar = document.getElementById('consumoProgressBar');
    const statusTxt = document.getElementById('resConsumoStatus');
    const aviso = document.getElementById('consumoAvisoTexto');
    
    if (!bar) return;
    
    if (media === 0) {
        bar.style.width = '0%';
        bar.classList.remove('excedido');
        if (statusTxt) {
            statusTxt.className = 'status-normal';
            statusTxt.innerText = 'NORMAL';
        }
        if (aviso) aviso.classList.add('hidden');
        return;
    }
    
    let rawPct = (totalAtual / media) * 100;
    let pct = rawPct;
    if (pct > 100) pct = 100;
    bar.style.width = pct + '%';
    
    if (totalAtual > media) {
        bar.classList.add('excedido');
        if (statusTxt) {
            statusTxt.className = 'status-excedido';
            statusTxt.innerText = `${rawPct.toFixed(0)}% (EXCEDIDO)`;
        }
        if (aviso) {
            aviso.classList.remove('hidden');
            const diff = (totalAtual - media).toFixed(1).replace('.0', '');
            aviso.innerHTML = `Excedeu ${diff} resmas do consumo médio.`;
        }
    } else {
        bar.classList.remove('excedido');
        if (statusTxt) {
            statusTxt.className = 'status-normal';
            statusTxt.innerText = `${rawPct.toFixed(0)}% (NORMAL)`;
        }
        if (aviso) aviso.classList.add('hidden');
    }
}


function selecionarOpcao(n, force = false) {
    if (!force && state.entregas && state.entregas.length > 0) {
        const agora = new Date();
        const entregasMes = state.entregas.filter(e => {
            const dataE = new Date(e.data_registro);
            return dataE.getMonth() === agora.getMonth() && dataE.getFullYear() === agora.getFullYear();
        });

        if (entregasMes.length > 0) {
            const detalhes = entregasMes.map(e => {
                const qtd = e.quantidade_definida;
                const unidade = qtd === 1 ? 'resma' : 'resmas';
                return `• ${new Date(e.data_registro).toLocaleDateString('pt-BR')} (${qtd} ${unidade})`;
            }).join('\n');

            const msg = `Já houve ${entregasMes.length === 1 ? 'uma entrega' : entregasMes.length + ' entregas'} este mês:\n\n${detalhes}\n\nDeseja prosseguir para mais entregas?`;
            if (!confirm(msg)) return;
        }
    }

    state.opcao = n;
    let qtd = state.sugestoes[n] || 0;
    if (n === 0) qtd = parseInt(document.getElementById('inputManualQtd').value) || 1;

    document.querySelectorAll('.option-card').forEach(c => c.classList.toggle('selected', c.dataset.opcao === String(n)));
    
    if (n === 'rec') {
        document.getElementById('sumOpcaoText').innerText = `Recomendado (${qtd} resma${qtd !== 1 ? 's' : ''})`;
    } else {
        document.getElementById('sumOpcaoText').innerText = n === 0 ? `Entrega Manual (${qtd} resmas)` : `${n}x por mês (${qtd} resmas por visita)`;
    }

    document.getElementById('formLineOs').classList.remove('hidden');
    document.getElementById('formLineObs').classList.remove('hidden');
    document.getElementById('actionRow').classList.remove('hidden');

    updateProxima();
    atualizarBarraConsumo(qtd);
}

function alterarQtdManual(delta) {
    const input = document.getElementById('inputManualQtd');
    const novaQtd = Math.max(1, (parseInt(input.value) || 1) + delta);
    input.value = novaQtd;
    atualizarQtdManual(novaQtd);
}

function atualizarQtdManual(val) {
    const num = parseInt(val) || 1;
    if (state.opcao === 0) {
        document.getElementById('sumOpcaoText').innerText = `Entrega Manual (${num} resmas)`;
        updateProxima();
        atualizarBarraConsumo(num);
    }
}

function atualizarProximaSolicitacao() {
    updateProxima();
}

function updateProxima() {
    const cont = parseInt(document.getElementById('inputContador').value) || 0;

    const entregas = state.entregas || [];
    const ultimaEntrega = entregas.length > 0 ? entregas[entregas.length - 1] : null;
    const ultimoContador = (ultimaEntrega && ultimaEntrega.contador_atual !== null && ultimaEntrega.contador_atual !== undefined)
        ? parseInt(ultimaEntrega.contador_atual)
        : (state.equipamento?.ultimo_contador || 0);

    const consumo = Math.max(0, cont - ultimoContador);

    // ── SALDO REMANESCENTE ──
    // Resmas entregues na última visita que ainda não foram impressas
    const ultimaEntregaQtd = ultimaEntrega ? (parseFloat(ultimaEntrega.quantidade_definida) || 0) : 0;
    const saldoRemanescente = (cont > 0 && ultimaEntregaQtd > 0)
        ? Math.max(0, ultimaEntregaQtd - consumo / 500)
        : 0;
    state.saldoRemanescente = saldoRemanescente;

    // ── RECOMENDAÇÃO: exatamente o que foi produzido ──
    // Entrega = o que o equipamento imprimiu desde a última visita (nunca fica zero)
    const recomendado = cont > 0 ? Math.max(1, Math.ceil(consumo / 500)) : Math.max(1, Math.ceil(state.media || 0));
    const optRecEl = document.getElementById('optRecQtd');
    if (optRecEl) optRecEl.innerText = recomendado;
    state.sugestoes['rec'] = recomendado;

    const optRecFooter = document.getElementById('optRecFooter');
    if (optRecFooter) {
        optRecFooter.innerText = cont > 0 ? 'consumo real' : 'média de ref.';
    }

    // ── DISPLAY SALDO ──
    const lineSaldo = document.getElementById('lineSaldoRemanescente');
    const saldoEl   = document.getElementById('resSaldoRemanescente');
    if (lineSaldo && saldoEl) {
        if (saldoRemanescente >= 0.1) {
            saldoEl.textContent = saldoRemanescente.toFixed(1).replace('.', ',') + ' resmas';
            saldoEl.style.color = saldoRemanescente > 2 ? '#ef4444' : '#f59e0b';
            lineSaldo.classList.remove('hidden');
        } else {
            lineSaldo.classList.add('hidden');
        }
    }

    let qtd = 0;
    if (state.opcao === 0) qtd = parseInt(document.getElementById('inputManualQtd').value) || 0;
    else if (state.opcao !== null) qtd = state.sugestoes[state.opcao] || 0;

    // ── PRÓXIMA SOLICITAÇÃO ──
    // Numerador mínimo = contador atual + (resmas entregues hoje + saldo em estoque no cliente) × 500
    // Exemplo: contador 224.027, entrega 7r, saldo 3r → mínimo = 224.027 + (7+3)×500 = 229.027
    const el = document.getElementById('resProximaSolicitacao');
    let qtdAtual = 0;
    if (state.opcao === 0) qtdAtual = parseInt(document.getElementById('inputManualQtd')?.value) || 0;
    else if (state.opcao !== null) qtdAtual = state.sugestoes[state.opcao] || 0;
    if (cont > 0 && qtdAtual > 0) {
        const totalPapelDisponivel = qtdAtual + saldoRemanescente; // entrega hoje + saldo no cliente
        el.innerText = Math.round(cont + totalPapelDisponivel * 500).toLocaleString('pt-BR');
    } else if (cont > 0 && saldoRemanescente > 0) {
        // Sem nova entrega mas tem saldo: o próximo mínimo é quando acabar o saldo
        el.innerText = Math.round(cont + saldoRemanescente * 500).toLocaleString('pt-BR');
    } else {
        el.innerText = '---';
    }

    if (state.opcao === 'rec') {
        document.getElementById('sumOpcaoText').innerText = `Recomendado (${recomendado} resma${recomendado !== 1 ? 's' : ''})`;
    }
}

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
    const isSistemaOriginal = window !== window.top;

    let os = document.getElementById('inputOs').value.trim().toUpperCase();
    if (!isSistemaOriginal && !os) return alert("Por favor, insira o número da O.S.!");
    
    document.getElementById('inputOs').value = os;

    const contVal = document.getElementById('inputContador').value.trim();

    const entregas = state.entregas || [];
    const ultimaEntrega = entregas.length > 0 ? entregas[entregas.length - 1] : null;
    const ultimoContador = (ultimaEntrega && ultimaEntrega.contador_atual !== null && ultimaEntrega.contador_atual !== undefined)
        ? parseInt(ultimaEntrega.contador_atual)
        : (state.equipamento?.ultimo_contador || 0);

    // Primeira entrega do equipamento: numerador é opcional
    const isPrimeiraEntrega = entregas.length === 0 && !ultimoContador;

    if (!isSistemaOriginal && !isPrimeiraEntrega && (contVal === '' || isNaN(parseInt(contVal)))) {
        return alert("Por favor, insira o Contador/Numerador Atual!");
    }
    const cont = contVal !== '' ? (parseInt(contVal) || 0) : null;

    // Validar se o contador atual é menor que o anterior (só aplica se houver referência anterior)
    if (!isSistemaOriginal && !isPrimeiraEntrega && cont !== null && ultimoContador > 0 && cont < ultimoContador) {
        return alert(`O contador atual (${cont.toLocaleString('pt-BR')}) não pode ser menor que o anterior (${ultimoContador.toLocaleString('pt-BR')})!`);
    }

    const obs = document.getElementById('inputObs').value.trim();

    let qtd = 0;
    let isSugestaoZero = false;
    let qtdSugerida = 0;

    if (state.opcao === 0) {
        qtd = parseInt(document.getElementById('inputManualQtd').value) || 0;
        qtdSugerida = state.sugestoes[1] || 0;
    } else {
        const sugestaoSelecionada = state.sugestoes[state.opcao] || 0;
        qtdSugerida = sugestaoSelecionada;
        if (sugestaoSelecionada === 0) {
            isSugestaoZero = true;
            qtd = parseInt(document.getElementById('inputManualQtd')?.value) || 0;
            if (!qtd) {
                alert("Sugestão de entrega é 0 (sem previsão de consumo).\nInforme a quantidade no campo Manual e o nº da O.S. para prosseguir.");
                return;
            }
        } else {
            qtd = sugestaoSelecionada;
        }
    }

    if (!qtd) return alert("Selecione uma opção de entrega!");

    // Entrega com sugestão zero sempre exige O.S.
    if (isSugestaoZero && !os) {
        alert("O.S. obrigatória para entrega com sugestão zero.");
        document.getElementById('inputOs')?.focus();
        return;
    }

    let isExcecao = false;
    let isSuperiorUltima = false;
    let isDivergencia = false;
    let isAcimaRecomendado = false;
    let divergenciaResmas = 0;
    const ultimaEntregaResmas = ultimaEntrega ? (parseInt(ultimaEntrega.quantidade_definida) || 0) : 0;

    if (!isSistemaOriginal) {
        // ── SALDO: ENTREGUE VS PRODUZIDO ──
        // Tolerância: 250 páginas (0,5 resma)
        const TOLERANCIA_PAG = 1000; // 2 resmas de margem de aceitação
        if (cont !== null && cont > 0 && ultimaEntregaResmas > 0 && ultimoContador > 0) {
            const paginasProduzidas = cont - ultimoContador;
            const paginasEsperadas  = ultimaEntregaResmas * 500;
            if (paginasProduzidas < (paginasEsperadas - TOLERANCIA_PAG)) {
                isDivergencia    = true;
                const resmasProd = Math.max(0, paginasProduzidas / 500);
                divergenciaResmas = parseFloat((qtd - resmasProd).toFixed(1));

                alert(
                    `⚠️ DIVERGÊNCIA DE RESMAS DETECTADA\n\n` +
                    `Última entrega: ${ultimaEntregaResmas} resma(s)\n` +
                    `Produção medida: ${paginasProduzidas.toLocaleString('pt-BR')} páginas (≈ ${resmasProd.toFixed(1)} resmas)\n` +
                    `Divergência: ${divergenciaResmas} resma(s) sem produção correspondente\n\n` +
                    `AÇÃO OBRIGATÓRIA: Informe o número da O.S. e descreva o ocorrido no campo Observação antes de confirmar.`
                );

                // Expõe campos O.S. e Observação
                document.getElementById('formLineObs')?.classList.remove('hidden');

                // Pré-preenche Observação com a divergência calculada
                const obsEl = document.getElementById('inputObs');
                if (obsEl && !obsEl.value.trim()) {
                    obsEl.value = `Divergência de ${divergenciaResmas}r sem produção correspondente. `;
                }

                // Exige O.S. antes de prosseguir
                if (!os) {
                    alert('Informe o número da O.S. para registrar a divergência.');
                    document.getElementById('inputOs')?.focus();
                    return;
                }
            }
        }

        // ── ACIMA DO RECOMENDADO (consumo real medido) ──
        const recomendadoAtual = state.sugestoes['rec'] || 0;
        if (recomendadoAtual > 0 && qtd > recomendadoAtual) {
            const excesso = qtd - recomendadoAtual;
            const saldoAtual = state.saldoRemanescente || 0;
            const serie = state.equipamento?.serie || '---';
            const cliente = state.equipamento?.cliente?.nome || '---';
            const ultimaEntregaInfo = ultimaEntregaResmas > 0
                ? `\u00daltima entrega registrada: ${ultimaEntregaResmas} resma(s)\n`
                : '';
            const saldoInfo = saldoAtual > 0
                ? `Saldo ainda em estoque no cliente: \u2248${saldoAtual.toFixed(1)} resma(s)\n`
                : '';
            const consumoPags = cont > 0 ? (cont - ultimoContador) : 0;
            const consumoInfo = consumoPags > 0
                ? `Consumo medido: ${consumoPags.toLocaleString('pt-BR')} p\u00e1gs (${(consumoPags/500).toFixed(1)} resmas)\n`
                : '';
            const confirmou = confirm(
                `\u26a0\ufe0f ENTREGA ACIMA DO CONSUMO MEDIDO\n` +
                `M\u00e1quina: ${serie} | Cliente: ${cliente}\n\n` +
                ultimaEntregaInfo +
                consumoInfo +
                saldoInfo +
                `Reposic\u0327\u00e3o sugerida: ${recomendadoAtual} resma(s)\n` +
                `Quantidade a entregar agora: ${qtd} resma(s)\n` +
                `Excesso sobre o consumo: +${excesso} resma(s)\n\n` +
                `Esta entrega excede o consumo real medido desta m\u00e1quina.\nDeseja confirmar mesmo assim?`
            );
            if (!confirmou) return;
            isAcimaRecomendado = true;
        }

        // ── SUPERIOR À ÚLTIMA ENTREGA ──
        if (ultimaEntregaResmas > 0 && qtd > ultimaEntregaResmas) {
            const confirmou = confirm(`A quantidade atual (${qtd} resmas) é superior à última entrega (${ultimaEntregaResmas} resmas). Deseja confirmar?`);
            if (!confirmou) return;
            isSuperiorUltima = true;
        }

        // ── ACIMA DA MÉDIA MENSAL ──
        if ((ultimaEntregaResmas > 0 && qtd > ultimaEntregaResmas) || (calcularEntregasMes() + qtd > (state.media || 0))) {
            if (!obs) {
                alert("JUSTIFICATIVA OBRIGATÓRIA: A quantidade solicitada ultrapassa a média mensal ou o limite da última entrega. Preencha o campo Observação.");
                document.getElementById('formLineObs').classList.remove('hidden');
                document.getElementById('inputObs').focus();
                return;
            }
            const confirmou = confirm("Exceção detectada: Você preencheu a justificativa. Deseja confirmar a entrega?");
            if (!confirmou) return;
            isExcecao = true;
        }
    }

    setBtnLoading(true);

    try {
        let finalMedia = state.media;
        if (cont !== null && state.equipamento.ultimo_contador && state.equipamento.data_ultimo_contador) {
            const dias = Math.ceil(Math.abs(new Date() - new Date(state.equipamento.data_ultimo_contador)) / (1000 * 60 * 60 * 24)) || 1;
            finalMedia = Math.ceil(((cont - state.equipamento.ultimo_contador) / dias * 30 / 500) * 10) / 10;
        }
        if (!isFinite(finalMedia) || isNaN(finalMedia) || finalMedia < 0) finalMedia = state.media || 0;

        let finalObs = obs || '';
        if (isDivergencia)      finalObs = `[DIVERG.${divergenciaResmas}R] ${finalObs}`.trim();
        if (isSugestaoZero)     finalObs = `[SUGESTAO_ZERO] ${finalObs}`.trim();
        if (state.opcao === 'rec') finalObs = `[RECOMENDADO] ${finalObs}`.trim();
        if (isExcecao)          finalObs = `[ACIMA DO LIMITE] ${finalObs}`.trim();
        if (isSuperiorUltima)   finalObs = `[SUPERIOR A ULTIMA] ${finalObs}`.trim();
        if (isAcimaRecomendado) {
            const excR = qtd - (state.sugestoes['rec'] || 0);
            finalObs = `[ACIMA_RECOMENDADO:+${excR}R] ${finalObs}`.trim();
        }

        await API.post('/balanceamento_entregas', {
            equipamento_id: state.equipamento.id,
            cliente_id: state.equipamento.cliente.id,
            numero_os: os || '',
            media_consumo_mensal: finalMedia,
            opcao_entrega: (state.opcao === 'rec' || state.opcao === 0) ? null : state.opcao,
            quantidade_sugerida: qtdSugerida || null,
            quantidade_definida: qtd,
            contador_atual: cont,
            observacao: finalObs,
            status: 'confirmado',
            data_registro: new Date().toISOString(),
            criado_por: obterUsuarioAtual() || (isSistemaOriginal ? 'Sistema Original' : 'Portal')
        });

        if (cont !== null && !isNaN(cont)) {
            await API.post('/ctrl_os', {
                equipment_id: state.equipamento.id,
                os_number: os || '',
                counter_reading: cont,
                os_date: new Date().toISOString().slice(0, 10)
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


// ── ANÁLISE IMEDIATA ──────────────────────────────────────

let _analiseAberta = null;

async function verificarAnaliseAberta(equipId) {
    try {
        const res = await API.fetch(`/balanceamento_entregas?equipamento_id=eq.${equipId}&status=eq.analise_aberta&order=data_registro.desc&limit=1`);
        return res.length > 0 ? res[0] : null;
    } catch (e) {
        return null;
    }
}

function abrirAnaliseImediata() {
    const equip = state.equipamento;
    if (!equip) return;
    document.getElementById('analiseSerie').innerText = equip.serie;
    document.getElementById('analiseNumeradorAtual').value = '';
    document.getElementById('analiseResmas').value = 0;
    _setAnaliseSugStatus('neutral', 0, 'AGUARDANDO LEITURA', 'Insira o numerador atual para o cálculo.');
    document.getElementById('btnAplicarSugestao').classList.add('hidden');
    analiseCalcularLimite();
    document.getElementById('analiseImediataBtn').classList.add('hidden');
    document.getElementById('analiseFecharCard').classList.add('hidden');
    document.getElementById('analiseAbertaCard').classList.remove('hidden');
    lucide.createIcons();
}

function fecharCardAnalise() {
    document.getElementById('analiseAbertaCard').classList.add('hidden');
    document.getElementById('analiseImediataBtn').classList.remove('hidden');
}

function analiseAlterarResmas(delta) {
    const input = document.getElementById('analiseResmas');
    input.value = Math.max(0, (parseInt(input.value) || 0) + delta);
    analiseCalcularLimite();
}

function _setAnaliseSugStatus(status, valor, titulo, subtitulo) {
    const card = document.getElementById('analiseSugestaoCard');
    card.className = `analise-sug-card analise-sug-${status}`;
    document.getElementById('analiseSugValor').innerText = valor;
    document.getElementById('analiseSugTitulo').innerText = titulo;
    document.getElementById('analiseSugSubtitulo').innerText = subtitulo;
}

function analiseAplicarSugestao() {
    const valor = parseInt(document.getElementById('btnAplicarSugestao').dataset.sugestao) || 0;
    if (valor > 0) {
        document.getElementById('analiseResmas').value = valor;
        analiseCalcularLimite();
    }
}

function analiseNumeradorChanged() {
    const numerador = parseInt(document.getElementById('analiseNumeradorAtual').value) || 0;
    const equip = state.equipamento;
    
    // Obter última entrega e seu numerador para calcular consumo e sugerir reposição
    const entregas = state.entregas || [];
    const ultimaEntrega = entregas.length > 0 ? entregas[entregas.length - 1] : null;
    
    const ultimoContador = (ultimaEntrega && ultimaEntrega.contador_atual !== null && ultimaEntrega.contador_atual !== undefined)
        ? parseInt(ultimaEntrega.contador_atual)
        : (equip?.ultimo_contador || 0);
        
    const ultimaEntregaResmas = ultimaEntrega ? (parseInt(ultimaEntrega.quantidade_definida) || 0) : 0;
    const btnAplicar = document.getElementById('btnAplicarSugestao');

    if (!numerador) {
        _setAnaliseSugStatus('neutral', 0, 'AGUARDANDO LEITURA', 'Insira o numerador atual para o cálculo.');
        btnAplicar.classList.add('hidden');
    } else if (numerador < ultimoContador) {
        _setAnaliseSugStatus('error', 0, 'ERRO DE LEITURA',
            `Numerador informado (${numerador.toLocaleString('pt-BR')}) é menor que o anterior (${ultimoContador.toLocaleString('pt-BR')}).`);
        btnAplicar.classList.add('hidden');
    } else {
        const consumoPaginas = numerador - ultimoContador;
        const sugerido = Math.ceil(consumoPaginas / 500);
        
        let subtitulo = '';
        if (ultimaEntregaResmas > 0) {
            const limiteAnterior = ultimoContador + (ultimaEntregaResmas * 500);
            subtitulo = `Última entrega: ${ultimaEntregaResmas} resmas (limite esperado: ${limiteAnterior.toLocaleString('pt-BR')}) · Consumido: ${consumoPaginas.toLocaleString('pt-BR')} págs (${(consumoPaginas / 500).toFixed(1).replace('.', ',')} resmas)`;
        } else {
            subtitulo = `Sem entregas anteriores · Consumo de ${consumoPaginas.toLocaleString('pt-BR')} págs desde o numerador base (${ultimoContador.toLocaleString('pt-BR')})`;
        }

        if (sugerido > 0) {
            _setAnaliseSugStatus('success', sugerido, 'SUGESTÃO DE REPOSIÇÃO', subtitulo);
            btnAplicar.dataset.sugestao = sugerido;
            btnAplicar.classList.remove('hidden');
        } else {
            _setAnaliseSugStatus('neutral', 0, 'NENHUMA REPOSIÇÃO SUGERIDA', subtitulo);
            btnAplicar.dataset.sugestao = 0;
            btnAplicar.classList.add('hidden');
        }
    }

    analiseCalcularLimite();
    lucide.createIcons();
}

function analiseCalcularLimite() {
    const resmas = parseInt(document.getElementById('analiseResmas').value) || 0;
    const numerador = parseInt(document.getElementById('analiseNumeradorAtual').value) || 0;
    if (numerador > 0) {
        document.getElementById('analiseLimite').innerText = (numerador + resmas * 500).toLocaleString('pt-BR');
    } else {
        document.getElementById('analiseLimite').innerText = '---';
    }
    atualizarBarraConsumo(resmas);
}

async function salvarAnaliseAberta() {
    const equip = state.equipamento;
    if (!equip) return;
    const resmas = parseInt(document.getElementById('analiseResmas').value) || 0;
    if (!resmas) return alert("Informe a quantidade de resmas!");
    
    let os = document.getElementById('analiseOs').value.trim().toUpperCase();
    if (!os) return alert("Por favor, insira o número da O.S.!");
    
    document.getElementById('analiseOs').value = os;

    const numeradorVal = document.getElementById('analiseNumeradorAtual').value.trim();
    if (numeradorVal === '' || isNaN(parseInt(numeradorVal))) {
        return alert("Por favor, insira o Numerador Atual!");
    }
    const numeradorBase = parseInt(numeradorVal);

    // Validar se o numerador atual é menor que o anterior
    const entregas = state.entregas || [];
    const ultimaEntrega = entregas.length > 0 ? entregas[entregas.length - 1] : null;
    const ultimoContador = (ultimaEntrega && ultimaEntrega.contador_atual !== null && ultimaEntrega.contador_atual !== undefined)
        ? parseInt(ultimaEntrega.contador_atual)
        : (equip?.ultimo_contador || 0);

    if (numeradorBase < ultimoContador) {
        return alert(`O numerador atual (${numeradorBase.toLocaleString('pt-BR')}) não pode ser menor que o anterior (${ultimoContador.toLocaleString('pt-BR')})!`);
    }

    let isSuperiorUltima = false;
    const ultimaEntregaResmas = ultimaEntrega ? (parseInt(ultimaEntrega.quantidade_definida) || 0) : 0;

    if (ultimaEntregaResmas > 0 && resmas > ultimaEntregaResmas) {
        const confirmou = confirm(`A quantidade atual (${resmas} resmas) é superior à última entrega (${ultimaEntregaResmas} resmas). Deseja confirmar?`);
        if (!confirmou) return;
        isSuperiorUltima = true;
    }

    if ((ultimaEntregaResmas > 0 && resmas > ultimaEntregaResmas) || (calcularEntregasMes() + resmas > (state.media || 0))) {
        const confirmou = confirm("Certeza que deseja entregar? Se sim, clique em OK para confirmar a entrega e lembre-se de sinalizar no chamado o motivo da exceção.");
        if (!confirmou) return;
    }

    try {
        await API.post('/balanceamento_entregas', {
            equipamento_id: equip.id,
            cliente_id: equip.cliente.id,
            numero_os: os || '',
            media_consumo_mensal: state.media || 0,
            opcao_entrega: null,
            quantidade_definida: resmas,
            contador_atual: numeradorBase,
            observacao: isSuperiorUltima ? `[SUPERIOR A ULTIMA] ANALISE_BASE:${numeradorBase}` : `ANALISE_BASE:${numeradorBase}`,
            status: 'analise_aberta',
            data_registro: new Date().toISOString(),
            criado_por: obterUsuarioAtual() || (window !== window.top ? 'Sistema Original' : 'Portal')
        });
        alert(`Entrega Realizada!\nSérie: ${equip.serie}\nNumerador base: ${numeradorBase.toLocaleString('pt-BR')}\nLimite: ${(numeradorBase + resmas * 500).toLocaleString('pt-BR')}`);
        window.location.reload();
    } catch (e) {
        alert("Erro ao iniciar análise: " + e.message);
    }
}

function mostrarFecharAnalise(analise) {
    _analiseAberta = analise;
    const equip = state.equipamento;
    const numeradorBase = (analise.contador_atual !== null && analise.contador_atual !== undefined)
        ? parseInt(analise.contador_atual)
        : (parseInt(analise.observacao?.match(/ANALISE_BASE:(\d+)/)?.[1]) || 0);
    const resmas = analise.quantidade_definida || 0;
    const limite = numeradorBase + resmas * 500;

    const dataEntrega = analise.data_registro ? new Date(analise.data_registro).toLocaleDateString('pt-BR') : 'N/D';
    const osEntrega = analise.numero_os || 'N/D';

    document.getElementById('fecharSerie').innerText = equip.serie;
    document.getElementById('fecharNumeradorBase').innerText = numeradorBase.toLocaleString('pt-BR');
    document.getElementById('fecharResmasAdicionadas').innerText = `${resmas} resma${resmas !== 1 ? 's' : ''} · ${dataEntrega} · O.S.: ${osEntrega}`;
    document.getElementById('fecharLimiteCalculado').innerText = limite.toLocaleString('pt-BR');

    // Reset inputs when opening this card
    document.getElementById('fecharNumeradorNovo').value = '';
    document.getElementById('fecharResmasInput').value = '0';
    document.getElementById('saldoBox').classList.add('hidden');

    document.getElementById('analiseAbertaCard').classList.add('hidden');
    document.getElementById('analiseFecharCard').classList.remove('hidden');
    document.getElementById('analiseImediataBtn').classList.add('hidden');
}

function fecharCalcularSaldo(evitarSobrescreverInputResmas = false) {
    if (!_analiseAberta) return;
    const numeradorBase = (_analiseAberta.contador_atual !== null && _analiseAberta.contador_atual !== undefined)
        ? parseInt(_analiseAberta.contador_atual)
        : (parseInt(_analiseAberta.observacao?.match(/ANALISE_BASE:(\d+)/)?.[1]) || 0);
    const resmas = _analiseAberta.quantidade_definida || 0;
    const dataAbertura = _analiseAberta.data_registro;
    const novoNumerador = parseInt(document.getElementById('fecharNumeradorNovo').value) || 0;

    const box = document.getElementById('saldoBox');
    if (!novoNumerador) { box.classList.add('hidden'); return; }

    const diasSemVisita = dataAbertura
        ? Math.max(1, Math.round((Date.now() - new Date(dataAbertura).getTime()) / 86400000))
        : 1;
    const consumoPaginas = Math.max(0, novoNumerador - numeradorBase);
    const cpd = consumoPaginas / diasSemVisita;

    const saldoEl = document.getElementById('fecharSaldo');
    const descEl = document.getElementById('fecharSaldoDesc');
    const resmasEl = document.getElementById('fecharSaldoResmas');

    const recomendacao = Math.ceil(consumoPaginas / 500);
    if (!evitarSobrescreverInputResmas) {
        document.getElementById('fecharResmasInput').value = recomendacao;
    }

    saldoEl.innerText = `${recomendacao} resma${recomendacao !== 1 ? 's' : ''}`;
    if (recomendacao > 0) {
        saldoEl.className = 'saldo-value saldo-positivo';
        box.classList.add('sugestao-card');
        descEl.innerText = `sugerida${recomendacao !== 1 ? 's' : ''} para reposição`;
    } else {
        saldoEl.className = 'saldo-value';
        box.classList.remove('sugestao-card');
        descEl.innerText = `sugeridas (nenhuma reposição necessária)`;
    }

    resmasEl.innerText = `CPD: ${cpd.toFixed(0)} pgs/dia · Consumo: ${consumoPaginas.toLocaleString('pt-BR')} págs. (${(consumoPaginas / 500).toFixed(1).replace('.', ',')} resmas) desde a abertura`;
    box.classList.remove('hidden');
}

function fecharAlterarResmas(delta) {
    const input = document.getElementById('fecharResmasInput');
    input.value = Math.max(0, (parseInt(input.value) || 0) + delta);
    fecharCalcularSaldo(true);
    const novasResmas = parseInt(document.getElementById('fecharResmasInput').value) || 0;
    atualizarBarraConsumo(novasResmas);
}

async function confirmarFechamentoAnalise() {
    const novoContadorVal = document.getElementById('fecharNumeradorNovo').value.trim();
    if (novoContadorVal === '' || isNaN(parseInt(novoContadorVal))) {
        return alert("Informe o novo numerador atual!");
    }
    const novaOsVal = (document.getElementById('fecharOsInput')?.value || '').trim();
    if (!novaOsVal) {
        alert("O número da O.S. é obrigatório para confirmar a entrega!");
        document.getElementById('fecharOsInput')?.focus();
        return;
    }
    const novoContador = parseInt(novoContadorVal);
    
    const equip = state.equipamento;
    const analise = _analiseAberta;
    const numeradorBase = (analise.contador_atual !== null && analise.contador_atual !== undefined)
        ? parseInt(analise.contador_atual)
        : (parseInt(analise.observacao?.match(/ANALISE_BASE:(\d+)/)?.[1]) || 0);

    if (novoContador < numeradorBase) {
        return alert(`O novo numerador atual (${novoContador.toLocaleString('pt-BR')}) não pode ser menor que o anterior (${numeradorBase.toLocaleString('pt-BR')})!`);
    }
    const resmas = analise.quantidade_definida || 0;
    const dataAbertura = analise.data_registro;

    const diasSemVisita = dataAbertura
        ? Math.max(1, Math.round((Date.now() - new Date(dataAbertura).getTime()) / 86400000))
        : 1;
    const consumoPaginas = Math.max(0, novoContador - numeradorBase);
    const cpd = consumoPaginas / diasSemVisita;
    const pagsRestantes = resmas * 500 - consumoPaginas;
    const saldoDias = cpd > 0 ? Math.round(pagsRestantes / cpd) : null;

    const novasResmas = parseInt(document.getElementById('fecharResmasInput').value) || 0;

    // Calcular se o valor é superior à última entrega
    const confirmadas = (state.entregas || []).filter(e => e.status === 'confirmado' && e.id !== analise.id);
    const ultimaConfirmada = confirmadas.length > 0 ? confirmadas[confirmadas.length - 1] : null;
    const ultimaEntregaResmas = ultimaConfirmada ? (parseInt(ultimaConfirmada.quantidade_definida) || 0) : 0;

    // VALIDAR CONSUMO DA ENTREGA ANTERIOR (DA ABERTURA DA ANÁLISE)
    let isEntregaAMais = false;
    if (novoContador > 0 && resmas > 0) {
        const paginasProduzidas = novoContador - numeradorBase;
        const paginasEsperadas = resmas * 500;
        if (paginasProduzidas < paginasEsperadas) {
            const minLiberar = numeradorBase + paginasEsperadas;
            const confirmou = confirm(`Aviso: O equipamento produziu apenas ${paginasProduzidas.toLocaleString('pt-BR')} páginas desde a abertura da análise de ${resmas} resma(s) (esperado: ${paginasEsperadas.toLocaleString('pt-BR')} páginas). O numerador atual para liberar normalmente precisaria ser no mínimo ${minLiberar.toLocaleString('pt-BR')}. Você confirma que deseja realizar esta entrega a mais?`);
            if (!confirmou) return;
            isEntregaAMais = true;
        }
    }

    let isSuperiorUltima = false;
    if (ultimaEntregaResmas > 0 && novasResmas > ultimaEntregaResmas) {
        const confirmou = confirm(`A quantidade atual (${novasResmas} resmas) é superior à última entrega (${ultimaEntregaResmas} resmas). Deseja confirmar?`);
        if (!confirmou) return;
        isSuperiorUltima = true;
    }

    if ((resmas > 0 && novasResmas > resmas) || (calcularEntregasMes() + novasResmas > (state.media || 0))) {
        const confirmou = confirm("Certeza que deseja entregar? Se sim, clique em OK para confirmar a entrega e lembre-se de sinalizar no chamado o motivo da exceção.");
        if (!confirmou) return;
    }

    try {
        await API.patch(`/balanceamento_entregas?id=eq.${analise.id}`, {
            status: 'confirmado',
            contador_atual: novoContador,
            observacao: `${analise.observacao} | Fechada. Cnt final: ${novoContador}. CPD: ${cpd.toFixed(0)} pgs/dia. Saldo: ${pagsRestantes >= 0 ? '+' : ''}${pagsRestantes} pgs${saldoDias !== null ? ` (≈ ${saldoDias}d)` : ''}.`
        });
        await API.post('/ctrl_os', {
            equipment_id: equip.id,
            os_number: analise.numero_os || '',
            counter_reading: novoContador,
            os_date: new Date().toISOString().slice(0, 10)
        });
        
        // Criar a nova entrega de resmas no balanceamento (como análise aberta)
        await API.post('/balanceamento_entregas', {
            equipamento_id: equip.id,
            cliente_id: equip.cliente.id,
            numero_os: novaOsVal || analise.numero_os || '',
            media_consumo_mensal: analise.media_consumo_mensal || 0,
            opcao_entrega: null,
            quantidade_definida: novasResmas,
            contador_atual: novoContador,
            observacao: (isSuperiorUltima ? `[SUPERIOR A ULTIMA] ` : '') + (isEntregaAMais ? `[ENTREGA A MAIS] ` : '') + `ANALISE_BASE:${novoContador}`,
            status: 'analise_aberta',
            data_registro: new Date().toISOString(),
            criado_por: obterUsuarioAtual() || (window !== window.top ? 'Sistema Original' : 'Portal')
        });

        const saldoAbs = Math.abs(pagsRestantes).toLocaleString('pt-BR');
        const diasInfo = saldoDias !== null ? ` · ≈ ${saldoDias} dias` : '';
        alert(`Análise concluída!\nCPD: ${cpd.toFixed(0)} pgs/dia\nSaldo: ${saldoAbs} pgs (≈ ${Math.abs(pagsRestantes / 500).toFixed(1)} resmas)${diasInfo} ${pagsRestantes >= 0 ? 'restantes' : 'acima do entregue'}`);
        window.location.reload();
    } catch (e) {
        alert("Erro ao confirmar análise: " + e.message);
    }
}

// CADASTRO
async function carregarClientesParaCadastro() {
    const select = document.getElementById('cadCliente');
    select.innerHTML = '<option value="">Carregando clientes...</option>';
    try {
        const cidade = getCidadeFiltro();
        const cidadeParam = cidade ? `?cidade=eq.${encodeURIComponent(cidade)}&select=id,nome&order=nome.asc` : '?select=id,nome&order=nome.asc';
        const data = await API.fetch(`/clientes${cidadeParam}`);
        select.innerHTML = '<option value="">Selecione um cliente</option>' +
            data.map(c => `<option value="${escAttr(c.id)}">${esc(c.nome)}</option>`).join('');

        if (!document.getElementById('formCadastro').dataset.init) {
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

    const senha = prompt("Digite a senha para cadastrar:");
    if (senha !== 'Doc2026') return alert("Senha incorreta!");

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

async function realizarConsulta() {
    const q = document.getElementById('globalSearchInput').value.trim();
    const clienteNome = document.getElementById('consultarCliente').value.trim();
    const dataInicio = document.getElementById('consultarDataInicio').value;
    const dataFim = document.getElementById('consultarDataFim').value;

    if (!clienteNome && !q && !dataInicio) return document.getElementById('consultarDashboard').classList.add('hidden');

    setLoading(true);
    const tbody = document.getElementById('consultarTbody');
    tbody.innerHTML = '<tr><td colspan="8">Buscando...</td></tr>';

    try {
        const cidade = getCidadeFiltro();
        const joinType = cidade ? '!inner' : '';
        const cidadeParam = cidade ? `&cliente.cidade=eq.${encodeURIComponent(cidade)}` : '';
        let endpoint = `/equipamentos?select=*,cliente:clientes${joinType}(nome,cidade),balanceamento_entregas(media_consumo_mensal,status,data_registro)${cidadeParam}&order=serie.asc`;

        if (q) endpoint += `&or=(serie.ilike.*${encodeURIComponent(q)}*,patrimonio.ilike.*${encodeURIComponent(q)}*,modelo.ilike.*${encodeURIComponent(q)}*,secretaria.ilike.*${encodeURIComponent(q)}*)`;

        if (dataInicio) endpoint += `&balanceamento_entregas.data_registro=gte.${dataInicio}`;
        if (dataFim) endpoint += `&balanceamento_entregas.data_registro=lte.${dataFim}T23:59:59`;

        const data = await API.fetch(endpoint);

        const filteredData = data.filter(item => {
            const matchQ = !q || (
                (item.serie||'').toLowerCase().includes(q.toLowerCase()) ||
                (item.patrimonio||'').toLowerCase().includes(q.toLowerCase()) ||
                (item.modelo||'').toLowerCase().includes(q.toLowerCase()) ||
                (item.secretaria||'').toLowerCase().includes(q.toLowerCase()) ||
                (item.cliente?.nome || '').toLowerCase().includes(q.toLowerCase())
            );
            const matchClient = !clienteNome || (item.cliente?.nome || '').toLowerCase().includes(clienteNome.toLowerCase());
            const matchCity = !cidade || (item.cliente?.cidade || '').toUpperCase() === cidade.toUpperCase();
            return matchQ && matchClient && matchCity;
        });

        document.getElementById('consultarDashboard').classList.remove('hidden');
        document.getElementById('dashTotalEquip').innerText = filteredData.length;

        let totalMediaGeral = 0;

        tbody.innerHTML = filteredData.map(eq => {
            const entregas = eq.balanceamento_entregas || [];
            const confirmadas = entregas.filter(e => e.status === 'confirmado');

            let mediaEquip = 0;
            if (confirmadas.length > 0) {
                const soma = confirmadas.reduce((a, b) => a + parseFloat(b.media_consumo_mensal), 0);
                mediaEquip = soma / confirmadas.length;
            }

            totalMediaGeral += mediaEquip;

            const s15 = Math.ceil(mediaEquip / 2);
            const s30 = Math.ceil(mediaEquip);
            const s45 = Math.ceil(mediaEquip * 1.5);
            const s60 = Math.ceil(mediaEquip * 2);

            return `
                <tr>
                    <td data-label="Série"><strong>${esc(eq.serie)}</strong></td>
                    <td data-label="Patrimônio">${esc(eq.patrimonio || '-')}</td>
                    <td data-label="Modelo">${esc(eq.modelo || '-')}</td>
                    <td data-label="Setor / Cliente">${esc(eq.secretaria || '-')} <br><small class="text-dim">${esc(eq.cliente?.nome || 'N/D')}</small></td>
                    <td data-label="Numerador" class="text-center"><strong>${esc(String(eq.ultimo_contador || 0))}</strong></td>
                    <td data-label="Média Real" class="text-center">
                        <span class="gold-text"><strong>${esc(mediaEquip.toFixed(1).replace('.', ','))}</strong></span>
                        <br><small class="text-dim">${confirmadas.length} reg.</small>
                    </td>
                    <td data-label="Sugestões" class="text-center">
                        <div class="suggestion-circles-mini">
                            <div class="circle-mini" title="Sugestão 15 dias"><span>${s15}</span><label>15d</label></div>
                            <div class="circle-mini" title="Sugestão 30 dias"><span>${s30}</span><label>30d</label></div>
                            <div class="circle-mini" title="Sugestão 45 dias"><span>${s45}</span><label>45d</label></div>
                            <div class="circle-mini" title="Sugestão 60 dias"><span>${s60}</span><label>60d</label></div>
                        </div>
                    </td>
                    <td data-label="Ações" class="text-center">
                        <div class="action-btns">
                            <button class="btn-primary btn-sm" data-serie="${escAttr(eq.serie)}" onclick="selecionarParaBalancear(this.dataset.serie)" title="Balancear este Equipamento">
                                <i data-lucide="scale"></i>
                            </button>
                            ${canEdit() ? `
                            <button class="btn-edit-icon" data-id="${escAttr(eq.id)}" onclick="prepararEdicao(this.dataset.id)" title="Editar Equipamento">
                                <i data-lucide="edit-2"></i>
                            </button>` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        document.getElementById('dashTotalConsumo').innerText = totalMediaGeral.toFixed(1).replace('.', ',');
        lucide.createIcons({ root: tbody });

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

function aplicarFiltroRapido(termo) {
    document.getElementById('filterCliente').value = termo;
    document.getElementById('filterSerie').value = '';
    state.historico.pagina = 1;

    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.classList.toggle('active', chip.innerText.includes(termo));
    });

    carregarHistorico();
}

// HISTÓRICO com filtros, paginação e restrição de cidade
async function carregarHistorico() {
    const tbody = document.getElementById('historicoTbody');
    tbody.style.opacity = '0.5';

    const dataInicio = document.getElementById('filterDataInicio').value;
    const dataFim = document.getElementById('filterDataFim').value;
    const clienteInput = document.getElementById('filterCliente').value.trim();
    const serie = document.getElementById('filterSerie').value.trim();

    // Para perfis com cidade restrita, forçar filtro pela cidade
    const cidade = getCidadeFiltro();

    const limit = state.historico.tamanho;
    const offset = (state.historico.pagina - 1) * limit;

    const joinCliente = (cidade || clienteInput) ? '!inner' : '';
    const addFilters  = (base) => {
        const tz = getLocalOffsetString();
        if (dataInicio)   base += `&data_registro=gte.${dataInicio}T00:00:00${tz}`;
        if (dataFim)      base += `&data_registro=lte.${dataFim}T23:59:59${tz}`;
        if (serie)        base += `&equipamento.or=(serie.ilike.*${encodeURIComponent(serie)}*,patrimonio.ilike.*${encodeURIComponent(serie)}*)`;
        if (cidade)       base += `&cliente.cidade=eq.${encodeURIComponent(cidade)}`;
        if (clienteInput) base += `&cliente.nome=ilike.*${encodeURIComponent(clienteInput)}*`;
        return base;
    };

    const endpoint    = addFilters(`/balanceamento_entregas?select=*,cliente:clientes${joinCliente}(nome,cidade),equipamento:equipamentos!inner(serie,patrimonio,secretaria)&order=data_registro.desc&limit=${limit}&offset=${offset}`);
    const sumEndpoint = addFilters(`/balanceamento_entregas?select=quantidade_definida,cliente:clientes${joinCliente}(cidade),equipamento:equipamentos!inner(id)`);

    try {
        const [res, sumData] = await Promise.all([
            API.fetch(endpoint, true),
            API.fetch(sumEndpoint)
        ]);
        const data = await res.json();
        tbody.style.opacity = '1';

        const contentRange = res.headers.get('Content-Range');
        if (contentRange) {
            state.historico.total = parseInt(contentRange.split('/')[1]) || 0;
        }

        const totalP = sumData.reduce((acc, curr) => acc + parseFloat(curr.quantidade_definida || 0), 0);

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="text-center">Nenhum registro encontrado para os filtros aplicados.</td></tr>';
            document.getElementById('totalResmas').innerText = '0';
            document.getElementById('histSummaryResmas').innerText = '0';
            document.getElementById('histSummaryRegs').innerText = '0';
            updatePaginationUI();
            return;
        }

        const editDeleteBtns = canEdit() ? `
            <div class="action-btns">
                <button class="btn-edit-icon" data-id="{ID}" onclick="prepararEdicaoHistorico(this.dataset.id)" title="Editar Registro">
                    <i data-lucide="edit-2"></i>
                </button>
                <button class="btn-delete-icon" data-id="{ID}" onclick="excluirRegistroHistorico(this.dataset.id)" title="Excluir Registro">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>` : '-';

        tbody.innerHTML = data.map(i => {
            const dateObj = i.data_registro ? new Date(i.data_registro) : null;
            const dateStr = (dateObj && !isNaN(dateObj.getTime())) ? dateObj.toLocaleDateString('pt-BR') : '-';
            const mediaVal = parseFloat(i.media_consumo_mensal);
            const mediaStr = (i.media_consumo_mensal && !isNaN(mediaVal)) ? mediaVal.toFixed(1).replace('.', ',') : '-';
            
            return `
            <tr class="clickable-row" onclick="abrirModalVisualizar(this, event)"
                data-data="${escAttr(dateStr)}"
                data-cliente="${escAttr(i.cliente?.nome || 'N/D')}"
                data-local="${escAttr(i.equipamento?.secretaria || 'N/D')}"
                data-serie="${escAttr(i.equipamento?.serie || 'N/D')}"
                data-media="${escAttr(mediaStr)}"
                data-freq="${escAttr((i.opcao_entrega === null || i.opcao_entrega === undefined || i.opcao_entrega === 0) ? 'Manual' : i.opcao_entrega + 'x')}"
                data-resmas="${escAttr(i.quantidade_definida !== null && i.quantidade_definida !== undefined ? String(i.quantidade_definida) : '-')}"
                data-os="${escAttr(i.numero_os || '-')}"
                data-status="${escAttr(i.status)}">
                <td data-label="Data">${esc(dateStr)}</td>
                <td data-label="Cliente">${esc(i.cliente?.nome || 'N/D')}</td>
                <td data-label="Local/Setor">${esc(i.equipamento?.secretaria || 'N/D')}</td>
                <td data-label="Série">${esc(i.equipamento?.serie || 'N/D')}</td>
                <td data-label="Média/mês">${esc(mediaStr)}</td>
                <td data-label="Frequência">${esc((i.opcao_entrega === null || i.opcao_entrega === undefined || i.opcao_entrega === 0) ? 'Manual' : i.opcao_entrega + 'x')}</td>
                <td data-label="Resmas">${esc(i.quantidade_definida !== null && i.quantidade_definida !== undefined ? String(i.quantidade_definida) : '-')}</td>
                <td data-label="O.S.">${esc(i.numero_os || '-')}</td>
                <td data-label="Status">${formatarStatus(i.status)}</td>
                <td data-label="Ações" class="text-center">
                    ${editDeleteBtns.replace(/{ID}/g, escAttr(i.id))}
                </td>
            </tr>`;
        }).join('');

        document.getElementById('totalResmas').innerText = totalP;
        document.getElementById('histSummaryResmas').innerText = totalP;
        document.getElementById('histSummaryRegs').innerText = state.historico.total;

        updatePaginationUI();
        lucide.createIcons({ root: tbody });
    } catch (e) {
        tbody.style.opacity = '1';
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="10" class="text-center" style="color:var(--danger)">Erro ao carregar histórico: ' + e.message + '</td></tr>';
    }
}

function updatePaginationUI() {
    const totalPaginas = Math.ceil(state.historico.total / state.historico.tamanho) || 1;
    document.getElementById('currentPageDisplay').innerText = state.historico.pagina;
    document.getElementById('totalPagesDisplay').innerText = totalPaginas;

    document.getElementById('btnPrevPage').disabled = state.historico.pagina <= 1;
    document.getElementById('btnNextPage').disabled = state.historico.pagina >= totalPaginas;
}

function mudarPagina(delta) {
    const novaPagina = state.historico.pagina + delta;
    const totalPaginas = Math.ceil(state.historico.total / state.historico.tamanho) || 1;

    if (novaPagina >= 1 && novaPagina <= totalPaginas) {
        state.historico.pagina = novaPagina;
        carregarHistorico();
    }
}

function mudarTamanhoPagina(novoTamanho) {
    state.historico.tamanho = parseInt(novoTamanho);
    state.historico.pagina = 1;
    carregarHistorico();
}

async function carregarRelatorios() {
    const tbody = document.getElementById('rankingTbody');
    tbody.innerHTML = '<tr><td colspan="7">Carregando...</td></tr>';
    try {
        const data = await API.fetch('/view_top_equipamentos?limit=20');

        const cidade = getCidadeFiltro();
        const filtrado = cidade
            ? data.filter(i => (i.cliente_nome || '').toUpperCase().includes(cidade))
            : data;

        tbody.innerHTML = filtrado.map((i, idx) => `
            <tr class="rank-${idx + 1}">
                <td><span class="rank-badge">${idx + 1}º</span></td>
                <td>${esc(i.serie)}</td>
                <td>${esc(i.secretaria)}</td>
                <td>${esc(i.cliente_nome)}</td>
                <td class="text-center">${esc(String(i.total_chamados))}</td>
                <td class="text-center">${esc(String(i.total_resmas))}</td>
                <td class="text-center">${esc(parseFloat(i.media_media).toFixed(1))}</td>
            </tr>
        `).join('');
    } catch (e) { tbody.innerHTML = '<tr><td colspan="7">Erro ao carregar relatório.</td></tr>'; }
}

function exportarExcel(id, name) {
    if (typeof XLSX === 'undefined') {
        return alert("Erro: A biblioteca XLSX (Excel) não foi carregada. Verifique sua conexão à internet.");
    }
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
    ['resultContainer', 'formLineOs', 'formLineObs', 'actionRow', 'saldoBox', 'historicoOriginalCard'].forEach(id =>
        document.getElementById(id)?.classList.add('hidden')
    );
    [['inputContador',''],['inputOs',''],['inputObs',''],
     ['analiseNumeradorAtual',''],['analiseOs',''],['analiseResmas','0'],
     ['fecharNumeradorNovo',''],['fecharResmasInput','0']].forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    });
}

// EDIÇÃO DE EQUIPAMENTO
let currentEditingId = null;

async function prepararEdicao(id) {
    if (!canEdit()) return alert("Você não tem permissão para editar equipamentos.");

    const senha = prompt("Digite a senha para editar:");
    if (senha !== 'Doc2026') return alert("Senha incorreta!");

    currentEditingId = id;
    try {
        const [eq] = await API.fetch(`/equipamentos?id=eq.${id}&select=*,cliente:clientes(nome)`);
        if (!eq) return alert("Equipamento não encontrado!");

        const os = await API.fetch(`/ctrl_os?equipment_id=eq.${id}&order=os_date.desc&limit=1&select=counter_reading`);
        const ultimoContador = os[0]?.counter_reading || 0;

        state._editEquip = eq;

        document.getElementById('editSerie').value = eq.serie;
        document.getElementById('editPatrimonio').value = eq.patrimonio || '';
        document.getElementById('editModelo').value = eq.modelo || '';
        document.getElementById('editSecretaria').value = eq.secretaria || '';
        document.getElementById('editMediaRef').value = eq.media_referencia || '';
        document.getElementById('editContador').value = ultimoContador || '';

        document.getElementById('modalEdicao').classList.remove('hidden');
        lucide.createIcons();
    } catch (e) {
        alert("Erro ao buscar dados: " + e.message);
    }
}


// ════════════════════════════════════════════════════════
// ÁREA ADMIN (CTO)
// ════════════════════════════════════════════════════════
let adminState = { cidade: null, clienteIds: null };

function showAdmin() {
    try {
        if (!document.getElementById('adminApp')) {
            // Se estiver dentro de um iframe (Sistema Original), não redireciona
            if (window !== window.top) {
                showTech();
                return;
            }
            localStorage.setItem('adm_user', JSON.stringify(currentUser));
            localStorage.setItem('adm_tk', Math.random().toString(36).slice(2) + Date.now().toString(36));
            if (typeof window !== 'undefined' && window.location) {
                window.location.href = 'admin.html?v=20260702';
            }
            return;
        }
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('adminApp').style.display = 'block';
        document.getElementById('adminBadge').innerText = currentUser.label;
        document.getElementById('adminCity').innerText = currentUser.cidade || 'TODAS AS CIDADES';
        adminState.cidade = currentUser.cidade;
        lucide.createIcons();
        initTheme();
        const btn = document.getElementById('adminThemeToggle');
        if (btn) {
            const icon = btn.querySelector('i');
            updateThemeIcon(localStorage.getItem('theme') || 'light', icon);
            btn.addEventListener('click', () => {
                const cur = document.documentElement.getAttribute('data-theme');
                const next = cur === 'dark' ? 'light' : 'dark';
                document.documentElement.setAttribute('data-theme', next);
                localStorage.setItem('theme', next);
                updateThemeIcon(next, icon);
                lucide.createIcons();
            });
        }
        initAdminTabs();
        admInitData();
    } catch (err) {
        alert("Erro no showAdmin: " + err.message + "\nStack: " + err.stack);
        console.error("Erro no showAdmin:", err);
    }
}

function initAdminTabs() {
    document.querySelectorAll('[data-admtab]').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.admtab;
            document.querySelectorAll('[data-admtab]').forEach(b => b.classList.toggle('active', b === btn));
            document.querySelectorAll('#adminApp .tab-content').forEach(c =>
                c.classList.toggle('active', c.id === 'adm-tab-' + tabId)
            );
            if (tabId === 'entregas') admCarregarEntregas();
            if (tabId === 'analises') admCarregarAnalises();
        });
    });
}

function formatarStatus(s) {
    if(!s) return '-';
    s = s.toLowerCase();
    const cls   = { confirmado:'status-confirmado', pendente:'status-pendente', entregue:'status-entregue', analise_aberta:'status-pendente' };
    const label = { confirmado:'Conforme', pendente:'Pendente', entregue:'Conforme', analise_aberta:'Inconforme' };
    return '<span class="status-badge ' + (cls[s]||'') + '">' + esc(label[s]||s).toUpperCase() + '</span>';
}

function abrirModalVisualizar(el, ev) {
    if (ev && ev.target.closest('button')) return; // ignore clicks on action buttons
    
    const d = el.dataset;
    let html = `
        <div style="display:flex; flex-direction:column; gap:12px; font-size:1rem; color:var(--text);">
            <p><strong>Data:</strong> <span style="float:right;">${d.data}</span></p>
            <p><strong>Cliente:</strong> <span style="float:right;">${d.cliente}</span></p>
            <p><strong>Local/Setor:</strong> <span style="float:right;">${d.local}</span></p>
            <p><strong>Série/Patrimônio:</strong> <span style="float:right;">${d.serie}</span></p>
            <p><strong>Média/Mês:</strong> <span style="float:right;">${d.media}</span></p>
            <p><strong>Frequência:</strong> <span style="float:right;">${d.freq}</span></p>
            <p><strong>Resmas:</strong> <span style="float:right;">${d.resmas}</span></p>
            <p><strong>O.S.:</strong> <span style="float:right;">${d.os}</span></p>
            <hr style="border:0; border-top:1px solid var(--border); margin:4px 0;">
            <p><strong>Status:</strong> <span style="float:right;">${formatarStatus(d.status)}</span></p>
        </div>
    `;
    
    let m = document.getElementById('modalVisualizarInfo');
    if (!m) {
        m = document.createElement('div');
        m.id = 'modalVisualizarInfo';
        m.className = 'modal-overlay';
        m.innerHTML = `
            <div class="modal-content modal-content-sm">
                <div class="modal-header">
                    <h3><i data-lucide="info"></i> Detalhes da Entrega</h3>
                    <button class="btn-close" onclick="document.getElementById('modalVisualizarInfo').classList.add('hidden')" title="Fechar">&times;</button>
                </div>
                <div class="modal-body" id="modalVisualizarBody"></div>
                <div class="modal-footer" style="margin-top:20px; text-align:right;">
                    <button type="button" class="btn-primary" onclick="document.getElementById('modalVisualizarInfo').classList.add('hidden')">FECHAR</button>
                </div>
            </div>
        `;
        document.body.appendChild(m);
        lucide.createIcons();
    }
    
    document.getElementById('modalVisualizarBody').innerHTML = html;
    m.classList.remove('hidden');
};

async function admInitData() {
    if (adminState.cidade) {
        try {
            const clientes = await API.fetch('/clientes?nome=ilike.*' + encodeURIComponent(adminState.cidade) + '*&select=id');
            adminState.clienteIds = clientes.map(c => c.id);
        } catch(e) { adminState.clienteIds = []; }
    } else {
        adminState.clienteIds = null;
    }
    admCarregarDashboard();
}

function admCidadeFilter(sep) {
    sep = sep || '&';
    if (adminState.clienteIds === null) return '';
    if (adminState.clienteIds.length === 0)
        return sep + 'cliente_id=eq.00000000-0000-0000-0000-000000000000';
    return sep + 'cliente_id=in.(' + adminState.clienteIds.join(',') + ')';
}

function admFmtData(iso) {
    return iso ? new Date(iso).toLocaleDateString('pt-BR') : '-';
}

function admStatusBadge(s) {
    const cls   = { confirmado:'status-confirmado', pendente:'status-pendente', entregue:'status-entregue', analise_aberta:'status-pendente' };
    const label = { confirmado:'Conforme', pendente:'Pendente', entregue:'Conforme', analise_aberta:'Inconforme' };
    return '<span class="status-badge ' + (cls[s]||'') + '">' + esc(label[s]||s) + '</span>';
}

async function admCarregarDashboard() {
    const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    try {
        const [equips, entregasMes, analises, recentes] = await Promise.all([
            API.fetch('/equipamentos?select=id' + admCidadeFilter() + '&limit=2000'),
            API.fetch('/balanceamento_entregas?status=in.(confirmado,analise_aberta)&data_registro=gte.' + inicioMes + admCidadeFilter() + '&select=quantidade_definida&limit=2000'),
            API.fetch('/balanceamento_entregas?status=eq.analise_aberta' + admCidadeFilter() + '&select=id&limit=1000'),
            API.fetch('/balanceamento_entregas?status=in.(confirmado,analise_aberta)' + admCidadeFilter() + '&order=data_registro.desc&limit=15&select=data_registro,quantidade_definida,numero_os,status,equipamento:equipamentos(serie,secretaria,cliente:clientes(nome))'),
        ]);
        document.getElementById('kpiEquip').innerText    = equips.length;
        document.getElementById('kpiEntregas').innerText  = entregasMes.length;
        document.getElementById('kpiResmas').innerText    = entregasMes.reduce(function(s,e){ return s + (parseFloat(e.quantidade_definida)||0); }, 0).toFixed(0);
        document.getElementById('kpiAnalises').innerText  = analises.length;
        const tbody = document.getElementById('admDashTbody');
        tbody.innerHTML = recentes.length === 0
            ? '<tr><td colspan="7" class="text-center">Nenhuma entrega encontrada.</td></tr>'
            : recentes.map(function(e){ return '<tr><td>' + admFmtData(e.data_registro) + '</td><td><strong>' + esc(e.equipamento&&e.equipamento.serie||'-') + '</strong></td><td>' + esc(e.equipamento&&e.equipamento.cliente&&e.equipamento.cliente.nome||'-') + '</td><td>' + esc(e.equipamento&&e.equipamento.secretaria||'-') + '</td><td class="text-center"><strong>' + esc(String(e.quantidade_definida||0)) + '</strong></td><td>' + esc(e.numero_os||'-') + '</td><td>' + admStatusBadge(e.status) + '</td></tr>'; }).join('');
    } catch(err) { console.error(err); }
}

async function admCarregarEntregas() {
    const di = document.getElementById('admDataInicio').value;
    const df = document.getElementById('admDataFim').value;
    let params = 'status=in.(confirmado,analise_aberta)' + admCidadeFilter() + '&order=data_registro.desc&limit=300&select=data_registro,quantidade_definida,media_consumo_mensal,numero_os,observacao,status,equipamento:equipamentos(serie,secretaria,cliente:clientes(nome))';
    const tz = getLocalOffsetString();
    if (di) params += '&data_registro=gte.' + di + 'T00:00:00' + tz;
    if (df) params += '&data_registro=lte.' + df + 'T23:59:59' + tz;
    document.getElementById('admEntregasTbody').innerHTML = '<tr><td colspan="9" class="text-center">Carregando...</td></tr>';
    try {
        const data = await API.fetch('/balanceamento_entregas?' + params);
        const tbody = document.getElementById('admEntregasTbody');
        if (!data.length) { tbody.innerHTML = '<tr><td colspan="9" class="text-center">Nenhum registro no periodo.</td></tr>'; return; }
        tbody.innerHTML = data.map(function(e){ return '<tr><td>' + admFmtData(e.data_registro) + '</td><td><strong>' + esc(e.equipamento&&e.equipamento.serie||'-') + '</strong></td><td>' + esc(e.equipamento&&e.equipamento.cliente&&e.equipamento.cliente.nome||'-') + '</td><td>' + esc(e.equipamento&&e.equipamento.secretaria||'-') + '</td><td class="text-center"><strong>' + esc(String(e.quantidade_definida||0)) + '</strong></td><td class="text-center">' + esc(e.media_consumo_mensal ? parseFloat(e.media_consumo_mensal).toFixed(1) : '-') + '</td><td>' + esc(e.numero_os||'-') + '</td><td style="max-width:160px;font-size:0.75rem;color:var(--text-dim)">' + esc(e.observacao||'-') + '</td><td>' + admStatusBadge(e.status) + '</td></tr>'; }).join('');
    } catch(err) {
        document.getElementById('admEntregasTbody').innerHTML = '<tr><td colspan="9" class="text-center" style="color:var(--danger)">Erro: ' + err.message + '</td></tr>';
    }
}

async function admCarregarAnalises() {
    const params = 'status=eq.analise_aberta' + admCidadeFilter() + '&order=data_registro.asc&select=*,equipamento:equipamentos(serie,secretaria,cliente:clientes(nome))';
    document.getElementById('admAnalisesTabody').innerHTML = '<tr><td colspan="9" class="text-center">Carregando...</td></tr>';
    try {
        const data = await API.fetch('/balanceamento_entregas?' + params);
        const tbody = document.getElementById('admAnalisesTabody');
        if (!data.length) { tbody.innerHTML = '<tr><td colspan="9" class="text-center">Nenhuma analise em aberto.</td></tr>'; return; }
        const agora = Date.now();
        tbody.innerHTML = data.map(function(e) {
            const base   = parseInt((e.observacao && e.observacao.match(/ANALISE_BASE:(\d+)/) || [])[1]) || 0;
            const limite = base + (e.quantidade_definida||0) * 500;
            const dias   = Math.round((agora - new Date(e.data_registro).getTime()) / 86400000);
            const cls    = dias > 7 ? 'dias-crit' : dias > 3 ? 'dias-warn' : 'dias-ok';
            return '<tr><td>' + admFmtData(e.data_registro) + '</td><td><strong>' + esc(e.equipamento&&e.equipamento.serie||'-') + '</strong></td><td>' + esc(e.equipamento&&e.equipamento.cliente&&e.equipamento.cliente.nome||'-') + '</td><td>' + esc(e.equipamento&&e.equipamento.secretaria||'-') + '</td><td class="text-center">' + base.toLocaleString('pt-BR') + '</td><td class="text-center"><strong>' + esc(String(e.quantidade_definida||0)) + '</strong></td><td class="text-center gold-text"><strong>' + limite.toLocaleString('pt-BR') + '</strong></td><td>' + esc(e.numero_os||'-') + '</td><td class="text-center ' + cls + '">' + dias + 'd</td></tr>';
        }).join('');
    } catch(err) {
        document.getElementById('admAnalisesTabody').innerHTML = '<tr><td colspan="9" class="text-center" style="color:var(--danger)">Erro: ' + err.message + '</td></tr>';
    }
}



function syncContador(origem) {
    const val     = document.getElementById(origem).value;
    const destino = origem === 'analiseNumeradorAtual' ? 'inputContador' : 'analiseNumeradorAtual';
    document.getElementById(destino).value = val;
}

// ════════════════════════════════════════════════════════
// CACHE LOCAL — IndexedDB
// Equipamentos e clientes salvos no celular para uso offline
// ════════════════════════════════════════════════════════
const IDB_NAME = 'rdy-cache';
const IDB_VER  = 2;
let _db = null;

function abrirDB() {
    if (_db) return Promise.resolve(_db);
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_NAME, IDB_VER);
        req.onupgradeneeded = e => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('equipamentos'))
                db.createObjectStore('equipamentos', { keyPath: 'id' });
            if (!db.objectStoreNames.contains('clientes'))
                db.createObjectStore('clientes', { keyPath: 'id' });
            if (!db.objectStoreNames.contains('meta'))
                db.createObjectStore('meta');
        };
        req.onsuccess = e => { _db = e.target.result; resolve(_db); };
        req.onerror   = () => reject(req.error);
    });
}

const _memCache = {};

async function salvarCacheStore(store, lista) {
    _memCache[store] = lista;
    const db = await abrirDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        const s  = tx.objectStore(store);
        lista.forEach(item => s.put(item));
        tx.oncomplete = resolve;
        tx.onerror    = () => reject(tx.error);
    });
}

async function lerCacheStore(store) {
    if (_memCache[store]) return _memCache[store];
    const db = await abrirDB();
    return new Promise((resolve, reject) => {
        const tx  = db.transaction(store, 'readonly');
        const req = tx.objectStore(store).getAll();
        req.onsuccess = () => { _memCache[store] = req.result || []; resolve(_memCache[store]); };
        req.onerror   = () => reject(tx.error);
    });
}

async function salvarMeta(chave, valor) {
    const db = await abrirDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('meta', 'readwrite');
        tx.objectStore('meta').put(valor, chave);
        tx.oncomplete = resolve;
        tx.onerror    = () => reject(tx.error);
    });
}

async function lerMeta(chave) {
    const db = await abrirDB();
    return new Promise(resolve => {
        const tx  = db.transaction('meta', 'readonly');
        const req = tx.objectStore('meta').get(chave);
        req.onsuccess = () => resolve(req.result);
        req.onerror   = () => resolve(null);
    });
}

// Busca no cache local (offline-first)
async function buscarEquipamentosLocal(termo) {
    try {
        const lista = await lerCacheStore('equipamentos');
        const t = termo.toLowerCase().trim();
        return lista.filter(e =>
            (e.serie      || '').toLowerCase().includes(t) ||
            (e.patrimonio || '').toLowerCase().includes(t)
        ).slice(0, 10);
    } catch(e) { return []; }
}

let _syncEmProgresso = false;

async function sincronizarDados(silencioso) {
    if (_syncEmProgresso || !navigator.onLine) return false;
    _syncEmProgresso = true;

    const btn   = document.getElementById('btnSync');
    const label = document.getElementById('syncLabel');
    if (btn) {
        btn.disabled = true;
        const icon = btn.querySelector('i') || btn.querySelector('svg');
        if (icon) icon.classList.add('spin');
    }
    if (label && !silencioso) label.textContent = 'Baixando...';

    try {
        const cidade = getCidadeFiltro();
        const cidadeParam = cidade
            ? ('&cliente=not.is.null&select=*,cliente:clientes!inner(id,nome)&cliente.nome=ilike.*' + encodeURIComponent(cidade) + '*')
            : '&select=*,cliente:clientes(id,nome)';

        const [equipamentos, clientes] = await Promise.all([
            API.fetch('/equipamentos?' + cidadeParam + '&order=serie.asc&limit=5000'),
            API.fetch('/clientes?select=id,nome&order=nome.asc&limit=2000')
        ]);

        await salvarCacheStore('equipamentos', equipamentos);
        await salvarCacheStore('clientes', clientes);
        const agora = Date.now();
        await salvarMeta('lastSync', agora);
        localStorage.setItem('lastSync', String(agora));

        atualizarSyncLabel();
        return true;
    } catch(e) {
        console.error('Sync falhou:', e);
        if (label) label.textContent = 'Falha no download';
        return false;
    } finally {
        _syncEmProgresso = false;
        if (btn) {
            btn.disabled = false;
            const icon = btn.querySelector('i') || btn.querySelector('svg');
            if (icon) icon.classList.remove('spin');
        }
    }
}

async function atualizarSyncLabel() {
    const label = document.getElementById('syncLabel');
    if (!label) return;
    const last = await lerMeta('lastSync');
    if (!last) { label.textContent = 'Sem dados locais'; return; }
    const diff = Date.now() - last;
    const min  = Math.floor(diff / 60000);
    const h    = Math.floor(diff / 3600000);
    if (min < 1)   label.textContent = 'Sincronizado agora';
    else if (h < 1) label.textContent = 'Sync: ' + min + 'min atras';
    else            label.textContent = 'Sync: ' + h + 'h atras';
}

let _syncTimer = null;

async function verificarAutoSync() {
    atualizarSyncLabel();
    const last = (await lerMeta('lastSync')) || 0;
    if (navigator.onLine && (Date.now() - last > 15 * 60000)) {
        await sincronizarDados(true);
    }
    iniciarSyncAutomatico();
}

function iniciarSyncAutomatico() {
    if (_syncTimer) return;
    // Sincroniza a cada 10 minutos enquanto a aba estiver aberta
    _syncTimer = setInterval(async () => {
        if (navigator.onLine && !_syncEmProgresso) {
            await sincronizarDados(true);
        }
    }, 10 * 60000);

    // Sincroniza ao recuperar conexão
    window.addEventListener('online', () => {
        sincronizarDados(true);
    });

    // Sincroniza ao voltar para a aba após >5min inativo
    document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible') {
            const last = (await lerMeta('lastSync')) || 0;
            if (navigator.onLine && Date.now() - last > 5 * 60000) {
                sincronizarDados(true);
            }
        }
    });
}
function initTheme() {
    const btn = document.getElementById('themeToggle');
    if (!btn) return;
    const icon = btn.querySelector('i');

    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme, icon);

    const savedColor = localStorage.getItem('themeColor') || '#e60000';
    changeColor(savedColor, false);

    btn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';

        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        updateThemeIcon(next, icon);
    });
}

function changeColor(color, save = true) {
    document.documentElement.style.setProperty('--gold', color);
    if (save) localStorage.setItem('themeColor', color);

    // Atualiza dinamicamente a meta tag de cor do tema para navegadores moveis
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'theme-color';
        document.head.appendChild(meta);
    }
    meta.content = color;

    document.querySelectorAll('.color-dot').forEach(dot => {
        const title = dot.getAttribute('title').toLowerCase();
        dot.classList.toggle('active', getColorHex(title) === color.toLowerCase());
    });
}

function getColorHex(name) {
    const map = {
        'ouro': '#d4af37',
        'ciano': '#0078d4',
        'magenta': '#ff00cc',
        'amarelo': '#ffcc00'
    };
    return map[name] || '';
}

function fecharTodasSugestoes() {
    document.querySelectorAll('.suggestions-list').forEach(l => l.classList.add('hidden'));
}

function updateThemeIcon(theme, icon) {
    if (!icon) return;
    const name = theme === 'dark' ? 'sun' : 'moon';
    icon.setAttribute('data-lucide', name);
    lucide.createIcons();
}

function fecharModalEdicao() {
    document.getElementById('modalEdicao').classList.add('hidden');
    currentEditingId = null;
    state._editEquip = null;
}

// GESTÃO DE HISTÓRICO (SENHA PROTEGIDA)
async function authAction(callback) {
    const pass = prompt("Digite a senha para continuar:");
    if (pass === "Doc2026") {
        callback();
    } else {
        if (pass !== null) alert("Senha incorreta!");
    }
}

async function excluirRegistroHistorico(id) {
    if (!canEdit()) return alert("Você não tem permissão para excluir registros.");
    authAction(async () => {
        if (confirm("Tem certeza que deseja excluir este registro permanentemente?")) {
            try {
                setLoading(true);
                await API.delete(`/balanceamento_entregas?id=eq.${id}`);
                alert("Registro excluído com sucesso!");
                carregarHistorico();
            } catch (e) {
                console.error(e);
                alert("Erro ao excluir registro.");
            } finally {
                setLoading(false);
            }
        }
    });
}

async function prepararEdicaoHistorico(id) {
    if (!canEdit()) return alert("Você não tem permissão para editar registros.");
    authAction(async () => {
        try {
            setLoading(true);
            const data = await API.fetch(`/balanceamento_entregas?id=eq.${id}&select=*,equipamento:equipamentos(serie),cliente:clientes(nome)`);
            if (data.length === 0) return;
            const item = data[0];

            document.getElementById('editHistId').value = item.id;
            document.getElementById('editHistEquip').innerText = `${item.equipamento.serie} - ${item.cliente.nome}`;
            document.getElementById('editHistQtd').value = item.quantidade_definida;
            document.getElementById('editHistOs').value = item.numero_os || '';
            document.getElementById('editHistStatus').value = item.status;

            document.getElementById('modalEdicaoHistorico').classList.remove('hidden');
        } catch (e) {
            console.error(e);
            alert("Erro ao carregar dados para edição.");
        } finally {
            setLoading(false);
        }
    });
}

async function salvarEdicaoHistorico() {
    const id = document.getElementById('editHistId').value;
    const payload = {
        quantidade_definida: parseFloat(document.getElementById('editHistQtd').value),
        numero_os: document.getElementById('editHistOs').value,
        status: document.getElementById('editHistStatus').value
    };

    try {
        setLoading(true);
        await API.patch(`/balanceamento_entregas?id=eq.${id}`, payload);
        alert("Registro atualizado com sucesso!");
        fecharModalEdicaoHistorico();
        carregarHistorico();
    } catch (e) {
        console.error(e);
        alert("Erro ao salvar alterações.");
    } finally {
        setLoading(false);
    }
}

function fecharModalEdicaoHistorico() {
    document.getElementById('modalEdicaoHistorico').classList.add('hidden');
}
