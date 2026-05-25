import type { Config } from "tailwindcss";
const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#2563eb", 600: "#2563eb", 700: "#1d4ed8" },
      },
    },
  },
  plugins: [],
};
export default config;
