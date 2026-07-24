import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Fixed dark navy — NOT theme-aware, unlike `ink`. For decorative
        // elements deliberately dark in both themes: modal backdrop scrims,
        // filled dark buttons/tooltips/toasts, hero/CTA bands. `ink` itself
        // flips (it's the primary text colour), so anything that needs a
        // permanently-dark surface must reach for this instead.
        midnight: "#0f172a",
        // Semantic tokens — flip between light/dark via CSS variables in globals.css.
        ink: "rgb(var(--c-ink) / <alpha-value>)",
        paper: "rgb(var(--c-paper) / <alpha-value>)",
        line: "rgb(var(--c-line) / <alpha-value>)",
        surface: "rgb(var(--c-surface) / <alpha-value>)",
        muted: "rgb(var(--c-muted) / <alpha-value>)",
        // Neutral slate scale — variable-driven and INVERTED in dark mode, so
        // bg-slate-50 becomes a dark surface and text-slate-600 becomes light,
        // with no call-site changes. (2900+ usages across the app.)
        slate: {
          50: "rgb(var(--s-50) / <alpha-value>)",
          100: "rgb(var(--s-100) / <alpha-value>)",
          200: "rgb(var(--s-200) / <alpha-value>)",
          300: "rgb(var(--s-300) / <alpha-value>)",
          400: "rgb(var(--s-400) / <alpha-value>)",
          500: "rgb(var(--s-500) / <alpha-value>)",
          600: "rgb(var(--s-600) / <alpha-value>)",
          700: "rgb(var(--s-700) / <alpha-value>)",
          800: "rgb(var(--s-800) / <alpha-value>)",
          900: "rgb(var(--s-900) / <alpha-value>)",
          950: "rgb(var(--s-950) / <alpha-value>)"
        },
        // Brand colours — identical in both themes.
        civic: "#4f46e5",
        brand: "#2563eb",
        saffron: "#f59e0b",
        berry: "#e11d48",
        emerald: {
          DEFAULT: "#059669",
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
          800: "#065f46",
          900: "#064e3b",
          950: "#022c22"
        }
      },
      boxShadow: {
        soft: "0 8px 40px rgba(15, 23, 42, 0.08)",
        card: "0 2px 12px rgba(15, 23, 42, 0.06)",
        glow: "0 0 0 3px rgba(14, 159, 142, 0.15)"
      },
      fontFamily: {
        sans: ["Google Sans Text", "Inter", "Roboto", "system-ui", "sans-serif"],
        heading: ["Google Sans", "Plus Jakarta Sans", "Inter", "Roboto", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"]
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.25s ease-out"
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" }
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      }
    }
  },
  plugins: []
};

export default config;
