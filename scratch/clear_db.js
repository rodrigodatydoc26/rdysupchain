const SUPABASE_URL = 'https://iedkbtceqgrawgubxslh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllZGtidGNlcWdyYXdndWJ4c2xoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU2ODA2NiwiZXhwIjoyMDkzMTQ0MDY2fQ.HPd4Dx63C3_IJ2F9so0UzYKGZDE0Rnak8FRGz1ymPs0';

const tables = ['balanceamento_entregas', 'ordens_servico', 'equipamentos', 'clientes'];

async function clearTables() {
    for (const table of tables) {
        console.log(`Limpando tabela: ${table}...`);
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
                method: 'DELETE',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (res.ok) {
                console.log(`Tabela ${table} limpa com sucesso.`);
            } else {
                const err = await res.text();
                console.error(`Erro ao limpar ${table}:`, err);
            }
        } catch (e) {
            console.error(`Erro fatal em ${table}:`, e.message);
        }
    }
}

clearTables();
