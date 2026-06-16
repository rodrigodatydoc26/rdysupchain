const fs = require('fs');
const path = require('path');

const adminPath = path.join(__dirname, '../admin.html');
let content = fs.readFileSync(adminPath, 'utf8');

// 1. Add CSS for new tags
const newCSS = `    .tag-portal { background: rgba(59, 130, 246, 0.1); color: var(--cyan); border-color: rgba(59, 130, 246, 0.2); }
    .tag-antigo { background: rgba(156, 163, 175, 0.1); color: var(--text-dim); border-color: rgba(156, 163, 175, 0.2); }
  </style>`;
content = content.replace('  </style>', newCSS);

// 2. Add criado_por to select
content = content.replace(
  `select=id,data_registro,quantidade_definida,media_consumo_mensal,numero_os,observacao,status,equipamento`,
  `select=id,data_registro,quantidade_definida,media_consumo_mensal,numero_os,observacao,status,criado_por,equipamento`
);

// 3. Add logic in tags map
const anchor = `if ((parseFloat(e.quantidade_definida) || 0) > (parseFloat(e.media_consumo_mensal) || 0)) {
        tags += \`<span class="badge-tag tag-acima-media" title="Acima da Média"><i data-lucide="trending-up"></i></span>\`;
      }`;
      
const replacement = `if ((parseFloat(e.quantidade_definida) || 0) > (parseFloat(e.media_consumo_mensal) || 0)) {
        tags += \`<span class="badge-tag tag-acima-media" title="Acima da Média"><i data-lucide="trending-up"></i></span>\`;
      }
      if (e.criado_por === 'Portal') {
        tags += \`<span class="badge-tag tag-portal" title="Via Portal"><i data-lucide="globe"></i></span>\`;
      } else {
        tags += \`<span class="badge-tag tag-antigo" title="Sistema Antigo"><i data-lucide="archive"></i></span>\`;
      }`;
      
content = content.replace(anchor, replacement);

fs.writeFileSync(adminPath, content, 'utf8');
console.log('Admin html updated with portal flags.');
