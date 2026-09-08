import { useState, useEffect } from "react";
import { auth } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LicensesPage } from "./pages/LicensesPage";

type Page = "dashboard" | "licenses";

function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState<Page>("dashboard");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0f1117",
        color: "#71717a",
      }}>
        Cargando...
      </div>
    );
  }

  if (!user) return <LoginPage />;

  const navItems: { id: Page; label: string }[] = [
    { id: "dashboard", label: "Panel principal" },
    { id: "licenses", label: "Licencias" },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0f1117",
      color: "#e4e4e7",
      fontFamily: "system-ui, -apple-system, sans-serif",
      display: "flex",
    }}>
      {/* Sidebar */}
      <div style={{
        width: "240px",
        background: "#1a1b23",
        borderRight: "1px solid #27272a",
        padding: "24px 16px",
        display: "flex",
        flexDirection: "column",
      }}>
        <div style={{
          fontSize: "18px",
          fontWeight: 700,
          marginBottom: "32px",
          padding: "0 8px",
        }}>
          GalapaSteam
          <div style={{ fontSize: "12px", fontWeight: 400, color: "#71717a", marginTop: "4px" }}>
            Panel de administración
          </div>
        </div>

        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "10px 12px",
              marginBottom: "4px",
              background: page === item.id ? "#27272a" : "transparent",
              color: page === item.id ? "#e4e4e7" : "#a1a1aa",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: page === item.id ? 500 : 400,
            }}
          >
            {item.label}
          </button>
        ))}

        <div style={{ flex: 1 }} />

        <div style={{
          padding: "12px",
          borderTop: "1px solid #27272a",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <span style={{ fontSize: "12px", color: "#71717a" }}>
            {user.email}
          </span>
          <button
            onClick={() => signOut(auth)}
            style={{
              padding: "4px 8px",
              background: "transparent",
              color: "#f87171",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "12px",
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, padding: "32px 40px", overflow: "auto" }}>
        {page === "dashboard" && <DashboardPage />}
        {page === "licenses" && <LicensesPage />}
      </div>
    </div>
  );
}

export default App;
