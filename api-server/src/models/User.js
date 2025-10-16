// src/models/User.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import validator from "validator";

const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      validate: [validator.isEmail, "Invalid email"],
    },
    name: { type: String, trim: true, default: "" },
    passwordHash: { type: String, required: true, select: false },
    roles: { type: [String], default: ["user"] },

    // MFA settings (these are fine in the fields object)
    mfa: {
      enabled: { type: Boolean, default: false },
      secret: { type: String, select: false }, // base32 secret for OTPs
    },
  },
  {
    // ✅ Schema options go here
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        return ret;
      },
    },
  }
);

// Unique index for email (Mongo will enforce uniqueness)
UserSchema.index({ email: 1 }, { unique: true });

/**
 * Instance methods
 */
UserSchema.methods.checkPassword = function (plain) {
  return bcrypt.compare(plain || "", this.passwordHash);
};

UserSchema.methods.setPassword = async function (plain) {
  const hash = await bcrypt.hash(plain, 12);
  this.passwordHash = hash;
  return this.save();
};

/**
 * Statics
 */
UserSchema.statics.signup = async function ({ email, name, password }) {
  if (!email || !password) throw new Error("email and password required");
  if (password.length < 6) throw new Error("password must be at least 6 chars");

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const user = await this.create({ email, name: name || "", passwordHash });
    return user;
  } catch (e) {
    if (e && e.code === 11000) {
      throw new Error("Email already registered");
    }
    throw e;
  }
};

UserSchema.statics.verify = async function ({ email, password }) {
  const user = await this.findOne({ email }).select("+passwordHash");
  if (!user) return null;
  const ok = await user.checkPassword(password);
  return ok ? user : null;
};

export const User =
  mongoose.models.User || mongoose.model("User", UserSchema);
