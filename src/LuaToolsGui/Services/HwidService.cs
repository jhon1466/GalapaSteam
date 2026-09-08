using System;
using System.Management;
using System.Security.Cryptography;
using System.Text;

namespace LuaToolsGui.Services;

/// <summary>
/// Generates a stable hardware fingerprint (HWID) for license binding.
/// Combines CPU ID, motherboard serial, and disk serial into a SHA-256 hash.
/// </summary>
public static class HwidService
{
    private static string? _cached;

    /// <summary>
    /// Returns a stable 16-char hex fingerprint for this machine.
    /// Cached after first call.
    /// </summary>
    public static string GetHwid()
    {
        if (_cached is not null) return _cached;

        var sb = new StringBuilder();

        sb.Append(GetWmiValue("Win32_Processor", "ProcessorId"));
        sb.Append(GetWmiValue("Win32_BaseBoard", "SerialNumber"));
        sb.Append(GetWmiValue("Win32_DiskDrive", "SerialNumber"));

        using var sha = SHA256.Create();
        var hash = sha.ComputeHash(Encoding.UTF8.GetBytes(sb.ToString()));
        var hex = Convert.ToHexString(hash);

        _cached = hex[..16];
        return _cached;
    }

    private static string GetWmiValue(string wmiClass, string property)
    {
        try
        {
            using var searcher = new ManagementObjectSearcher($"SELECT {property} FROM {wmiClass}");
            foreach (var obj in searcher.Get())
            {
                var val = obj[property]?.ToString();
                if (!string.IsNullOrWhiteSpace(val))
                    return val.Trim();
            }
        }
        catch { /* WMI may not be available in restricted environments */ }
        return "";
    }
}
