/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        room: {
          950: "#0B0C0E",
          900: "#111317",
          800: "#191c21",
          700: "#23262c",
          600: "#2f3239",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "'Geist Mono'", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
