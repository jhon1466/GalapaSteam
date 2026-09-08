import { useState, useEffect, type FormEvent } from "react";
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

export function LicensesPage() {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<License | null>(null);

  useEffect(() => {
    loadLicenses();
  }, []);

  async function loadLicenses() {
    setLoading(true);
    try {
      const listFn = httpsCallable(functions, "listLicenses");
      const result = await listFn({}) as { data: { licenses: License[] } };
      setLicenses(result.data.licenses);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeactivate(key: string) {
    if (!confirm(`¿Desactivar licencia ${key}?`)) return;
    try {
      const fn = httpsCallable(functions, "deactivateLicense");
      await fn({ key });
      await loadLicenses();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleToggle(key: string, currentActive: boolean) {
    try {
      const fn = httpsCallable(functions, "updateLicense");
      await fn({ key, active: !currentActive });
      await loadLicenses();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 600 }}>Licencias</h2>
        <div style={{ display: "flex", gap: "8px" }}>
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
          <button
            onClick={() => { setShowCreate(true); setEditing(null); }}
            style={{
              padding: "8px 16px",
              background: "#3b82f6",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            + Crear licencia
          </button>
        </div>
      </div>

      {(showCreate || editing) && (
        <LicenseForm
          editing={editing}
          onClose={() => { setShowCreate(false); setEditing(null); }}
          onSaved={() => { setShowCreate(false); setEditing(null); loadLicenses(); }}
        />
      )}

      {loading ? (
        <p style={{ color: "#71717a" }}>Cargando...</p>
      ) : (
        <div style={{
          background: "#1a1b23",
          border: "1px solid #27272a",
          borderRadius: "12px",
          overflow: "hidden",
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #27272a" }}>
                <th style={thStyle}>Clave</th>
                <th style={thStyle}>Plan</th>
                <th style={thStyle}>Estado</th>
                <th style={thStyle}>Juegos</th>
                <th style={thStyle}>Expira</th>
                <th style={thStyle}>Nota</th>
                <th style={thStyle}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {licenses.map((lic) => (
                <tr key={lic.key} style={{ borderBottom: "1px solid #27272a" }}>
                  <td style={tdStyle}>
                    <code style={{ color: "#3b82f6" }}>{lic.key}</code>
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: "2px 8px",
                      borderRadius: "4px",
                      fontSize: "12px",
                      fontWeight: 600,
                      background: lic.plan === "premium" ? "rgba(139,92,246,0.15)" : "rgba(245,158,11,0.15)",
                      color: lic.plan === "premium" ? "#a78bfa" : "#fbbf24",
                    }}>
                      {lic.plan}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      padding: "2px 8px",
                      borderRadius: "4px",
                      fontSize: "12px",
                      fontWeight: 600,
                      background: lic.active ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                      color: lic.active ? "#4ade80" : "#f87171",
                    }}>
                      {lic.active ? "Activa" : "Inactiva"}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    {lic.plan === "premium" ? "Todos" : lic.allowedAppIds.length}
                  </td>
                  <td style={tdStyle}>
                    {lic.expiresAt
                      ? new Date(lic.expiresAt.seconds * 1000).toLocaleDateString()
                      : "Nunca"}
                  </td>
                  <td style={tdStyle}>{lic.note || "-"}</td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        onClick={() => { setEditing(lic); setShowCreate(false); }}
                        style={actionBtn("#3b82f6")}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleToggle(lic.key, lic.active)}
                        style={actionBtn(lic.active ? "#f59e0b" : "#22c55e")}
                      >
                        {lic.active ? "Desactivar" : "Activar"}
                      </button>
                      <button
                        onClick={() => handleDeactivate(lic.key)}
                        style={actionBtn("#ef4444")}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {licenses.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ ...tdStyle, textAlign: "center", color: "#71717a", padding: "40px" }}>
                    No hay licencias aún. Crea una para comenzar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LicenseForm({
  editing,
  onClose,
  onSaved,
}: {
  editing: License | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [plan, setPlan] = useState<string>(editing?.plan ?? "basic");
  const [appIds, setAppIds] = useState(editing?.allowedAppIds?.join(", ") ?? "");
  const [note, setNote] = useState(editing?.note ?? "");
  const [expiresAt, setExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState("");

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setResult("");
    try {
      if (editing) {
        const fn = httpsCallable(functions, "updateLicense");
        const updates: Record<string, unknown> = { key: editing.key };
        updates.plan = plan;
        updates.note = note;
        if (plan === "basic") {
          updates.allowedAppIds = appIds
            .split(",")
            .map((s) => parseInt(s.trim(), 10))
            .filter((n) => !isNaN(n));
        } else {
          updates.allowedAppIds = [];
        }
        if (expiresAt) updates.expiresAt = expiresAt;
        else updates.expiresAt = null;
        await fn(updates);
      } else {
        const fn = httpsCallable(functions, "createLicense");
        const data: Record<string, unknown> = { plan, note };
        if (plan === "basic") {
          data.allowedAppIds = appIds
            .split(",")
            .map((s) => parseInt(s.trim(), 10))
            .filter((n) => !isNaN(n));
        }
        if (expiresAt) data.expiresAt = expiresAt;
        const res = await fn(data) as { data: { key: string } };
        setResult(`Creada: ${res.data.key}`);
      }
      onSaved();
    } catch (err: any) {
      setResult(err.message || "Error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      background: "#1a1b23",
      border: "1px solid #27272a",
      borderRadius: "12px",
      padding: "24px",
      marginBottom: "24px",
    }}>
      <h3 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "16px" }}>
        {editing ? `Editar ${editing.key}` : "Crear licencia"}
      </h3>

      <form onSubmit={handleSave}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
          <div>
            <label style={labelStyle}>Plan</label>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              style={inputStyle}
            >
              <option value="basic">Básico (juegos limitados)</option>
              <option value="premium">Premium (todos los juegos)</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Expira</label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        {plan === "basic" && (
          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>IDs de juegos permitidos (separados por coma)</label>
            <input
              value={appIds}
              onChange={(e) => setAppIds(e.target.value)}
              placeholder="730, 440, 570"
              style={inputStyle}
            />
          </div>
        )}

        <div style={{ marginBottom: "16px" }}>
          <label style={labelStyle}>Nota</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nombre del cliente, etc."
            style={inputStyle}
          />
        </div>

        {result && (
          <div style={{
            padding: "10px",
            borderRadius: "8px",
            fontSize: "13px",
            marginBottom: "16px",
            background: result.includes("Creada") ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
            color: result.includes("Creada") ? "#4ade80" : "#f87171",
            border: `1px solid ${result.includes("Creada") ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
          }}>
            {result}
          </div>
        )}

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: "8px 20px",
              background: saving ? "#27272a" : "#3b82f6",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: saving ? "not-allowed" : "pointer",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            {saving ? "Guardando..." : editing ? "Actualizar" : "Crear"}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 20px",
              background: "#27272a",
              color: "#a1a1aa",
              border: "1px solid #3f3f46",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 16px",
  color: "#a1a1aa",
  fontWeight: 500,
  fontSize: "12px",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 16px",
  color: "#e4e4e7",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "13px",
  fontWeight: 500,
  marginBottom: "6px",
  color: "#a1a1aa",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  background: "#0f1117",
  border: "1px solid #27272a",
  borderRadius: "8px",
  color: "#e4e4e7",
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box",
};

function actionBtn(color: string): React.CSSProperties {
  return {
    padding: "4px 10px",
    background: `${color}20`,
    color: color,
    border: `1px solid ${color}40`,
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 500,
  };
}
