// server.js (or index.js)
import "dotenv/config";
import mongoose from "mongoose";
import app from "./src/app.js";

const port = process.env.PORT || 8080;
const mongoUri = process.env.MONGODB_URI;

async function start() {
  if (!mongoUri) {
    console.error("[mongo] MONGODB_URI is missing in .env");
    process.exit(1);
  }

  try {
    // Connect to Mongo
    mongoose.set("strictQuery", true);
    await mongoose.connect(mongoUri, {
      autoIndex: true,           // helpful in dev; disable in prod if you manage indexes manually
      serverSelectionTimeoutMS: 15000,
    });
    console.log(`[mongo] connected → db: ${mongoose.connection.name}`);

    // Start HTTP server only after Mongo is ready
    const server = app.listen(port, () => {
      console.log(`API running at http://localhost:${port}`);
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      console.log(`\n[${signal}] shutting down...`);
      try {
        await mongoose.connection.close();
        server.close(() => {
          console.log("[http] closed");
          process.exit(0);
        });
      } catch (err) {
        console.error("[shutdown] error:", err);
        process.exit(1);
      }
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (err) {
    console.error("[mongo] connection failed:", err?.message || err);
    process.exit(1);
  }
}

start();

