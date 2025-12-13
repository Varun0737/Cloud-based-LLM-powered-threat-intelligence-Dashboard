import React, { useEffect, useState, useMemo, useRef } from "react";
import Globe from "react-globe.gl";
import api from "../api";
import { COUNTRY_COORDS, ATTACK_SOURCES } from "../util/geoData";

// Helper: Get random item
const sample = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Generate "Attack" flows from CVEs
// Since CVEs don't have geo-data, we simulate realistic flows:
// - Source: Likely threat actors (heuristically) or random.
// - Target: Inferred from vendor (e.g. Microsoft -> USA) or random.
function generateFlows(cves) {
    const flows = [];
    const validCodes = Object.keys(COUNTRY_COORDS);

    cves.forEach((cve) => {
        // 1. Determine Source (Attacker)
        // Randomly pick from common threat actor countries for visualization drama
        const srcCode = sample(ATTACK_SOURCES);
        const src = COUNTRY_COORDS[srcCode];

        // 2. Determine Target (Victim)
        // Try to map vendor to country, else random
        let dstCode = sample(validCodes);

        // Simple vendor heuristics
        const v = (cve.vendor || "").toLowerCase();
        if (v.includes("microsoft") || v.includes("google") || v.includes("apple") || v.includes("cisco")) dstCode = "USA";
        else if (v.includes("huawei") || v.includes("dji")) dstCode = "CHN";
        else if (v.includes("samsung")) dstCode = "KOR";
        else if (v.includes("kaspersky")) dstCode = "RUS";
        else if (v.includes("siemens")) dstCode = "DEU";

        // Avoid self-attack for visual clarity (optional)
        if (srcCode === dstCode) return;

        const dst = COUNTRY_COORDS[dstCode];

        if (src && dst) {
            flows.push({
                id: cve.id,
                srcLat: src.lat,
                srcLng: src.lng,
                dstLat: dst.lat,
                dstLng: dst.lng,
                srcName: src.name,
                dstName: dst.name,
                severity: cve.severity || "UNKNOWN",
                color: cve.severity === "CRITICAL" ? "#ff003c" : cve.severity === "HIGH" ? "#fcee0a" : "#00f3ff",
                title: cve.title
            });
        }
    });

    return flows;
}

export default function CyberGlobe() {
    const globeRef = useRef();
    const containerRef = useRef();
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
    const [flows, setFlows] = useState([]);
    const [loading, setLoading] = useState(true);

    // Auto-resize globe to container
    useEffect(() => {
        const resizeObserver = new ResizeObserver((entries) => {
            if (entries.length === 0) return;
            const { width, height } = entries[0].contentRect;
            setDimensions({ width, height });
        });
        if (containerRef.current) resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, []);

    // Fetch real CVEs
    useEffect(() => {
        let mounted = true;
        const fetchStats = async () => {
            // ... existing fetch logic ...
            try {
                const token = localStorage.getItem("token");
                const res = await api.get("/api/cve/recent?limit=100", {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (mounted && res.data?.items) {
                    const newFlows = generateFlows(res.data.items);
                    setFlows(newFlows);
                }
            } catch (e) {
                console.error("Globe data error:", e);
            } finally {
                if (mounted) setLoading(false);
            }
        };
        fetchStats();

        // Auto-rotate
        if (globeRef.current) {
            globeRef.current.controls().autoRotate = true;
            globeRef.current.controls().autoRotateSpeed = 0.6;
            // Set initial distance
            globeRef.current.pointOfView({ altitude: 2.5 });
        }
        return () => { mounted = false; };
    }, []);

    return (
        <div ref={containerRef} className="relative w-full h-[600px] bg-cyber-black rounded-xl overflow-hidden border border-neon-cyan/30 shadow-[0_0_50px_rgba(0,243,255,0.1)] flex items-center justify-center">
            {/* 3D Globe */}
            <Globe
                ref={globeRef}
                width={dimensions.width}
                height={dimensions.height}
                backgroundColor="rgba(0,0,0,0)"
                globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
                bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"

                // Arcs (Attacks)
                arcsData={flows}
                arcColor={(d) => d.color} // Dynamic color
                arcDashLength={0.5}       // Longer trails
                arcDashGap={0.2}
                arcDashAnimateTime={1200} // Faster
                arcStroke={0.8}           // Thicker

                // Rings (Impact ripple)
                ringsData={flows}
                ringColor={(d) => d.color}
                ringMaxRadius={6}         // Larger
                ringPropagationSpeed={3}  // Faster
                ringRepeatPeriod={600}    // More frequent

                // Points (Source/Dest highlights)
                pointsData={flows.flatMap(f => [
                    { lat: f.srcLat, lng: f.srcLng, color: f.color === "#ff003c" ? "#ff003c" : "#00f3ff", radius: 0.3 },
                    { lat: f.dstLat, lng: f.dstLng, color: f.color, radius: 0.4 } // Victim slightly bigger
                ])}
                pointColor="color"
                pointRadius="radius"
                pointAltitude={0.01}
                pointResolution={12}

                // Atmosphere
                atmosphereColor="#00f3ff"
                atmosphereAltitude={0.2}
            />

            {/* Overlay UI */}
            <div className="absolute top-4 left-4 z-10 pointer-events-none">
                <h3 className="font-cyber text-neon-cyan text-xl tracking-widest drop-shadow-[0_0_5px_rgba(0,243,255,0.8)]">
                    LIVE THREAT MONITOR
                </h3>
                <p className="text-xs text-neon-cyan/60 font-mono">
                    Global Packet Interception
                </p>
            </div>

            {/* Live Feed Terminal */}
            <div className="absolute bottom-4 right-4 z-10 w-80 h-48 bg-black/80 backdrop-blur border border-gray-800 rounded p-3 overflow-hidden font-mono text-[10px] text-green-400">
                <div className="border-b border-gray-700 pb-1 mb-2 text-gray-400 uppercase tracking-wider text-xs">
                    Intercepted Packets
                </div>
                <div className="space-y-1 animate-pulse">
                    {flows.slice(0, 8).map((f) => (
                        <div key={f.id} className="truncate">
                            <span className={f.severity === "CRITICAL" ? "text-neon-pink" : "text-neon-cyan"}>
                                [{f.severity.substring(0, 4)}]
                            </span>{" "}
                            <span className="text-gray-300">{f.srcName}</span> &rarr; <span className="text-white">{f.dstName}</span> :: {f.id}
                        </div>
                    ))}
                </div>
            </div>

            {/* Loading State */}
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
                    <div className="text-neon-cyan font-cyber animate-pulse">
                        INITIALIZING SAT-LINK...
                    </div>
                </div>
            )}
        </div>
    );
}
