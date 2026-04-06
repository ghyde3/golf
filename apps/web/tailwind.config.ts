import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        forest: "#1a3a2a",
        fairway: "#2d5a3d",
        grass: "#4a8c5c",
        "light-grass": "#7ab88a",
        gold: "#c9a84c",
        "gold-light": "#f0d98a",
        cream: "#faf7f2",
        stone: "#e8e0d0",
        "warm-white": "#fefcf8",
        ink: "#1c2118",
        muted: "#6b7a6e",
        "sidebar-bg": "#1c1f1d",
        ds: {
          forest: "var(--forest)",
          fairway: "var(--fairway)",
          grass: "var(--grass)",
          "light-grass": "var(--light-grass)",
          morning: "var(--morning)",
          cream: "var(--cream)",
          stone: "var(--stone)",
          "warm-white": "var(--warm-white)",
          ink: "var(--ink)",
          muted: "var(--muted)",
          gold: "var(--gold)",
          "gold-light": "var(--gold-light)",
          "body-bg": "var(--body-bg)",
          "tag-green": "var(--tag-green-bg)",
          "tag-gold-bg": "var(--tag-gold-bg)",
          "tag-gold-fg": "var(--tag-gold-fg)",
        },
      },
      fontFamily: {
        sans: ['"DM Sans"', "var(--font-dm-sans)", "system-ui", "sans-serif"],
        display: [
          '"Playfair Display"',
          "var(--font-playfair)",
          "Georgia",
          "serif",
        ],
        mono: ['"DM Mono"', "var(--font-dm-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        search: "var(--shadow-search)",
        card: "var(--shadow-card)",
      },
    },
  },
  plugins: [],
};

export default config;
