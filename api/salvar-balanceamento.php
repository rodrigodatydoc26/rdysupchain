<?php
header('Content-Type: application/json');

$supabaseUrl = getenv('SUPABASE_URL') ?: 'https://iedkbtceqgrawgubxslh.supabase.co';
$supabaseKey = getenv('SUPABASE_KEY') ?: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllZGtidGNlcWdyYXdndWJ4c2xoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NjgwNjYsImV4cCI6MjA5MzE0NDA2Nn0.O29RYcYN2NOAz8pZUCa0ntBHXDEFRLmbeojpwdAArBo';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Apenas POST']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['equipamento_id'], $input['cliente_id'], $input['numero_os'], $input['quantidade_definida'])) {
    echo json_encode(['success' => false, 'error' => 'Dados incompletos']);
    exit;
}

$opcaoEntrega = isset($input['opcao_entrega']) ? (int)$input['opcao_entrega'] : null;
$quantidadeSugerida = isset($input['quantidade_sugerida']) && $input['quantidade_sugerida'] !== null
    ? (float)$input['quantidade_sugerida']
    : null;

$payload = [
    'equipamento_id' => $input['equipamento_id'],
    'cliente_id'     => $input['cliente_id'],
    'numero_os'      => $input['numero_os'],
    'media_consumo_mensal' => isset($input['media_consumo_mensal']) ? (float)$input['media_consumo_mensal'] : null,
    'opcao_entrega'  => $opcaoEntrega,
    'quantidade_sugerida' => $quantidadeSugerida,
    'quantidade_definida' => (float)$input['quantidade_definida'],
    'contador_atual' => isset($input['contador_atual']) ? (int)$input['contador_atual'] : null,
    'observacao'     => $input['observacao'] ?? '',
    'status'         => 'confirmado',
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
    echo json_encode(['success' => false, 'error' => $response]);
}
