"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import jsQR from "jsqr";
import {
  CheckCircle2, XCircle, Loader2, Camera, CameraOff,
  Upload, KeyRound, RefreshCw, ScanLine,
} from "lucide-react";

type VerifyStatus = "idle" | "loading" | "success" | "error";
type Tab = "camera" | "image" | "manual";
type CamState = "prompt" | "requesting" | "active" | "denied";

interface OrderData {
  orderNumber: string;
  totalAmount: number;
  queuePosition: number | null;
  customer: { name: string; email: string };
  items: { menuItem: string; quantity: number; subtotal: string | number }[];
}

export default function VerifyPage() {
  const [tab, setTab] = useState<Tab>("camera");
  const [status, setStatus] = useState<VerifyStatus>("idle");
  const [message, setMessage] = useState("");
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [camState, setCamState] = useState<CamState>("prompt");
  const [manualToken, setManualToken] = useState("");
  const [imageError, setImageError] = useState("");

  // Refs — these never change identity, no re-render issues
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const pausedRef = useRef(false); // true while showing result, prevents double-scan

  // ── Helpers ────────────────────────────────────────────────────────────────

  const stopRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const killStream = useCallback(() => {
    stopRaf();
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    pausedRef.current = false;
  }, [stopRaf]);

  // ── API call ───────────────────────────────────────────────────────────────

  const verify = useCallback(async (token: string) => {
    setStatus("loading");
    setMessage("");
    setOrderData(null);
    try {
      const res = await fetch("/api/token/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus("success");
        setMessage("Delivered! Token invalidated.");
        setOrderData(data.order);
      } else {
        setStatus("error");
        const map: Record<string, string> = {
          ORDER_CLAIMED: "⚠️ Already Claimed — order was already delivered.",
          ORDER_CANCELLED: "This order was cancelled.",
          TOKEN_001: "Invalid or expired token.",
        };
        setMessage(map[data.code] ?? data.error ?? "Verification failed.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Check your connection.");
    }
  }, []);

  // ── Scan loop ──────────────────────────────────────────────────────────────
  // Uses a stable canvas ref so we don't recreate it every tick

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
    }
  }, []);

  const startScanLoop = useCallback(() => {
    stopRaf();
    pausedRef.current = false;

    const tick = () => {
      // Paused while showing result — just reschedule, keep looping cheaply
      if (pausedRef.current) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const video = videoRef.current;
      if (!video || video.readyState < video.HAVE_ENOUGH_DATA || video.paused) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const canvas = canvasRef.current!;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) { rafRef.current = requestAnimationFrame(tick); return; }

      ctx.drawImage(video, 0, 0);
      const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(id.data, id.width, id.height, { inversionAttempts: "dontInvert" });

      if (code?.data) {
        pausedRef.current = true; // pause scanning while showing result
        verify(code.data);
        // Keep ticking (cheaply) so resume after reset works without restarting
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [stopRaf, verify]);

  // ── Camera start ───────────────────────────────────────────────────────────

  const attachStream = useCallback((stream: MediaStream) => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    video.play()
      .then(() => startScanLoop())
      .catch(err => {
        console.error("play() failed:", err);
        setCamState("denied");
      });
  }, [startScanLoop]);

  const startCamera = useCallback(async () => {
    setCamState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
      });
      streamRef.current = stream;
      // camState → "active" renders the <video>; then effect below attaches srcObject
      setCamState("active");
    } catch {
      setCamState("denied");
    }
  }, []);

  // After camState flips to "active", the <video> is guaranteed to be in the DOM
  useEffect(() => {
    if (camState === "active" && streamRef.current) {
      attachStream(streamRef.current);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camState]); // intentionally only camState — runs once on mount into "active"

  // Stop everything when switching away from camera tab
  useEffect(() => {
    if (tab !== "camera") {
      killStream();
      setCamState("prompt");
    }
    return () => { /* cleanup on unmount */ killStream(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // ── Reset ──────────────────────────────────────────────────────────────────
  // KEY: we DON'T stop the camera or unmount the video — just unpause the scan loop

  const reset = useCallback(() => {
    setStatus("idle");
    setMessage("");
    setOrderData(null);
    setManualToken("");
    setImageError("");
    pausedRef.current = false; // scan loop unpauses on next tick automatically
  }, []);

  // ── Image upload ───────────────────────────────────────────────────────────

  const scanImage = useCallback((file: File) => {
    setImageError("");
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const attempt = (scale: number) => {
          const c = document.createElement("canvas");
          c.width = img.width * scale; c.height = img.height * scale;
          const ctx = c.getContext("2d", { willReadFrequently: true })!;
          ctx.drawImage(img, 0, 0, c.width, c.height);
          const id = ctx.getImageData(0, 0, c.width, c.height);
          return (
            jsQR(id.data, id.width, id.height, { inversionAttempts: "dontInvert" }) ??
            jsQR(id.data, id.width, id.height, { inversionAttempts: "invertFirst" }) ??
            jsQR(id.data, id.width, id.height, { inversionAttempts: "attemptBoth" })
          )?.data ?? null;
        };
        const decoded = attempt(1) ?? attempt(2) ?? attempt(3);
        if (decoded) {
          verify(decoded);
        } else {
          setImageError("No QR code found. Ensure the full QR is visible, unblurred, and well-lit.");
        }
      };
      img.onerror = () => setImageError("Could not load image.");
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, [verify]);

  // ── Result card ────────────────────────────────────────────────────────────

  const ResultCard = () => {
    if (status === "idle") return null;
    if (status === "loading") {
      return (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-amber-600" />
          <p className="text-sm font-semibold text-slate-700">Verifying…</p>
        </div>
      );
    }
    const ok = status === "success";
    return (
      <div className={`rounded-2xl border p-5 shadow-sm ${ok ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {ok
              ? <CheckCircle2 className="h-6 w-6 shrink-0 text-green-600" />
              : <XCircle className="h-6 w-6 shrink-0 text-red-600" />}
            <h3 className={`text-base font-semibold ${ok ? "text-green-900" : "text-red-900"}`}>
              {ok ? "Order Delivered ✓" : "Verification Failed"}
            </h3>
          </div>
          <button
            onClick={reset}
            className="flex items-center gap-1.5 rounded-lg bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white border border-slate-200 shadow-sm transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {tab === "camera" ? "Scan Next" : "Try Again"}
          </button>
        </div>
        <p className={`mt-2 text-sm ${ok ? "text-green-800" : "text-red-800"}`}>{message}</p>

        {ok && orderData && (
          <div className="mt-4 rounded-xl border border-green-200 bg-white p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-slate-400">Order No.</p><p className="font-semibold text-slate-900">{orderData.orderNumber}</p></div>
              <div><p className="text-xs text-slate-400">Customer</p><p className="font-semibold text-slate-900">{orderData.customer?.name}</p></div>
              <div><p className="text-xs text-slate-400">Total</p><p className="font-semibold text-green-700">Rs. {Number(orderData.totalAmount).toLocaleString()}</p></div>
              {orderData.queuePosition && (
                <div><p className="text-xs text-slate-400">Queue #</p><p className="font-semibold text-slate-900">#{orderData.queuePosition}</p></div>
              )}
            </div>
            <div className="border-t border-slate-100 pt-3 space-y-1.5">
              {orderData.items.map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-slate-700"><span className="font-medium">{item.quantity}×</span> {item.menuItem}</span>
                  <span className="font-medium text-slate-900">Rs. {Number(item.subtotal).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Tabs ───────────────────────────────────────────────────────────────────

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "camera", label: "Camera", icon: <ScanLine className="h-4 w-4" /> },
    { id: "image",  label: "Upload QR", icon: <Upload className="h-4 w-4" /> },
    { id: "manual", label: "Enter Token", icon: <KeyRound className="h-4 w-4" /> },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Verify & Deliver Order</h1>
        <p className="mt-1 text-sm text-slate-500">Scan, upload, or enter a token to complete delivery.</p>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1 gap-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); reset(); }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
              tab === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── CAMERA TAB ──
          CRITICAL: the <video> element is ALWAYS rendered while camState==="active",
          regardless of `status`. This prevents the srcObject from being lost on re-mount. */}
      {tab === "camera" && (
        <div className="space-y-5">
          {/* Prompt / Requesting / Denied — only shown when NOT active */}
          {camState === "prompt" && (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col items-center gap-5 p-10 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-50">
                <Camera className="h-10 w-10 text-amber-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Camera Access Needed</h2>
                <p className="mt-1 text-sm text-slate-500 max-w-xs mx-auto">Allow camera access to scan customer QR codes.</p>
              </div>
              <button
                onClick={startCamera}
                className="rounded-xl bg-amber-600 px-8 py-3 text-sm font-semibold text-white hover:bg-amber-700 active:scale-95 transition-all"
              >
                Start Camera
              </button>
            </div>
          )}

          {camState === "requesting" && (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col items-center gap-4 p-10 text-center">
              <Loader2 className="h-10 w-10 text-amber-600 animate-spin" />
              <p className="text-sm font-medium text-slate-700">Requesting camera permission…</p>
              <p className="text-xs text-slate-400">Check the browser permission popup</p>
            </div>
          )}

          {camState === "denied" && (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col items-center gap-5 p-10 text-center">
              <CameraOff className="h-12 w-12 text-red-400" />
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Camera Denied</h2>
                <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
                  Allow camera in browser settings, or use Upload QR / Enter Token instead.
                </p>
              </div>
              <button
                onClick={() => setCamState("prompt")}
                className="rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Video — ALWAYS mounted while camState==="active". CSS hides, never unmounts. */}
          <div
            className="rounded-2xl border border-slate-200 bg-black shadow-sm overflow-hidden"
            style={{ display: camState === "active" ? "block" : "none" }}
          >
            <div className="relative">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full max-h-96 object-cover"
              />
              {/* Viewfinder overlay — only meaningful while scanning */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="relative h-52 w-52">
                  {[
                    "top-0 left-0",
                    "top-0 right-0 rotate-90",
                    "bottom-0 right-0 rotate-180",
                    "bottom-0 left-0 -rotate-90",
                  ].map((pos, i) => (
                    <div key={i} className={`absolute ${pos} h-8 w-8`}>
                      <div className="absolute top-0 left-0 h-1.5 w-8 bg-amber-400 rounded-full" />
                      <div className="absolute top-0 left-0 h-8 w-1.5 bg-amber-400 rounded-full" />
                    </div>
                  ))}
                  {/* Scan line — paused state changes opacity so user knows it's paused */}
                  <div
                    className="absolute inset-x-0 top-0 h-0.5 bg-amber-400 animate-scan transition-opacity"
                    style={{ opacity: status === "idle" ? 0.9 : 0.3 }}
                  />
                </div>
              </div>
              {/* Status badge on video */}
              <div className="absolute bottom-3 inset-x-0 flex justify-center gap-2">
                {status === "idle" && (
                  <span className="rounded-full bg-black/60 px-4 py-1.5 text-xs font-medium text-white backdrop-blur">
                    Scanning…
                  </span>
                )}
                {(status === "success" || status === "error") && (
                  <span className="rounded-full bg-black/60 px-4 py-1.5 text-xs font-medium text-white backdrop-blur">
                    Paused — hit &quot;Scan Next&quot; to continue
                  </span>
                )}
                <button
                  onClick={() => { killStream(); setCamState("prompt"); reset(); }}
                  className="rounded-full bg-black/60 px-4 py-1.5 text-xs font-medium text-white backdrop-blur hover:bg-black/80 transition-colors"
                >
                  Stop
                </button>
              </div>
            </div>
          </div>

          {/* Result shown BELOW the live camera — camera never unmounts */}
          <ResultCard />
        </div>
      )}

      {/* ── IMAGE TAB ── */}
      {tab === "image" && (
        <div className="space-y-5">
          {status === "idle" && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Upload QR Image</h2>
                <p className="mt-1 text-sm text-slate-500">Upload a screenshot of the customer&apos;s QR code.</p>
              </div>
              <label
                htmlFor="qr-upload"
                className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 cursor-pointer hover:border-amber-400 hover:bg-amber-50 transition-colors text-center"
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) scanImage(f); }}
              >
                <Upload className="h-8 w-8 text-amber-500" />
                <div>
                  <p className="text-sm font-semibold text-slate-700">Click to upload or drag & drop</p>
                  <p className="text-xs text-slate-400 mt-0.5">PNG, JPG, WEBP</p>
                </div>
                <input
                  id="qr-upload" type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) scanImage(f); e.target.value = ""; }}
                />
              </label>
              {imageError && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <XCircle className="h-4 w-4 mt-0.5 shrink-0" />{imageError}
                </div>
              )}
            </div>
          )}
          <ResultCard />
        </div>
      )}

      {/* ── MANUAL TAB ── */}
      {tab === "manual" && (
        <div className="space-y-5">
          {status === "idle" && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Enter Order Token</h2>
                <p className="mt-1 text-sm text-slate-500">Paste the JWT token from the customer&apos;s order page.</p>
              </div>
              <textarea
                value={manualToken}
                onChange={e => setManualToken(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                rows={4}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-xs font-mono text-slate-800 placeholder:text-slate-400 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 resize-none"
              />
              <button
                onClick={() => verify(manualToken)}
                disabled={!manualToken.trim()}
                className="w-full rounded-xl bg-amber-600 py-3 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
              >
                Verify Token
              </button>
            </div>
          )}
          <ResultCard />
        </div>
      )}
    </div>
  );
}
