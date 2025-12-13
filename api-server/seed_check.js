import fetch from "node-fetch";

async function runSeed() {
    const TOTAL_TARGET = 100; // Small batch for test
    const PER_PAGE = 50;
    let fetched = 0;
    let startIndex = 0;

    console.log("Starting CVE seed (TEST MODE)...");

    try {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 60); // 60 days
        const iso = (d) => d.toISOString().split(".")[0];

        while (fetched < TOTAL_TARGET) {
            const nvdUrl =
                `https://services.nvd.nist.gov/rest/json/cves/2.0?` +
                `pubStartDate=${iso(start)}&pubEndDate=${iso(end)}&` +
                `resultsPerPage=${PER_PAGE}&startIndex=${startIndex}&noRejected`;

            console.log(`Fetching: ${nvdUrl}`);

            const r = await fetch(nvdUrl, {
                headers: {
                    "User-Agent": "threat-intel-debug-script"
                }
            });

            if (!r.ok) {
                console.error(`NVD Error ${r.status} ${r.statusText}`);
                const txt = await r.text();
                console.error("Body:", txt.slice(0, 200));
                break;
            }

            const data = await r.json();
            const vulnerabilities = data.vulnerabilities || [];
            console.log(`Got ${vulnerabilities.length} items`);

            if (vulnerabilities.length === 0) break;

            // Check vendor extraction
            let vendorsFound = 0;
            for (const v of vulnerabilities) {
                const c = v.cve;
                const vendor = extractVendorFromConfigurations(c.configurations) ||
                    extractVendorFromReferences(c.references) ||
                    extractVendorFromSource(c.sourceIdentifier);

                if (vendor) {
                    vendorsFound++;
                    console.log(`Found vendor: ${vendor} (ID: ${c.id})`);
                }
            }
            console.log(`Vendors found in batch: ${vendorsFound}/${vulnerabilities.length}`);

            fetched += vulnerabilities.length;
            startIndex += vulnerabilities.length;

            // Wait to respect rate limits
            await new Promise(r => setTimeout(r, 2000));
        }
        console.log("Seed complete.");
    } catch (e) {
        console.error("Seeding failed:", e);
    }
}

// Reuse extract functions
function extractVendorFromConfigurations(conf = {}) {
    try {
        const nodes = conf?.nodes || [];
        for (const node of nodes) {
            const matches = node.cpeMatch || node.cpe_match || [];
            for (const m of matches) {
                const crit = m.criteria || m.cpe23Uri || m.cpe23uri;
                if (typeof crit === "string" && crit.startsWith("cpe:2.3:")) {
                    const parts = crit.split(":");
                    if (parts.length > 4) return parts[3] || null;
                }
            }
            if (node.children?.length) {
                const v = extractVendorFromConfigurations({ nodes: node.children });
                if (v) return v;
            }
        }
    } catch (_) { }
    return null;
}

function extractVendorFromReferences(refs = []) {
    for (const r of refs) {
        try {
            const u = new URL(r.url);
            const host = u.hostname.replace(/^www\./, "");
            if (host.includes("adobe")) return "Adobe";
            if (host.includes("microsoft")) return "Microsoft";
            if (host.includes("google")) return "Google";
            if (host.includes("apple")) return "Apple";
            if (host.includes("cisco")) return "Cisco";
            if (host.includes("oracle")) return "Oracle";
            if (host.includes("ibm")) return "IBM";
            if (host.includes("linux") || host.includes("kernel.org")) return "Linux";
            if (host.includes("android")) return "Android";
            if (!host.includes("github") && !host.includes("nist") && !host.includes("mitre")) {
                const parts = host.split(".");
                if (parts.length >= 2) return parts[parts.length - 2].charAt(0).toUpperCase() + parts[parts.length - 2].slice(1);
            }
        } catch (_) { }
    }
    return null;
}

function extractVendorFromSource(src = "") {
    if (src.includes("@")) {
        const domain = src.split("@")[1];
        const parts = domain.split(".");
        if (parts.length >= 2) {
            const name = parts[parts.length - 2];
            return name.charAt(0).toUpperCase() + name.slice(1);
        }
    }
    return null;
}

runSeed();
