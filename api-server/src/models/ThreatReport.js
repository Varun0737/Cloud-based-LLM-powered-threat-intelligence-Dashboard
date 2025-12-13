import mongoose from "mongoose";

const threatReportSchema = new mongoose.Schema({
    title: { type: String, required: true, unique: true },
    link: { type: String, required: true },
    summary: { type: String },
    pubDate: { type: Date },
    source: { type: String, default: "HackerNews" },
    fetchedAt: { type: Date, default: Date.now },
});

// Index for quick retrieval by date
threatReportSchema.index({ pubDate: -1 });

const ThreatReport = mongoose.model("ThreatReport", threatReportSchema);
export default ThreatReport;
