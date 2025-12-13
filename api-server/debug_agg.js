import mongoose from "mongoose";
import CVE from "./src/models/CVE.js";

mongoose.connect("mongodb://localhost:27017/test")
    .then(async () => {
        console.log("Connected.");

        const agg = await CVE.aggregate([
            { $match: { vendor: { $exists: true, $ne: "" } } },
            { $group: { _id: "$vendor", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        console.log("Vendor Aggregation Result:", JSON.stringify(agg, null, 2));
        process.exit(0);
    })
    .catch(e => console.error(e));
