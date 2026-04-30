const XLSX = require('xlsx');
const path = require('path');

const SUPABASE_URL = 'https://iedkbtceqgrawgubxslh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllZGtidGNlcWdyYXdndWJ4c2xoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU2ODA2NiwiZXhwIjoyMDkzMTQ0MDY2fQ.HPd4Dx63C3_IJ2F9so0UzYKGZDE0Rnak8FRGz1ymPs0';

async function importData() {
    const filePath = path.join(__dirname, '..', 'banco de dados', 'CONSOLIDADO_MEDIA_PAPEL (1).xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    console.log(`Lendo ${rows.length} linhas do Excel...`);

    // Cache de clientes para evitar duplicatas e chamadas excessivas
    const clientMap = new Map();

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 4 || !row[3]) continue; // Pula se não tiver série

        const cidade = row[0] || 'DESCONHECIDO';
        const secretaria = row[1] || 'OUTROS';
        const local = row[2] || 'LOCAL NÃO INFORMADO';
        const serie = row[3];
        const mediaResmas = parseFloat(row[10]) || 0;

        const clienteNome = `${cidade} - ${local}`;

        try {
            // 1. Obter ou Criar Cliente
            let clienteId;
            if (clientMap.has(clienteNome)) {
                clienteId = clientMap.get(clienteNome);
            } else {
                const resCli = await fetch(`${SUPABASE_URL}/rest/v1/clientes?nome=eq.${encodeURIComponent(clienteNome)}&select=id`, {
                    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
                });
                const cliData = await resCli.json();
                
                if (cliData.length > 0) {
                    clienteId = cliData[0].id;
                } else {
                    const resNewCli = await fetch(`${SUPABASE_URL}/rest/v1/clientes`, {
                        method: 'POST',
                        headers: { 
                            'apikey': SUPABASE_KEY, 
                            'Authorization': `Bearer ${SUPABASE_KEY}`,
                            'Content-Type': 'application/json',
                            'Prefer': 'return=representation'
                        },
                        body: JSON.stringify({ nome: clienteNome, cidade: cidade })
                    });
                    const newCliData = await resNewCli.json();
                    clienteId = newCliData[0].id;
                }
                clientMap.set(clienteNome, clienteId);
            }

            // 2. Criar Equipamento
            // Tentamos inserir com media_referencia, se der erro removemos
            const equipPayload = {
                cliente_id: clienteId,
                serie: serie,
                secretaria: secretaria,
                modelo: 'Não informado',
                patrimonio: 'Não informado'
            };

            const resEquip = await fetch(`${SUPABASE_URL}/rest/v1/equipamentos`, {
                method: 'POST',
                headers: { 
                    'apikey': SUPABASE_KEY, 
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(equipPayload)
            });

            if (i % 50 === 0) console.log(`Progresso: ${i}/${rows.length}...`);

        } catch (e) {
            console.error(`Erro na linha ${i}:`, e.message);
        }
    }
    console.log("Importação concluída!");
}

importData();
