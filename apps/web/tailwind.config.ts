import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
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
        sans: ["var(--font-dm-sans)", "DM Sans", "system-ui", "sans-serif"],
        display: [
          "var(--font-playfair)",
          "Playfair Display",
          "Georgia",
          "serif",
        ],
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
