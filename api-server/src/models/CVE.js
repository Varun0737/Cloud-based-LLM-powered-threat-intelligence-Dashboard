import mongoose from "mongoose";

const cveSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    title: String,
    summary: String,
    vendor: String,
    published: Date,
    severity: String, // CRITICAL, HIGH, MEDIUM, LOW
    score: Number,
    lastModified: Date,
    source: { type: String, default: "NVD" },
});

// Index for faster stats aggregation
cveSchema.index({ severity: 1 });
cveSchema.index({ published: -1 });
cveSchema.index({ title: "text", summary: "text", id: "text", vendor: "text" });

const CVE = mongoose.model("CVE", cveSchema);
export default CVE;
