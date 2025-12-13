/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        cyber: {
          black: "#050510",
          gray: "#0a0a1f",
          dark: "#02020a",
        },
        neon: {
          cyan: "#00f3ff",
          green: "#00ff9d",
          pink: "#ff003c",
          yellow: "#fcee0a",
          purple: "#9d00ff",
        },
      },
      fontFamily: {
        cyber: ["Orbitron", "sans-serif"],
        tech: ["Rajdhani", "sans-serif"],
      },
      backgroundImage: {
        "cyber-grid": "linear-gradient(to right, #0a0a1f 1px, transparent 1px), linear-gradient(to bottom, #0a0a1f 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
};


