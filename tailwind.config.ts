import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./node_modules/@tremor/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Dark-mode-first neutral scale. 50 = darkest (page background),
        // 950 = lightest (primary text). Kept the same key names as the
        // original light scale so every existing `bg-ink-*`/`text-ink-*`
        // class in the app repaints automatically — no per-component
        // find/replace needed for the neutral palette.
        ink: {
          50: "#0a0b0f",
          100: "#12141b",
          200: "#20232d",
          300: "#2f333f",
          400: "#565c6c",
          500: "#7c8294",
          600: "#9aa0af",
          700: "#b7bbc4",
          800: "#d3d5da",
          900: "#e9eaed",
          950: "#f8f8f9",
        },
        // Primary accent — the one non black/white brand color, used for
        // links, active nav state, buttons, focus rings and chat accents.
        primary: {
          50: "#eafdfb",
          100: "#c8f8f2",
          200: "#93efe6",
          300: "#57ddd2",
          400: "#2bc4bb",
          500: "#14b8a6",
          600: "#0d9488",
          700: "#0f766e",
          800: "#115e56",
          900: "#134e47",
          950: "#042f2b",
        },
        severity: {
          1: "#6b9080",
          2: "#a4ac86",
          3: "#e0b04a",
          4: "#d1793d",
          5: "#b3432b",
        },
        // Extra hues used ONLY to give charts variety from one graph to the
        // next. Never used for AQI-severity meaning — that stays in
        // lib/aqi-scale.ts.
        chart: {
          teal: "#2bc4bb",
          violet: "#a78bfa",
          amber: "#fbbf24",
          rose: "#fb7185",
          sky: "#38bdf8",
          lime: "#a3e635",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
