/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#f1f0ff",
          100: "#e6e4ff",
          200: "#d0ccff",
          300: "#b0a8ff",
          400: "#8c7dfb",
          500: "#6d5bf3",
          600: "#5b3fe6",
          700: "#4c31c9",
          800: "#3f2ba2",
          900: "#352a80",
          950: "#1f1850",
        },
        ink: {
          900: "#0b1020",
          800: "#111832",
          700: "#1a2247",
        },
      },
      boxShadow: {
        premium: "0 1px 2px rgba(16,24,40,.04), 0 8px 24px -6px rgba(16,24,40,.08)",
        "premium-lg": "0 2px 4px rgba(16,24,40,.04), 0 24px 48px -12px rgba(16,24,40,.18)",
        glow: "0 8px 30px -6px rgba(109,91,243,.55)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-468px 0" },
          "100%": { backgroundPosition: "468px 0" },
        },
      },
      animation: {
        "fade-up": "fade-up .45s ease-out both",
        "fade-in": "fade-in .3s ease-out both",
        float: "float 6s ease-in-out infinite",
        shimmer: "shimmer 1.4s linear infinite",
      },
    },
  },
  plugins: [],
};
