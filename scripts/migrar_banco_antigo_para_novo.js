/**
 * MIGRAÇÃO: Banco Antigo → Banco Novo
 * Banco antigo: jvwrbrypyrwnaaqijbqm (origem)
 * Banco novo:   iedkbtceqgrawgubxslh (destino)
 *
 * Executar: node scripts/migrar_banco_antigo_para_novo.js
 * Requer: Node.js >= 18 (fetch nativo) ou instalar node-fetch
 */

// ─── CONFIGURAÇÃO ────────────────────────────────────────────────────────────

const ANTIGO = {
  url: 'https://jvwrbrypyrwnaaqijbqm.supabase.co',
  // Substitua pela service role key do banco ANTIGO (Settings → API → service_role)
  key: 'COLE_AQUI_SERVICE_ROLE_KEY_DO_BANCO_ANTIGO'
};

const NOVO = {
  url: 'https://iedkbtceqgrawgubxslh.supabase.co',
  // Substitua pela service role key do banco NOVO
  key: 'COLE_AQUI_SERVICE_ROLE_KEY_DO_BANCO_NOVO'
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

async function ler(banco, tabela, select = '*', filtros = '') {
  const url = `${banco.url}/rest/v1/${tabela}?select=${select}${filtros}&limit=10000`;
  const res = await fetch(url, {
    headers: {
      apikey: banco.key,
      Authorization: `Bearer ${banco.key}`,
      'Content-Type': 'application/json'
    }
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`LEITURA ${tabela} falhou (${res.status}): ${txt}`);
  }
  return res.json();
}

async function inserir(banco, tabela, rows) {
  if (!rows || rows.length === 0) return { inseridos: 0 };

  // Inserir em lotes de 500 para evitar timeout
  const LOTE = 500;
  let total = 0;
  for (let i = 0; i < rows.length; i += LOTE) {
    const lote = rows.slice(i, i + LOTE);
    const res = await fetch(`${banco.url}/rest/v1/${tabela}`, {
      method: 'POST',
      headers: {
        apikey: banco.key,
        Authorization: `Bearer ${banco.key}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates,return=minimal'
      },
      body: JSON.stringify(lote)
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`INSERT ${tabela} lote ${i}-${i + LOTE} falhou (${res.status}): ${txt}`);
    }
    total += lote.length;
    console.log(`  ✓ ${tabela}: ${total}/${rows.length} inseridos`);
  }
  return { inseridos: total };
}

function ok(msg) { console.log(`\n✅ ${msg}`); }
function info(msg) { console.log(`   ${msg}`); }
function erro(msg) { console.error(`\n❌ ${msg}`); }

// ─── MIGRAÇÕES POR TABELA ────────────────────────────────────────────────────

async function migrarClientes() {
  console.log('\n── CLIENTES ─────────────────────────────────────────');
  const rows = await ler(ANTIGO, 'clientes');
  info(`Encontrados no antigo: ${rows.length}`);
  if (rows.length === 0) return;

  // Mapear campos antigos → novos (o novo tem ambos, usar como está)
  const mapped = rows.map(r => ({
    id:         r.id,
    nome:       r.nome,
    cidade:     r.cidade,
    created_at: r.created_at
  }));

  await inserir(NOVO, 'clientes', mapped);
  ok(`clientes: ${mapped.length} registros migrados`);
}

async function migrarEquipamentos() {
  console.log('\n── EQUIPAMENTOS ─────────────────────────────────────');
  const rows = await ler(ANTIGO, 'equipamentos');
  info(`Encontrados no antigo: ${rows.length}`);
  if (rows.length === 0) return;

  const mapped = rows.map(r => ({
    id:               r.id,
    cliente_id:       r.cliente_id,
    serie:            r.serie,
    patrimonio:       r.patrimonio,
    modelo:           r.modelo,
    secretaria:       r.secretaria,
    media_referencia: r.media_referencia ?? 0,
    current_counter:  r.ultimo_contador ?? r.current_counter ?? 0,
    created_at:       r.created_at
  }));

  await inserir(NOVO, 'equipamentos', mapped);
  ok(`equipamentos: ${mapped.length} registros migrados`);
}

async function migrarUsuarios() {
  console.log('\n── USUARIOS ─────────────────────────────────────────');
  const rows = await ler(ANTIGO, 'balanceamento_usuarios');
  info(`Encontrados no antigo: ${rows.length}`);
  if (rows.length === 0) return;

  await inserir(NOVO, 'balanceamento_usuarios', rows);
  ok(`balanceamento_usuarios: ${rows.length} registros migrados`);
}

async function migrarEntregas() {
  console.log('\n── BALANCEAMENTO_ENTREGAS ───────────────────────────');
  const rows = await ler(ANTIGO, 'balanceamento_entregas');
  info(`Encontrados no antigo: ${rows.length}`);
  if (rows.length === 0) return;

  const mapped = rows.map(r => ({
    id:                   r.id,
    equipamento_id:       r.equipamento_id,
    equipment_id:         r.equipamento_id, // preencher coluna nova também
    cliente_id:           r.cliente_id,
    status:               r.status ?? 'confirmado',
    quantidade_definida:  r.quantidade_definida,
    media_consumo_mensal: r.media_consumo_mensal,
    opcao_entrega:        r.opcao_entrega,
    contador_atual:       r.contador_atual,
    counter_reading:      r.contador_atual, // preencher coluna nova também
    numero_os:            r.numero_os,
    observacao:           r.observacao,
    criado_por:           r.criado_por ?? 'Migração',
    data_registro:        r.data_registro ?? r.created_at
  }));

  await inserir(NOVO, 'balanceamento_entregas', mapped);
  ok(`balanceamento_entregas: ${mapped.length} registros migrados`);
}

async function migrarOrdens() {
  console.log('\n── CTRL_OS (de ordens_servico) ──────────────────────');

  // Tentar ordens_servico (schema antigo)
  let rows = [];
  try {
    rows = await ler(ANTIGO, 'ordens_servico');
    info(`Encontrados em ordens_servico: ${rows.length}`);
  } catch (e) {
    // Tentar ctrl_os se ordens_servico não existir
    try {
      rows = await ler(ANTIGO, 'ctrl_os');
      info(`Encontrados em ctrl_os: ${rows.length}`);
    } catch (e2) {
      info('Nenhuma tabela de OS encontrada no banco antigo — pulando.');
      return;
    }
  }

  if (rows.length === 0) return;

  const mapped = rows.map(r => ({
    id:              r.id,
    equipment_id:    r.equipamento_id ?? r.equipment_id,
    os_number:       r.numero_os ?? r.os_number ?? '',
    os_date:         r.data_os ?? r.os_date ?? new Date().toISOString().slice(0, 10),
    counter_reading: r.contador_atual ?? r.counter_reading ?? 0,
    created_at:      r.created_at
  }));

  await inserir(NOVO, 'ctrl_os', mapped);
  ok(`ctrl_os: ${mapped.length} registros migrados`);
}

// ─── VERIFICAÇÃO FINAL ────────────────────────────────────────────────────────

async function verificar() {
  console.log('\n── VERIFICAÇÃO FINAL ────────────────────────────────');
  const tabelas = ['clientes', 'equipamentos', 'balanceamento_entregas', 'ctrl_os', 'balanceamento_usuarios'];
  for (const t of tabelas) {
    try {
      const rows = await ler(NOVO, t, 'id');
      info(`${t.padEnd(30)} → ${rows.length} registros`);
    } catch (e) {
      info(`${t.padEnd(30)} → ERRO: ${e.message}`);
    }
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  MIGRAÇÃO: BANCO ANTIGO → BANCO NOVO');
  console.log('  Antigo: jvwrbrypyrwnaaqijbqm');
  console.log('  Novo:   iedkbtceqgrawgubxslh');
  console.log('═══════════════════════════════════════════════════');

  if (ANTIGO.key.includes('COLE_AQUI') || NOVO.key.includes('COLE_AQUI')) {
    erro('Configure as service_role keys antes de rodar!');
    console.log('\nPara obter as keys:');
    console.log('  Supabase Dashboard → Projeto → Settings → API → service_role secret');
    process.exit(1);
  }

  try {
    // Ordem importa: clientes antes de equipamentos (FK), equipamentos antes de entregas
    await migrarClientes();
    await migrarEquipamentos();
    await migrarUsuarios();
    await migrarEntregas();
    await migrarOrdens();
    await verificar();

    console.log('\n═══════════════════════════════════════════════════');
    console.log('  MIGRAÇÃO CONCLUÍDA COM SUCESSO');
    console.log('═══════════════════════════════════════════════════\n');
  } catch (e) {
    erro(`Migração falhou: ${e.message}`);
    console.error(e);
    process.exit(1);
  }
}

main();
