# ==========================================================
# Build Shopify-compliant Theme ZIP Archive
# AD PERFUMES — Luxury Theme Rebuild v3.0 (Shopify OS 2.0 Ready)
# ==========================================================
$themeDir = $PSScriptRoot

$newName = "AD-Perfumes-Luxury-Theme-v3.0-Shopify-Rebuild.zip"

$destZip = Join-Path (Split-Path $themeDir -Parent) $newName
$localZip = Join-Path $themeDir $newName
$desktopZip = [System.IO.Path]::Combine([System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop), $newName)

# Clean up any previous v3.0 zip build
@($destZip, $localZip, $desktopZip) | ForEach-Object {
    if (Test-Path $_) { Remove-Item $_ -Force }
}

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zipStream = [System.IO.File]::Open($destZip, [System.IO.FileMode]::Create)
$archive = New-Object System.IO.Compression.ZipArchive($zipStream, [System.IO.Compression.ZipArchiveMode]::Create)

$dirsToInclude = @("assets", "config", "layout", "locales", "sections", "snippets", "templates")
$fileCount = 0

foreach ($dir in $dirsToInclude) {
    $fullDir = Join-Path $themeDir $dir
    if (Test-Path $fullDir) {
        $files = Get-ChildItem -Path $fullDir -Recurse -File
        foreach ($file in $files) {
            # Compute relative path and ensure forward slashes
            $rel = $file.FullName.Substring($themeDir.Length + 1).Replace("\", "/")
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $rel, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
            $fileCount++
        }
    }
}

$archive.Dispose()
$zipStream.Dispose()

# Copy to Desktop and Workspace
Copy-Item $destZip $desktopZip -Force
Copy-Item $destZip $localZip -Force

Write-Host "=========================================================="
Write-Host " [SUCCESS] SHOPIFY THEME ZIP READY FOR UPLOAD!"
Write-Host " Theme Name:  AD PERFUMES Luxury Storefront v3.0"
Write-Host " Files packed: $fileCount theme files"
Write-Host " Output (Desktop):   $desktopZip"
Write-Host " Output (Workspace): $localZip"
Write-Host " Output (Parent):    $destZip"
Write-Host "=========================================================="

# Verification
$verify = [System.IO.Compression.ZipFile]::OpenRead($destZip)
$hasLayout = $verify.Entries | Where-Object { $_.FullName -eq "layout/theme.liquid" }
$hasIndex = $verify.Entries | Where-Object { $_.FullName -eq "templates/index.json" }
$hasSchema = $verify.Entries | Where-Object { $_.FullName -eq "config/settings_schema.json" }
$hasData = $verify.Entries | Where-Object { $_.FullName -eq "config/settings_data.json" }
$hasLocale = $verify.Entries | Where-Object { $_.FullName -eq "locales/en.default.json" }
$hasProduct = $verify.Entries | Where-Object { $_.FullName -eq "sections/product-main.liquid" }
$hasCart = $verify.Entries | Where-Object { $_.FullName -eq "sections/cart-main.liquid" }
$hasDrawer = $verify.Entries | Where-Object { $_.FullName -eq "snippets/cart-drawer.liquid" }
$hasSignature = $verify.Entries | Where-Object { $_.FullName -eq "sections/the-signature-collection.liquid" }
$hasDiscovery = $verify.Entries | Where-Object { $_.FullName -eq "sections/the-discovery-collection.liquid" }
$hasBusiness = $verify.Entries | Where-Object { $_.FullName -eq "templates/page.business.json" }

if ($hasLayout -and $hasIndex -and $hasSchema -and $hasData -and $hasLocale -and $hasProduct -and $hasCart -and $hasDrawer -and $hasSignature -and $hasDiscovery -and $hasBusiness) {
    Write-Host " [VERIFIED] All core Shopify Online Store 2.0 theme requirements present at root with standard structure."
} else {
    Write-Warning " [WARNING] Missing core Shopify theme files!"
}
$verify.Dispose()
