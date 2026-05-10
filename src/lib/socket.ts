import { Server as HTTPServer } from "http";
import { Socket as ServerSocket, Server as SocketIOServer } from "socket.io";

export type OrderNewEvent = {
  orderId: string;
  orderNumber: string;
  queuePosition: number | null;
  items: Array<{ name: string; quantity: number }>;
  totalAmount: number;
  pickupTime: string;
  userName: string | null;
};

export type OrderReadyEvent = {
  orderId: string;
  orderNumber: string;
  queuePosition: number | null;
};

export type OrderCompletedEvent = {
  orderId: string;
  orderNumber: string;
  completedAt: string;
  staffId: string;
};

export type QueueUpdatedEvent = {
  activeOrders: number;
  nextPickupTime: string | null;
};

let io: SocketIOServer | null = null;

export function initializeSocket(httpServer: HTTPServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error("Authentication required"));
      }

      // In production, verify JWT token here
      // For now, we'll decode the session info from the token
      socket.data.authenticated = true;
    } catch (error) {
      return next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket: ServerSocket) => {
    console.log("Socket connected:", socket.id);

    // Join staff room if user is staff/admin
    socket.on("join:staff", (userId: string, role: string) => {
      if (role === "STAFF" || role === "ADMIN") {
        socket.join("staff");
        console.log(`${userId} joined staff room`);
      }
    });

    // Join user-specific room
    socket.on("join:user", (userId: string) => {
      socket.join(`user:${userId}`);
      console.log(`${userId} joined their user room`);
    });

    // Join admin room
    socket.on("join:admin", (userId: string, role: string) => {
      if (role === "ADMIN") {
        socket.join("admin");
        console.log(`${userId} joined admin room`);
      }
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);
    });
  });

  return io;
}

export function getSocket(): SocketIOServer | null {
  return io;
}

export function emitOrderNew(event: OrderNewEvent): void {
  if (!io) return;
  io.to("staff").emit("order:new", event);
}

export function emitOrderReady(userId: string, event: OrderReadyEvent): void {
  if (!io) return;
  io.to(`user:${userId}`).emit("order:ready", event);
}

export function emitOrderCompleted(event: OrderCompletedEvent): void {
  if (!io) return;
  io.to("admin").emit("order:completed", event);
}

export function emitQueueUpdated(event: QueueUpdatedEvent): void {
  if (!io) return;
  io.to("staff").emit("queue:updated", event);
}