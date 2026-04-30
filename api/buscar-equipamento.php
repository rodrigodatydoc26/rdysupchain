<?php
header('Content-Type: application/json');

$supabaseUrl = getenv('SUPABASE_URL') ?: 'https://iedkbtceqgrawgubxslh.supabase.co';
$supabaseKey = getenv('SUPABASE_KEY') ?: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllZGtidGNlcWdyYXdndWJ4c2xoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU2ODA2NiwiZXhwIjoyMDkzMTQ0MDY2fQ.HPd4Dx63C3_IJ2F9so0UzYKGZDE0Rnak8FRGz1ymPs0';

$q = $_GET['q'] ?? '';

if (strlen($q) < 3) {
    echo json_encode(['error' => 'Query muito curta']);
    exit;
}

$url = $supabaseUrl . '/rest/v1/equipamentos'
     . '?or=(serie.ilike.*' . urlencode($q) . '*,patrimonio.ilike.*' . urlencode($q) . '*)'
     . '&select=id,serie,patrimonio,modelo,secretaria,cliente:clientes(id,nome,cidade)&limit=1';

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
    $data = is_array($resData) ? $resData[0] : null;

    if ($data) {
        // Buscar último contador na tabela ordens_servico
        $urlOs = $supabaseUrl . '/rest/v1/ordens_servico'
               . '?equipamento_id=eq.' . urlencode($data['id'])
               . '&contador=gt.0'
               . '&select=contador,data_os'
               . '&order=data_os.desc&limit=1';
        
        $chOs = curl_init($urlOs);
        curl_setopt($chOs, CURLOPT_HTTPHEADER, [
            'apikey: ' . $supabaseKey,
            'Authorization: Bearer ' . $supabaseKey
        ]);
        curl_setopt($chOs, CURLOPT_RETURNTRANSFER, true);
        $resOs = curl_exec($chOs);
        curl_close($chOs);
        
        $dataOs = json_decode($resOs, true);
        if (is_array($dataOs) && isset($dataOs[0]) && is_array($dataOs[0]) && array_key_exists('contador', $dataOs[0])) {
            $data['ultimo_contador'] = $dataOs[0]['contador'];
            $data['data_ultimo_contador'] = $dataOs[0]['data_os'];
        } else {
            $data['ultimo_contador'] = 0;
            $data['data_ultimo_contador'] = null;
        }
    }

    echo json_encode($data);
} else {
    echo json_encode(['error' => 'Equipamento não encontrado']);
}

?>
