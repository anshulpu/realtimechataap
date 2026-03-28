$ErrorActionPreference = "Stop"

$backendPath = Split-Path -Parent $PSScriptRoot
Set-Location $backendPath

$redisPort = 6379
$serverAPort = 4001
$serverBPort = 4002
$redisUrl = "redis://127.0.0.1:$redisPort"

$nodeA = $null
$nodeB = $null
$redisProc = $null
$startedRedisByScript = $false

function Stop-PortProcess([int]$port) {
  $pids = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique

  foreach ($procId in $pids) {
    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
  }
}

function Wait-Port([int]$port, [int]$timeoutSeconds = 12) {
  $deadline = (Get-Date).AddSeconds($timeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $listening = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
      Where-Object { $_.State -eq "Listen" }
    if ($listening) { return $true }
    Start-Sleep -Milliseconds 500
  }
  return $false
}

function Ensure-Redis {
  $listening = Get-NetTCPConnection -LocalPort $redisPort -ErrorAction SilentlyContinue |
    Where-Object { $_.State -eq "Listen" }

  if ($listening) {
    Write-Host "Redis already running on port $redisPort"
    return
  }

  $redisExe = "C:\Program Files\Redis\redis-server.exe"
  if (-not (Test-Path $redisExe)) {
    throw "Redis server executable not found at '$redisExe'. Install Redis first."
  }

  $redisProc = Start-Process -FilePath $redisExe -ArgumentList "--port $redisPort" -PassThru -WindowStyle Hidden
  $script:startedRedisByScript = $true

  if (-not (Wait-Port -port $redisPort -timeoutSeconds 10)) {
    throw "Redis did not start on port $redisPort"
  }

  Write-Host "Redis started by script (PID $($redisProc.Id))"
}

try {
  Write-Host "Preparing clean test ports..."
  Stop-PortProcess -port $serverAPort
  Stop-PortProcess -port $serverBPort

  Write-Host "Ensuring Redis is running..."
  Ensure-Redis

  Write-Host "Starting Server A on $serverAPort"
  $env:PORT = "$serverAPort"
  $env:REDIS_URL = $redisUrl
  $nodeA = Start-Process -FilePath node -ArgumentList "src/server.js" -PassThru -WindowStyle Hidden

  Write-Host "Starting Server B on $serverBPort"
  $env:PORT = "$serverBPort"
  $env:REDIS_URL = $redisUrl
  $nodeB = Start-Process -FilePath node -ArgumentList "src/server.js" -PassThru -WindowStyle Hidden

  if (-not (Wait-Port -port $serverAPort -timeoutSeconds 15)) {
    throw "Server A failed to listen on port $serverAPort"
  }

  if (-not (Wait-Port -port $serverBPort -timeoutSeconds 15)) {
    throw "Server B failed to listen on port $serverBPort"
  }

  Write-Host "Running multi-instance verification..."
  $env:SERVER_A = "http://localhost:$serverAPort"
  $env:SERVER_B = "http://localhost:$serverBPort"

  npm run verify:multi

  Write-Host "SUCCESS: Full multi-instance verification completed."
}
finally {
  Write-Host "Cleaning up test server processes..."
  if ($nodeA) { Stop-Process -Id $nodeA.Id -Force -ErrorAction SilentlyContinue }
  if ($nodeB) { Stop-Process -Id $nodeB.Id -Force -ErrorAction SilentlyContinue }

  if ($startedRedisByScript -and $redisProc) {
    Stop-Process -Id $redisProc.Id -Force -ErrorAction SilentlyContinue
    Write-Host "Stopped Redis process started by script."
  }
}
