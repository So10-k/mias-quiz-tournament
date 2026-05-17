import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sky1: "var(--sky-1)",
        sky2: "var(--sky-2)",
        sky3: "var(--sky-3)",
        sun: "var(--sun)",
        "sun-deep": "var(--sun-deep)",
        cloud: "var(--cloud)",
        grass: "var(--grass)",
        "grass-deep": "var(--grass-deep)",
        "grass-soft": "var(--grass-soft)",
        coral: "var(--coral)",
        "coral-deep": "var(--coral-deep)",
        "coral-soft": "var(--coral-soft)",
        berry: "var(--berry)",
        navy: "var(--navy)",
        "navy-soft": "var(--navy-soft)",
        gold: "var(--gold)",
      },
      fontFamily: {
        display: ['"Fredoka"', '"Quicksand"', "system-ui", "sans-serif"],
        body: ['"Quicksand"', "system-ui", "sans-serif"],
      },
      borderWidth: {
        "3": "3px",
      },
      boxShadow: {
        pop: "4px 4px 0 0 var(--navy)",
        "pop-lg": "8px 8px 0 0 var(--navy)",
        "pop-sm": "2px 2px 0 0 var(--navy)",
      },
    },
  },
  plugins: [],
};

export default config;
