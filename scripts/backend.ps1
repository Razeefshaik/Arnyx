$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Join-Path $PSScriptRoot '..\backend')
& mvn -B -ntp @args
exit $LASTEXITCODE
