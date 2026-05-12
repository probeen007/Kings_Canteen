import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

function getVerifyUrl(orderId: string, totalAmount: string) {
  if (!env.ESEWA_MERCHANT_CODE) {
    return null;
  }

  if (env.ESEWA_VERIFY_URL) {
    const base = env.ESEWA_VERIFY_URL.replace(/\/$/, "");
    return `${base}?product_code=${encodeURIComponent(env.ESEWA_MERCHANT_CODE)}&total_amount=${encodeURIComponent(totalAmount)}&transaction_uuid=${encodeURIComponent(orderId)}`;
  }

  if (!env.ESEWA_BASE_URL) {
    return null;
  }

  const baseUrl = env.ESEWA_BASE_URL.replace(/\/$/, "");
  if (!baseUrl.includes("/api/epay/main/v2")) return null;

  const origin = new URL(baseUrl).origin;
  return `${origin}/api/epay/transaction/status/?product_code=${encodeURIComponent(env.ESEWA_MERCHANT_CODE)}&total_amount=${encodeURIComponent(totalAmount)}&transaction_uuid=${encodeURIComponent(orderId)}`;
}

async function verifyEsewaTransaction(orderId: string, totalAmount: string) {
  const verifyUrl = getVerifyUrl(orderId, totalAmount);
  if (!verifyUrl) return null;

  try {
    const response = await fetch(verifyUrl, { cache: "no-store" });
    if (!response.ok) return null;
    const payload = (await response.json().catch(() => null)) as {
      status?: string;
      transaction_uuid?: string;
      total_amount?: string;
      product_code?: string;
    } | null;
    return payload;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const dataParam = url.searchParams.get("data");
  let orderId = url.searchParams.get("oid") ?? url.searchParams.get("pid");
  let refId = url.searchParams.get("refId") ?? url.searchParams.get("ref_id");
  let status = url.searchParams.get("status");
  console.info("esewa:verify:query", Object.fromEntries(url.searchParams));

  if (orderId && orderId.includes("?data=")) {
    const [cleanId, dataValue] = orderId.split("?data=");
    orderId = cleanId;
    if (!dataParam && dataValue) {
      try {
        const decoded = Buffer.from(dataValue, "base64").toString("utf-8");
        console.info("esewa:verify:data", decoded);
        const payload = JSON.parse(decoded) as {
          transaction_uuid?: string;
          status?: string;
          ref_id?: string;
          refId?: string;
        };
        orderId = payload.transaction_uuid ?? orderId;
        status = payload.status ?? status;
        refId = payload.ref_id ?? payload.refId ?? refId;
      } catch (error) {
        console.error("eSewa payload decode failed", error);
      }
    }
  }

  let transactionCode: string | null = null;

  if (dataParam) {
    try {
      const decoded = Buffer.from(dataParam, "base64").toString("utf-8");
      console.info("esewa:verify:data", decoded);
      const payload = JSON.parse(decoded) as {
        transaction_code?: string;
        transaction_uuid?: string;
        status?: string;
        ref_id?: string;
        refId?: string;
      };
      transactionCode = payload.transaction_code ?? null;
      orderId = payload.transaction_uuid ?? orderId;
      status = payload.status ?? status;
      refId = payload.ref_id ?? payload.refId ?? refId;
    } catch (error) {
      console.error("eSewa payload decode failed", error);
    }
  }

  const appUrl = env.NEXT_PUBLIC_APP_URL;
  const failureRedirect = `${appUrl}/orders?payment=failed`;

  if (!orderId) {
    return NextResponse.redirect(failureRedirect);
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payment: true },
  });

  if (!order || !order.payment) {
    return NextResponse.redirect(failureRedirect);
  }

  const normalizedStatus = status?.toUpperCase();

  if (normalizedStatus === "FAILED") {
    await prisma.payment.update({
      where: { id: order.payment.id },
      data: {
        status: "FAILED",
        esewaData: JSON.stringify(Object.fromEntries(url.searchParams)),
      },
    });
    return NextResponse.redirect(failureRedirect);
  }

  if (normalizedStatus && !["SUCCESS", "COMPLETE"].includes(normalizedStatus)) {
    await prisma.payment.update({
      where: { id: order.payment.id },
      data: {
        status: "FAILED",
        esewaData: JSON.stringify(Object.fromEntries(url.searchParams)),
      },
    });
    return NextResponse.redirect(failureRedirect);
  }

  const effectiveRef = refId ?? transactionCode;
  if (!effectiveRef) {
    return NextResponse.redirect(failureRedirect);
  }

  const totalAmount = Number(order.totalAmount).toFixed(2);
  const verification = await verifyEsewaTransaction(order.id, totalAmount);
  if (!verification) {
    return NextResponse.redirect(failureRedirect);
  }

  const verifiedStatus = verification.status?.toUpperCase();
  if (!verifiedStatus || !["SUCCESS", "COMPLETE"].includes(verifiedStatus)) {
    return NextResponse.redirect(failureRedirect);
  }

  if (verification.transaction_uuid && verification.transaction_uuid !== order.id) {
    return NextResponse.redirect(failureRedirect);
  }

  if (verification.product_code && verification.product_code !== env.ESEWA_MERCHANT_CODE) {
    return NextResponse.redirect(failureRedirect);
  }

  if (verification.total_amount && verification.total_amount !== totalAmount) {
    return NextResponse.redirect(failureRedirect);
  }

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: order.payment.id },
      data: {
        status: "SUCCESS",
        esewaRefId: effectiveRef,
        esewaData: JSON.stringify(Object.fromEntries(url.searchParams)),
        verifiedAt: new Date(),
      },
    }),
    prisma.order.update({
      where: { id: order.id },
      data: order.status === "PENDING" ? { status: "CONFIRMED" } : {},
    }),
  ]);

  return NextResponse.redirect(`${appUrl}/token/${order.id}?payment=success`);
}