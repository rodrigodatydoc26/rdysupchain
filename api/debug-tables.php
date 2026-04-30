<?php
header('Content-Type: application/json');

$supabaseUrl = getenv('SUPABASE_URL') ?: 'https://jvwrbrypyrwnaaqijbqm.supabase.co';
$supabaseKey = getenv('SUPABASE_KEY') ?: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2d3JicnlweXJ3bmFhcWlqYnFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NjQ3NTcsImV4cCI6MjA5MTM0MDc1N30.qNQw3VOLRVFxuXM7fESkMwPlvc6Hg5qGTVlBepzU85o';

$tables = ['clientes', 'equipamentos', 'balanceamento_entregas', 'ordens_servico'];
$results = [];

foreach ($tables as $table) {
    $url = $supabaseUrl . '/rest/v1/' . $table . '?select=count';
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'apikey: ' . $supabaseKey,
        'Authorization: Bearer ' . $supabaseKey,
        'Range: 0-0'
    ]);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $response = curl_exec($ch);
    $results[$table] = json_decode($response, true);
    curl_close($ch);
}

echo json_encode($results);
?>
