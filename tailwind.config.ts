import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0a0a0f",
          900: "#101018",
          800: "#181824",
          700: "#232334",
        },
        accent: {
          DEFAULT: "#8b5cf6",
          soft: "#a78bfa",
        },
      },
    },
  },
  plugins: [],
};

export default config;
