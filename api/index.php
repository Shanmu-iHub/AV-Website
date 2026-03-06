<?php
// PHP Proxy for 2Factor / Node.js API
// Handles subdirectory hosting and provides JSON error responses

$path = isset($_GET['path']) ? $_GET['path'] : str_replace('/api/', '', $_SERVER['REQUEST_URI']);
$node_url = "http://127.0.0.1:3000/api/" . $path;

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

curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    curl_setopt($ch, CURLOPT_POSTFIELDS, file_get_contents('php://input'));
}

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if (curl_errno($ch)) {
    header("Content-Type: application/json", true, 503);
    echo json_encode([
        "success" => false,
        "message" => "API Gateway Error: Local server unreachable",
        "error" => curl_error($ch)
    ]);
} else {
    header("Content-Type: application/json", true, $http_code);
    echo $response;
}

curl_close($ch);
?>