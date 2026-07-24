param(
  [Parameter(Mandatory = $true)][string]$Action,
  [string]$Find = "0.814759",
  [string]$Write = "40",
  [string]$Map = ""
)

$ErrorActionPreference = "Stop"
$StateFile = Join-Path $env:TEMP "stormpower-wave-addrs.txt"

Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;

public static class SpMem {
  [DllImport("kernel32.dll", SetLastError = true)]
  static extern IntPtr OpenProcess(uint dwDesiredAccess, bool bInheritHandle, int dwProcessId);

  [DllImport("kernel32.dll", SetLastError = true)]
  static extern bool CloseHandle(IntPtr hObject);

  [DllImport("kernel32.dll", SetLastError = true)]
  static extern bool ReadProcessMemory(IntPtr hProcess, IntPtr lpBaseAddress, byte[] lpBuffer, int dwSize, out int lpNumberOfBytesRead);

  [DllImport("kernel32.dll", SetLastError = true)]
  static extern bool WriteProcessMemory(IntPtr hProcess, IntPtr lpBaseAddress, byte[] lpBuffer, int nSize, out int lpNumberOfBytesWritten);

  [DllImport("kernel32.dll", SetLastError = true)]
  static extern int VirtualQueryEx(IntPtr hProcess, IntPtr lpAddress, out MEMORY_BASIC_INFORMATION lpBuffer, uint dwLength);

  [StructLayout(LayoutKind.Sequential)]
  public struct MEMORY_BASIC_INFORMATION {
    public IntPtr BaseAddress;
    public IntPtr AllocationBase;
    public uint AllocationProtect;
    public UIntPtr RegionSize;
    public uint State;
    public uint Protect;
    public uint Type;
  }

  const uint PROCESS_VM_READ = 0x0010;
  const uint PROCESS_VM_WRITE = 0x0020;
  const uint PROCESS_VM_OPERATION = 0x0008;
  const uint PROCESS_QUERY_INFORMATION = 0x0400;
  const uint MEM_COMMIT = 0x1000;
  const uint PAGE_READWRITE = 0x04;
  const uint PAGE_WRITECOPY = 0x08;
  const uint PAGE_EXECUTE_READWRITE = 0x40;
  const uint PAGE_EXECUTE_WRITECOPY = 0x80;
  const uint PAGE_GUARD = 0x100;

  static bool IsWritable(uint protect) {
    if ((protect & PAGE_GUARD) != 0) return false;
    uint p = protect & 0xFF;
    return p == PAGE_READWRITE || p == PAGE_WRITECOPY || p == PAGE_EXECUTE_READWRITE || p == PAGE_EXECUTE_WRITECOPY;
  }

  public static int FindPid() {
    foreach (var name in new[] { "stormworks64", "stormworks" }) {
      var procs = Process.GetProcessesByName(name);
      if (procs.Length > 0) return procs[0].Id;
    }
    return 0;
  }

  static string Escape(string s) {
    return s.Replace("\\", "\\\\").Replace("\"", "\\\"");
  }

  static HashSet<long> LoadAddrs(string path) {
    var set = new HashSet<long>();
    if (!File.Exists(path)) return set;
    foreach (var line in File.ReadAllLines(path)) {
      long a;
      if (long.TryParse(line.Trim(), out a) && a > 0) set.Add(a);
    }
    return set;
  }

  static void SaveAddrs(string path, HashSet<long> set) {
    var lines = new List<string>();
    foreach (var a in set) lines.Add(a.ToString());
    File.WriteAllLines(path, lines);
  }

  public static string PatchWave(float find, float write, string statePath) {
    return PatchWaveInner(find, write, statePath, true);
  }

  public static string FreezeWave(float write, string statePath) {
    return PatchWaveInner(0f, write, statePath, false);
  }

  static string PatchWaveInner(float find, float write, string statePath, bool doScan) {
    int pid = FindPid();
    if (pid == 0) return "{\"ok\":false,\"error\":\"Stormworks is not running\",\"hits\":0,\"writes\":0,\"frozen\":0}";

    IntPtr h = OpenProcess(PROCESS_VM_READ | PROCESS_VM_WRITE | PROCESS_VM_OPERATION | PROCESS_QUERY_INFORMATION, false, pid);
    if (h == IntPtr.Zero) return "{\"ok\":false,\"error\":\"OpenProcess failed - run StormPower as Administrator\",\"hits\":0,\"writes\":0,\"frozen\":0}";

    try {
      var addrs = LoadAddrs(statePath);
      int frozen = 0;
      var stillGood = new HashSet<long>();
      foreach (var addr in addrs) {
        if (WriteFloat(h, addr, write)) {
          frozen++;
          stillGood.Add(addr);
        }
      }

      int hits = 0, writes = 0;
      if (doScan) {
        var found = ScanFloat(h, find, 24);
        hits = found.Count;
        foreach (var addr in found) {
          if (WriteFloat(h, addr, write)) {
            writes++;
            stillGood.Add(addr);
          }
        }
      }
      SaveAddrs(statePath, stillGood);

      bool ok = writes > 0 || frozen > 0;
      string msg;
      if (ok) msg = "Live wave boost ON (new " + writes + ", frozen " + frozen + ", mag " + write.ToString(System.Globalization.CultureInfo.InvariantCulture) + ")";
      else msg = "Waiting for tsunami marker in RAM - turn on Massive/Ultra Waves";
      return "{\"ok\":" + (ok ? "true" : "false") + ",\"message\":\"" + Escape(msg) + "\",\"hits\":" + hits + ",\"writes\":" + writes + ",\"frozen\":" + frozen + ",\"pid\":" + pid + "}";
    } finally {
      CloseHandle(h);
    }
  }

  public static string ClearWave(string statePath) {
    try { if (File.Exists(statePath)) File.Delete(statePath); } catch {}
    return "{\"ok\":true,\"message\":\"wave address cache cleared\",\"hits\":0,\"writes\":0,\"frozen\":0}";
  }

  public static string PatchEngine(string map) {
    int pid = FindPid();
    if (pid == 0) return "{\"ok\":false,\"error\":\"Stormworks is not running\",\"hits\":0,\"writes\":0}";

    IntPtr h = OpenProcess(PROCESS_VM_READ | PROCESS_VM_WRITE | PROCESS_VM_OPERATION | PROCESS_QUERY_INFORMATION, false, pid);
    if (h == IntPtr.Zero) return "{\"ok\":false,\"error\":\"OpenProcess failed - run StormPower as Administrator\",\"hits\":0,\"writes\":0}";

    try {
      var dict = new Dictionary<float, float>();
      foreach (var part in map.Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries)) {
        var kv = part.Split(':');
        if (kv.Length != 2) continue;
        float from, to;
        if (!float.TryParse(kv[0], System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out from)) continue;
        if (!float.TryParse(kv[1], System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out to)) continue;
        dict[from] = to;
      }
      int hits = 0, writes = 0;
      ScanReplace(h, dict, 64, ref hits, ref writes);
      bool ok = writes > 0;
      string msg = ok
        ? ("Live overrev ON (" + writes + " force values patched in RAM)")
        : "No medium/large engine force values in RAM yet - enter a world / use those engines";
      return "{\"ok\":" + (ok ? "true" : "false") + ",\"message\":\"" + Escape(msg) + "\",\"hits\":" + hits + ",\"writes\":" + writes + ",\"pid\":" + pid + "}";
    } finally {
      CloseHandle(h);
    }
  }

  static List<long> ScanFloat(IntPtr hProcess, float needle, int maxHits) {
    var hits = new List<long>();
    int needleBits = BitConverter.ToInt32(BitConverter.GetBytes(needle), 0);
    IntPtr address = IntPtr.Zero;
    MEMORY_BASIC_INFORMATION mbi;
    byte[] buffer = new byte[1024 * 256];

    while (VirtualQueryEx(hProcess, address, out mbi, (uint)Marshal.SizeOf(typeof(MEMORY_BASIC_INFORMATION))) != 0) {
      long regionSize = (long)mbi.RegionSize;
      if (regionSize <= 0) break;

      if (mbi.State == MEM_COMMIT && IsWritable(mbi.Protect) && regionSize < 64L * 1024 * 1024) {
        long baseAddr = mbi.BaseAddress.ToInt64();
        long remaining = regionSize;
        long offset = 0;
        while (remaining > 0 && hits.Count < maxHits) {
          int toRead = (int)Math.Min(buffer.Length, remaining);
          int read;
          if (ReadProcessMemory(hProcess, new IntPtr(baseAddr + offset), buffer, toRead, out read) && read >= 4) {
            int end = read - 3;
            for (int i = 0; i < end; i += 4) {
              if (BitConverter.ToInt32(buffer, i) != needleBits) continue;
              hits.Add(baseAddr + offset + i);
              if (hits.Count >= maxHits) break;
            }
          }
          offset += toRead;
          remaining -= toRead;
        }
      }

      long next = mbi.BaseAddress.ToInt64() + regionSize;
      if (next <= address.ToInt64()) break;
      address = new IntPtr(next);
    }
    return hits;
  }

  static bool WriteFloat(IntPtr hProcess, long addr, float value) {
    byte[] data = BitConverter.GetBytes(value);
    int written;
    return WriteProcessMemory(hProcess, new IntPtr(addr), data, 4, out written) && written == 4;
  }

  static void ScanReplace(IntPtr hProcess, Dictionary<float, float> map, int maxWrites, ref int hits, ref int writes) {
    var needles = new Dictionary<int, float>();
    foreach (var kv in map) {
      needles[BitConverter.ToInt32(BitConverter.GetBytes(kv.Key), 0)] = kv.Key;
    }

    IntPtr address = IntPtr.Zero;
    MEMORY_BASIC_INFORMATION mbi;
    byte[] buffer = new byte[1024 * 256];

    while (VirtualQueryEx(hProcess, address, out mbi, (uint)Marshal.SizeOf(typeof(MEMORY_BASIC_INFORMATION))) != 0) {
      long regionSize = (long)mbi.RegionSize;
      if (regionSize <= 0) break;

      if (mbi.State == MEM_COMMIT && IsWritable(mbi.Protect) && regionSize < 64L * 1024 * 1024) {
        long baseAddr = mbi.BaseAddress.ToInt64();
        long remaining = regionSize;
        long offset = 0;
        while (remaining > 0 && writes < maxWrites) {
          int toRead = (int)Math.Min(buffer.Length, remaining);
          int read;
          if (ReadProcessMemory(hProcess, new IntPtr(baseAddr + offset), buffer, toRead, out read) && read >= 4) {
            int end = read - 3;
            for (int i = 0; i < end; i += 4) {
              int bits = BitConverter.ToInt32(buffer, i);
              float from;
              if (!needles.TryGetValue(bits, out from)) continue;
              hits++;
              float to = map[from];
              if (WriteFloat(hProcess, baseAddr + offset + i, to)) {
                writes++;
                if (writes >= maxWrites) break;
              }
            }
          }
          offset += toRead;
          remaining -= toRead;
        }
      }

      long next = mbi.BaseAddress.ToInt64() + regionSize;
      if (next <= address.ToInt64()) break;
      address = new IntPtr(next);
    }
  }
}
"@ -Language CSharp

$culture = [System.Globalization.CultureInfo]::InvariantCulture

if ($Action -eq "wave") {
  $findF = [float]::Parse($Find, $culture)
  $writeF = [float]::Parse($Write, $culture)
  Write-Output ([SpMem]::PatchWave($findF, $writeF, $StateFile))
  exit 0
}

if ($Action -eq "wave-freeze") {
  $writeF = [float]::Parse($Write, $culture)
  Write-Output ([SpMem]::FreezeWave($writeF, $StateFile))
  exit 0
}

if ($Action -eq "wave-clear") {
  Write-Output ([SpMem]::ClearWave($StateFile))
  exit 0
}

if ($Action -eq "engine") {
  if ([string]::IsNullOrWhiteSpace($Map)) {
    Write-Output '{"ok":false,"error":"Map required"}'
    exit 1
  }
  Write-Output ([SpMem]::PatchEngine($Map))
  exit 0
}

if ($Action -eq "ping") {
  $swPid = [SpMem]::FindPid()
  Write-Output ("{`"ok`":true,`"pid`":$swPid,`"message`":`"helper ready`"}")
  exit 0
}

Write-Output '{"ok":false,"error":"Unknown action"}'
exit 1
