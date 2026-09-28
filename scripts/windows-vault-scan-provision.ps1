# Run once in an elevated PowerShell session as the Windows account that will
# own and run the scheduled task. The secret is never stored as plain text.
$ErrorActionPreference = 'Stop'
$state = Join-Path $env:ProgramData 'CLADORA\VaultScanner'
$secretFile = Join-Path $state 'worker-key.dpapi'
$accountSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value

if (-not (Test-Path 'C:\Program Files\ClamAV\clamscan.exe') -or
    -not (Test-Path 'C:\Program Files\ClamAV\freshclam.exe') -or
    -not (Test-Path (Join-Path $PSScriptRoot 'document-clamav-worker.mjs'))) {
  throw 'SCANNER_RUNTIME_MISSING'
}
New-Item -ItemType Directory -Path $state -Force | Out-Null
& icacls $state /inheritance:r /grant:r "*${accountSid}:(OI)(CI)F" /grant:r '*S-1-5-18:(OI)(CI)F' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'SCANNER_DIRECTORY_ACL_FAILED' }

$secret = Read-Host 'CLADORA worker secret key (never paste into chat)' -AsSecureString
try {
  if (-not $secret -or $secret.Length -lt 20) { throw 'SCANNER_KEY_INVALID' }
  $encrypted = ConvertFrom-SecureString -SecureString $secret
  [System.IO.File]::WriteAllText($secretFile, $encrypted)
  & icacls $secretFile /inheritance:r /grant:r "*${accountSid}:F" /grant:r '*S-1-5-18:F' | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'SCANNER_SECRET_ACL_FAILED' }
} catch {
  Remove-Item $secretFile -ErrorAction SilentlyContinue
  throw
} finally {
  if ($secret) { $secret.Dispose() }
}
Write-Output 'Scanner key encrypted for this Windows account and protected by file ACL.'
