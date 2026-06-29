$headers = @{
    "Authorization" = "Bearer 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"
    "Content-Type" = "application/json"
    "Accept" = "application/json"
}
$body = @{
    model = "meta/llama-3.1-405b-instruct"
    messages = @(
        @{ role = "user"; content = "hi" }
    )
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "https://integrate.api.nvidia.com/v1/chat/completions" -Method Post -Headers $headers -Body $body
    $response | ConvertTo-Json -Depth 5
} catch {
    Write-Error $_.Exception.Message
    if ($_.ErrorDetails) { Write-Error $_.ErrorDetails.Message }
}
