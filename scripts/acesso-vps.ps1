[CmdletBinding(PositionalBinding = $false)]
param(
    [string]$VpsHost = '157.180.32.221',
    [string]$VpsUser = 'root',
    [string]$IdentityFile = (Join-Path $env:USERPROFILE '.ssh\cesca_vps_ed25519'),
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$RemoteCommand
)

$ErrorActionPreference = 'Stop'
if (-not (Get-Command ssh.exe -ErrorAction SilentlyContinue)) { throw 'OpenSSH Client não está instalado no Windows.' }
if (-not (Test-Path -LiteralPath $IdentityFile -PathType Leaf)) { throw "Chave SSH não encontrada em $IdentityFile." }

$arguments = @('-i', $IdentityFile, '-o', 'IdentitiesOnly=yes', '-o', 'PreferredAuthentications=publickey', '-o', 'StrictHostKeyChecking=accept-new', '-o', 'ServerAliveInterval=30', '-o', 'ServerAliveCountMax=3', "$VpsUser@$VpsHost")
if ($RemoteCommand.Count -gt 0) { $arguments += ($RemoteCommand -join ' ') }
& ssh.exe @arguments
exit $LASTEXITCODE
