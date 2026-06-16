const fs = require('fs');
const path = require('path');

const adminPath = path.join(__dirname, '../admin.html');
let content = fs.readFileSync(adminPath, 'utf8');

// 1. Insert HTML
const htmlAnchor = `<div class="admin-filters-grid">`;
const newHTML = `        <div class="kpi-grid" style="grid-template-columns: repeat(2, 1fr); margin-bottom: 20px;">
          <div class="kpi-card">
            <span class="kpi-label">Entregas Filtradas</span>
            <span class="kpi-value" id="filtroKpiEntregas" style="color: white;">—</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Total de Resmas</span>
            <span class="kpi-value gold-text" id="filtroKpiResmas">—</span>
          </div>
        </div>
        <div class="admin-filters-grid">`;

content = content.replace(htmlAnchor, newHTML);

// 2. Insert JS logic
const jsAnchor = `const tbody = document.getElementById('entregasTbody');`;
const newJS = `    document.getElementById('filtroKpiEntregas').innerText = data.length;
    const totalResmasFiltro = data.reduce((s, e) => s + (parseFloat(e.quantidade_definida) || 0), 0);
    document.getElementById('filtroKpiResmas').innerText = totalResmasFiltro.toLocaleString('pt-BR');

    const tbody = document.getElementById('entregasTbody');`;

content = content.replace(jsAnchor, newJS);

// Also reset KPIs if error or no results? The text says '—'. If 0 results, data.length is 0.
// If error, let's leave it as is or reset to '—'. The update above happens before the length check, so it correctly shows 0 if no results!

fs.writeFileSync(adminPath, content, 'utf8');
console.log('KPIs adicionados ao admin.html');
