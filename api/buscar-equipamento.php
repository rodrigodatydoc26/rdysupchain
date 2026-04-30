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

$data = json_decode($response, true);

if (is_array($data) && count($data) > 0) {
    echo json_encode($data[0]);
} else {
    echo json_encode(['error' => 'Equipamento não encontrado']);
}
