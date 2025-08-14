import type { Config } from "tailwindcss";

export default {
  content: [
    "./design/**/*.{html,ts,tsx,js,css}",
    "./dapp/**/*.{html,js,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(225, 9%, 8%)",
        primary: "hsl(217, 91%, 60%)",
        secondary: "hsl(185, 94%, 35%)",
        success: "hsl(142, 71%, 45%)",
        surface: "hsl(225, 14%, 12%)",
        ink: "hsl(214, 32%, 92%)",
        muted: "hsl(213, 20%, 72%)",
        border: "hsl(223, 18%, 24%)"
      },
      fontFamily: {
        inter: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      boxShadow: {
        quantum: "0 10px 30px rgba(0,0,0,.35), 0 0 60px -20px hsla(217, 91%, 60%, .35)"
      },
      borderRadius: { xl: "18px" },
      keyframes: {
        pulse: { "0%,100%": { opacity: .5 }, "50%": { opacity: 1 } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-6px)" } }
      },
      animation: {
        pulse: "pulse 1.6s ease-in-out infinite",
        float: "float 6s ease-in-out infinite"
      }
    }
  },
  plugins: []
} satisfies Config;
