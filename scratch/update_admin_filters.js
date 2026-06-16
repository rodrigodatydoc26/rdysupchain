const fs = require('fs');
const path = require('path');

const adminPath = path.join(__dirname, '../admin.html');
let content = fs.readFileSync(adminPath, 'utf8');

// 1. Insert CSS
const newCSS = `
    /* ── NOVOS FILTROS ── */
    .admin-filters-grid {
      display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px;
      background: var(--bg-1); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px;
    }
    .filter-row-top {
      display: flex; flex-wrap: wrap; align-items: center; gap: 12px;
    }
    .filter-input-group { flex: 1; min-width: 150px; }
    .filter-input-group input, .filter-input-group select {
      width: 100%; padding: 10px 14px; background: var(--bg-0); border: 1px solid var(--border);
      border-radius: var(--radius-sm); color: var(--text); font-size: 0.875rem;
    }
    .filter-row-bottom {
      display: flex; flex-wrap: wrap; align-items: center; gap: 24px; padding-top: 8px; border-top: 1px dashed var(--border);
    }
    .toggle-switch-label {
      display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none;
    }
    .toggle-switch-checkbox { display: none; }
    .toggle-switch-slider {
      position: relative; width: 36px; height: 20px; background: var(--bg-0); border: 1px solid var(--border);
      border-radius: 20px; transition: 0.3s;
    }
    .toggle-switch-slider::before {
      content: ""; position: absolute; height: 14px; width: 14px; left: 2px; bottom: 2px;
      background: var(--text-dim); border-radius: 50%; transition: 0.3s;
    }
    .toggle-switch-checkbox:checked + .toggle-switch-slider { background: rgba(212, 175, 55, 0.2); border-color: var(--gold); }
    .toggle-switch-checkbox:checked + .toggle-switch-slider::before { transform: translateX(14px); background: var(--gold); }
    .toggle-switch-text { font-size: 0.8125rem; font-weight: 600; color: var(--text-dim); }
    .toggle-switch-checkbox:checked ~ .toggle-switch-text { color: var(--text); }
  </style>
`;

content = content.replace('  </style>', newCSS);

// 2. Insert HTML
const oldHTML = `        <div class="filter-controls-wide">
          <div class="date-range-group">
            <input type="date" id="admDataInicio" title="Data Inicial">
            <span>ATÉ</span>
            <input type="date" id="admDataFim" title="Data Final">
          </div>
          <button class="btn-filter-premium" onclick="carregarEntregas()" title="Filtrar">
            <i data-lucide="filter"></i>
          </button>
        </div>`;

const newHTML = `        <div class="admin-filters-grid">
          <!-- Linha 1: Filtros de Texto e Data -->
          <div class="filter-row-top">
            <div class="date-range-group">
              <input type="date" id="admDataInicio" title="Data Inicial">
              <span>ATÉ</span>
              <input type="date" id="admDataFim" title="Data Final">
            </div>
            <div class="filter-input-group">
              <input type="text" id="admFiltroCidade" placeholder="Filtrar por Cidade..." title="Cidade">
            </div>
            <div class="filter-input-group">
              <input type="text" id="admFiltroSerie" placeholder="Filtrar por Série..." title="Série">
            </div>
            <div class="filter-input-group">
              <select id="admFiltroOrdem" title="Ordenação">
                <option value="recentes">Mais Recentes</option>
                <option value="maiores">Maiores Consumidores</option>
              </select>
            </div>
            <button class="btn-filter-premium" onclick="carregarEntregas()" title="Aplicar Filtros">
              <i data-lucide="filter"></i> Buscar
            </button>
          </div>
          
          <!-- Linha 2: Switches/Checkboxes -->
          <div class="filter-row-bottom">
            <label class="toggle-switch-label">
              <input type="checkbox" id="admFiltroAcimaMedia" class="toggle-switch-checkbox">
              <span class="toggle-switch-slider"></span>
              <span class="toggle-switch-text">Apenas Entregas Além da Média Mensal</span>
            </label>
            <label class="toggle-switch-label">
              <input type="checkbox" id="admFiltroJustificados" class="toggle-switch-checkbox">
              <span class="toggle-switch-slider"></span>
              <span class="toggle-switch-text">Apenas Justificados</span>
            </label>
          </div>
        </div>`;

content = content.replace(oldHTML, newHTML);

// 3. Update JS Logic
const oldJS = `async function carregarEntregas() {
  const di = document.getElementById('admDataInicio').value;
  const df = document.getElementById('admDataFim').value;

  let params = \`status=eq.confirmado\${cidadeFilter()}&order=data_registro.desc&limit=300\`;
  params += \`&select=data_registro,quantidade_definida,media_consumo_mensal,numero_os,observacao,status,equipamento:equipamentos(serie,secretaria,cliente:clientes(nome))\`;
  if (di) params += \`&data_registro=gte.\${di}\`;
  if (df) params += \`&data_registro=lte.\${df}T23:59:59\`;

  document.getElementById('entregasTbody').innerHTML =
    '<tr><td colspan="9" class="text-center">Carregando...</td></tr>';
  try {
    const data = await API.fetch(\`/balanceamento_entregas?\${params}\`);
    const tbody = document.getElementById('entregasTbody');
    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center">Nenhum registro no período.</td></tr>';
      return;
    }
    tbody.innerHTML = data.map(e => \`
      <tr>
        <td>\${fmtData(e.data_registro)}</td>
        <td><strong>\${esc(e.equipamento?.serie || '—')}</strong></td>
        <td>\${esc(e.equipamento?.cliente?.nome || '—')}</td>
        <td>\${esc(e.equipamento?.secretaria || '—')}</td>
        <td class="text-center"><strong>\${esc(String(e.quantidade_definida || 0))}</strong></td>
        <td class="text-center">\${esc(e.media_consumo_mensal ? parseFloat(e.media_consumo_mensal).toFixed(1) : '—')}</td>
        <td>\${esc(e.numero_os || '—')}</td>
        <td style="max-width:160px;font-size:0.75rem;color:var(--text-dim)">\${esc(e.observacao || '—')}</td>
        <td>\${statusBadge(e.status)}</td>
      </tr>\`).join('');
  } catch(err) {
    document.getElementById('entregasTbody').innerHTML =
      \`<tr><td colspan="9" class="text-center" style="color:var(--danger)">Erro: \${err.message}</td></tr>\`;
  }
}`;

const newJS = `async function carregarEntregas() {
  const di = document.getElementById('admDataInicio').value;
  const df = document.getElementById('admDataFim').value;
  const fCidade = document.getElementById('admFiltroCidade').value.trim().toLowerCase();
  const fSerie = document.getElementById('admFiltroSerie').value.trim().toLowerCase();
  const fOrdem = document.getElementById('admFiltroOrdem').value;
  const fAcimaMedia = document.getElementById('admFiltroAcimaMedia').checked;
  const fJustificados = document.getElementById('admFiltroJustificados').checked;

  let params = \`status=eq.confirmado\${cidadeFilter()}&limit=1000\`;
  params += \`&select=data_registro,quantidade_definida,media_consumo_mensal,numero_os,observacao,status,equipamento:equipamentos!inner(serie,secretaria,cliente:clientes!inner(nome,cidade))\`;
  
  if (di) params += \`&data_registro=gte.\${di}\`;
  if (df) params += \`&data_registro=lte.\${df}T23:59:59\`;
  if (fSerie) params += \`&equipamento.serie=ilike.*\${encodeURIComponent(fSerie)}*\`;
  if (fCidade) params += \`&equipamento.cliente.cidade=ilike.*\${encodeURIComponent(fCidade)}*\`;

  if (fOrdem === 'recentes') {
    params += \`&order=data_registro.desc\`;
  }

  document.getElementById('entregasTbody').innerHTML = '<tr><td colspan="9" class="text-center">Carregando...</td></tr>';
  
  try {
    let data = await API.fetch(\`/balanceamento_entregas?\${params}\`);
    
    // Filtros em Memória
    if (fAcimaMedia) {
        data = data.filter(e => (parseFloat(e.quantidade_definida) || 0) > (parseFloat(e.media_consumo_mensal) || 0));
    }
    
    if (fJustificados) {
        data = data.filter(e => e.observacao && e.observacao.trim() !== '' && !e.observacao.startsWith('ANALISE_BASE'));
    }
    
    // Ordenação em Memória
    if (fOrdem === 'maiores') {
        data.sort((a, b) => (parseFloat(b.quantidade_definida) || 0) - (parseFloat(a.quantidade_definida) || 0));
    }

    const tbody = document.getElementById('entregasTbody');
    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center">Nenhum registro encontrado com estes filtros.</td></tr>';
      if (typeof lucide !== 'undefined') lucide.createIcons();
      return;
    }
    
    tbody.innerHTML = data.map(e => \`
      <tr>
        <td>\${fmtData(e.data_registro)}</td>
        <td><strong>\${esc(e.equipamento?.serie || '—')}</strong></td>
        <td>\${esc(e.equipamento?.cliente?.nome || '—')}</td>
        <td>\${esc(e.equipamento?.secretaria || '—')}</td>
        <td class="text-center"><strong>\${esc(String(e.quantidade_definida || 0))}</strong></td>
        <td class="text-center">\${esc(e.media_consumo_mensal ? parseFloat(e.media_consumo_mensal).toFixed(1) : '—')}</td>
        <td>\${esc(e.numero_os || '—')}</td>
        <td style="max-width:160px;font-size:0.75rem;color:var(--text-dim)">\${esc(e.observacao || '—')}</td>
        <td>\${statusBadge(e.status)}</td>
      </tr>\`).join('');
      
    if (typeof lucide !== 'undefined') lucide.createIcons();
  } catch(err) {
    document.getElementById('entregasTbody').innerHTML = \`<tr><td colspan="9" class="text-center" style="color:var(--danger)">Erro: \${err.message}</td></tr>\`;
  }
}`;

content = content.replace(oldJS, newJS);

// Save file
fs.writeFileSync(adminPath, content, 'utf8');
console.log('Filtros atualizados no admin.html com sucesso.');
