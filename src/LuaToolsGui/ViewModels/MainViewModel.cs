using System.Reflection;
using System.Windows;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using LuaToolsGui.Models;
using LuaToolsGui.Services;

namespace LuaToolsGui.ViewModels;

public partial class MainViewModel : ObservableObject
{
    private readonly AuthService _auth;
    private readonly SteamService _steam;
    private readonly CacheService _cache;
    private readonly UnlockerService _unlocker;
    private readonly PluginInstallerService _installer;

    /// <summary>The first-run welcome overlay VM (hosted at the window root, shown via its IsOpen).</summary>
    public OnboardingViewModel Onboarding { get; }

    /// <summary>The license activation overlay VM.</summary>
    public LicenseViewModel License { get; }

    /// <summary>App version shown in the nav pane footer, e.g. "v1.0.1". Read from the assembly.</summary>
    public string VersionLabel { get; } = $"v{ReadVersion()}";

    private static string ReadVersion()
    {
        // InformationalVersion carries the csproj <Version> (may have a "+commit" suffix. Trim it).
        var info = Assembly.GetExecutingAssembly()
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion;
        var ver = info ?? Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "?";
        int plus = ver.IndexOf('+');
        return plus >= 0 ? ver[..plus] : ver;
    }

    [ObservableProperty]
    [NotifyPropertyChangedFor(nameof(IsRealUser))]
    [NotifyPropertyChangedFor(nameof(FooterStatus))]
    private bool _isGuest = true;

    public bool IsRealUser => !IsGuest;

    /// <summary>Bottom-of-pane line: version plus auth state. No username shown (privacy).</summary>
    public string FooterStatus => $"{VersionLabel} · {(IsGuest ? Resources.Strings.Nav_Footer_Guest : Resources.Strings.Nav_Footer_LoggedIn)}";

    [ObservableProperty] private bool _isSigningIn;
    [ObservableProperty] private string? _signInError;

    public MainViewModel(AuthService auth, SteamService steam, OnboardingViewModel onboarding, LicenseViewModel license,
        CacheService cache, UnlockerService unlocker, PluginInstallerService installer)
    {
        _auth = auth;
        _steam = steam;
        Onboarding = onboarding;
        License = license;
        _cache = cache;
        _unlocker = unlocker;
        _installer = installer;
        _auth.AuthStateChanged += () => IsGuest = _auth.IsGuest;

        // After license activation, check if onboarding should show
        License.OnActivated = () =>
        {
            if (!_cache.OnboardingComplete)
            {
                bool configured =
                    _unlocker.SelectedMode is (UnlockerMode.Ost or UnlockerMode.Bst)
                    && _installer.IsInstalledLocally();
                if (configured)
                    _cache.OnboardingComplete = true;
                else
                    Onboarding.IsOpen = true;
            }
        };
    }

    public async Task InitializeAsync()
    {
        await _auth.InitializeAsync();
        IsGuest = _auth.IsGuest;
    }

    [RelayCommand]
    private async Task SignInAsync()
    {
        if (IsSigningIn) return;
        IsSigningIn = true;
        SignInError = null;
        try
        {
            await _auth.SignInAsync();
        }
        catch (Exception ex)
        {
            SignInError = ex.Message;
        }
        finally
        {
            IsSigningIn = false;
        }
    }

    /// <summary>Confirm, then kill + relaunch Steam so newly added/removed luas take effect.</summary>
    [RelayCommand]
    private void RestartSteam()
    {
        var result = MessageBox.Show(
            Resources.Strings.Main_RestartSteam_Ask,
            Resources.Strings.Manage_RestartSteam_Title,
            MessageBoxButton.OKCancel,
            MessageBoxImage.Question);
        if (result != MessageBoxResult.OK) return;

        if (!_steam.RestartSteam())
            MessageBox.Show(
                Resources.Strings.Manage_RestartSteam_Failed,
                Resources.Strings.Manage_RestartSteam_Title,
                MessageBoxButton.OK,
                MessageBoxImage.Warning);
    }
}
