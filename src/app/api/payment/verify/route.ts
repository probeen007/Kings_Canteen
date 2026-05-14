import { NextResponse } from "next/server";
import crypto from "crypto";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

// ── eSewa v2 HMAC signature verification ─────────────────────────────────────
// This is the PRIMARY verification — cryptographic proof from eSewa.
// Does NOT require any network call. If this passes we trust the callback.

function verifyEsewaSignature(payload: Record<string, string>): boolean {
  if (!env.ESEWA_SECRET_KEY) return false;
  const signedFieldNames = payload.signed_field_names;
  if (!signedFieldNames) return false;

  const fields = signedFieldNames.split(",");
  const message = fields.map((f) => `${f}=${payload[f] ?? ""}`).join(",");

  const expected = crypto
    .createHmac("sha256", env.ESEWA_SECRET_KEY)
    .update(message)
    .digest("base64");

  // Use timingSafeEqual to prevent timing attacks
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(payload.signature ?? "");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ── Parse money string (handles "100", "1,000.00", "Rs. 100" etc.) ───────────

function parseMoney(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

// ── eSewa status API (SECONDARY check — optional, with timeout) ───────────────

async function callEsewaStatusApi(
  orderId: string,
  totalAmount: string
): Promise<{ status?: string; total_amount?: string; transaction_uuid?: string; product_code?: string } | null> {
  let verifyUrl: string | null = null;

  if (env.ESEWA_VERIFY_URL) {
    verifyUrl = `${env.ESEWA_VERIFY_URL.replace(/\/$/, "")}?product_code=${encodeURIComponent(env.ESEWA_MERCHANT_CODE!)}&total_amount=${encodeURIComponent(totalAmount)}&transaction_uuid=${encodeURIComponent(orderId)}`;
  } else if (env.ESEWA_BASE_URL?.includes("/api/epay/main/v2")) {
    const origin = new URL(env.ESEWA_BASE_URL).origin;
    verifyUrl = `${origin}/api/epay/transaction/status/?product_code=${encodeURIComponent(env.ESEWA_MERCHANT_CODE!)}&total_amount=${encodeURIComponent(totalAmount)}&transaction_uuid=${encodeURIComponent(orderId)}`;
  }

  if (!verifyUrl) return null;

  // Abort if eSewa API takes more than 8 seconds
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);

  try {
    console.info("esewa:status-api:url", verifyUrl);
    const res = await fetch(verifyUrl, { cache: "no-store", signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      console.warn("esewa:status-api:non-ok", res.status);
      return null;
    }
    return await res.json().catch(() => null);
  } catch (err) {
    clearTimeout(timer);
    console.warn("esewa:status-api:failed", err instanceof Error ? err.message : err);
    return null;
  }
}

// ── GET handler ───────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const url = new URL(request.url);
  const appUrl = env.NEXT_PUBLIC_APP_URL;
  const failureRedirect = `${appUrl}/orders?payment=failed`;

  console.info("esewa:verify:query", Object.fromEntries(url.searchParams));

  // ── 1. Parse eSewa callback ────────────────────────────────────────────────

  // V1 params
  let orderId = url.searchParams.get("oid") ?? url.searchParams.get("pid");
  let refId = url.searchParams.get("refId") ?? url.searchParams.get("ref_id");
  let status = url.searchParams.get("status");
  let callbackPayload: Record<string, string> | null = null;
  let transactionCode: string | null = null;

  // V2: all data is in a base64-encoded JSON `data` param
  const dataParam = url.searchParams.get("data");
  if (dataParam) {
    try {
      const decoded = Buffer.from(dataParam, "base64").toString("utf-8");
      console.info("esewa:verify:decoded", decoded);
      callbackPayload = JSON.parse(decoded) as Record<string, string>;
      orderId = callbackPayload.transaction_uuid ?? orderId;
      status = callbackPayload.status ?? status;
      refId = callbackPayload.ref_id ?? callbackPayload.refId ?? refId;
      transactionCode = callbackPayload.transaction_code ?? null;
    } catch (err) {
      console.error("esewa:verify:decode-failed", err);
    }
  }

  // Malformed URL where oid contains ?data= appended
  if (orderId?.includes("?data=")) {
    const [cleanId, dataValue] = orderId.split("?data=");
    orderId = cleanId;
    if (!dataParam && dataValue) {
      try {
        callbackPayload = JSON.parse(Buffer.from(dataValue, "base64").toString("utf-8"));
        orderId = callbackPayload?.transaction_uuid ?? orderId;
        status = callbackPayload?.status ?? status;
        refId = callbackPayload?.ref_id ?? callbackPayload?.refId ?? refId;
        transactionCode = callbackPayload?.transaction_code ?? null;
      } catch { /* ignore */ }
    }
  }

  const normalizedStatus = status?.toUpperCase();
  const effectiveRef = refId ?? transactionCode;

  console.info("esewa:verify:parsed", { orderId, normalizedStatus, effectiveRef });

  // ── 2. Hard failure gate: status explicitly FAILED ─────────────────────────

  if (normalizedStatus === "FAILED") {
    if (orderId) {
      const order = await prisma.order.findUnique({ where: { id: orderId }, include: { payment: true } });
      if (order?.payment) {
        await prisma.payment.update({
          where: { id: order.payment.id },
          data: { status: "FAILED", esewaData: JSON.stringify(Object.fromEntries(url.searchParams)) },
        });
      }
    }
    return NextResponse.redirect(failureRedirect);
  }

  // ── 3. Validate we have an order ─────────────────────────────────────────

  if (!orderId) {
    console.error("esewa:verify:no-orderId");
    return NextResponse.redirect(failureRedirect);
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payment: true },
  });

  if (!order || !order.payment) {
    console.error("esewa:verify:order-not-found", { orderId });
    return NextResponse.redirect(failureRedirect);
  }

  // ── 4. Idempotency — already processed ───────────────────────────────────

  if (order.payment.status === "SUCCESS") {
    console.info("esewa:verify:already-success (idempotent)", { orderId });
    return NextResponse.redirect(`${appUrl}/token/${order.id}?payment=success`);
  }

  // ── 5. PRIMARY: HMAC signature verification ───────────────────────────────
  // This is cryptographic — no network required. Trust this over the status API.

  let signatureValid = false;
  if (callbackPayload && callbackPayload.signed_field_names && callbackPayload.signature) {
    signatureValid = verifyEsewaSignature(callbackPayload);
    console.info("esewa:verify:signature", { valid: signatureValid });
  } else {
    // V1 flow has no signature — fall through to status API check
    console.info("esewa:verify:no-signature-in-payload (v1 or malformed)");
  }

  // ── 6. Verify callback status is SUCCESS/COMPLETE ─────────────────────────

  const callbackStatusOk =
    normalizedStatus === "SUCCESS" || normalizedStatus === "COMPLETE";

  if (!callbackStatusOk) {
    console.error("esewa:verify:bad-callback-status", { normalizedStatus });
    await prisma.payment.update({
      where: { id: order.payment.id },
      data: { status: "FAILED", esewaData: JSON.stringify(Object.fromEntries(url.searchParams)) },
    });
    return NextResponse.redirect(failureRedirect);
  }

  // ── 7. Amount sanity check from callback ─────────────────────────────────

  const dbAmount = Number(order.totalAmount);
  const callbackAmount = parseMoney(callbackPayload?.total_amount);
  if (callbackAmount !== null && Math.abs(callbackAmount - dbAmount) > 0.01) {
    console.error("esewa:verify:amount-mismatch-callback", {
      db: dbAmount,
      callback: callbackPayload?.total_amount,
    });
    return NextResponse.redirect(failureRedirect);
  }

  // ── 8. SECONDARY: Status API (optional, with timeout) ────────────────────
  // Only required when we couldn't verify the HMAC signature (V1 flow).
  // For V2 with valid HMAC, treat as advisory.

  let apiVerified = false;

  if (!signatureValid) {
    // No HMAC → must call status API to verify
    if (!effectiveRef) {
      console.error("esewa:verify:no-ref-and-no-signature");
      return NextResponse.redirect(failureRedirect);
    }

    const verification = await callEsewaStatusApi(order.id, dbAmount.toFixed(2));
    if (!verification) {
      console.error("esewa:verify:status-api-failed-no-fallback");
      return NextResponse.redirect(failureRedirect);
    }

    const apiStatus = verification.status?.toUpperCase();
    if (!["SUCCESS", "COMPLETE"].includes(apiStatus ?? "")) {
      console.error("esewa:verify:bad-api-status", { apiStatus });
      return NextResponse.redirect(failureRedirect);
    }

    const apiAmount = parseMoney(verification.total_amount);
    if (apiAmount !== null && Math.abs(apiAmount - dbAmount) > 0.01) {
      console.error("esewa:verify:amount-mismatch-api", { db: dbAmount, api: verification.total_amount });
      return NextResponse.redirect(failureRedirect);
    }

    if (verification.transaction_uuid && verification.transaction_uuid !== order.id) {
      console.error("esewa:verify:uuid-mismatch", { db: order.id, api: verification.transaction_uuid });
      return NextResponse.redirect(failureRedirect);
    }

    apiVerified = true;
  } else {
    // HMAC passed — call API in background as advisory audit log only
    callEsewaStatusApi(order.id, dbAmount.toFixed(2))
      .then((v) => console.info("esewa:verify:advisory-api-status", v?.status))
      .catch(() => {});
    apiVerified = true;
  }

  if (!signatureValid && !apiVerified) {
    console.error("esewa:verify:neither-signature-nor-api-verified");
    return NextResponse.redirect(failureRedirect);
  }

  // ── 9. All checks passed → record SUCCESS ────────────────────────────────

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: order.payment.id },
      data: {
        status: "SUCCESS",
        esewaRefId: effectiveRef ?? "signature-verified",
        esewaData: JSON.stringify(Object.fromEntries(url.searchParams)),
        verifiedAt: new Date(),
      },
    }),
    prisma.order.update({
      where: { id: order.id },
      data: order.status === "PENDING" ? { status: "CONFIRMED" } : {},
    }),
  ]);

  console.info("esewa:verify:success", { orderId, signatureValid, effectiveRef });
  return NextResponse.redirect(`${appUrl}/token/${order.id}?payment=success`);
}