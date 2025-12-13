import mongoose from "mongoose";
import CVE from "./src/models/CVE.js";

mongoose.connect("mongodb://localhost:27017/test")
    .then(async () => {
        console.log("Connected.");
        const cve = await CVE.findOne({ vendor: { $exists: true, $ne: null } });
        if (cve) {
            console.log("Found CVE with vendor:", cve.vendor);
        } else {
            console.log("No CVEs with vendor found.");
            const any = await CVE.findOne();
            console.log("Sample arbitrary CVE:", any);
        }
        process.exit(0);
    })
    .catch(e => console.error(e));
