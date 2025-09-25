/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "#4F46E5",
          50: "#EDEEFF",
          100: "#D8D6FF",
          200: "#B3AEFF",
          300: "#8D85FF",
          400: "#685DFF",
          500: "#4F46E5",
          600: "#3730A3",
          700: "#2D2887",
          800: "#23206B",
          900: "#19184F"
        },
        secondary: {
          DEFAULT: "#6366F1",
          50: "#EBECFE",
          100: "#D7D9FD",
          200: "#AFB3FB",
          300: "#878DFA",
          400: "#6366F1",
          500: "#4F46E5",
          600: "#4338CA",
          700: "#3730A3",
          800: "#312E81",
          900: "#1E1B4B"
        },
        success: "#10B981",
        warning: "#F59E0B",
        danger: "#EF4444",
        emotional: {
          happy: "#FCD34D",
          neutral: "#9CA3AF",
          sad: "#6B7280",
          confused: "#F59E0B",
          tired: "#8B5CF6"
        }
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-in-out",
        "fade-in-up": "fadeInUp 0.5s ease-out",
        "slide-in": "slideIn 0.3s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        "scale-in": "scaleIn 0.3s ease-out",
        "bounce-in": "bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)",
        "shake": "shake 0.5s cubic-bezier(.36,.07,.19,.97) both",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "float": "float 3s ease-in-out infinite",
        "shimmer": "shimmer 2s linear infinite",
        "ken-burns": "kenBurns 20s ease-out infinite alternate",
        "confetti": "confetti 1s ease-out forwards",
        "flip-3d": "flip3d 0.6s ease-in-out",
        "rotate-3d": "rotate3d 10s linear infinite",
        "particle": "particle 10s linear infinite"
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" }
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        slideIn: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" }
        },
        slideUp: {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" }
        },
        scaleIn: {
          "0%": { transform: "scale(0.9)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" }
        },
        bounceIn: {
          "0%": { transform: "scale(0.3)", opacity: "0" },
          "50%": { transform: "scale(1.05)" },
          "70%": { transform: "scale(0.9)" },
          "100%": { transform: "scale(1)", opacity: "1" }
        },
        shake: {
          "10%, 90%": { transform: "translate3d(-1px, 0, 0)" },
          "20%, 80%": { transform: "translate3d(2px, 0, 0)" },
          "30%, 50%, 70%": { transform: "translate3d(-4px, 0, 0)" },
          "40%, 60%": { transform: "translate3d(4px, 0, 0)" }
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-20px)" }
        },
        shimmer: {
          "0%": { backgroundPosition: "-1000px 0" },
          "100%": { backgroundPosition: "1000px 0" }
        },
        kenBurns: {
          "0%": { transform: "scale(1) translate(0, 0)" },
          "100%": { transform: "scale(1.1) translate(-10px, -10px)" }
        },
        confetti: {
          "0%": { transform: "translateY(0) rotateZ(0deg)", opacity: "1" },
          "100%": { transform: "translateY(1000px) rotateZ(720deg)", opacity: "0" }
        },
        flip3d: {
          "0%": { transform: "rotateY(0deg)" },
          "100%": { transform: "rotateY(360deg)" }
        },
        rotate3d: {
          "0%": { transform: "rotate3d(0, 1, 0, 0deg)" },
          "100%": { transform: "rotate3d(0, 1, 0, 360deg)" }
        },
        particle: {
          "0%": { transform: "translate(0, 0) scale(1)", opacity: "1" },
          "50%": { transform: "translate(100px, -100px) scale(0.5)", opacity: "0.5" },
          "100%": { transform: "translate(-100px, 100px) scale(0)", opacity: "0" }
        }
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "gradient-primary": "linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)",
        "gradient-success": "linear-gradient(135deg, #10B981 0%, #34D399 100%)",
        "gradient-warning": "linear-gradient(135deg, #F59E0B 0%, #FCD34D 100%)",
        "gradient-danger": "linear-gradient(135deg, #EF4444 0%, #F87171 100%)"
      },
      backdropFilter: {
        "glass": "blur(10px)"
      }
    },
  },
  plugins: [],
};