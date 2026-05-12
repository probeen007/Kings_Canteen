import { format } from "date-fns";
import Decimal from "decimal.js";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

import { redis } from "@/lib/redis";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function generateOrderNumber() {
  const today = format(new Date(), "yyyyMMdd");
  try {
    const counter = await redis.incr(`order:number:${today}`);
    const sequence = String(counter).padStart(4, "0");
    return `CNT-${today}-${sequence}`;
  } catch (error) {
    console.error("Order number counter unavailable", error);
    const fallback = String(Date.now() % 1_000_000).padStart(6, "0");
    return `CNT-${today}-${fallback}`;
  }
}

export function sanitizeInput(value: string) {
  return value.replace(/<[^>]*>/g, "").trim();
}

export function maskPhone(phone: string) {
  if (!phone) return "";
  const normalized = phone.replace(/\s+/g, "");
  if (normalized.startsWith("+977") && normalized.length === 14) {
    return `${normalized.slice(0, 5)}XXXX${normalized.slice(-4)}`;
  }
  return `${normalized.slice(0, 3)}XXXX${normalized.slice(-2)}`;
}

export function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  if (!user || !domain) return email;
  const maskedUser = `${user.slice(0, 2)}**`;
  const [domainName, tld] = domain.split(".");
  const maskedDomain = `${domainName.slice(0, 2)}***.${tld ?? "com"}`;
  return `${maskedUser}@${maskedDomain}`;
}

export function formatNPR(amount: Decimal.Value) {
  const formatter = new Intl.NumberFormat("en-NP", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `Rs. ${formatter.format(new Decimal(amount).toNumber())}`;
}

export function formatPrice(amount: Decimal.Value) {
  return formatNPR(amount);
}

export function formatDate(value: Date) {
  return format(value, "MMM d, hh:mm a");
}

type TotalItem = { quantity: number; unitPrice: Decimal.Value };

export function calculateTotal(items: TotalItem[]) {
  return items.reduce((total, item) => {
    const line = new Decimal(item.unitPrice).mul(item.quantity);
    return total.plus(line);
  }, new Decimal(0));
}