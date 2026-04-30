<?php
header('Content-Type: application/json');

$supabaseUrl = getenv('SUPABASE_URL') ?: 'https://iedkbtceqgrawgubxslh.supabase.co';
$supabaseKey = getenv('SUPABASE_KEY') ?: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllZGtidGNlcWdyYXdndWJ4c2xoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU2ODA2NiwiZXhwIjoyMDkzMTQ0MDY2fQ.HPd4Dx63C3_IJ2F9so0UzYKGZDE0Rnak8FRGz1ymPs0';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Apenas POST']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['equipamento_id'], $input['cliente_id'], $input['numero_os'], $input['quantidade_definida'])) {
    echo json_encode(['success' => false, 'error' => 'Dados incompletos']);
    exit;
}

$payload = [
    'equipamento_id' => $input['equipamento_id'],
    'cliente_id' => $input['cliente_id'],
    'numero_os' => $input['numero_os'],
    'media_consumo_mensal' => $input['media_consumo_mensal'],
    'opcao_entrega' => $input['opcao_entrega'],
    'quantidade_sugerida' => $input['quantidade_sugerida'],
    'quantidade_definida' => $input['quantidade_definida'],
    'observacao' => $input['observacao'] ?? '',
    'status' => 'confirmado' // Status inicial modificado para confirmado conforme fluxo
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
        $opcao = (int)$input['opcao_entrega'];
        $dias = 30; // default 1x
        if ($opcao === 2) $dias = 15;
        if ($opcao === 3) $dias = 10;
        if ($opcao === 0) $dias = 0; // Entrega manual imediata
        
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
