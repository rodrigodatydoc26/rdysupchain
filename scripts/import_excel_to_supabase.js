const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://iedkbtceqgrawgubxslh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllZGtidGNlcWdyYXdndWJ4c2xoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU2ODA2NiwiZXhwIjoyMDkzMTQ0MDY2fQ.HPd4Dx63C3_IJ2F9so0UzYKGZDE0Rnak8FRGz1ymPs0'; // Service role key
const supabase = createClient(supabaseUrl, supabaseKey);

const file1 = 'C:\\Users\\Rodrigo Daty\\Desktop\\balanceamento\\banco de dados\\INDAIATUBA MEDIA.xlsx';
const file2 = 'C:\\Users\\Rodrigo Daty\\Desktop\\balanceamento\\banco de dados\\LIMEIRA MEDIA DE PAPEL.xlsx';

async function migrateData() {
    let equipamentosToInsert = [];
    
    function extractIndaiatuba() {
        const workbook = xlsx.readFile(file1);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        
        for (let i = 2; i < data.length; i++) {
            const row = data[i];
            if (!row) continue;
            
            if (row[0] && row[1]) {
                equipamentosToInsert.push({ cliente: row[0], serie: row[1], modelo: 'Não informado', media: parseFloat(row[3]) || 0, secretaria: 'ADM' });
            }
            if (row[5] && row[6]) {
                equipamentosToInsert.push({ cliente: row[5], serie: row[6], modelo: 'Não informado', media: parseFloat(row[8]) || 0, secretaria: 'SAUDE' });
            }
            if (row[10] && row[11]) {
                equipamentosToInsert.push({ cliente: row[10], serie: row[11], modelo: 'Não informado', media: parseFloat(row[13]) || 0, secretaria: 'EDUCAÇÃO' });
            }
        }
    }

    function extractLimeira() {
        const workbook = xlsx.readFile(file2);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        
        for (let i = 2; i < data.length; i++) {
            const row = data[i];
            if (!row) continue;
            
            let name = '';
            for (let j = 0; j < row.length; j++) {
                const cell = row[j];
                if (typeof cell === 'string' && (cell.startsWith('BRB') || cell.startsWith('AK9'))) {
                    name = typeof row[j-1] === 'string' ? row[j-1] : 'Cliente Limeira';
                    let tempMedia = 0;
                    for (let k = j+1; k < j+5; k++) {
                        if (typeof row[k] === 'number' && row[k] < 100 && row[k] > 0) {
                            tempMedia = row[k];
                        }
                    }
                    
                    // Identificar secretaria por range de colunas em Limeira
                    let secretaria = 'OUTROS';
                    if (j < 15) secretaria = 'ADM';
                    else if (j < 25) secretaria = 'SAUDE';
                    else if (j < 35) secretaria = 'EDUC FUNDAMENTAL';
                    else secretaria = 'EDUC INFANTIL';

                    equipamentosToInsert.push({ cliente: name, serie: cell, modelo: 'Não informado', media: tempMedia, secretaria: secretaria });
                }
            }
        }
    }

    console.log("Extraindo dados das planilhas...");
    try { extractIndaiatuba(); } catch(e){ console.error("Erro lendo Indaiatuba", e.message); }
    try { extractLimeira(); } catch(e){ console.error("Erro lendo Limeira", e.message); }
    
    console.log(`Encontrados ${equipamentosToInsert.length} equipamentos. Iniciando migração para Supabase...`);

    let insertedEquips = 0;
    
    for (const eq of equipamentosToInsert) {
        if (!eq.serie || eq.serie.trim() === '') continue;
        
        // 1. Inserir ou buscar cliente
        let { data: cliente, error: errCliente } = await supabase
            .from('clientes')
            .select('id')
            .ilike('nome', eq.cliente)
            .maybeSingle();
            
        if (!cliente) {
            const res = await supabase.from('clientes').insert({ nome: eq.cliente, cidade: 'Importado' }).select().single();
            if (res.error) {
                console.error("Erro ao criar cliente:", eq.cliente, res.error.message);
                continue;
            }
            cliente = res.data;
        }

        // 2. Inserir ou buscar equipamento
        let { data: equipamento, error: errEquip } = await supabase
            .from('equipamentos')
            .select('id')
            .eq('serie', eq.serie)
            .maybeSingle();

        if (!equipamento) {
            const res = await supabase.from('equipamentos').insert({
                cliente_id: cliente.id,
                serie: eq.serie,
                modelo: eq.modelo,
                patrimonio: '',
                secretaria: eq.secretaria
            }).select().single();
            if (res.error) {
                console.error("Erro ao criar equipamento:", eq.serie, res.error.message);
                continue;
            }
            equipamento = res.data;
        }
        
        // 3. Criar histórico de consumo mockado na tabela entregas_papel se houver media > 0
        if (eq.media > 0) {
            // Verificar se já tem entregas
            const { count } = await supabase.from('entregas_papel')
                .select('*', { count: 'exact', head: true })
                .eq('equipamento_id', equipamento.id);
                
            if (count === 0) {
                let entregasMockadas = [];
                for (let m = 1; m <= 3; m++) {
                    entregasMockadas.push({
                        equipamento_id: equipamento.id,
                        cliente_id: cliente.id,
                        numero_os: `MOCK-${eq.serie}-${m}`,
                        quantidade: Math.round(eq.media),
                        data_entrega: new Date(Date.now() - m * 30 * 24 * 60 * 60 * 1000).toISOString(),
                        origem: 'importacao_excel'
                    });
                }
                const { error: errEntregas } = await supabase.from('entregas_papel').insert(entregasMockadas);
                if (errEntregas) {
                    console.error("Erro ao criar entregas mockadas:", errEntregas.message);
                }
            }
        }
        insertedEquips++;
    }
    
    console.log(`Migração concluída com sucesso! Processados ${insertedEquips} equipamentos.`);
}

migrateData();
