using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Net.Http.Json;
using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization;
using Velopack;
using Velopack.Sources;

namespace LuaToolsGui.Services;

public class UpdateService
{
    private readonly HttpClient _http = new() { Timeout = TimeSpan.FromSeconds(15) };

    private UpdateManager? _mgr;
    private UpdateInfo? _staged;

    public event Action? UpdateReady;

    public bool HasStagedUpdate => _staged is not null;
    public bool IsInstalled => _mgr?.IsInstalled ?? false;

    public string LastCheckResult { get; private set; } = "Sin verificar";
    public string? AvailableVersion { get; private set; }

    private static readonly Version CurrentVersion = GetCurrentVersion();

    public async Task CheckAndStageAsync()
    {
        try
        {
            LastCheckResult = "Buscando actualizaciones...";
            var releases = await GetReleasesAsync();
            if (releases is null || releases.Count == 0)
            {
                LastCheckResult = "No se encontraron versiones en GitHub";
                return;
            }

            var latest = releases
                .Where(r => !r.Prerelease && !r.Draft)
                .OrderByDescending(r => ParseVersion(r.TagName))
                .FirstOrDefault();

            if (latest is null)
            {
                LastCheckResult = "No hay versiones estables";
                return;
            }

            var latestVer = ParseVersion(latest.TagName);
            AvailableVersion = latest.TagName;

            if (latestVer is null || latestVer <= CurrentVersion)
            {
                LastCheckResult = $"Actualizado (v{CurrentVersion})";
                return;
            }

            LastCheckResult = $"Nueva version: {latest.TagName}. Descargando...";

            _mgr = new UpdateManager(
                new GithubSource("https://github.com/jhon1466/GalapaSteam", accessToken: null, prerelease: false));

            var info = await _mgr.CheckForUpdatesAsync();
            if (info is null)
            {
                var full = latest.Assets.FirstOrDefault(a => a.Name.EndsWith("-full.nupkg"));
                if (full is not null)
                {
                    var tmp = Path.Combine(Path.GetTempPath(), "GalapaSteamUpdate");
                    Directory.CreateDirectory(tmp);
                    var dest = Path.Combine(tmp, full.Name);
                    using (var resp = await _http.GetAsync(full.BrowserDownloadUrl))
                    {
                        resp.EnsureSuccessStatusCode();
                        using var fs = File.Create(dest);
                        await resp.Content.CopyToAsync(fs);
                    }
                    LastCheckResult = $"Descargado {full.Name}. Reinicia para aplicar.";
                }
                else
                {
                    LastCheckResult = $"Version {latest.TagName} disponible pero sin archivo .nupkg";
                }
                return;
            }

            await _mgr.DownloadUpdatesAsync(info);
            _staged = info;
            LastCheckResult = $"Descargado {latest.TagName}. Se aplica al cerrar.";
            UpdateReady?.Invoke();
        }
        catch (Exception ex)
        {
            LastCheckResult = $"Error: {ex.Message}";
            Debug.WriteLine($"[UpdateService] {ex}");
        }
    }

    public void ApplyAndRestart(string[]? restartArgs = null)
    {
        if (_mgr is not null && _staged is not null)
            _mgr.ApplyUpdatesAndRestart(_staged, restartArgs);
    }

    public void ApplyOnExit()
    {
        if (_mgr is not null && _staged is not null)
            _mgr.WaitExitThenApplyUpdates(_staged, silent: true, restart: false);
    }

    private static Version GetCurrentVersion()
    {
        var ver = Assembly.GetExecutingAssembly().GetName().Version ?? new Version(1, 0, 0);
        return new Version(ver.Major, ver.Minor, ver.Build > 0 ? ver.Build : 0);
    }

    private static Version? ParseVersion(string tag)
    {
        var v = tag.TrimStart('v', 'V');
        return Version.TryParse(v, out var ver) ? ver : null;
    }

    private async Task<List<GitHubRelease>?> GetReleasesAsync()
    {
        const string url = "https://api.github.com/repos/jhon1466/GalapaSteam/releases";
        try
        {
            using var req = new HttpRequestMessage(HttpMethod.Get, url);
            req.Headers.TryAddWithoutValidation("User-Agent", "GalapaSteam");
            var resp = await _http.SendAsync(req);
            if (!resp.IsSuccessStatusCode)
            {
                LastCheckResult = $"Error de GitHub API: {resp.StatusCode}";
                return null;
            }
            var json = await resp.Content.ReadAsStringAsync();
            return JsonSerializer.Deserialize<List<GitHubRelease>>(json);
        }
        catch (Exception ex)
        {
            LastCheckResult = $"Error de red: {ex.Message}";
            return null;
        }
    }

    private class GitHubRelease
    {
        [JsonPropertyName("tag_name")]
        public string TagName { get; set; } = "";
        [JsonPropertyName("prerelease")]
        public bool Prerelease { get; set; }
        [JsonPropertyName("draft")]
        public bool Draft { get; set; }
        [JsonPropertyName("assets")]
        public List<GitHubAsset> Assets { get; set; } = [];
    }

    private class GitHubAsset
    {
        [JsonPropertyName("name")]
        public string Name { get; set; } = "";
        [JsonPropertyName("browser_download_url")]
        public string BrowserDownloadUrl { get; set; } = "";
    }
}
