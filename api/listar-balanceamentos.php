<?php
header('Content-Type: application/json');

$supabaseUrl = getenv('SUPABASE_URL') ?: 'https://iedkbtceqgrawgubxslh.supabase.co';
$supabaseKey = getenv('SUPABASE_KEY') ?: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllZGtidGNlcWdyYXdndWJ4c2xoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU2ODA2NiwiZXhwIjoyMDkzMTQ0MDY2fQ.HPd4Dx63C3_IJ2F9so0UzYKGZDE0Rnak8FRGz1ymPs0';

$url = $supabaseUrl . '/rest/v1/balanceamento_entregas'
     . '?select=*,cliente:clientes(nome),equipamento:equipamentos(serie)'
     . '&order=data_registro.desc'
     . '&limit=50';

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
  'apikey: ' . $supabaseKey,
  'Authorization: Bearer ' . $supabaseKey
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
curl_close($ch);

echo $response;
