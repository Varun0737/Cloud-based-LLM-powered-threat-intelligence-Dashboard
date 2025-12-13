import axios from "axios";
import ThreatReport from "../models/ThreatReport.js";

const RSS_URL = "https://feeds.feedburner.com/TheHackersNews";

export async function fetchSecurityNews() {
    try {
        console.log("[Scraper] Fetching RSS from:", RSS_URL);
        const res = await axios.get(RSS_URL);
        const xml = res.data;

        // Simple regex parsing to avoid heavy xml dependencies if possible, 
        // or we could use 'xml2js' if installed. Let's try simple parsing first 
        // to keep it lightweight, or better yet, let's install xml2js if we want robustness.
        // Actually, packet.json shows no xml parser. I'll use a robust regex approach 
        // or keep it simple. The Hacker News RSS is standard.

        // items usually in <item>...</item>
        const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
        console.log(`[Scraper] Found ${items.length} items.`);

        let added = 0;

        for (const itemStr of items) {
            const titleMatch = itemStr.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || itemStr.match(/<title>(.*?)<\/title>/);
            const linkMatch = itemStr.match(/<link>(.*?)<\/link>/);
            const dateMatch = itemStr.match(/<pubDate>(.*?)<\/pubDate>/);
            const descMatch = itemStr.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) || itemStr.match(/<description>(.*?)<\/description>/);

            if (titleMatch && linkMatch) {
                const title = titleMatch[1];
                const link = linkMatch[1];
                const pubDate = dateMatch ? new Date(dateMatch[1]) : new Date();
                const summary = descMatch ? descMatch[1].replace(/<[^>]*>?/gm, "") : ""; // strip html

                try {
                    await ThreatReport.findOneAndUpdate(
                        { title },
                        { title, link, summary, pubDate, source: "TheHackerNews" },
                        { upsert: true }
                    );
                    added++;
                } catch (e) {
                    // ignore dupes or errors
                }
            }
        }

        console.log(`[Scraper] Successfully synced ${added} articles.`);
        return { count: added };
    } catch (err) {
        console.error("[Scraper] Error:", err.message);
        throw err;
    }
}
