import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#f4f4f5",
        muted: "#a1a1aa",
        panel: "#101014",
        line: "rgba(255,255,255,0.07)",
        accent: "#f00646",
      },
      borderRadius: {
        control: "10px",
        card: "14px",
        panel: "18px",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Consolas", "monospace"],
      },
      transitionTimingFunction: {
        swift: "cubic-bezier(.32,.72,0,1)",
      },
    },
  },
  plugins: [],
};

export default config;
