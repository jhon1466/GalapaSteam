import { useState, useEffect } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

interface License {
  key: string;
  plan: "basic" | "premium";
  active: boolean;
  allowedAppIds: number[];
  note: string;
  createdAt: any;
  expiresAt: any;
}

interface Stats {
  total: number;
  active: number;
  basic: number;
  premium: number;
  expired: number;
}

export function DashboardPage() {
  const [_licenses, setLicenses] = useState<License[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    active: 0,
    basic: 0,
    premium: 0,
    expired: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLicenses();
  }, []);

  async function loadLicenses() {
    setLoading(true);
    try {
      const listFn = httpsCallable(functions, "listLicenses");
      const result = await listFn({}) as { data: { licenses: License[] } };
      const lics = result.data.licenses;
      setLicenses(lics);

      const now = new Date();
      setStats({
        total: lics.length,
        active: lics.filter((l) => l.active).length,
        basic: lics.filter((l) => l.plan === "basic").length,
        premium: lics.filter((l) => l.plan === "premium").length,
        expired: lics.filter(
          (l) => l.expiresAt && new Date(l.expiresAt.toDate()) < now
        ).length,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const cards = [
    { label: "Total", value: stats.total, color: "#6366f1" },
    { label: "Activas", value: stats.active, color: "#22c55e" },
    { label: "Básicas", value: stats.basic, color: "#f59e0b" },
    { label: "Premium", value: stats.premium, color: "#8b5cf6" },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 600 }}>Panel principal</h2>
        <button
          onClick={loadLicenses}
          style={{
            padding: "8px 16px",
            background: "#27272a",
            color: "#e4e4e7",
            border: "1px solid #3f3f46",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "13px",
          }}
        >
          Actualizar
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "32px" }}>
        {cards.map((c) => (
          <div
            key={c.label}
            style={{
              background: "#1a1b23",
              border: "1px solid #27272a",
              borderRadius: "12px",
              padding: "20px",
            }}
          >
            <div style={{ color: "#a1a1aa", fontSize: "13px", marginBottom: "8px" }}>{c.label}</div>
            <div style={{ fontSize: "32px", fontWeight: 700, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {loading && <p style={{ color: "#71717a" }}>Cargando...</p>}
    </div>
  );
}
