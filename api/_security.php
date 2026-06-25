<?php
/**
 * Helpers de segurança compartilhados entre os endpoints PHP.
 * Inclua com: require_once __DIR__ . '/_security.php';
 */

function validateUuid(string $value): bool {
    return (bool) preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $value);
}

function requireUuid(string $value, string $field = 'id'): void {
    if (!validateUuid($value)) {
        http_response_code(400);
        echo json_encode(['error' => "Parâmetro inválido: $field"]);
        exit;
    }
}

function sanitizeSearch(string $value, int $maxLen = 100): string {
    $v = trim($value);
    if (strlen($v) > $maxLen) $v = substr($v, 0, $maxLen);
    // Remove caracteres que poderiam ser usados para injeção de operadores PostgREST
    return preg_replace('/[^a-zA-Z0-9À-ÿ\s\-_.\/]/', '', $v);
}

function sanitizeDate(string $value): ?string {
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) return $value;
    return null;
}
