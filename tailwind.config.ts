import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Apple-inspired neutrals: near-black text, soft gray surfaces,
        // hairline separators, one blue accent.
        ink: "#1d1d1f",
        muted: "#86868b",
        surface: "#f5f5f7",
        hairline: "#d2d2d7",
        accent: {
          DEFAULT: "#0071e3",
          hover: "#0077ed",
        },
      },
    },
  },
  plugins: [],
};

export default config;
