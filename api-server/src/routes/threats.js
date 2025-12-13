import { Router } from "express";

const router = Router();

// Synthesized data based on 2024-2025 Threat Intelligence Reports
// Sources: Check Point, CrowdStrike, IBM X-Force, Microsoft Digital Defense Report
// Note: "Count" is a normalized representation of attack volume/intensity.

const THREAT_FLOWS = [
    // MAJOR STATE-SPONSORED FLOWS
    { source: "RUS", target: "UKR", count: 4500, type: "Warfare/Wiper" },
    { source: "RUS", target: "POL", count: 3200, type: "Espionage/DDoS" },
    { source: "RUS", target: "USA", count: 2800, type: "Ransomware/Espionage" },
    { source: "RUS", target: "DEU", count: 1500, type: "Espionage" },
    { source: "CHN", target: "USA", count: 4100, type: "Espionage/IP Theft" },
    { source: "CHN", target: "TWN", count: 3800, type: "Intimidation" },
    { source: "CHN", target: "IND", count: 1200, type: "Probing" },
    { source: "CHN", target: "PHL", count: 900, type: "Espionage" },
    { source: "PRK", target: "KOR", count: 2500, type: "Espionage/Crypto Theft" },
    { source: "PRK", target: "JPN", count: 1100, type: "Espionage" },
    { source: "PRK", target: "USA", count: 800, type: "Finance" },
    { source: "IRN", target: "ISR", count: 3500, type: "Destructive" },
    { source: "IRN", target: "SAU", count: 1100, type: "Espionage" },
    { source: "IRN", target: "USA", count: 900, type: "Influence" },

    // RANSOMWARE & CRIMINAL FLOWS (Broad origins)
    // Attributing to "Unknown" or major hubs if specific source obscured
    { source: "BRA", target: "USA", count: 400, type: "Banking Trojan" },
    { source: "BRA", target: "ESP", count: 300, type: "Banking Trojan" },
    { source: "VNM", target: "SGP", count: 600, type: "Phishing" },
    { source: "NGA", target: "GBR", count: 500, type: "Fraud" },
    { source: "NGA", target: "USA", count: 700, type: "Fraud" },

    // LATIN AMERICA SURGE
    { source: "RUS", target: "COL", count: 400, type: "Ransomware" },
    { source: "CHN", target: "BRA", count: 500, type: "Espionage" },
];

/**
 * GET /api/threats/flow
 * Returns list of { source: ISO3, target: ISO3, count, type }
 */
router.get("/flow", (req, res) => {
    // Simulate slight variation in counts to make it feel "live"
    const liveData = THREAT_FLOWS.map(f => ({
        ...f,
        count: Math.floor(f.count * (0.9 + Math.random() * 0.2)) // +/- 10%
    }));
    res.json({ items: liveData });
});

export default router;
