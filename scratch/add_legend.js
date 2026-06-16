const fs = require('fs');
const path = require('path');

const adminPath = path.join(__dirname, '../admin.html');
let content = fs.readFileSync(adminPath, 'utf8');

// 1. Insert CSS for Legend
const cssAnchor = `    .tag-antigo { background: rgba(156, 163, 175, 0.1); color: var(--text-dim); border-color: rgba(156, 163, 175, 0.2); }`;
const cssReplacement = `    .tag-antigo { background: rgba(156, 163, 175, 0.1); color: var(--text-dim); border-color: rgba(156, 163, 175, 0.2); }
    .legend-row {
      display: flex; gap: 16px; align-items: center; margin-bottom: 16px; flex-wrap: wrap;
      background: var(--bg-1); padding: 12px 16px; border-radius: var(--radius-sm); border: 1px solid var(--border);
    }
    .legend-title { font-size: 0.75rem; font-weight: 700; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.05em; margin-right: 8px; }
    .legend-item { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; color: var(--text); }`;
    
content = content.replace(cssAnchor, cssReplacement);

// 2. Insert HTML for Legend above table
const htmlAnchor = `        <div class="table-responsive">
          <table class="data-table" id="entregasTable">`;
          
const htmlReplacement = `        <div class="legend-row">
          <span class="legend-title">Legenda de Sinais:</span>
          <div class="legend-item"><span class="badge-tag tag-entregue"><i data-lucide="package-check"></i></span> Entregue</div>
          <div class="legend-item"><span class="badge-tag tag-acima-media"><i data-lucide="trending-up"></i></span> Acima da Média Mensal</div>
          <div class="legend-item"><span class="badge-tag tag-portal"><i data-lucide="globe"></i></span> Via Novo Portal</div>
          <div class="legend-item"><span class="badge-tag tag-antigo"><i data-lucide="archive"></i></span> Via Sistema Antigo</div>
        </div>

        <div class="table-responsive">
          <table class="data-table" id="entregasTable">`;
          
content = content.replace(htmlAnchor, htmlReplacement);

fs.writeFileSync(adminPath, content, 'utf8');
console.log('Legend added to admin.html');
