<?php
header('Content-Type: application/json');
require_once __DIR__ . '/_security.php';

$supabaseUrl = getenv('SUPABASE_URL') ?: 'https://iedkbtceqgrawgubxslh.supabase.co';
$supabaseKey = getenv('SUPABASE_KEY') ?: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllZGtidGNlcWdyYXdndWJ4c2xoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NjgwNjYsImV4cCI6MjA5MzE0NDA2Nn0.O29RYcYN2NOAz8pZUCa0ntBHXDEFRLmbeojpwdAArBo';

$equipamento_id = $_GET['equipamento_id'] ?? '';
requireUuid($equipamento_id, 'equipamento_id');

$date = new DateTime();
$date->modify('-90 days');
$dataCorte = $date->format('Y-m-d\TH:i:s.000\Z');

$url = $supabaseUrl . '/rest/v1/balanceamento_entregas'
     . '?equipamento_id=eq.' . urlencode($equipamento_id)
     . '&data_registro=gte.' . urlencode($dataCorte)
     . '&status=eq.confirmado'
     . '&select=quantidade_definida,data_registro,numero_os,created_at'
     . '&order=data_registro.desc';

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
  'apikey: ' . $supabaseKey,
  'Authorization: Bearer ' . $supabaseKey
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
curl_close($ch);

$entregas = json_decode($response, true);

if (!is_array($entregas)) {
    echo json_encode(['error' => 'Erro ao buscar entregas']);
    exit;
}

$total = 0;
foreach ($entregas as $e) {
    $total += floatval($e['quantidade_definida']);
}

$media = $total / 3;
$mediaArredondada = ceil($media * 10) / 10;
$comMargem = $mediaArredondada * 1.15;

$sugestoes = [
    1 => ceil($comMargem),
    2 => ceil($comMargem / 2),
    3 => ceil($comMargem / 3)
];

echo json_encode([
    'media' => $mediaArredondada,
    'total_3m' => $total,
    'entregas_encontradas' => count($entregas),
    'sugestoes' => $sugestoes,
    'entregas' => $entregas
]);
