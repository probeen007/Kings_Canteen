const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

(async () => {
  try {
    console.log("Testing DB connection...");
    await prisma.$connect();
    const count = await prisma.user.count();
    console.log("Connected. user count:", count);
    await prisma.$disconnect();
    process.exit(0);
  } catch (err) {
    console.error("DB connection failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
})();
