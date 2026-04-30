const XLSX = require('xlsx');
const path = require('path');

const SUPABASE_URL = 'https://jvwrbrypyrwnaaqijbqm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2d3JicnlweXJ3bmFhcWlqYnFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NjQ3NTcsImV4cCI6MjA5MTM0MDc1N30.qNQw3VOLRVFxuXM7fESkMwPlvc6Hg5qGTVlBepzU85o';

async function importFull() {
    const filePath = path.join(__dirname, '..', 'banco de dados', 'CONSOLIDADO_MEDIA_PAPEL (1).xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    console.log(`Lendo ${rows.length} linhas...`);

    const clientMap = new Map();

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 4 || !row[3]) continue;

        const cidade = row[0] || 'DESCONHECIDO';
        const secretaria = row[1] || 'OUTROS';
        const local = row[2] || 'LOCAL NÃO INFORMADO';
        const serie = row[3];
        const mediaResmas = parseFloat(row[10]) || 0;

        const clienteNome = `${cidade} - ${local}`;

        try {
            let clienteId;
            if (clientMap.has(clienteNome)) {
                clienteId = clientMap.get(clienteNome);
            } else {
                // Upsert cliente
                const resCli = await fetch(`${SUPABASE_URL}/rest/v1/clientes`, {
                    method: 'POST',
                    headers: { 
                        'apikey': SUPABASE_KEY, 
                        'Authorization': `Bearer ${SUPABASE_KEY}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify({ nome: clienteNome, cidade: cidade })
                });
                const cliData = await resCli.json();
                clienteId = cliData[0].id;
                clientMap.set(clienteNome, clienteId);
            }

            // Inserir equipamento
            await fetch(`${SUPABASE_URL}/rest/v1/equipamentos`, {
                method: 'POST',
                headers: { 
                    'apikey': SUPABASE_KEY, 
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    cliente_id: clienteId,
                    serie: serie,
                    secretaria: secretaria,
                    media_referencia: mediaResmas,
                    modelo: 'Não informado',
                    patrimonio: 'Não informado'
                })
            });

            if (i % 100 === 0) console.log(`Progresso: ${i}/${rows.length}...`);
        } catch (e) {
            console.error(`Erro na linha ${i}:`, e.message);
        }
    }
    console.log("Importação de Produção Concluída!");
}

importFull();
