<?php
header('Content-Type: application/json');
require_once __DIR__ . '/_security.php';

$supabaseUrl = getenv('SUPABASE_URL') ?: 'https://iedkbtceqgrawgubxslh.supabase.co';
$supabaseKey = getenv('SUPABASE_KEY') ?: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllZGtidGNlcWdyYXdndWJ4c2xoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NjgwNjYsImV4cCI6MjA5MzE0NDA2Nn0.O29RYcYN2NOAz8pZUCa0ntBHXDEFRLmbeojpwdAArBo';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Apenas POST']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['equipamento_id'], $input['cliente_id'], $input['numero_os'], $input['quantidade_definida'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Dados incompletos']);
    exit;
}

// Validação de UUIDs
if (!validateUuid($input['equipamento_id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'equipamento_id inválido']);
    exit;
}
if (!validateUuid($input['cliente_id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'cliente_id inválido']);
    exit;
}

// Validação de tipos numéricos
$qtd = floatval($input['quantidade_definida']);
if ($qtd <= 0 || $qtd > 9999) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'quantidade_definida fora do intervalo permitido']);
    exit;
}

$opcaoEntrega = isset($input['opcao_entrega']) ? (int)$input['opcao_entrega'] : null;
$quantidadeSugerida = isset($input['quantidade_sugerida']) && $input['quantidade_sugerida'] !== null
    ? (float)$input['quantidade_sugerida']
    : null;

$payload = [
    'equipamento_id' => $input['equipamento_id'],
    'cliente_id'     => $input['cliente_id'],
    'numero_os'      => substr(trim($input['numero_os']), 0, 50),
    'media_consumo_mensal' => isset($input['media_consumo_mensal']) ? (float)$input['media_consumo_mensal'] : null,
    'opcao_entrega'  => $opcaoEntrega,
    'quantidade_sugerida' => $quantidadeSugerida,
    'quantidade_definida' => $qtd,
    'contador_atual' => isset($input['contador_atual']) ? (int)$input['contador_atual'] : null,
    'observacao'     => substr(trim($input['observacao'] ?? ''), 0, 500),
    'status'         => 'confirmado',
    'data_registro'  => date('Y-m-d'),
    'criado_por'     => 'Sistema Original'
];

$url = $supabaseUrl . '/rest/v1/balanceamento_entregas';

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
  'apikey: ' . $supabaseKey,
  'Authorization: Bearer ' . $supabaseKey,
  'Content-Type: application/json',
  'Prefer: return=representation'
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode >= 200 && $httpCode < 300) {
    echo json_encode(['success' => true]);
} else {
    echo json_encode(['success' => false, 'error' => 'Falha ao salvar']);
}
