param(
  [Parameter(Mandatory = $true)][string]$Action,
  [string]$Find = "0.814759",
  [string]$Write = "10",
  [string]$Map = ""
)

$ErrorActionPreference = "Stop"
$StateFile = Join-Path $env:TEMP "stormpower-wave-addrs.txt"

Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
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
  const uint MEM_PRIVATE = 0x20000;
  const uint PAGE_READWRITE = 0x04;
  const uint PAGE_WRITECOPY = 0x08;
  const uint PAGE_EXECUTE_READWRITE = 0x40;
  const uint PAGE_EXECUTE_WRITECOPY = 0x80;
  const uint PAGE_GUARD = 0x100;

  static IntPtr _h = IntPtr.Zero;
  static int _pid = 0;
  static float _marker = 0.814759f;
  static float _boost = 10f;
  static HashSet<long> _locked = new HashSet<long>();
  static HashSet<long> _watch = new HashSet<long>();
  static string _statePath = null;

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

  static string Fmt(float f) {
    return f.ToString(CultureInfo.InvariantCulture);
  }

  static IntPtr Open(int pid) {
    return OpenProcess(PROCESS_VM_READ | PROCESS_VM_WRITE | PROCESS_VM_OPERATION | PROCESS_QUERY_INFORMATION, false, pid);
  }

  static bool EnsureOpen() {
    if (_h != IntPtr.Zero) {
      bool dead = false;
      try {
        var p = Process.GetProcessById(_pid);
        dead = p.HasExited;
      } catch { dead = true; }
      if (dead) {
        CloseHandle(_h);
        _h = IntPtr.Zero;
        _pid = 0;
        _locked.Clear();
        _watch.Clear();
      }
    }
    if (_h == IntPtr.Zero) {
      _pid = FindPid();
      if (_pid == 0) return false;
      _h = Open(_pid);
      if (_h == IntPtr.Zero) { _pid = 0; return false; }
    }
    return true;
  }

  static bool ReadFloat(long addr, out float value) {
    byte[] buf = new byte[4];
    int read;
    value = 0f;
    if (!ReadProcessMemory(_h, new IntPtr(addr), buf, 4, out read) || read != 4) return false;
    value = BitConverter.ToSingle(buf, 0);
    return true;
  }

  static bool WriteFloatAt(long addr, float value) {
    byte[] data = BitConverter.GetBytes(value);
    int written;
    return WriteProcessMemory(_h, new IntPtr(addr), data, 4, out written) && written == 4;
  }

  static bool SameBits(float a, float b) {
    return BitConverter.ToInt32(BitConverter.GetBytes(a), 0) == BitConverter.ToInt32(BitConverter.GetBytes(b), 0);
  }

  public static void SetStatePath(string path) {
    _statePath = path;
    LoadState();
  }

  static void LoadState() {
    if (_statePath == null || !File.Exists(_statePath)) return;
    try {
      foreach (var line in File.ReadAllLines(_statePath)) {
        long a;
        if (long.TryParse(line.Trim(), out a) && a > 0) _watch.Add(a);
      }
    } catch {}
  }

  static void SaveState() {
    if (_statePath == null) return;
    try {
      var all = new List<string>();
      foreach (var a in _locked) all.Add(a.ToString());
      foreach (var a in _watch) if (!_locked.Contains(a)) all.Add(a.ToString());
      File.WriteAllLines(_statePath, all);
    } catch {}
  }

  static List<long> ScanFloat(float needle, int maxHits) {
    var hits = new List<long>();
    int needleBits = BitConverter.ToInt32(BitConverter.GetBytes(needle), 0);
    IntPtr address = IntPtr.Zero;
    MEMORY_BASIC_INFORMATION mbi;
    byte[] buffer = new byte[1024 * 256];

    while (VirtualQueryEx(_h, address, out mbi, (uint)Marshal.SizeOf(typeof(MEMORY_BASIC_INFORMATION))) != 0) {
      long regionSize = (long)mbi.RegionSize;
      if (regionSize <= 0) break;

      bool candidate = mbi.State == MEM_COMMIT
        && mbi.Type == MEM_PRIVATE
        && IsWritable(mbi.Protect)
        && regionSize < 64L * 1024 * 1024;

      if (candidate) {
        long baseAddr = mbi.BaseAddress.ToInt64();
        long remaining = regionSize;
        long offset = 0;
        while (remaining > 0 && hits.Count < maxHits) {
          int toRead = (int)Math.Min(buffer.Length, remaining);
          int read;
          if (ReadProcessMemory(_h, new IntPtr(baseAddr + offset), buffer, toRead, out read) && read >= 4) {
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

  static void ScanReplace(Dictionary<float, float> map, int maxWrites, ref int hits, ref int writes) {
    var needles = new Dictionary<int, float>();
    foreach (var kv in map) needles[BitConverter.ToInt32(BitConverter.GetBytes(kv.Key), 0)] = kv.Key;

    IntPtr address = IntPtr.Zero;
    MEMORY_BASIC_INFORMATION mbi;
    byte[] buffer = new byte[1024 * 256];

    while (VirtualQueryEx(_h, address, out mbi, (uint)Marshal.SizeOf(typeof(MEMORY_BASIC_INFORMATION))) != 0) {
      long regionSize = (long)mbi.RegionSize;
      if (regionSize <= 0) break;

      bool candidate = mbi.State == MEM_COMMIT
        && mbi.Type == MEM_PRIVATE
        && IsWritable(mbi.Protect)
        && regionSize < 64L * 1024 * 1024;

      if (candidate) {
        long baseAddr = mbi.BaseAddress.ToInt64();
        long remaining = regionSize;
        long offset = 0;
        while (remaining > 0 && writes < maxWrites) {
          int toRead = (int)Math.Min(buffer.Length, remaining);
          int read;
          if (ReadProcessMemory(_h, new IntPtr(baseAddr + offset), buffer, toRead, out read) && read >= 4) {
            int end = read - 3;
            for (int i = 0; i < end; i += 4) {
              int bits = BitConverter.ToInt32(buffer, i);
              float from;
              if (!needles.TryGetValue(bits, out from)) continue;
              hits++;
              if (WriteFloatAt(baseAddr + offset + i, map[from])) {
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

  static string Err(string msg) {
    return "{\"ok\":false,\"error\":\"" + Escape(msg) + "\"}";
  }

  /// Adopt any watched slot that now holds the marker, then hold every locked slot.
  /// A locked slot that no longer holds marker/boost has been cancelled or expired:
  /// it goes back to watch-only so cancelGerstner actually sticks.
  static string DoFreeze(bool alsoScan) {
    if (!EnsureOpen()) return Err("Stormworks is not running");

    int adopted = 0, held = 0, expired = 0, scanned = 0;

    var promote = new List<long>();
    foreach (var addr in _watch) {
      float cur;
      if (!ReadFloat(addr, out cur)) continue;
      if (SameBits(cur, _marker)) promote.Add(addr);
    }
    foreach (var addr in promote) {
      if (WriteFloatAt(addr, _boost)) {
        _locked.Add(addr);
        adopted++;
      }
    }

    var drop = new List<long>();
    foreach (var addr in _locked) {
      float cur;
      if (!ReadFloat(addr, out cur)) { drop.Add(addr); continue; }
      if (SameBits(cur, _boost) || SameBits(cur, _marker)) {
        if (WriteFloatAt(addr, _boost)) held++;
        else drop.Add(addr);
      } else {
        drop.Add(addr);
      }
    }
    foreach (var addr in drop) {
      _locked.Remove(addr);
      _watch.Add(addr);
      expired++;
    }

    if (alsoScan && _locked.Count == 0) {
      var found = ScanFloat(_marker, 24);
      scanned = found.Count;
      foreach (var addr in found) {
        _watch.Add(addr);
        if (WriteFloatAt(addr, _boost)) {
          _locked.Add(addr);
          adopted++;
        }
      }
    }

    SaveState();
    bool ok = _locked.Count > 0;
    string msg = ok
      ? ("Wave locked at " + Fmt(_boost) + "x (" + _locked.Count + " slots)")
      : "No active marked tsunami";
    return "{\"ok\":" + (ok ? "true" : "false")
      + ",\"message\":\"" + Escape(msg) + "\""
      + ",\"locked\":" + _locked.Count
      + ",\"watch\":" + _watch.Count
      + ",\"adopted\":" + adopted
      + ",\"held\":" + held
      + ",\"expired\":" + expired
      + ",\"scanned\":" + scanned
      + ",\"pid\":" + _pid + "}";
  }

  /// Drop magnitude to 0 so the next spawnTsunami counts as the stronger event
  /// (the game ignores a new event that is weaker than the active one).
  static string DoRelease(bool forget) {
    if (!EnsureOpen()) return Err("Stormworks is not running");
    int released = 0;
    foreach (var addr in _locked) {
      if (WriteFloatAt(addr, 0f)) released++;
      _watch.Add(addr);
    }
    _locked.Clear();
    if (forget) _watch.Clear();
    SaveState();
    return "{\"ok\":true,\"message\":\"released " + released + " slots\",\"released\":" + released + ",\"watch\":" + _watch.Count + "}";
  }

  static string DoEngine(string map) {
    if (!EnsureOpen()) return Err("Stormworks is not running");
    var dict = new Dictionary<float, float>();
    foreach (var part in map.Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries)) {
      var kv = part.Split(':');
      if (kv.Length != 2) continue;
      float from, to;
      if (!float.TryParse(kv[0], NumberStyles.Float, CultureInfo.InvariantCulture, out from)) continue;
      if (!float.TryParse(kv[1], NumberStyles.Float, CultureInfo.InvariantCulture, out to)) continue;
      dict[from] = to;
    }
    if (dict.Count == 0) return Err("empty map");
    int hits = 0, writes = 0;
    ScanReplace(dict, 64, ref hits, ref writes);
    bool ok = writes > 0;
    string msg = ok
      ? ("Live overrev ON (" + writes + " force values patched)")
      : "No matching engine force values in RAM yet";
    return "{\"ok\":" + (ok ? "true" : "false") + ",\"message\":\"" + Escape(msg) + "\",\"hits\":" + hits + ",\"writes\":" + writes + ",\"pid\":" + _pid + "}";
  }

  /// Line protocol for daemon mode: keeps the process handle and address cache hot
  /// so freezing costs milliseconds instead of a fresh PowerShell start.
  public static string Command(string line) {
    if (line == null) return Err("empty");
    line = line.Trim();
    if (line.Length == 0) return Err("empty");

    var parts = line.Split(' ');
    string verb = parts[0].ToLowerInvariant();

    try {
      if (verb == "ping") {
        EnsureOpen();
        return "{\"ok\":true,\"pid\":" + _pid + ",\"locked\":" + _locked.Count + ",\"watch\":" + _watch.Count + ",\"boost\":" + Fmt(_boost) + "}";
      }
      if (verb == "set") {
        if (parts.Length >= 2) {
          float m;
          if (float.TryParse(parts[1], NumberStyles.Float, CultureInfo.InvariantCulture, out m)) _marker = m;
        }
        if (parts.Length >= 3) {
          float b;
          if (float.TryParse(parts[2], NumberStyles.Float, CultureInfo.InvariantCulture, out b)) _boost = b;
        }
        // Re-apply the new height to everything we already hold.
        if (EnsureOpen()) {
          foreach (var addr in _locked) WriteFloatAt(addr, _boost);
        }
        return "{\"ok\":true,\"message\":\"marker " + Fmt(_marker) + " boost " + Fmt(_boost) + "\",\"locked\":" + _locked.Count + "}";
      }
      if (verb == "freeze") return DoFreeze(false);
      if (verb == "scan") return DoFreeze(true);
      if (verb == "release") return DoRelease(false);
      if (verb == "forget") return DoRelease(true);
      if (verb == "engine") {
        string map = line.Length > 7 ? line.Substring(7).Trim() : "";
        return DoEngine(map);
      }
      return Err("unknown verb " + verb);
    } catch (Exception ex) {
      return Err(ex.Message);
    }
  }
}
"@ -Language CSharp

$culture = [System.Globalization.CultureInfo]::InvariantCulture
[SpMem]::SetStatePath($StateFile)

if ($Action -eq "daemon") {
  [Console]::Out.WriteLine('{"ok":true,"message":"daemon ready"}')
  [Console]::Out.Flush()
  while ($true) {
    $line = [Console]::In.ReadLine()
    if ($null -eq $line) { break }
    if ($line.Trim() -eq "quit") { break }
    if ($line.Trim() -eq "") { continue }
    [Console]::Out.WriteLine([SpMem]::Command($line))
    [Console]::Out.Flush()
  }
  exit 0
}

# One-shot actions (diagnostics / manual use)
if ($Action -eq "ping") { Write-Output ([SpMem]::Command("ping")); exit 0 }
if ($Action -eq "wave") {
  [SpMem]::Command("set $Find $Write") | Out-Null
  Write-Output ([SpMem]::Command("scan"))
  exit 0
}
if ($Action -eq "wave-freeze") {
  [SpMem]::Command("set $Find $Write") | Out-Null
  Write-Output ([SpMem]::Command("freeze"))
  exit 0
}
if ($Action -eq "wave-release") { Write-Output ([SpMem]::Command("release")); exit 0 }
if ($Action -eq "wave-clear") { Write-Output ([SpMem]::Command("forget")); exit 0 }
if ($Action -eq "engine") { Write-Output ([SpMem]::Command("engine $Map")); exit 0 }

Write-Output '{"ok":false,"error":"Unknown action"}'
exit 1
