// api-server/scripts/promote.js
// Usage: node scripts/promote.js me@test.com [role]
// Default role = "admin"

import "dotenv/config";
import mongoose from "mongoose";
import { User } from "../src/models/User.js";

const email = process.argv[2];
const role = process.argv[3] || "admin";

if (!email) {
  console.error("Usage: node scripts/promote.js <email> [role]");
  process.exit(1);
}

const DB_NAME = process.env.MONGODB_DB || "test"; // keep in sync with your app
try {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: DB_NAME });

  const u = await User.findOne({ email });
  if (!u) {
    console.error("User not found:", email);
    process.exitCode = 1;
  } else {
    const roles = new Set([...(u.roles || []), role]);
    u.roles = Array.from(roles);
    await u.save();
    console.log(`Promoted ${email} -> roles:`, u.roles);
  }
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
  process.exit(); // ensure the script ends
}

