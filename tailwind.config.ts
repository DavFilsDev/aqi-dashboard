import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./node_modules/@tremor/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    {
      pattern:
        /^(bg|border|text|fill|stroke|ring)-(teal|cyan|emerald|amber|rose|violet|sky|lime|orange|gray|slate)-(50|100|200|300|400|500|600|700|800|900|950)$/,
      variants: ["hover", "dark", "dark:hover"],
    },
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
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
