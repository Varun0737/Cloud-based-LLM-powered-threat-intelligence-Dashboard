import fetch from "node-fetch";

async function testNVD() {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 5); // Just 5 days
    const iso = (d) => d.toISOString().split(".")[0];

    const url = `https://services.nvd.nist.gov/rest/json/cves/2.0?pubStartDate=${iso(start)}&pubEndDate=${iso(end)}&resultsPerPage=5`;
    console.log("Fetching:", url);

    try {
        const r = await fetch(url, { headers: { "User-Agent": "test-script" } });
        if (!r.ok) throw new Error(r.statusText);
        const data = await r.json();

        console.log(`Got ${data.vulnerabilities.length} items`);

        for (const v of data.vulnerabilities) {
            const c = v.cve;
            console.log("\nCVE:", c.id);
            const vendor = extractVendorFromConfigurations(c.configurations);
            console.log("Extracted Vendor:", vendor);

            // Print raw cpes if vendor is null
            console.log("Source ID:", c.sourceIdentifier);
            if (!vendor) {
                // console.log("Configs:", JSON.stringify(c.configurations, null, 2));
            }
        }
    } catch (e) {
        console.error(e);
    }
}

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

testNVD();
