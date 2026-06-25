<?php
// Endpoint de diagnóstico — acesso restrito por chave
header('Content-Type: application/json');

$secret = getenv('DEBUG_SECRET') ?: null;
$provided = $_GET['key'] ?? $_SERVER['HTTP_X_DEBUG_KEY'] ?? '';

if (!$secret || !hash_equals($secret, $provided)) {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden']);
    exit;
}

$supabaseUrl = getenv('SUPABASE_URL') ?: 'https://iedkbtceqgrawgubxslh.supabase.co';
$supabaseKey = getenv('SUPABASE_KEY') ?: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllZGtidGNlcWdyYXdndWJ4c2xoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NjgwNjYsImV4cCI6MjA5MzE0NDA2Nn0.O29RYcYN2NOAz8pZUCa0ntBHXDEFRLmbeojpwdAArBo';

$tables = ['clientes', 'equipamentos', 'balanceamento_entregas', 'ctrl_os', 'balanceamento_usuarios'];
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
