import type { Config } from "tailwindcss";
import containerQueries from "@tailwindcss/container-queries";

// 모든 Themeable 색상은 CSS 변수(Token)를 거친다. 직접 Hex/red-* 사용 금지 (Master v2.0 §5).
const tok = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        shell: { DEFAULT: tok("theme-shell"), fg: tok("shell-fg"), muted: tok("shell-fg-muted"), line: tok("shell-line"), hover: tok("shell-hover"), active: tok("shell-active") },
        primary: { DEFAULT: tok("theme-primary"), fg: tok("primary-fg"), ink: tok("primary-ink") },
        secondary: tok("theme-secondary"),
        accent: { DEFAULT: tok("theme-accent"), ink: tok("accent-ink") },
        highlight: tok("theme-highlight"),
        soft: tok("theme-soft"),
        canvas: tok("neutral-canvas"),
        surface: { DEFAULT: tok("neutral-surface"), 2: tok("neutral-surface-2") },
        ink: { DEFAULT: tok("neutral-text"), 2: tok("neutral-text-2") },
        muted: tok("neutral-muted"),
        line: { DEFAULT: tok("neutral-border"), strong: tok("neutral-border-strong") },
        success: { DEFAULT: tok("sem-success"), soft: tok("sem-success-soft") },
        warning: { DEFAULT: tok("sem-warning"), soft: tok("sem-warning-soft") },
        danger: { DEFAULT: tok("sem-error"), soft: tok("sem-error-soft") },
        info: { DEFAULT: tok("sem-info"), soft: tok("sem-info-soft") },
        demo: { DEFAULT: tok("sem-demo"), soft: tok("sem-demo-soft") },
        grp: {
          ops: tok("grp-ops"),
          "ops-soft": tok("grp-ops-soft"),
          growth: tok("grp-growth"),
          "growth-soft": tok("grp-growth-soft"),
          intel: tok("grp-intel"),
          "intel-soft": tok("grp-intel-soft"),
          sys: tok("grp-sys"),
          "sys-soft": tok("grp-sys-soft"),
        },
      },
      fontFamily: {
        sans: ["var(--font-pretendard)", "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "18px",
        xl2: "22px",
      },
      boxShadow: {
        card: "0 1px 2px rgb(15 23 42 / 0.04), 0 1px 1px rgb(15 23 42 / 0.03)",
        raised: "0 6px 18px -6px rgb(15 23 42 / 0.16), 0 2px 6px -2px rgb(15 23 42 / 0.08)",
        pop: "0 18px 50px -12px rgb(15 23 42 / 0.35)",
      },
      // Container Query 기준은 px로 고정 (root font-size 변화와 무관하게 동작)
      containers: {
        xs: "380px",
        sm: "520px",
        md: "720px",
        lg: "960px",
        xl: "1180px",
        "2xl": "1400px",
      },
      keyframes: {
        "fade-up": { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "sheet-up": { from: { transform: "translateY(100%)" }, to: { transform: "translateY(0)" } },
        "drawer-in": { from: { transform: "translateX(100%)" }, to: { transform: "translateX(0)" } },
        "drawer-left": { from: { transform: "translateX(-100%)" }, to: { transform: "translateX(0)" } },
        "scale-in": { from: { opacity: "0", transform: "scale(0.97)" }, to: { opacity: "1", transform: "scale(1)" } },
        "bar-grow": { from: { transform: "scaleX(0)" }, to: { transform: "scaleX(1)" } },
        shimmer: { "0%": { backgroundPosition: "-400px 0" }, "100%": { backgroundPosition: "400px 0" } },
      },
      animation: {
        "fade-up": "fade-up 280ms cubic-bezier(0.2, 0.7, 0.2, 1) both",
        "fade-in": "fade-in 200ms ease-out both",
        "sheet-up": "sheet-up 220ms cubic-bezier(0.2, 0.8, 0.2, 1) both",
        "drawer-in": "drawer-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1) both",
        "drawer-left": "drawer-left 220ms cubic-bezier(0.2, 0.8, 0.2, 1) both",
        "scale-in": "scale-in 200ms cubic-bezier(0.2, 0.8, 0.2, 1) both",
        "bar-grow": "bar-grow 700ms cubic-bezier(0.2, 0.7, 0.2, 1) both",
        shimmer: "shimmer 1.4s linear infinite",
      },
    },
  },
  plugins: [containerQueries],
};

export default config;
