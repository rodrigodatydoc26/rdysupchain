const fs = require('fs');
const path = require('path');

const adminPath = path.join(__dirname, '../admin.html');
let content = fs.readFileSync(adminPath, 'utf8');

// 1. Insert CSS for Tags
const newCSS = `
    /* ── TAGS DE SINALIZAÇÃO ── */
    .tags-container { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
    .badge-tag {
      display: inline-flex; align-items: center; justify-content: center;
      width: 26px; height: 26px; border-radius: 6px;
      background: var(--bg-2); color: var(--text-dim);
      border: 1px solid var(--border);
    }
    .badge-tag i { width: 14px; height: 14px; }
    .tag-entregue { background: rgba(16, 185, 129, 0.1); color: var(--success); border-color: rgba(16, 185, 129, 0.2); }
    .tag-acima-media { background: rgba(239, 68, 68, 0.1); color: var(--danger); border-color: rgba(239, 68, 68, 0.2); }
  </style>
`;
content = content.replace('  </style>', newCSS);

// 2. Update Table Header (tab-entregas)
const oldThead = `            <thead>
              <tr>
                <th>Data</th><th>Série</th><th>Cliente</th><th>Setor</th>
                <th class="text-center">Resmas</th><th class="text-center">Média/mês</th>
                <th>O.S.</th><th>Observação</th><th>Status</th>
              </tr>
            </thead>`;
            
const newThead = `            <thead>
              <tr>
                <th width="80" class="text-center">ID / Ato</th>
                <th>Data</th><th>Série</th><th>Cliente</th><th>Setor</th>
                <th class="text-center">Resmas</th><th class="text-center">Média/mês</th>
                <th>Sinais</th>
                <th>O.S.</th><th>Observação</th><th>Status</th>
              </tr>
            </thead>`;
content = content.replace(oldThead, newThead);

// Fix colspan in loading/error messages
content = content.replace(/colspan="9"/g, 'colspan="11"');

// Update Select string to include id
content = content.replace(
  `select=data_registro,quantidade_definida,media_consumo_mensal,numero_os,observacao,status,equipamento:equipamentos!inner(serie,secretaria,cliente:clientes!inner(nome,cidade))`,
  `select=id,data_registro,quantidade_definida,media_consumo_mensal,numero_os,observacao,status,equipamento:equipamentos!inner(serie,secretaria,cliente:clientes!inner(nome,cidade))`
);

// 3. Update carregarEntregas JS
const oldJSMapStart = `tbody.innerHTML = data.map(e => \`
      <tr>
        <td>\${fmtData(e.data_registro)}</td>`;

const newJSMapStart = `tbody.innerHTML = data.map((e) => {
      let tags = '';
      if (e.status === 'confirmado') {
        tags += \`<span class="badge-tag tag-entregue" title="Entregue"><i data-lucide="package-check"></i></span>\`;
      }
      if ((parseFloat(e.quantidade_definida) || 0) > (parseFloat(e.media_consumo_mensal) || 0)) {
        tags += \`<span class="badge-tag tag-acima-media" title="Acima da Média"><i data-lucide="trending-up"></i></span>\`;
      }
      
      // Formata o ID: Se for UUID, pega só início, senão mostra o número
      let displayId = String(e.id || '—');
      if (displayId.length > 15 && displayId.includes('-')) {
        displayId = displayId.substring(0, 6).toUpperCase();
      }
      
      return \`
      <tr>
        <td class="text-center" style="color:var(--text-dim);font-size:0.75rem;font-family:monospace;">#\${displayId}</td>
        <td>\${fmtData(e.data_registro)}</td>`;

content = content.replace(oldJSMapStart, newJSMapStart);

// Update end of JS Map
const oldJSMapEnd = `        <td>\${statusBadge(e.status)}</td>
      </tr>\`).join('');`;
      
const newJSMapEnd = `        <td>\${statusBadge(e.status)}</td>
      </tr>\`;
    }).join('');`;

content = content.replace(oldJSMapEnd, newJSMapEnd);

// Also need to inject the "Sinais" column td into the HTML string
const oldTds = `<td class="text-center">\${esc(e.media_consumo_mensal ? parseFloat(e.media_consumo_mensal).toFixed(1) : '—')}</td>
        <td>\${esc(e.numero_os || '—')}</td>`;
        
const newTds = `<td class="text-center">\${esc(e.media_consumo_mensal ? parseFloat(e.media_consumo_mensal).toFixed(1) : '—')}</td>
        <td><div class="tags-container">\${tags}</div></td>
        <td>\${esc(e.numero_os || '—')}</td>`;
        
content = content.replace(oldTds, newTds);

fs.writeFileSync(adminPath, content, 'utf8');
console.log('Admin table updated with DB ID numeration and signal tags.');
