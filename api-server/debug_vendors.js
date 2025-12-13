import mongoose from "mongoose";
import CVE from "./src/models/CVE.js";
import dotenv from "dotenv";

dotenv.config();

mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/test")
    .then(async () => {
        console.log("Connected to Mongo");
        const count = await CVE.countDocuments();
        console.log(`Total CVEs: ${count}`);

        const sample = await CVE.find({}).limit(5);
        console.log("Sample CVEs:", JSON.stringify(sample, null, 2));

        const vendors = await CVE.find({ vendor: { $exists: true, $ne: "" } }).limit(5);
        console.log("CVEs with vendors:", vendors.length); // will be 0 if limit is applied but no matches found? allow simple count check

        const vendorCount = await CVE.countDocuments({ vendor: { $exists: true, $ne: "" } });
        console.log(`Total CVEs with defined vendor: ${vendorCount}`);

        process.exit(0);
    })
    .catch(e => {
        console.error(e);
        process.exit(1);
    });
