<?php
// PHP Proxy for 2Factor / Node.js API with DEBUG LOGGING
// Handles subdirectory hosting and provides JSON error responses

$log_file = __DIR__ . '/proxy_debug.log';
function log_msg($msg)
{
    global $log_file;
    file_put_contents($log_file, "[" . date('Y-m-d H:i:s') . "] " . $msg . "\n", FILE_APPEND);
}

$path = isset($_GET['path']) ? $_GET['path'] : str_replace('/api/', '', $_SERVER['REQUEST_URI']);
$node_url = "http://127.0.0.1:3000/api/" . $path;

log_msg("Incoming request: " . $_SERVER['REQUEST_METHOD'] . " " . $_SERVER['REQUEST_URI']);
log_msg("Targeting Node URL: " . $node_url);

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $node_url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $_SERVER['REQUEST_METHOD']);
curl_setopt($ch, CURLOPT_TIMEOUT, 15);

$headers = [];
foreach (getallheaders() as $name => $value) {
    if (strtolower($name) !== 'host') {
        $headers[] = "$name: $value";
    }
}
log_msg("Headers: " . implode(", ", $headers));

curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = file_get_contents('php://input');
    log_msg("POST Body: " . $input);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $input);
}

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);

if ($error) {
    log_msg("CURL ERROR: " . $error);
    header("Content-Type: application/json", true, 503);
    echo json_encode([
        "success" => false,
        "message" => "API Gateway Error: Local server unreachable",
        "error" => $error
    ]);
} else {
    log_msg("Response Code: " . $http_code);
    log_msg("Raw Response Prefix: " . substr($response, 0, 100));
    header("Content-Type: application/json", true, $http_code);
    echo $response;
}

curl_close($ch);
?>