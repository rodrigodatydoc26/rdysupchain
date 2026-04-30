<?php
header('Content-Type: application/json');

$supabaseUrl = getenv('SUPABASE_URL') ?: 'https://iedkbtceqgrawgubxslh.supabase.co';
$supabaseKey = getenv('SUPABASE_KEY') ?: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllZGtidGNlcWdyYXdndWJ4c2xoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU2ODA2NiwiZXhwIjoyMDkzMTQ0MDY2fQ.HPd4Dx63C3_IJ2F9so0UzYKGZDE0Rnak8FRGz1ymPs0';

$url = $supabaseUrl . '/rest/v1/balanceamento_entregas'
     . '?select=*,cliente:clientes(nome),equipamento:equipamentos(serie,patrimonio,modelo)'
     . '&order=data_registro.desc';

// Adicionar filtros se existirem
if (!empty($_GET['data'])) {
    $data = $_GET['data'];
    $url .= '&data_registro=gte.' . urlencode($data . 'T00:00:00Z');
    $url .= '&data_registro=lte.' . urlencode($data . 'T23:59:59Z');
}
if (!empty($_GET['cliente'])) {
    $url .= '&cliente.nome=ilike.*' . urlencode($_GET['cliente']) . '*';
}
if (!empty($_GET['serie'])) {
    $q = $_GET['serie'];
    $url .= '&or=(equipamento.serie.ilike.*' . urlencode($q) . '*,equipamento.patrimonio.ilike.*' . urlencode($q) . '*)';
}

$url .= '&limit=50';

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
  'apikey: ' . $supabaseKey,
  'Authorization: Bearer ' . $supabaseKey
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($curlError) {
    http_response_code(503);
    echo json_encode(['error' => 'Falha ao conectar ao banco de dados']);
    exit;
}

if ($httpCode < 200 || $httpCode >= 300) {
    http_response_code($httpCode);
    echo json_encode(['error' => 'Erro ao buscar histórico', 'detalhe' => $response]);
    exit;
}

echo $response;
