import QRCode from "qrcode";

export async function generateQRCode(token: string): Promise<string> {
  try {
    const qrDataUrl = await QRCode.toDataURL(token, {
      errorCorrectionLevel: "H",
      type: "image/png",
      width: 300,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });
    return qrDataUrl;
  } catch (error) {
    throw new Error(`QR_GENERATION_FAILED: ${error}`);
  }
}

export async function generateQRString(
  orderId: string,
  token: string
): Promise<string> {
  const qrString = `${orderId}:${token}`;
  return qrString;
}