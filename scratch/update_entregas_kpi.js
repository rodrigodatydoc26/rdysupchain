const fs = require('fs');
const path = require('path');

const adminPath = path.join(__dirname, '../admin.html');
let content = fs.readFileSync(adminPath, 'utf8');

// 1. Initialize Dates in DOMContentLoaded
const initAnchor = `document.addEventListener('DOMContentLoaded', () => {`;
const initReplacement = `document.addEventListener('DOMContentLoaded', () => {
  const hojeStr = new Date().toISOString().slice(0,10);
  document.getElementById('admDataInicio').value = hojeStr;
  document.getElementById('admDataFim').value = hojeStr;`;
content = content.replace(initAnchor, initReplacement);

// 2. Change KPI grid HTML
const kpiAnchor = `<div class="kpi-grid" style="grid-template-columns: repeat(2, 1fr); margin-bottom: 20px;">
          <div class="kpi-card">
            <span class="kpi-label">Entregas Filtradas</span>
            <span class="kpi-value" id="filtroKpiEntregas" style="color: white;">—</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Total de Resmas</span>
            <span class="kpi-value" id="filtroKpiResmas" style="color: var(--gold);">—</span>
          </div>
        </div>`;
const kpiReplacement = `<div class="kpi-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 20px;">
          <div class="kpi-card">
            <span class="kpi-label">Equipamentos</span>
            <span class="kpi-value" id="filtroKpiEquip" style="color: white;">—</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Entregas Filtradas</span>
            <span class="kpi-value" id="filtroKpiEntregas" style="color: white;">—</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">Total de Resmas</span>
            <span class="kpi-value" id="filtroKpiResmas" style="color: var(--gold);">—</span>
          </div>
        </div>`;
content = content.replace(kpiAnchor, kpiReplacement);

// 3. Update carregarEntregas JS logic
const jsAnchor = `document.getElementById('filtroKpiEntregas').innerText = data.length;
    const totalResmasFiltro = data.reduce((s, e) => s + (parseFloat(e.quantidade_definida) || 0), 0);
    document.getElementById('filtroKpiResmas').innerText = totalResmasFiltro.toLocaleString('pt-BR');`;
const jsReplacement = `const setEquips = new Set();
    data.forEach(e => {
        if (e.equipamento && e.equipamento.serie) setEquips.add(e.equipamento.serie);
    });
    document.getElementById('filtroKpiEquip').innerText = setEquips.size;
    document.getElementById('filtroKpiEntregas').innerText = data.length;
    const totalResmasFiltro = data.reduce((s, e) => s + (parseFloat(e.quantidade_definida) || 0), 0);
    document.getElementById('filtroKpiResmas').innerText = totalResmasFiltro.toLocaleString('pt-BR');`;
content = content.replace(jsAnchor, jsReplacement);

fs.writeFileSync(adminPath, content, 'utf8');
console.log('Admin KPIs updated');
