const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, '../js/app.js');
let content = fs.readFileSync(appJsPath, 'utf8');

// 1. Inject functions after updateMedia()
const newFunctions = `
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
    
    let pct = (totalAtual / media) * 100;
    if (pct > 100) pct = 100;
    bar.style.width = pct + '%';
    
    if (totalAtual > media) {
        bar.classList.add('excedido');
        if (statusTxt) {
            statusTxt.className = 'status-excedido';
            statusTxt.innerText = \`\${((totalAtual/media)*100).toFixed(0)}%\`;
        }
        if (aviso) {
            aviso.classList.remove('hidden');
            const diff = (totalAtual - media).toFixed(1).replace('.0', '');
            aviso.innerHTML = \`Excedeu \${diff} resmas do consumo médio.\`;
        }
    } else {
        bar.classList.remove('excedido');
        if (statusTxt) {
            statusTxt.className = 'status-normal';
            statusTxt.innerText = 'NORMAL';
        }
        if (aviso) aviso.classList.add('hidden');
    }
}
`;

content = content.replace(
    /state\.sugestoes\[3\] = s3;\s*\}/,
    `state.sugestoes[3] = s3;\n    atualizarBarraConsumo(0);\n}\n${newFunctions}`
);

// 2. Hook into selecionarOpcao
content = content.replace(
    /updateProxima\(\);\s*\}/,
    `updateProxima();\n    atualizarBarraConsumo(qtd);\n}`
);

// 3. Hook into atualizarQtdManual
content = content.replace(
    /updateProxima\(\);\s*\}/,
    `updateProxima();\n        atualizarBarraConsumo(num);\n    }`
);

// 4. Justification rule in confirmar (normal delivery) - Note: function name was not exactly 'confirmar', let's check lines near 'Certeza que deseja entregar'
content = content.replace(
    /if \(ultimaEntregaResmas > 0 && qtd > ultimaEntregaResmas\) \{/g,
    `if ((ultimaEntregaResmas > 0 && qtd > ultimaEntregaResmas) || (calcularEntregasMes() + qtd > (state.media || 0))) {`
);

content = content.replace(
    /if \(ultimaEntregaResmas > 0 && resmas > ultimaEntregaResmas\) \{/g,
    `if ((ultimaEntregaResmas > 0 && resmas > ultimaEntregaResmas) || (calcularEntregasMes() + resmas > (state.media || 0))) {`
);

content = content.replace(
    /if \(resmas > 0 && novasResmas > resmas\) \{/g,
    `if ((resmas > 0 && novasResmas > resmas) || (calcularEntregasMes() + novasResmas > (state.media || 0))) {`
);

// Hook into analise aberta resmas change
content = content.replace(
    /document\.getElementById\('analiseLimite'\)\.innerText = '---\';\s*\}/,
    `document.getElementById('analiseLimite').innerText = '---';\n    }\n    atualizarBarraConsumo(resmas);`
);

// Hook into fechar alterar resmas
content = content.replace(
    /fecharCalcularSaldo\(true\);\s*\}/,
    `fecharCalcularSaldo(true);\n    const novasResmas = parseInt(document.getElementById('fecharResmasInput').value) || 1;\n    atualizarBarraConsumo(novasResmas);\n}`
);


fs.writeFileSync(appJsPath, content, 'utf8');
console.log('App.js updated successfully!');
