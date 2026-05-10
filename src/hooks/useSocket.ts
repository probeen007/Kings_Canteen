"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

interface UseSocketOptions {
  userId?: string;
  role?: string;
  autoConnect?: boolean;
}

export function useSocket({ userId, role, autoConnect = true }: UseSocketOptions = {}) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  useEffect(() => {
    if (!autoConnect || !userId || !role) return;

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3000";

    const socket = io(socketUrl, {
      auth: {
        token: "client-token", // In production, use actual JWT
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socket.on("connect", () => {
      setConnected(true);
      setReconnecting(false);
      console.log("Socket connected");

      // Join appropriate rooms
      if (role === "STAFF" || role === "ADMIN") {
        socket.emit("join:staff", userId, role);
      }
      if (role === "ADMIN") {
        socket.emit("join:admin", userId, role);
      }
      if (role === "USER") {
        socket.emit("join:user", userId);
      }
    });

    socket.on("disconnect", () => {
      setConnected(false);
      console.log("Socket disconnected");
    });

    socket.on("reconnect_attempt", () => {
      setReconnecting(true);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [userId, role, autoConnect]);

  const on = useCallback((event: string, handler: (data: any) => void) => {
    if (!socketRef.current) return;
    socketRef.current.on(event, handler);
  }, []);

  const off = useCallback((event: string, handler?: (data: any) => void) => {
    if (!socketRef.current) return;
    if (handler) {
      socketRef.current.off(event, handler);
    } else {
      socketRef.current.off(event);
    }
  }, []);

  const emit = useCallback((event: string, data: any) => {
    if (!socketRef.current) return;
    socketRef.current.emit(event, data);
  }, []);

  return {
    socket: socketRef.current,
    connected,
    reconnecting,
    on,
    off,
    emit,
  };
}