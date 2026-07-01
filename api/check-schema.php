<?php
header('Content-Type: application/json');
$supabaseUrl = 'https://iedkbtceqgrawgubxslh.supabase.co/rest/v1/';
$supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImllZGtidGNlcWdyYXdndWJ4c2xoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NjgwNjYsImV4cCI6MjA5MzE0NDA2Nn0.O29RYcYN2NOAz8pZUCa0ntBHXDEFRLmbeojpwdAArBo';

$opts = [
    'http' => [
        'method' => 'GET',
        'header' => "apikey: $supabaseKey\r\nAuthorization: Bearer $supabaseKey\r\n"
    ]
];
$context = stream_context_create($opts);
$response = file_get_contents($supabaseUrl, false, $context);

$data = json_decode($response, true);
$output = [
    'tables' => array_keys($data['definitions'] ?? []),
    'equipamentos' => $data['definitions']['equipamentos'] ?? null,
    'ctrl_os' => $data['definitions']['ctrl_os'] ?? null
];
echo json_encode($output, JSON_PRETTY_PRINT);
