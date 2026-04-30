<?php
header('Content-Type: application/json');

$supabaseUrl = getenv('SUPABASE_URL') ?: 'https://jvwrbrypyrwnaaqijbqm.supabase.co';
$supabaseKey = getenv('SUPABASE_KEY') ?: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2d3JicnlweXJ3bmFhcWlqYnFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NjQ3NTcsImV4cCI6MjA5MTM0MDc1N30.qNQw3VOLRVFxuXM7fESkMwPlvc6Hg5qGTVlBepzU85o';

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
    'cliente_id' => $input['cliente_id'],
    'numero_os' => $input['numero_os'],
    'media_consumo_mensal' => isset($input['media_consumo_mensal']) ? (float)$input['media_consumo_mensal'] : null,
    'opcao_entrega' => $opcaoEntrega,
    'quantidade_sugerida' => $quantidadeSugerida,
    'quantidade_definida' => (float)$input['quantidade_definida'],
    'contador_atual' => isset($input['contador_atual']) ? (int)$input['contador_atual'] : null,
    'observacao' => $input['observacao'] ?? '',
    'status' => 'confirmado'
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
    // Integração com módulo Entregas
    $resData = json_decode($response, true);
    $balanceamento = is_array($resData) ? $resData[0] : null;

    if ($balanceamento) {
        // Calcular data da próxima entrega
        $opcao = $opcaoEntrega ?? 1;
        $diasMap = [0 => 0, 1 => 30, 2 => 15, 3 => 10];
        $dias = $diasMap[$opcao] ?? 30;

        $proximaData = new DateTime();
        if ($dias > 0) {
            $proximaData->modify("+$dias days");
        }

        $entregaPayload = [
            'equipamento_id' => $input['equipamento_id'],
            'cliente_id' => $input['cliente_id'],
            'numero_os' => $input['numero_os'],
            'quantidade' => $input['quantidade_definida'],
            'data_entrega' => $proximaData->format('Y-m-d\TH:i:s.000\Z'),
            'origem' => 'balanceamento',
            'balanceamento_id' => $balanceamento['id']
        ];
        
        $urlEntrega = $supabaseUrl . '/rest/v1/entregas_papel';
        $ch2 = curl_init($urlEntrega);
        curl_setopt($ch2, CURLOPT_HTTPHEADER, [
          'apikey: ' . $supabaseKey,
          'Authorization: Bearer ' . $supabaseKey,
          'Content-Type: application/json'
        ]);
        curl_setopt($ch2, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch2, CURLOPT_POST, true);
        curl_setopt($ch2, CURLOPT_POSTFIELDS, json_encode($entregaPayload));
        curl_exec($ch2);
        curl_close($ch2);
    }
    
    echo json_encode(['success' => true]);
} else {
    echo json_encode(['success' => false, 'error' => $response]);
}
