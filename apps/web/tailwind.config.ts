import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        paper: "#f1f5fb",
        line: "#dde6f0",
        surface: "#ffffff",
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
        },
        muted: "#64748b"
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
