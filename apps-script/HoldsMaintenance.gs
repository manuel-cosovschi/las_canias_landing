/***********************
 * LAS CAÑAS — Maintenance Holds (sin n8n schedule)
 * status hold: HOLD_TRANSFER
 * expires_at: ISO (ej 2026-01-18T22:57:32.434Z)
 *
 * Hace 2 cosas:
 *  1) Si expires_at <= ahora: marca como CANCELLED (o EXPIRED) y setea cancelled_at/status_reason/updated_at
 *  2) Si faltan <= 1h: manda aviso 1h antes (1 sola vez) y marca reminder_1h_sent_at
 *
 * Los destinatarios se conservan en el editor de Apps Script, fuera del repo
 * público. Ver README.md antes de copiar este archivo al proyecto.
 ***********************/

const SHEET_NAME = "reservas";
const HOLD_STATUS = "HOLD_TRANSFER";
const EXPIRE_TO_STATUS = "CANCELLED";
const REMINDER_WINDOW_MS = 60 * 60 * 1000; // 1 hora

// Mantener los valores actuales del proyecto al desplegar. No publicar emails.
const OWNER_EMAILS = "";
const CC_EMAILS = "";

function runHoldsMaintenance() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    Logger.log("SKIP runHoldsMaintenance | otra ejecución sigue en curso");
    return;
  }
  try {
    Logger.log("START runHoldsMaintenance");
    runHoldsMaintenanceOnce_();
  } finally {
    lock.releaseLock();
  }
}

function readHoldsSheet_() {
  const ss = withMaintenanceReadRetry_("abrir planilla", () => SpreadsheetApp.getActiveSpreadsheet());
  if (!ss) throw new Error("El script debe estar vinculado a la planilla de reservas");
  const sheet = withMaintenanceReadRetry_("abrir pestaña", () => ss.getSheetByName(SHEET_NAME));
  if (!sheet) throw new Error(`No existe la pestaña "${SHEET_NAME}"`);

  const range = withMaintenanceReadRetry_("obtener rango", () => sheet.getDataRange());
  const values = withMaintenanceReadRetry_("leer reservas", () => range.getValues());
  return { sheet, values };
}

// Diagnóstico de sólo lectura: no crea columnas, no cambia reservas ni envía mails.
function inspectHoldsMaintenance() {
  const { values } = readHoldsSheet_();
  const headers = (values[0] || []).map(h => String(h || "").trim());
  const col = {};
  headers.forEach((name, i) => col[name] = i);
  for (const name of ["id", "status", "expires_at"]) {
    if (col[name] === undefined) throw new Error(`Falta la columna "${name}"`);
  }
  const report = { rows: values.length - 1, holds: 0, expired: 0, remindersDue: 0, invalidExpires: 0 };
  const nowMs = Date.now();
  for (const row of values.slice(1)) {
    if (String(get_(row, col.status)) !== HOLD_STATUS) continue;
    report.holds++;
    const expires = parseIsoMs_(get_(row, col.expires_at));
    if (!Number.isFinite(expires)) report.invalidExpires++;
    else if (expires <= nowMs) report.expired++;
    else if (expires - nowMs <= REMINDER_WINDOW_MS && !get_(row, col.reminder_1h_sent_at)) report.remindersDue++;
  }
  Logger.log(`CHECK runHoldsMaintenance | ${JSON.stringify(report)}`);
  return report;
}

function runHoldsMaintenanceOnce_() {
  const { sheet, values } = readHoldsSheet_();
  if (values.length < 2) return;

  const headers = values[0].map(h => String(h || "").trim());

  // Columnas que usamos (si faltan, las creamos al final, no rompe nada)
  const col = ensureColumns_(sheet, headers, [
    "id",
    "status",
    "expires_at",
    "email",          // huésped
    "guest_name",
    "house_code",
    "check_in",
    "check_out",
    "phone",          // opcional, si no existe se crea
    "reminder_1h_sent_at",
    "expired_at",
    "cancelled_at",
    "status_reason",
    "updated_at",
  ]);

  const now = new Date();
  const nowMs = now.getTime();

  let changed = 0;
  let mailed = 0;
  let expired = 0;

  for (let r = 1; r < values.length; r++) {
    const row = values[r];

    const status = get_(row, col.status);
    if (String(status) !== HOLD_STATUS) continue;

    const expiresRaw = get_(row, col.expires_at);
    const expMs = parseIsoMs_(expiresRaw);
    if (!Number.isFinite(expMs)) continue;

    const msLeft = expMs - nowMs;

    // 1) Expirar hold
    if (msLeft <= 0) {
      const alreadyExpired = get_(row, col.expired_at);
      if (!alreadyExpired) {
        set_(row, col.status, EXPIRE_TO_STATUS);
        set_(row, col.expired_at, now.toISOString());
        if (col.cancelled_at !== undefined) set_(row, col.cancelled_at, now.toISOString());
        set_(row, col.status_reason, "Auto-expired (Apps Script)");
        set_(row, col.updated_at, now.toISOString());
        expired++;
        changed++;
      }
      continue;
    }

    // 2) Aviso 1h antes (1 sola vez) -> a DUEÑOS
    if (msLeft <= REMINDER_WINDOW_MS) {
      const sentAt = get_(row, col.reminder_1h_sent_at);
      if (!sentAt) {
        const to = String(OWNER_EMAILS || "").trim();
        if (to) {
          sendOwnerReminderEmail_({
            to,
            cc: String(CC_EMAILS || "").trim(),
            id: get_(row, col.id),
            house: get_(row, col.house_code),
            checkIn: get_(row, col.check_in),
            checkOut: get_(row, col.check_out),
            expiresAtIso: String(expiresRaw),
            guestName: get_(row, col.guest_name),
            guestEmail: String(get_(row, col.email) || "").trim(),
            guestPhone: String(get_(row, col.phone) || "").trim(),
          });

          mailed++;
          set_(row, col.reminder_1h_sent_at, now.toISOString());
          set_(row, col.updated_at, now.toISOString());
          changed++;
        }
      }
    }
  }

  if (changed > 0) {
    // ensureColumns_ puede haber ampliado la hoja después de obtener range.
    const output = values.map((row, index) => index === 0 ? headers :
      Array.from({ length: headers.length }, (_, c) => row[c] ?? ""));
    // No repetir una escritura ambigua: n8n también modifica esta planilla
    // y podría haber confirmado una reserva después del primer intento.
    sheet.getRange(1, 1, output.length, headers.length).setValues(output);
    SpreadsheetApp.flush();
  }

  Logger.log(`OK runHoldsMaintenance | changed=${changed} mailed=${mailed} expired=${expired}`);
}

/** ===== Helpers ===== */

// Sólo para lecturas. NUNCA envolver escrituras, envío de mail ni la ejecución
// completa: Google podría haber aceptado la operación antes de devolver error.
function withMaintenanceReadRetry_(operation, action) {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return action();
    } catch (error) {
      const message = String(error && error.message || error);
      const transient = /server error occurred|server not available|internal error|service unavailable|service spreadsheets timed out/i.test(message);
      if (!transient || attempt === maxAttempts) {
        console.error(`FAIL runHoldsMaintenance | operation=${operation} attempt=${attempt} | ${message}`);
        throw error;
      }
      const delayMs = 1000 * Math.pow(2, attempt - 1);
      console.warn(`RETRY runHoldsMaintenance | operation=${operation} attempt=${attempt} delayMs=${delayMs} | ${message}`);
      Utilities.sleep(delayMs);
    }
  }
}

function ensureColumns_(sheet, headers, required) {
  const idx = {};
  headers.forEach((h, i) => idx[h] = i);

  let appended = false;
  required.forEach(name => {
    if (idx[name] === undefined) {
      headers.push(name);
      idx[name] = headers.length - 1;
      appended = true;
    }
  });

  if (appended) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    SpreadsheetApp.flush();
  }

  return {
    id: idx["id"],
    status: idx["status"],
    expires_at: idx["expires_at"],
    email: idx["email"],
    guest_name: idx["guest_name"],
    house_code: idx["house_code"],
    check_in: idx["check_in"],
    check_out: idx["check_out"],
    phone: idx["phone"],
    reminder_1h_sent_at: idx["reminder_1h_sent_at"],
    expired_at: idx["expired_at"],
    cancelled_at: idx["cancelled_at"],
    status_reason: idx["status_reason"],
    updated_at: idx["updated_at"],
  };
}

function parseIsoMs_(value) {
  if (!value) return NaN;
  if (Object.prototype.toString.call(value) === "[object Date]") {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : NaN;
  }
  const ms = Date.parse(String(value));
  return Number.isFinite(ms) ? ms : NaN;
}

function get_(row, i) {
  if (i === undefined) return "";
  return row[i];
}
function set_(row, i, v) {
  if (i === undefined) return;
  row[i] = v;
}

function safeLocalAr_(iso) {
  try {
    const d = new Date(iso);
    return Utilities.formatDate(d, "America/Argentina/Buenos_Aires", "dd/MM/yyyy HH:mm") + " (AR)";
  } catch (e) {
    return String(iso);
  }
}

function formatIfDate_(v, pattern) {
  const p = pattern || "dd/MM/yyyy";
  if (Object.prototype.toString.call(v) === "[object Date]") {
    return Utilities.formatDate(v, "America/Argentina/Buenos_Aires", p);
  }
  return String(v ?? "-");
}

function escapeHtml_(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Email HTML (a dueños) — aviso 1h antes. */
function sendOwnerReminderEmail_({ to, cc, id, house, checkIn, checkOut, expiresAtIso, guestName, guestEmail, guestPhone }) {
  const exp = safeLocalAr_(expiresAtIso);
  const ci = formatIfDate_(checkIn, "dd/MM/yyyy");
  const co = formatIfDate_(checkOut, "dd/MM/yyyy");

  const subject = `Las Cañas — Vence en 1 hora: ${id || ""} (${house || "-"})`.trim();

  const html = `
  <div style="font-family: Inter, Arial, sans-serif; background:#F5F1E9; padding:24px;">
    <div style="max-width:680px; margin:0 auto; background:#ffffff; border:1px solid #DED2B9; border-radius:18px; overflow:hidden;">
      <div style="padding:18px 22px; background:#4A3728; color:#F5F1E9;">
        <div style="font-size:12px; letter-spacing:2px; font-weight:800; text-transform:uppercase; opacity:.9;">
          Las Cañas · Aviso interno a propietarios
        </div>
        <div style="font-size:22px; font-family:'Playfair Display', Georgia, serif; font-weight:800; margin-top:6px;">
          Reserva por vencer en ~1 hora
        </div>
        <div style="margin-top:8px; font-size:13px; opacity:.9;">
          Estado: <b>HOLD_TRANSFER</b>
        </div>
      </div>
      <div style="padding:18px 22px; color:#4A3728;">
        <p style="margin:0 0 14px 0; font-size:14px; color:#8C7662;">
          Esta reserva está pendiente de validación. Confirmar/gestionar antes del vencimiento.
        </p>
        <div style="display:flex; gap:12px; flex-wrap:wrap; margin:14px 0;">
          <div style="flex:1; min-width:260px; padding:12px 14px; border:1px solid #DED2B9; border-radius:14px; background:#FBFAF7;">
            <div style="font-size:11px; color:#8C7662; font-weight:800; text-transform:uppercase; letter-spacing:1px;">Reserva</div>
            <div style="margin-top:8px; font-size:14px;"><b>ID:</b> ${escapeHtml_(id || "-")}</div>
            <div style="margin-top:6px; font-size:14px;"><b>Casa:</b> ${escapeHtml_(house || "-")}</div>
            <div style="margin-top:6px; font-size:14px;"><b>Fechas:</b> ${escapeHtml_(ci)} → ${escapeHtml_(co)}</div>
            <div style="margin-top:6px; font-size:14px;">
              <b>Vence:</b> <span style="display:inline-block; padding:2px 8px; border-radius:999px; background:#FFF3CD; border:1px solid #FFE69C;">
                ${escapeHtml_(exp)}
              </span>
            </div>
          </div>
          <div style="flex:1; min-width:260px; padding:12px 14px; border:1px solid #DED2B9; border-radius:14px; background:#FBFAF7;">
            <div style="font-size:11px; color:#8C7662; font-weight:800; text-transform:uppercase; letter-spacing:1px;">Huésped (referencia)</div>
            <div style="margin-top:8px; font-size:14px;"><b>Nombre:</b> ${escapeHtml_(guestName || "-")}</div>
            <div style="margin-top:6px; font-size:14px;"><b>Email:</b> ${escapeHtml_(guestEmail || "-")}</div>
            <div style="margin-top:6px; font-size:14px;"><b>Teléfono:</b> ${escapeHtml_(guestPhone || "-")}</div>
          </div>
        </div>
        <div style="margin-top:14px; padding:12px 14px; border:1px dashed #DED2B9; border-radius:14px; background:#ffffff;">
          <div style="font-size:11px; color:#8C7662; font-weight:800; text-transform:uppercase; letter-spacing:1px;">Acción sugerida</div>
          <div style="margin-top:8px; font-size:14px;">
            Si el huésped ya pagó, confirmar la transferencia. Si no, dejar que expire (el script la marca como <b>${escapeHtml_(EXPIRE_TO_STATUS)}</b>).
          </div>
        </div>
        <p style="margin:16px 0 0 0; font-size:12px; color:#8C7662;">
          Enviado automáticamente por Apps Script (sin consumo de ejecuciones n8n Cloud).
        </p>
      </div>
    </div>
  </div>
  `;

  const options = { htmlBody: html, name: "Las Cañas" };
  if (cc && String(cc).trim()) options.cc = String(cc).trim();
  MailApp.sendEmail(to, subject, "Este email requiere HTML.", options);
}

function printIso30m() {
  const iso = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  Logger.log(iso);
}
