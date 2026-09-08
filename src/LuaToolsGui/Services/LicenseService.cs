using System;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace LuaToolsGui.Services;

/// <summary>
/// Validates GalapaSteam license keys against the Firebase backend.
/// </summary>
public sealed class LicenseService : IDisposable
{
    private readonly HttpClient _http = new();
    private readonly SettingsService _settings;

    // Firebase Cloud Function HTTP endpoint (validateLicenseHttp)
    private const string ValidateUrl =
        "https://us-central1-galapasteam-48065.cloudfunctions.net/validateLicenseHttp";

    private DateTime _lastCheck = DateTime.MinValue;
    private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(30);

    public LicenseService(SettingsService settings)
    {
        _settings = settings;
        _http.Timeout = TimeSpan.FromSeconds(10);
    }

    /// <summary>Current license info, or null if not activated.</summary>
    public LicenseInfo? Current { get; private set; }

    /// <summary>True if a valid license is loaded.</summary>
    public bool IsValid => Current?.Valid == true;

    /// <summary>True if the current license is premium (all games).</summary>
    public bool IsPremium => Current?.Plan == "premium";

    /// <summary>True if the current license is basic (limited games).</summary>
    public bool IsBasic => Current?.Plan == "basic";

    /// <summary>App IDs allowed by the current license (empty = all for premium).</summary>
    public int[] AllowedAppIds => Current?.AllowedAppIds ?? [];

    /// <summary>
    /// Validate a license key. Returns the license info or null on error.
    /// </summary>
    public async Task<LicenseInfo?> ValidateAsync(string key, CancellationToken ct = default)
    {
        try
        {
            var hwid = HwidService.GetHwid();
            var request = new { key = key.Trim().ToUpperInvariant(), hwid = hwid };
            var resp = await _http.PostAsJsonAsync(ValidateUrl, request, ct);
            resp.EnsureSuccessStatusCode();

            var result = await resp.Content.ReadFromJsonAsync<ValidateResponse>(ct);
            if (result is null) return null;

            var info = new LicenseInfo
            {
                Key = key.Trim().ToUpperInvariant(),
                Valid = result.Valid,
                Plan = result.Plan ?? "",
                AllowedAppIds = result.AllowedAppIds ?? [],
                ExpiresAt = DateTime.TryParse(result.ExpiresAt, out var exp) ? exp : null,
                Reason = result.Reason,
                Hwid = hwid,
            };

            if (info.Valid)
            {
                Current = info;
                _lastCheck = DateTime.UtcNow;
                SaveToLocal();
            }

            return info;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[LicenseService] Validate error: {ex.Message}");
            return null;
        }
    }

    /// <summary>
    /// Check if a specific AppID is allowed by the current license.
    /// Returns true if allowed, false if blocked.
    /// </summary>
    public bool IsAppAllowed(int appId)
    {
        if (Current is null || !Current.Valid) return false;
        if (Current.Plan == "premium") return true;
        if (Current.AllowedAppIds.Length == 0) return true; // empty = all allowed
        return Array.IndexOf(Current.AllowedAppIds, appId) >= 0;
    }

    /// <summary>
    /// Try to restore license from local settings. Returns true if restored and still cached.
    /// </summary>
    public bool TryRestoreFromCache()
    {
        var saved = _settings.GetLicense();
        if (saved is null) return false;

        Current = saved;
        return true;
    }

    /// <summary>
    /// Validate saved license against server (background refresh).
    /// </summary>
    public async Task RefreshAsync(CancellationToken ct = default)
    {
        if (Current is null || string.IsNullOrEmpty(Current.Key)) return;
        if (DateTime.UtcNow - _lastCheck < CacheDuration) return;

        await ValidateAsync(Current.Key, ct);
    }

    /// <summary>Clear the current license (sign out / deactivate).</summary>
    public void Clear()
    {
        Current = null;
        _settings.ClearLicense();
    }

    private void SaveToLocal()
    {
        if (Current is not null)
            _settings.SaveLicense(Current);
    }

    public void Dispose() => _http.Dispose();
}

/// <summary>License information returned by the backend.</summary>
public sealed class LicenseInfo
{
    public string Key { get; init; } = "";
    public bool Valid { get; init; }
    public string Plan { get; init; } = "";
    public int[] AllowedAppIds { get; init; } = [];
    public DateTime? ExpiresAt { get; init; }
    public string? Reason { get; init; }
    public string Hwid { get; init; } = "";
}

internal sealed class ValidateResponse
{
    public bool Valid { get; set; }
    public string? Plan { get; set; }
    public int[]? AllowedAppIds { get; set; }
    public string? ExpiresAt { get; set; }
    public string? Reason { get; set; }
    public string? Hwid { get; set; }
}
