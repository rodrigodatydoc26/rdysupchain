<?php
header('Content-Type: application/json');

$supabaseUrl = getenv('SUPABASE_URL') ?: 'https://iedkbtceqgrawgubxslh.supabase.co';
$supabaseKey = getenv('SUPABASE_KEY') ?: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllZGtidGNlcWdyYXdndWJ4c2xoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NjgwNjYsImV4cCI6MjA5MzE0NDA2Nn0.O29RYcYN2NOAz8pZUCa0ntBHXDEFRLmbeojpwdAArBo';

$url = $supabaseUrl . '/rest/v1/balanceamento_entregas'
     . '?select=*,cliente:clientes(nome),equipamento:equipamentos(serie,secretaria,media_referencia)'
     . '&order=data_registro.desc';

if (!empty($_GET['data_inicio'])) {
    $url .= '&data_registro=gte.' . urlencode($_GET['data_inicio'] . 'T00:00:00Z');
}
if (!empty($_GET['data_fim'])) {
    $url .= '&data_registro=lte.' . urlencode($_GET['data_fim'] . 'T23:59:59Z');
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
