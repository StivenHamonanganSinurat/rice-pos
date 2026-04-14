<?php
require_once 'config.php';
$stmt = $pdo->query("SELECT id, username, role FROM users");
echo json_encode($stmt->fetchAll(), JSON_PRETTY_PRINT);
?>
