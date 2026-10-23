/**
 * Canonical 7 Theme (Master v4.0 §C) — Theme 수는 7개로 고정, 각 Theme는 6개 Core Token.
 * 이 파일이 Theme Hex 값의 유일한 정의 위치다. (컴포넌트에서 Hex 직접 사용 금지)
 *
 * 01 Deep Navy Blue는 이다플레이스 AX프론트 레퍼런스(차콜 네이비 + 오렌지)에 맞춰
 * Master v2.0 §6 "7개 중 1개를 Default Seed로 선택 후 브랜드에 맞춰 미세조정" 규칙에 따라
 * `brandTune`을 기본 적용한다. 설정에서 끄면 원본 Canonical 값으로 즉시 복귀한다.
 */

export type ThemeId = "t01" | "t02" | "t03" | "t04" | "t05" | "t06" | "t07";

export interface CorePalette {
  shell: string;
  primary: string;
  secondary: string;
  accent: string;
  highlight: string;
  soft: string;
}

export interface ThemeDef {
  id: ThemeId;
  no: string;
  name: string;
  nameKo: string;
  palette: CorePalette;
  /** 다크 Shell 여부 — Sidebar 글자색 규칙 분기 (Master v6.3 Dark Sidebar Readability) */
  darkShell: boolean;
}

export const BRAND_TUNE_T01: CorePalette = {
  shell: "#121A2A",
  primary: "#DB5D1F",
  secondary: "#1687A7",
  accent: "#17A889",
  highlight: "#F2B27A",
  soft: "#FCEEE5",
};

export const THEMES: ThemeDef[] = [
  { id: "t01", no: "01", name: "Deep Navy Blue", nameKo: "딥 네이비 블루", darkShell: true,
    palette: { shell: "#0B1830", primary: "#2457D6", secondary: "#1687A7", accent: "#17A889", highlight: "#E7C873", soft: "#DCE8F7" } },
  { id: "t02", no: "02", name: "Navy Gold", nameKo: "네이비 골드", darkShell: true,
    palette: { shell: "#111A2D", primary: "#2847A7", secondary: "#A37A28", accent: "#D0A84B", highlight: "#F0D995", soft: "#EFE8D7" } },
  { id: "t03", no: "03", name: "Emerald Gold", nameKo: "에메랄드 골드", darkShell: true,
    palette: { shell: "#11332B", primary: "#0E7663", secondary: "#2C9277", accent: "#B4862A", highlight: "#E8CE88", soft: "#E2F0EA" } },
  { id: "t04", no: "04", name: "Forest Sage", nameKo: "포레스트 세이지", darkShell: true,
    palette: { shell: "#17352C", primary: "#356E58", secondary: "#73977E", accent: "#A58E4D", highlight: "#D9D2AA", soft: "#E5ECE5" } },
  { id: "t05", no: "05", name: "Deep Teal", nameKo: "딥 틸", darkShell: true,
    palette: { shell: "#08323A", primary: "#087A83", secondary: "#1597A3", accent: "#D2704C", highlight: "#E9B59B", soft: "#DDEDEF" } },
  { id: "t06", no: "06", name: "Onyx Gold", nameKo: "오닉스 골드", darkShell: true,
    palette: { shell: "#15171C", primary: "#343942", secondary: "#6A717C", accent: "#B89032", highlight: "#E0C76F", soft: "#E6E8EC" } },
  { id: "t07", no: "07", name: "Pure White", nameKo: "퓨어 화이트", darkShell: false,
    palette: { shell: "#FFFFFF", primary: "#171B20", secondary: "#343B44", accent: "#6B7680", highlight: "#D47A4A", soft: "#FAFAF8" } },
];

export const DEFAULT_THEME: ThemeId = "t01";

export function getTheme(id: ThemeId): ThemeDef {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export function effectivePalette(id: ThemeId, brandTune: boolean): CorePalette {
  if (id === "t01" && brandTune) return BRAND_TUNE_T01;
  return getTheme(id).palette;
}

// ───────── 색 계산 유틸 (대비 검증 · 파생 Token) ─────────

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: [number, number, number]): string {
  return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("").toUpperCase();
}

function channel(c: number) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex([ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t]);
}

/** 흰 배경 위 글자로 쓸 때 4.5:1 이상이 되도록 어둡게 조정한 색 */
export function inkOn(hex: string, bg = "#FFFFFF", target = 4.5): string {
  let c = hex;
  for (let i = 0; i < 20 && contrast(c, bg) < target; i++) c = mix(c, "#000000", 0.08);
  return c;
}

/** 해당 배경 위에서 더 읽기 좋은 글자색 (흰색 우선) */
export function fgFor(bg: string): string {
  return contrast("#FFFFFF", bg) >= 3.2 ? "#FFFFFF" : "#111827";
}

const triplet = (hex: string) => hexToRgb(hex).join(" ");

export interface DerivedTokens {
  [k: string]: string;
}

export function deriveTokens(def: ThemeDef, p: CorePalette): DerivedTokens {
  const dark = def.darkShell;
  return {
    "theme-shell": triplet(p.shell),
    "theme-primary": triplet(p.primary),
    "theme-secondary": triplet(p.secondary),
    "theme-accent": triplet(p.accent),
    "theme-highlight": triplet(p.highlight),
    "theme-soft": triplet(p.soft),
    "primary-fg": triplet(fgFor(p.primary)),
    "primary-ink": triplet(inkOn(p.primary)),
    "accent-ink": triplet(inkOn(p.accent)),
    // Dark Sidebar: Text는 Theme Hue에 물들지 않는 White 계열 (Master v6.3)
    "shell-fg": triplet(dark ? "#F3F5F8" : "#171B20"),
    "shell-fg-muted": triplet(dark ? "#AEB7C3" : "#5B6472"),
    "shell-line": triplet(dark ? mix(p.shell, "#FFFFFF", 0.12) : "#E7EAEE"),
    "shell-hover": triplet(dark ? mix(p.shell, "#FFFFFF", 0.07) : "#F3F4F6"),
    "shell-active": triplet(dark ? mix(p.shell, "#FFFFFF", 0.11) : "#F1F2F4"),
    // Neutral — Theme와 분리된 가독성 고정값
    "neutral-canvas": triplet(def.id === "t07" ? "#FFFFFF" : "#F3F5F8"),
  };
}

export const NEUTRAL_AND_SEMANTIC: DerivedTokens = {
  "neutral-surface": triplet("#FFFFFF"),
  "neutral-surface-2": triplet("#F8F9FB"),
  "neutral-text": triplet("#111827"),
  "neutral-text-2": triplet("#374151"),
  "neutral-muted": triplet("#5B6472"),
  "neutral-border": triplet("#E5E7EB"),
  "neutral-border-strong": triplet("#CFD5DD"),
  // Semantic (Error Red는 의미상 Error/Risk에만 사용)
  "sem-success": triplet("#15803D"),
  "sem-success-soft": triplet("#DCFCE7"),
  "sem-warning": triplet("#B45309"),
  "sem-warning-soft": triplet("#FEF3C7"),
  "sem-error": triplet("#B91C1C"),
  "sem-error-soft": triplet("#FEE2E2"),
  "sem-info": triplet("#1D4ED8"),
  "sem-info-soft": triplet("#DBEAFE"),
  "sem-demo": triplet("#334155"),
  "sem-demo-soft": triplet("#EEF1F5"),
  // Sidebar Group Hue (Master v4.0 §B-2) — 같은 Group은 같은 Hue
  "grp-ops": triplet("#5B8DEF"),
  "grp-ops-soft": triplet("#E8F0FD"),
  "grp-growth": triplet("#D79A43"),
  "grp-growth-soft": triplet("#FBF1E3"),
  "grp-intel": triplet("#3C9A75"),
  "grp-intel-soft": triplet("#E3F3EC"),
  "grp-sys": triplet("#718096"),
  "grp-sys-soft": triplet("#EDF0F4"),
};

/** SSR에서 그대로 주입되는 Theme CSS — data-theme / data-brand 속성으로 전환 */
export function buildThemeCss(): string {
  const root = Object.entries(NEUTRAL_AND_SEMANTIC).map(([k, v]) => `--${k}:${v};`).join("");
  const blocks: string[] = [`:root{${root}}`];
  for (const def of THEMES) {
    const t = deriveTokens(def, def.palette);
    blocks.push(`[data-theme="${def.id}"]{${Object.entries(t).map(([k, v]) => `--${k}:${v};`).join("")}}`);
  }
  const t01 = getTheme("t01");
  const tuned = deriveTokens(t01, BRAND_TUNE_T01);
  blocks.push(`[data-theme="t01"][data-brand="on"]{${Object.entries(tuned).map(([k, v]) => `--${k}:${v};`).join("")}}`);
  return blocks.join("\n");
}
