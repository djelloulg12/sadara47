<#
.SYNOPSIS
  Runs the Firebase CLI with the TLS interception on this machine handled.

.DESCRIPTION
  Kaspersky inspects HTTPS on this computer and presents its own root
  certificate. Node.js does not read the Windows certificate store, so every
  call to auth.firebase.tools fails with SELF_SIGNED_CERT_IN_CHAIN. This script
  exports the intercepting roots to a PEM file, points NODE_EXTRA_CA_CERTS at
  it, and only then runs the CLI.

  It also passes --interactive for `login`: firebase-tools forces nonInteractive
  whenever stdin is not a TTY, which would otherwise abort the sign-in.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File tools/firebase.ps1 login
  powershell -ExecutionPolicy Bypass -File tools/firebase.ps1 deploy
#>
param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Args,
  # Write the certificate bundle and stop, so a doctor can reuse it.
  [switch]$ExportOnly
)

$ErrorActionPreference = 'Stop'

$Project = Split-Path -Parent $PSScriptRoot
$CaFile  = Join-Path $Project 'tools\intercept-roots.pem'
$Cli     = Join-Path $Project 'node_modules\.bin\firebase.cmd'

if (-not (Test-Path $Cli)) {
  Write-Host 'firebase-tools is not installed. Run: npm install' -ForegroundColor Yellow
  exit 1
}

# --- export any TLS-intercepting root into a PEM bundle --------------------
function Export-InterceptRoots {
  param([string]$OutFile)

  # Detect by behaviour rather than by name: ask the server what chain it is
  # presenting, and export the root that signed it. A self-signed root has
  # Subject == Issuer, so matching on subject text alone would miss it.
  $roots = @{}
  try {
    $tcp = New-Object System.Net.Sockets.TcpClient('auth.firebase.tools', 443)
    $accept = { $true }
    $callback = [System.Net.Security.RemoteCertificateValidationCallback]$accept
    $ssl = New-Object System.Net.Security.SslStream($tcp.GetStream(), $false, $callback)
    $ssl.AuthenticateAsClient('auth.firebase.tools')
    $chain = New-Object System.Security.Cryptography.X509Certificates.X509Chain
    $null = $chain.Build($ssl.RemoteCertificate)
    $chain.ChainStatus | ForEach-Object {
      Write-Host ("  chain note: " + $_.Status) -ForegroundColor DarkGray
    }
    foreach ($el in $chain.ChainElements) {
      if ($el.ChainElementStatus -and
          ($el.ChainElementStatus -join ',') -match 'PartialChain|UntrustedRoot') {
        $roots[$el.Certificate.Thumbprint] = $el.Certificate
      }
    }
    $ssl.Dispose(); $tcp.Close()
  } catch {
    Write-Host ('  could not inspect the chain: ' + $_.Exception.Message) -ForegroundColor DarkGray
  }

  # Anything already trusted locally is harmless to include, so add the roots
  # that are not part of the public set either.
  foreach ($store in 'Cert:\LocalMachine\Root', 'Cert:\CurrentUser\Root') {
    Get-ChildItem $store -ErrorAction SilentlyContinue | ForEach-Object {
      if ($_.Issuer -ne 'CN=Microsoft Root Certificate Authority 1' -and
          $_.NotAfter -gt (Get-Date)) {
        # only keep well-known inspection vendors, to stay conservative
        if ($_.Subject -match 'Kaspersky|ESET|Bitdefender|Avast|AVG|Norton|McAfee|Sophos|FireEye|CrowdStrike|Palo Alto|Fortinet|Symantec|Zscaler|Netskope') {
          $roots[$_.Thumbprint] = $_
        }
      }
    }
  }

  if ($roots.Count -eq 0) {
    if (Test-Path $OutFile) { Remove-Item $OutFile -Force }
    return 0
  }

  $pem = New-Object System.Text.StringBuilder
  foreach ($c in $roots.Values) {
    $der = $c.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
    [void]$pem.AppendLine('-----BEGIN CERTIFICATE-----')
    [void]$pem.AppendLine([Convert]::ToBase64String($der, [Base64FormattingOptions]::InsertLineBreaks))
    [void]$pem.AppendLine('-----END CERTIFICATE-----')
    [void]$pem.AppendLine()
  }
  [System.IO.File]::WriteAllText($OutFile, $pem.ToString())
  return $roots.Count
}

$count = Export-InterceptRoots -OutFile $CaFile
if ($count -gt 0) {
  Write-Host ("  TLS interception detected: exported {0} root certificate(s)" -f $count) -ForegroundColor DarkGray
  $env:NODE_EXTRA_CA_CERTS = $CaFile
} else {
  Write-Host '  no TLS interception found' -ForegroundColor DarkGray
}

if ($ExportOnly) { exit 0 }

# --- the configured project must actually exist ---------------------------
$FirebaseRc = Join-Path $Project '.firebaserc'
$Project_Id = $null
if (Test-Path $FirebaseRc) {
  try {
    $Project_Id = (Get-Content $FirebaseRc -Raw | ConvertFrom-Json).projects.default
  } catch { $Project_Id = $null }
}

if ($Project_Id) {
  # capture through a file: piping the CLI's stderr straight away trips PowerShell
  $tmp = Join-Path $env:TEMP 'opencode\fb-projects.txt'
  $old = $ErrorActionPreference
  $ErrorActionPreference = 'SilentlyContinue'
  & $Cli 'projects:list' '--json' *> $tmp
  $ErrorActionPreference = $old
  $known = if (Test-Path $tmp) { Get-Content $tmp -Raw } else { '' }
  if ($known -notmatch [regex]::Escape($Project_Id)) {
    Write-Host ''
    Write-Host ('  The project in .firebaserc does not exist: ' + $Project_Id) -ForegroundColor Yellow
    Write-Host '  Pick one of your projects, or create a new one:' -ForegroundColor Yellow
    Write-Host ''
    Write-Host '    npm run projects                     shows what you already have'
    Write-Host '    https://console.firebase.google.com  create a project'
    Write-Host ''
    Write-Host '  To switch, change the "default" line in .firebaserc.' -ForegroundColor Yellow
    Write-Host ''
    exit 2
  }
}

# --- node has to be on PATH for the CLI to run at all ---------------------
$nodeDir = 'C:\Program Files\nodejs'
if (-not ($env:PATH -like "*$nodeDir*")) { $env:PATH = "$nodeDir;$env:PATH" }

# --- login needs the interactive flag, otherwise it refuses to start ------
if ($Args -contains 'login' -and -not ($Args -contains '--interactive')) {
  $Args = @($Args) + '--interactive'
}

Write-Host ("  firebase " + ($Args -join ' ')) -ForegroundColor DarkGray
& $Cli @Args
exit $LASTEXITCODE