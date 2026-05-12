import jwt from "jsonwebtoken";
import crypto from "crypto";

import { env } from "@/lib/env";

export type OrderTokenPayload = {
  orderId: string;
  orderNumber: string;
  userId: string;
  queuePosition: number | null;
  pickupTime: string;
  iat: number;
  exp: number;
};

export function generateOrderToken(
  orderId: string,
  orderNumber: string,
  userId: string,
  queuePosition: number | null,
  pickupTime: Date
) {
  if (!env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing");
  }
  const pickupTimeISO = pickupTime.toISOString();
  const expiryTime = new Date(pickupTime);

  const token = jwt.sign(
    {
      orderId,
      orderNumber,
      userId,
      queuePosition,
      pickupTime: pickupTimeISO,
    },
    env.JWT_SECRET,
    {
      algorithm: "HS256",
      expiresIn: Math.floor((expiryTime.getTime() - Date.now()) / 1000),
    }
  );

  const tokenHash = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  return { token, tokenHash };
}

export function verifyOrderToken(token: string) {
  try {
    if (!env.JWT_SECRET) {
      throw new Error("JWT_SECRET is missing");
    }
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ["HS256"],
    }) as unknown as OrderTokenPayload;
    return decoded;
  } catch {
    throw new Error("TOKEN_INVALID");
  }
}