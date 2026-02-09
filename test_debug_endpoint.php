<?php

// Test the debug quiz generation endpoint
$ch = curl_init();

curl_setopt($ch, CURLOPT_URL, 'http://localhost:8000/debug-quiz-generate');
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
    'subject' => 'Test Subject',
    'topic' => 'Test Topic',
    'forceNew' => true
]));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Accept: application/json'
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_COOKIE, 'laravel_session=test'); // You'll need to get actual session

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo "HTTP Code: $httpCode\n";
echo "Response: $response\n";
