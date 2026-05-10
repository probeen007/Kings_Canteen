import { z } from "zod";

import crypto from "crypto";

import { apiHandler } from "@/lib/apiHandler";
import { AppError, AuthError } from "@/lib/errors";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { RATE_LIMITS, enforceRateLimit } from "@/lib/rateLimiter";

const initiateSchema = z.object({
  orderId: z.string().min(1),
});

export const POST = apiHandler(
  async (_request, context) => {
    if (!context.user) {
      throw new AuthError("Unauthenticated", "AUTH_001");
    }

    const limit = await enforceRateLimit(
      `rate:payment:initiate:${context.user.id}`,
      RATE_LIMITS.paymentInitiate.maxRequests,
      RATE_LIMITS.paymentInitiate.windowSeconds
    );
    if (!limit.allowed) {
      throw new AppError("Too many requests", 429, "RATE_001", {
        retryAfterSeconds: Math.ceil((limit.resetAt - Date.now()) / 1000),
      });
    }

    const orderId = context.body?.orderId;
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true },
    });

    if (!order || order.userId !== context.user.id) {
      throw new AppError("Order not found", 404, "ORDER_404");
    }

    if (!order.payment || order.payment.status !== "PENDING") {
      throw new AppError("Payment already processed", 409, "PAYMENT_002");
    }

    const amount = Number(order.totalAmount);
    const baseUrl = env.ESEWA_BASE_URL.replace(/\/$/, "");
    const isV2 = baseUrl.includes("/api/epay/main/v2");
    const paymentUrl = baseUrl.includes("/epay/main") ? baseUrl : `${baseUrl}/epay/main`;
    const successUrl = `${env.NEXT_PUBLIC_APP_URL}/api/payment/verify`;
    const failureUrl = `${env.NEXT_PUBLIC_APP_URL}/api/payment/verify?status=failed`;

    if (isV2) {
      const totalAmount = amount.toFixed(2);
      const signedFieldNames = "total_amount,transaction_uuid,product_code";
      const signaturePayload = `total_amount=${totalAmount},transaction_uuid=${order.id},product_code=${env.ESEWA_MERCHANT_CODE}`;
      const signature = crypto
        .createHmac("sha256", env.ESEWA_SECRET_KEY)
        .update(signaturePayload)
        .digest("base64");

      return {
        paymentUrl,
        fields: {
          amount: totalAmount,
          tax_amount: "0",
          total_amount: totalAmount,
          transaction_uuid: order.id,
          product_code: env.ESEWA_MERCHANT_CODE,
          product_service_charge: "0",
          product_delivery_charge: "0",
          success_url: successUrl,
          failure_url: failureUrl,
          signed_field_names: signedFieldNames,
          signature,
        },
      };
    }

    return {
      paymentUrl,
      fields: {
        amt: amount.toFixed(2),
        psc: "0",
        pdc: "0",
        txAmt: "0",
        tAmt: amount.toFixed(2),
        pid: order.id,
        scd: env.ESEWA_MERCHANT_CODE,
        su: successUrl,
        fu: failureUrl,
      },
    };
  },
  { roles: ["USER"], schema: initiateSchema, requireAuth: true }
);