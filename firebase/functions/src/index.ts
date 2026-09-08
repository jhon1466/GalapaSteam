import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

// ── Helpers ──────────────────────────────────────────────────────────────

function generateKey(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const segment = () =>
    Array.from({ length: 4 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join("");
  return `GS-${segment()}-${segment()}-${segment()}`;
}

async function assertAdmin(uid: string): Promise<void> {
  const snap = await db.doc("admins/config").get();
  if (!snap.exists) {
    throw new functions.https.HttpsError("permission-denied", "Admin config not found.");
  }
  const uids = snap.data()!.uids as string[];
  if (!uids.includes(uid)) {
    throw new functions.https.HttpsError("permission-denied", "Not an admin.");
  }
}

// ── validateLicense ──────────────────────────────────────────────────────

export const validateLicense = functions.https.onCall(async (data, context) => {
  const key = (data?.key as string)?.trim().toUpperCase();
  if (!key || !/^GS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key)) {
    throw new functions.https.HttpsError("invalid-argument", "Formato de clave inválido.");
  }

  const hwid = (data?.hwid as string)?.trim() ?? "";

  const snap = await db.doc(`licenses/${key}`).get();
  if (!snap.exists) {
    return { valid: false, reason: "Licencia no encontrada." };
  }

  const lic = snap.data()!;
  if (!lic.active) {
    return { valid: false, reason: "La licencia está desactivada." };
  }

  if (lic.expiresAt && lic.expiresAt.toDate() < new Date()) {
    return { valid: false, reason: "La licencia ha expirado." };
  }

  // HWID binding
  if (hwid) {
    const storedHwid = (lic.hwid as string) ?? "";
    if (storedHwid && storedHwid !== hwid) {
      return { valid: false, reason: "La licencia está vinculada a otro equipo." };
    }
    if (!storedHwid) {
      await db.doc(`licenses/${key}`).update({ hwid });
    }
  }

  return {
    valid: true,
    plan: lic.plan,
    allowedAppIds: lic.allowedAppIds ?? [],
    expiresAt: lic.expiresAt?.toDate().toISOString() ?? null,
    hwid: (lic.hwid as string) ?? hwid ?? "",
  };
});

// ── createLicense ────────────────────────────────────────────────────────

export const createLicense = functions.https.onCall(async (data, context) => {
  if (!context?.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be signed in.");
  }
  await assertAdmin(context.auth.uid);

  const plan = data?.plan as string;
  if (plan !== "basic" && plan !== "premium") {
    throw new functions.https.HttpsError("invalid-argument", "Plan must be 'basic' or 'premium'.");
  }

  const key = generateKey();
  const allowedAppIds: number[] = plan === "basic" ? (data?.allowedAppIds ?? []) : [];
  const note: string = data?.note ?? "";
  const expiresAt = data?.expiresAt
    ? admin.firestore.Timestamp.fromDate(new Date(data.expiresAt))
    : null;

  await db.doc(`licenses/${key}`).set({
    key,
    plan,
    active: true,
    allowedAppIds,
    note,
    hwid: null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt,
  });

  return { key, plan, allowedAppIds };
});

// ── updateLicense ────────────────────────────────────────────────────────

export const updateLicense = functions.https.onCall(async (data, context) => {
  if (!context?.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be signed in.");
  }
  await assertAdmin(context.auth.uid);

  const key = (data?.key as string)?.trim().toUpperCase();
  if (!key) {
    throw new functions.https.HttpsError("invalid-argument", "Key is required.");
  }

  const updates: Record<string, unknown> = {};
  if (data.plan !== undefined) updates.plan = data.plan;
  if (data.active !== undefined) updates.active = data.active;
  if (data.allowedAppIds !== undefined) updates.allowedAppIds = data.allowedAppIds;
  if (data.note !== undefined) updates.note = data.note;
  if (data.hwid !== undefined) updates.hwid = data.hwid; // allow admin to clear/set hwid
  if (data.expiresAt !== undefined) {
    updates.expiresAt = data.expiresAt
      ? admin.firestore.Timestamp.fromDate(new Date(data.expiresAt))
      : null;
  }

  const docRef = db.doc(`licenses/${key}`);
  const snap = await docRef.get();
  if (!snap.exists) {
    throw new functions.https.HttpsError("not-found", "License not found.");
  }

  await docRef.update(updates);
  return { success: true };
});

// ── deactivateLicense ────────────────────────────────────────────────────

export const deactivateLicense = functions.https.onCall(async (data, context) => {
  if (!context?.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be signed in.");
  }
  await assertAdmin(context.auth.uid);

  const key = (data?.key as string)?.trim().toUpperCase();
  if (!key) {
    throw new functions.https.HttpsError("invalid-argument", "Key is required.");
  }

  await db.doc(`licenses/${key}`).update({ active: false });
  return { success: true };
});

// ── listLicenses ─────────────────────────────────────────────────────────

export const listLicenses = functions.https.onCall(async (data, context) => {
  if (!context?.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be signed in.");
  }
  await assertAdmin(context.auth.uid);

  let query: FirebaseFirestore.Query = db.collection("licenses");
  const plan = data?.plan as string | undefined;
  const active = data?.active as boolean | undefined;

  if (plan) query = query.where("plan", "==", plan);
  if (active !== undefined) query = query.where("active", "==", active);

  const snap = await query.orderBy("createdAt", "desc").limit(200).get();
  const licenses = snap.docs.map((d) => d.data());

  return { licenses, count: licenses.length };
});

// ── HTTP endpoint for app validation ─────────────────────────────────────

export const validateLicenseHttp = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Método no permitido" });
    return;
  }

  const key = (req.body?.key as string)?.trim().toUpperCase();
  if (!key || !/^GS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key)) {
    res.status(400).json({ error: "Formato de clave inválido." });
    return;
  }

  const hwid = (req.body?.hwid as string)?.trim() ?? "";

  const snap = await db.doc(`licenses/${key}`).get();
  if (!snap.exists) {
    res.status(200).json({ valid: false, reason: "Licencia no encontrada." });
    return;
  }

  const lic = snap.data()!;
  if (!lic.active) {
    res.status(200).json({ valid: false, reason: "La licencia está desactivada." });
    return;
  }

  if (lic.expiresAt && lic.expiresAt.toDate() < new Date()) {
    res.status(200).json({ valid: false, reason: "La licencia ha expirado." });
    return;
  }

  // HWID binding
  if (hwid) {
    const storedHwid = (lic.hwid as string) ?? "";
    if (storedHwid && storedHwid !== hwid) {
      res.status(200).json({ valid: false, reason: "La licencia está vinculada a otro equipo." });
      return;
    }
    if (!storedHwid) {
      await db.doc(`licenses/${key}`).update({ hwid });
    }
  }

  res.status(200).json({
    valid: true,
    plan: lic.plan,
    allowedAppIds: lic.allowedAppIds ?? [],
    expiresAt: lic.expiresAt?.toDate().toISOString() ?? null,
    hwid: (lic.hwid as string) ?? hwid ?? "",
  });
});
