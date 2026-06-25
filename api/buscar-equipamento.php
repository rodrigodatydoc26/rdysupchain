<?php
header('Content-Type: application/json');
require_once __DIR__ . '/_security.php';

$supabaseUrl = getenv('SUPABASE_URL') ?: 'https://iedkbtceqgrawgubxslh.supabase.co';
$supabaseKey = getenv('SUPABASE_KEY') ?: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllZGtidGNlcWdyYXdndWJ4c2xoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NjgwNjYsImV4cCI6MjA5MzE0NDA2Nn0.O29RYcYN2NOAz8pZUCa0ntBHXDEFRLmbeojpwdAArBo';

$q    = sanitizeSearch($_GET['q'] ?? '', 80);
$type = in_array($_GET['type'] ?? '', ['single', 'list']) ? $_GET['type'] : 'single';

if (strlen($q) < 3) {
    echo json_encode([]);
    exit;
}

if ($type === 'list') {
    $url = $supabaseUrl . '/rest/v1/equipamentos'
         . '?select=serie,patrimonio,secretaria,media_referencia,cliente:clientes(nome)'
         . '&or=(serie.ilike.*' . urlencode($q) . '*,patrimonio.ilike.*' . urlencode($q) . '*)'
         . '&limit=8';

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'apikey: ' . $supabaseKey,
        'Authorization: Bearer ' . $supabaseKey
    ]);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $response = curl_exec($ch);
    curl_close($ch);
    echo $response;
    exit;
}

$url = $supabaseUrl . '/rest/v1/equipamentos'
     . '?or=(serie.ilike.*' . urlencode($q) . '*,patrimonio.ilike.*' . urlencode($q) . '*)'
     . '&select=id,serie,patrimonio,modelo,secretaria,media_referencia,cliente:clientes(id,nome,cidade)&limit=1';

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
  'apikey: ' . $supabaseKey,
  'Authorization: Bearer ' . $supabaseKey
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
curl_close($ch);

$resData = json_decode($response, true);

if (is_array($resData) && count($resData) > 0) {
    $data = $resData[0];

    if ($data && validateUuid($data['id'] ?? '')) {
        // Buscar último contador em ctrl_os
        $urlOs = $supabaseUrl . '/rest/v1/ctrl_os'
               . '?equipment_id=eq.' . urlencode($data['id'])
               . '&counter_reading=gt.0'
               . '&select=counter_reading,os_date'
               . '&order=os_date.desc&limit=1';

        $chOs = curl_init($urlOs);
        curl_setopt($chOs, CURLOPT_HTTPHEADER, [
            'apikey: ' . $supabaseKey,
            'Authorization: Bearer ' . $supabaseKey
        ]);
        curl_setopt($chOs, CURLOPT_RETURNTRANSFER, true);
        $resOs = curl_exec($chOs);
        curl_close($chOs);

        $dataOs = json_decode($resOs, true);
        if (is_array($dataOs) && isset($dataOs[0]) && array_key_exists('counter_reading', $dataOs[0])) {
            $data['ultimo_contador'] = $dataOs[0]['counter_reading'];
            $data['data_ultimo_contador'] = $dataOs[0]['os_date'];
        } else {
            $data['ultimo_contador'] = $data['current_counter'] ?? 0;
            $data['data_ultimo_contador'] = null;
        }
    }

    echo json_encode($data);
} else {
    echo json_encode(['error' => 'Equipamento não encontrado']);
}
