using System;
using System.Threading.Tasks;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using LuaToolsGui.Services;

namespace LuaToolsGui.ViewModels;

public partial class LicenseViewModel : ObservableObject
{
    private readonly LicenseService _license;
    private readonly SettingsService _settings;

    [ObservableProperty]
    private bool _isOpen;

    [ObservableProperty]
    private string _key = "";

    [ObservableProperty]
    private bool _isValidating;

    [ObservableProperty]
    private string _error = "";

    [ObservableProperty]
    private string _successMessage = "";

    [ObservableProperty]
    private string _hwid = "";

    /// <summary>Fired after successful activation so the host can close the overlay.</summary>
    public Action? OnActivated { get; set; }

    public LicenseViewModel(LicenseService license, SettingsService settings)
    {
        _license = license;
        _settings = settings;
        _hwid = HwidService.GetHwid();
    }

    /// <summary>Check if we already have a saved license. Returns true if valid.</summary>
    public bool TryRestore()
    {
        if (_license.TryRestoreFromCache() && _license.IsValid)
        {
            return true;
        }
        return false;
    }

    [RelayCommand]
    private async Task ValidateAsync()
    {
        if (string.IsNullOrWhiteSpace(Key))
        {
            Error = "Ingresa una clave de licencia.";
            return;
        }

        IsValidating = true;
        Error = "";
        SuccessMessage = "";

        try
        {
            var result = await _license.ValidateAsync(Key);
            if (result is null)
            {
                Error = "No se pudo validar la licencia. Verifica tu conexión a internet.";
                return;
            }

            if (!result.Valid)
            {
                Error = result.Reason ?? "Clave de licencia inválida.";
                return;
            }

            SuccessMessage = $"¡Licencia activada! Plan: {result.Plan.ToUpper()}";
            await Task.Delay(1500);
            IsOpen = false;
            OnActivated?.Invoke();
        }
        catch (Exception ex)
        {
            Error = $"Error: {ex.Message}";
        }
        finally
        {
            IsValidating = false;
        }
    }
}
