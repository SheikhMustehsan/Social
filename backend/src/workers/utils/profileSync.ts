import fs from "fs";
import path from "path";
import { execSync } from "child_process";

// Windows-specific copier that opens files using shared read/write/delete.
// This allows duplicating Chrome session databases (like Cookies) even when Chrome is actively running.
export function copyLockedFileWindows(src: string, dst: string): boolean {
  try {
    const srcResolved = path.resolve(src);
    const dstResolved = path.resolve(dst);

    // Escape backslashes for PowerShell command string
    const srcEscaped = srcResolved.replace(/\\/g, "\\\\");
    const dstEscaped = dstResolved.replace(/\\/g, "\\\\");

    const psCommand = `
      $src = '${srcEscaped}';
      $dst = '${dstEscaped}';
      try {
        $srcFile = [System.IO.File]::Open($src, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWriteDelete);
        $dstDir = [System.IO.Path]::GetDirectoryName($dst);
        if (-not (Test-Path $dstDir)) {
            [void](New-Item -ItemType Directory -Force -Path $dstDir);
        }
        $dstFile = [System.IO.File]::Open($dst, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None);
        $buffer = New-Object byte[] 65536;
        while (($bytesRead = $srcFile.Read($buffer, 0, $buffer.Length)) -gt 0) {
            $dstFile.Write($buffer, 0, $bytesRead);
        }
        $dstFile.Close();
        $srcFile.Close();
        Write-Output 'SUCCESS';
      } catch {
        Write-Error $_.Exception.Message;
        exit 1;
      }
    `;

    // Execute PowerShell command synchronously
    const output = execSync(`powershell -NoProfile -Command "${psCommand.replace(/\n/g, " ")}"`, {
      encoding: "utf-8"
    });

    return output.trim().includes("SUCCESS");
  } catch (error) {
    console.error(`[WARN] copyLockedFileWindows failed for ${src}:`, error);
    return false;
  }
}

// Recursively copy directory or file with fallback to locked copy for Windows
export function copyProfileDirectory(src: string, dst: string) {
  if (!fs.existsSync(src)) return;

  const stat = fs.statSync(src);

  if (stat.isDirectory()) {
    if (!fs.existsSync(dst)) {
      fs.mkdirSync(dst, { recursive: true });
    }

    const items = fs.readdirSync(src);
    for (const item of items) {
      // Ignore Chrome lock files
      if (["lockfile", "LOCK", "parent.lock"].includes(item) || item.endsWith(".lock") || item.endsWith(".tmp")) {
        continue;
      }
      copyProfileDirectory(path.join(src, item), path.join(dst, item));
    }
  } else {
    try {
      // Try to copy file normally
      fs.copyFileSync(src, dst);
    } catch (err) {
      // If it fails (typically due to file lock) and we are on Windows, try the locked file copier
      if (process.platform === "win32") {
        const success = copyLockedFileWindows(src, dst);
        if (success) {
          console.log(`[SUCCESS] Copied locked file via shared read: ${path.basename(src)}`);
        } else {
          console.warn(`[WARN] Failed to copy locked file: ${path.basename(src)}`);
        }
      } else {
        console.warn(`[WARN] Could not copy file ${path.basename(src)}:`, err);
      }
    }
  }
}

// Main helper to sync Chrome sessions for a specific social profile
export function syncChromeProfile(srcProfilePath: string, destProfilePath: string) {
  console.log(`🔄 Syncing Chrome session details from ${srcProfilePath} to ${destProfilePath}...`);
  
  const src = path.resolve(srcProfilePath);
  const dst = path.resolve(destProfilePath);

  // We sync the 'Network' folder (which contains Cookies database) and 'Local Storage' folder
  const foldersToSync = ["Network", "Local Storage"];

  for (const folder of foldersToSync) {
    const srcFolder = path.join(src, folder);
    const dstFolder = path.join(dst, folder);
    
    if (fs.existsSync(srcFolder)) {
      copyProfileDirectory(srcFolder, dstFolder);
    }
  }
  
  console.log(`✅ Session sync completed!`);
}
