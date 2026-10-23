<#
.SYNOPSIS
  Zips backend/lambdas/<Name>/ and deploys it to the Lambda function of the same name.
.EXAMPLE
  .\deploy.ps1 -Name aura-users
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$Name
)

$ErrorActionPreference = 'Stop'

$Allowed = @(
    'aura-users',
    'aura-posts',
    'aura-aura',
    'aura-groups',
    'aura-comments',
    'aura-notifications'
)

# -ccontains is case-sensitive, so 'AURA-users' is rejected too
if ($Allowed -cnotcontains $Name) {
    throw "Refusing to deploy '$Name'. Allowed: $($Allowed -join ', ')"
}

$SourceDir = Join-Path $PSScriptRoot "backend\lambdas\$Name"
if (-not (Test-Path (Join-Path $SourceDir 'index.mjs'))) {
    throw "Missing $SourceDir\index.mjs"
}

# Build the zip outside the source folder so it can never include itself
$TempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("aura-deploy-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $TempDir | Out-Null
$Zip = Join-Path $TempDir "$Name.zip"

try {
    Compress-Archive -Path (Join-Path $SourceDir '*') -DestinationPath $Zip

    Write-Host "Deploying $Name from $Zip ..."
    aws lambda update-function-code `
        --function-name $Name `
        --zip-file "fileb://$Zip" `
        --profile aura `
        --output text --query 'CodeSha256' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "update-function-code failed for $Name" }

    aws lambda wait function-updated --function-name $Name --profile aura
    if ($LASTEXITCODE -ne 0) { throw "Waiting for $Name to finish updating failed" }

    $LastModified = aws lambda get-function-configuration `
        --function-name $Name `
        --profile aura `
        --query 'LastModified' --output text
    if ($LASTEXITCODE -ne 0) { throw "get-function-configuration failed for $Name" }

    Write-Host "Deployed $Name. LastModified: $LastModified"
}
finally {
    Remove-Item -Recurse -Force $TempDir -ErrorAction SilentlyContinue
}
