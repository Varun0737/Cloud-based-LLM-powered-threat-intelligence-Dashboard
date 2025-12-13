import mongoose from "mongoose";
import CVE from "./src/models/CVE.js";

mongoose.connect("mongodb://127.0.0.1:27017/test")
    .then(async () => {
        console.log("Connected to Mongo");

        // Check raw count of valid vendors
        const validCount = await CVE.countDocuments({ vendor: { $exists: true, $ne: null } });
        console.log("Docs with non-null vendor:", validCount);

        const agg = await CVE.aggregate([
            { $match: { vendor: { $exists: true, $ne: null } } },
            { $match: { vendor: { $ne: "" } } },
            { $group: { _id: "$vendor", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        console.log("Aggregation Result:");
        console.log(JSON.stringify(agg, null, 2));

        process.exit(0);
    })
    .catch(e => {
        console.error(e);
        process.exit(1);
    });
