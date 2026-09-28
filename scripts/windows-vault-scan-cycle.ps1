param([string]$ProjectPath = (Split-Path $PSScriptRoot -Parent))

$ErrorActionPreference = 'Stop'
$state = Join-Path $env:ProgramData 'CLADORA\VaultScanner'
$secretFile = Join-Path $state 'worker-key.dpapi'
$logFile = Join-Path $state 'scan-events.jsonl'
$mutex = New-Object System.Threading.Mutex($false, 'Local\CLADORA_VAULT_SCANNER')
$hasLock = $false
$secret = $null
$ptr = [IntPtr]::Zero

function Write-ScanEvent([string]$outcome, [string]$code) {
  if ((Test-Path $logFile) -and (Get-Item $logFile).Length -gt 2MB) {
    Move-Item $logFile "$logFile.previous" -Force
  }
  @{ at = (Get-Date).ToUniversalTime().ToString('o'); outcome = $outcome; code = $code } |
    ConvertTo-Json -Compress | Add-Content -Path $logFile -Encoding UTF8
}

try {
  try {
    $hasLock = $mutex.WaitOne(0)
  } catch [System.Threading.AbandonedMutexException] {
    # A prior worker process exited without releasing its process-local lock.
    $hasLock = $true
  }
  if (-not $hasLock) { exit 0 }
  if (-not (Test-Path $secretFile)) { throw 'SCANNER_KEY_MISSING' }
  $secret = Get-Content $secretFile -Raw | ConvertTo-SecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
  $env:SUPABASE_SERVICE_ROLE_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  $env:SUPABASE_URL = 'https://jyomlehahwlyqzoacrvp.supabase.co'
  $env:CLAMSCAN_PATH = 'C:\Program Files\ClamAV\clamscan.exe'
  $env:FRESHCLAM_PATH = 'C:\Program Files\ClamAV\freshclam.exe'

  Push-Location $ProjectPath
  try {
    $result = & node scripts/document-clamav-worker.mjs --queue 2>$null
    if ($LASTEXITCODE -ne 0) { throw 'SCAN_QUEUE_FAILED' }
    $record = $result | ConvertFrom-Json
    if ($record.outcome -notin @('idle', 'completed', 'retry', 'dead_letter')) {
      throw 'SCAN_QUEUE_RESULT_INVALID'
    }
    Write-ScanEvent $record.outcome ([string]$record.errorCode)
    $status = & node scripts/document-clamav-worker.mjs --status 2>$null
    if ($LASTEXITCODE -ne 0) { throw 'SCAN_QUEUE_UNHEALTHY' }
    $health = $status | ConvertFrom-Json
    if ($health.healthy -ne $true) { throw 'SCAN_QUEUE_UNHEALTHY' }
    Write-Output ($record | ConvertTo-Json -Compress)
  } finally {
    Pop-Location
  }
} catch {
  # Only bounded internal error codes are written; never print secret or files.
  $code = if ($_.Exception.Message -match '^[A-Z_]{3,50}$') { $_.Exception.Message } else { 'SCAN_CYCLE_FAILED' }
  if ($hasLock) { Write-ScanEvent 'error' $code }
  Write-Error $code
  exit 1
} finally {
  Remove-Item Env:\SUPABASE_SERVICE_ROLE_KEY -ErrorAction SilentlyContinue
  if ($ptr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
  if ($secret) { $secret.Dispose() }
  if ($hasLock) { $mutex.ReleaseMutex() }
  $mutex.Dispose()
}
