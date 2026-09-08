using System.Windows.Controls;

namespace LuaToolsGui.Views;

/// <summary>
/// License activation overlay. DataContext is <see cref="ViewModels.LicenseViewModel"/>.
/// Visibility is controlled by the host in MainWindow via License.IsOpen.
/// </summary>
public partial class LicenseView : UserControl
{
    public LicenseView() => InitializeComponent();
}
