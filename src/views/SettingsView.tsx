"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { Palette, Type, Users, RotateCcw, GraduationCap, Database, Sparkles, PlugZap, Check, X, Minus, Download, Upload, FlaskConical } from "lucide-react";
import { useStore } from "@/components/providers/StoreProvider";
import { Badge, Button, Card, CardHeader, KV, PageHeader, Segmented } from "@/components/ui/primitives";
import { Overlay } from "@/components/ui/Overlay";
import { useToast } from "@/components/ui/Toast";
import { THEMES, BRAND_TUNE_T01, type ThemeId } from "@/lib/theme/themes";
import { ROLE_META, ROLE_ORDER, PERMISSION_MATRIX, can } from "@/domain/permissions";
import { resetDemo, setBrandTune, setFontScale, setReduceMotion, setRole, setTheme, createTask } from "@/lib/store/actions";
import { startTour } from "@/components/tour/Tour";
import { fetchAccessConfig } from "@/lib/access/client";
import type { AccessConfig } from "@/lib/access/contract";
import { fmtInstant, isValidDate } from "@/domain/time";
import { CATEGORIES, CATEGORY_META } from "@/domain/readiness";
import type { FontScale, OpeningCategory } from "@/domain/types";
import { axActor } from "@/lib/store/actor";
import { isStorageBroken } from "@/lib/store/repository";
import { Notice } from "./shared";

const SAMPLE_CSV = `title,category,dueDate,required\n로비 사인물 설치 확인,FACILITY,2026-11-02,true\n객실 커튼 교체 확인,ROOM,2026-11-03,false\n`;

function parseCsv(text: string) {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  const errors: string[] = [];
  const rows: { title: string; category: OpeningCategory; dueDate: string; required: boolean }[] = [];
  if (!lines.length) return { rows, errors: ["빈 파일입니다."] };
  const head = lines[0].split(",").map((h) => h.trim());
  const need = ["title", "category", "dueDate", "required"];
  if (need.some((n, i) => head[i] !== n)) return { rows, errors: [`첫 줄은 ${need.join(",")} 이어야 합니다.`] };
  lines.slice(1, 51).forEach((l, i) => {
    const [title, category, dueDate, required] = l.split(",").map((x) => x.trim());
    const n = i + 2;
    if (!title || title.length > 40) errors.push(`${n}행: 업무명(1~40자)`);
    else if (!CATEGORIES.includes(category as OpeningCategory)) errors.push(`${n}행: category는 ${CATEGORIES.join("/")}`);
    else if (!isValidDate(dueDate)) errors.push(`${n}행: dueDate 형식 YYYY-MM-DD`);
    else if (required !== "true" && required !== "false") errors.push(`${n}행: required는 true/false`);
    else rows.push({ title, category: category as OpeningCategory, dueDate, required: required === "true" });
  });
  return { rows, errors };
}

export function SettingsView() {
  const s = useStore();
  const toast = useToast();
  const [resetOpen, setResetOpen] = useState(false);
  const [config, setConfig] = useState<AccessConfig | null>(null);
  const [csv, setCsv] = useState<ReturnType<typeof parseCsv> | null>(null);
  const [storageWarn, setStorageWarn] = useState(false);
  useEffect(() => {
    fetchAccessConfig().then(setConfig);
    setStorageWarn(isStorageBroken());
  }, []);
  const canReset = can(s.ui.role, "demo.reset");
  const actor = axActor(s);
  return (
    <div className="animate-fade-up">
      <PageHeader title="설정" subtitle="화면 · 역할 미리보기 · 데모 · 데이터 · AI · 연동 준비 상태" eyebrow={<Badge tone="demo">DEMO 환경</Badge>} />
      {storageWarn && <Notice tone="warning" className="mb-4">브라우저 저장소를 사용할 수 없어 새로고침 시 데모 데이터가 초기화됩니다. (시크릿 모드 등)</Notice>}
      <nav aria-label="설정 목차" className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
        {[["display", "화면"], ["roles", "사용자·권한"], ["demo", "데모"], ["data", "데이터"], ["ai", "AI"], ["integration", "연동 준비"]].map(([id, l]) => (
          <a key={id} href={`#${id}`} className="press shrink-0 rounded-full border border-line bg-surface px-3 py-1.5 text-[0.82rem] font-semibold hover:bg-surface-2">{l}</a>
        ))}
      </nav>
      <div className="space-y-4">
        <Card id="display" testId="settings-display">
          <CardHeader title="화면 · Theme" icon={Palette} iconTone="sys" subtitle="Canonical 7 Theme · PC·Mobile·고객 화면에 같은 상태 적용" />
          <div className="grid gap-3 p-5 @md/shell:grid-cols-2 @xl/shell:grid-cols-4" role="radiogroup" aria-label="Theme" data-testid="theme-picker">
            {THEMES.map((t) => {
              const pal = t.id === "t01" && s.ui.brandTune ? BRAND_TUNE_T01 : t.palette;
              const active = s.ui.theme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  data-testid={`theme-${t.id}`}
                  onClick={() => setTheme(t.id as ThemeId)}
                  className={clsx("press card-hover rounded-2xl border p-3 text-left", active ? "border-primary ring-2 ring-primary/30" : "border-line")}
                >
                  <div className="flex h-12 overflow-hidden rounded-xl ring-1 ring-line" aria-hidden>
                    {Object.values(pal).map((c, i) => (
                      <span key={i} className="flex-1" style={{ background: c }} />
                    ))}
                  </div>
                  <p className="mt-2 flex items-center justify-between text-[0.88rem] font-bold">
                    {t.no} {t.name}
                    {active && <Check className="h-4 w-4 text-primary-ink" aria-hidden />}
                  </p>
                  <p className="text-[0.74rem] text-muted">{t.nameKo}{t.id === "t01" && s.ui.brandTune ? " · StayOps 브랜드 조정(기본)" : ""}</p>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line px-5 py-4">
            <label className="flex items-center gap-2 text-[0.88rem] font-semibold">
              <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--theme-primary))]" checked={s.ui.brandTune} onChange={(e) => setBrandTune(e.target.checked)} data-testid="brand-tune" />
              01 Theme에 StayOps 브랜드 조정(차콜 네이비 + 오렌지) 적용
            </label>
            <div className="flex items-center gap-2">
              <Type className="h-4 w-4 text-muted" aria-hidden />
              <span className="text-[0.88rem] font-semibold">글자 크기</span>
              <Segmented<FontScale>
                size="sm"
                value={s.ui.fontScale}
                onChange={(v) => setFontScale(v)}
                testId="font-scale"
                ariaLabel="글자 크기"
                options={[
                  { value: "SM", label: "작게", testId: "font-SM" },
                  { value: "MD", label: "기본", testId: "font-MD" },
                  { value: "LG", label: "크게", testId: "font-LG" },
                ]}
              />
            </div>
            <label className="flex items-center gap-2 text-[0.88rem] font-semibold">
              <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--theme-primary))]" checked={s.ui.reduceMotion} onChange={(e) => setReduceMotion(e.target.checked)} data-testid="reduce-motion" />
              모션 줄이기
            </label>
          </div>
        </Card>

        <Card id="roles" testId="settings-roles">
          <CardHeader title="사용자 · 권한 미리보기" icon={Users} iconTone="ops" subtitle="Demo Role 전환 — 실제 운영 보안 아님 (운영 전 Supabase Auth + RLS + 서버 권한 검증 필수)" />
          <div className="grid gap-2 p-5 @md/shell:grid-cols-2 @xl/shell:grid-cols-4">
            {ROLE_ORDER.map((r) => (
              <button key={r} type="button" onClick={() => setRole(r)} aria-pressed={s.ui.role === r} data-testid={`settings-role-${r}`} className={clsx("press rounded-2xl border p-3 text-left", s.ui.role === r ? "border-primary bg-soft/60 ring-2 ring-primary/25" : "border-line hover:bg-surface-2")}>
                <p className="font-bold">{ROLE_META[r].label}</p>
                <p className="text-[0.76rem] text-muted">{ROLE_META[r].org} · {ROLE_META[r].desc}</p>
              </button>
            ))}
          </div>
          <div className="scrollbar-thin overflow-x-auto px-5 pb-5">
            <table className="w-full min-w-[640px] text-[0.84rem]" data-testid="permission-matrix">
              <thead>
                <tr className="border-b border-line text-left text-[0.76rem] text-muted">
                  <th className="py-2 pr-3 font-bold">권한</th>
                  {ROLE_ORDER.map((r) => <th key={r} className="px-2 py-2 text-center font-bold">{ROLE_META[r].short}</th>)}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_MATRIX.map((p) => (
                  <tr key={p.perm} className="row-hover border-b border-line">
                    <td className="py-2 pr-3">
                      {p.label}
                      {p.note && <span className="block text-[0.7rem] text-muted">{p.note}</span>}
                    </td>
                    {ROLE_ORDER.map((r) => (
                      <td key={r} className="px-2 py-2 text-center">
                        {can(r, p.perm) ? <Check className="mx-auto h-4 w-4 text-success" aria-label="허용" /> : p.perm === "view.reservations" && r === "STAFF" ? <Minus className="mx-auto h-4 w-4 text-warning" aria-label="제한" /> : <X className="mx-auto h-4 w-4 text-muted" aria-label="불가" />}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card id="demo" testId="settings-demo">
          <CardHeader title="데모" icon={FlaskConical} iconTone="intel" subtitle="미팅 전 초기화 · 튜토리얼 · 상태 표시" />
          <div className="grid gap-4 p-5 @lg/shell:grid-cols-2">
            <div className="rounded-2xl bg-surface-2 px-4 py-2">
              <KV k="운영 모드" v={<Badge tone="demo">DEMO</Badge>} />
              <KV k="LIVE 전환 조건" v="실운영 계약 · 실데이터 · 공식 API · 보안 검증" />
              <KV k="데모 초기화 횟수" v={`${s.counters.demoResets}회`} />
              <KV k="Seed 생성" v={fmtInstant(s.seededAt)} />
            </div>
            <div className="flex flex-col gap-2">
              <Button variant="danger" icon={RotateCcw} disabled={!canReset} onClick={() => setResetOpen(true)} data-testid="demo-reset">
                데모 초기화 (Demo Reset)
              </Button>
              {!canReset && <p className="text-[0.78rem] text-muted">관리자 역할에서만 초기화할 수 있습니다.</p>}
              <Button variant="secondary" icon={GraduationCap} onClick={() => startTour("tutorial")} data-testid="replay-tutorial">튜토리얼 다시 보기</Button>
              <p className="text-[0.78rem] text-muted">초기화는 이 브라우저의 데모 저장소만 원상복구합니다. 실제 운영 데이터에는 적용되지 않습니다(실운영 데이터 없음).</p>
            </div>
          </div>
        </Card>

        <Card id="data" testId="settings-data">
          <CardHeader title="데이터" icon={Database} iconTone="ops" subtitle="Data Source · Provenance · 가져오기 준비" />
          <div className="grid gap-4 p-5 @lg/shell:grid-cols-2">
            <div className="rounded-2xl bg-surface-2 px-4 py-2">
              <KV k="Data Source" v="DemoRepository (localStorage · 이 브라우저)" />
              <KV k="동기화" v="storage 이벤트 + BroadcastChannel (PC ↔ Mobile iframe)" />
              <KV k="마지막 업데이트" v={fmtInstant(s.updatedAt, { seconds: true })} mono />
              <KV k="Revision" v={s.rev} mono />
              <KV k="운영 DB" v={<Badge tone="warning">Supabase 미연결</Badge>} />
            </div>
            <div className="space-y-2">
              <p className="text-[0.88rem] font-bold">개업 준비 업무 CSV 가져오기 (P1 · 데모)</p>
              <p className="text-[0.78rem] text-muted">필드: title, category({CATEGORIES.join("/")}), dueDate(YYYY-MM-DD), required(true/false) · 최대 50행</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  icon={Download}
                  onClick={() => {
                    const url = URL.createObjectURL(new Blob(["﻿" + SAMPLE_CSV], { type: "text/csv;charset=utf-8" }));
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "stayops_opening_tasks_sample.csv";
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  샘플 파일
                </Button>
                <label className="press inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 text-[0.8rem] font-semibold hover:bg-surface-2">
                  <Upload className="h-4 w-4" aria-hidden /> 파일 선택
                  <input type="file" accept=".csv,text/csv" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setCsv(parseCsv(await f.text())); e.target.value = ""; }} data-testid="csv-input" />
                </label>
              </div>
              {csv && (
                <div className="rounded-xl border border-line p-3 text-[0.82rem]" data-testid="csv-preview">
                  <p className="font-bold">검증 결과: 정상 {csv.rows.length}행 · 오류 {csv.errors.length}건</p>
                  {csv.errors.slice(0, 4).map((e) => <p key={e} className="text-danger">{e}</p>)}
                  {csv.rows.length > 0 && can(s.ui.role, "edit.preopening") && (
                    <Button size="sm" className="mt-2" onClick={() => { csv.rows.forEach((r) => createTask({ ...r, assigneeId: undefined }, actor)); toast({ tone: "success", title: `${csv.rows.length}개 업무를 가져왔습니다`, body: "데이터 출처: DEMO_USER_INPUT" }); setCsv(null); }}>
                      {csv.rows.length}행 가져오기
                    </Button>
                  )}
                </div>
              )}
              <p className="text-[0.74rem] text-muted">카테고리: {CATEGORIES.map((c) => `${c}=${CATEGORY_META[c].label}`).join(", ")}</p>
            </div>
          </div>
        </Card>

        <Card id="ai" testId="settings-ai">
          <CardHeader title="AI" icon={Sparkles} iconTone="intel" subtitle="AI Ready 상태" />
          <div className="grid gap-3 p-5 @lg/shell:grid-cols-3">
            {[
              ["현재 방식", "규칙 기반 진단 (RULE) — 결정론적 코드. 외부 LLM API 호출 없음"],
              ["AI가 보는 데이터 (예정)", "개업 준비 업무·마감·사유, 객실 정비 상태, 출입권한 이력, 고객 문의 텍스트 (개인정보 최소화)"],
              ["첫 연결 후보 1개", "개업 준비·운영 위험의 자연어 요약 + 대응 순서 (서버 측, 사람 승인 후 전달)"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-surface-2 p-4">
                <p className="text-[0.78rem] font-bold text-muted">{k}</p>
                <p className="mt-1 text-[0.88rem]">{v}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card id="integration" testId="settings-integration">
          <CardHeader title="연동 준비 상태" icon={PlugZap} iconTone="growth" subtitle="허위 연동 금지 — 실제 연결된 외부 서비스 없음 (상세: INTEGRATION_READINESS.md)" />
          <ul className="divide-y divide-line">
            {[
              ["스마트 도어락", `Provider: ${config?.provider ?? "확인 중"} · LIVE_LOCK_ENABLED=${config ? String(config.liveLockEnabled) : "…"}`, "미연동", "솔리티·잇소키·TTLock 등 공식 API·지원 모델·기기 적용 확인(ACK)·SLA 확인 필요"],
              ["예약 채널 (OTA·채널매니저)", "직접 등록 시연 예약만 구현", "미연동", "야놀자·여기어때·부킹닷컴·에어비앤비 등은 검토 가능한 예시일 뿐 · iCal은 실시간 재고 동기화 대체 불가"],
              ["운영 DB · 로그인", "DemoRepository (브라우저)", "미연결", "Supabase Auth + RLS + tenant 격리 · 마이그레이션 초안 준비 (supabase/migrations)"],
              ["AI API", "규칙 기반", "미연결", "서버 측 키 보관 · 1개 기능부터"],
              ["문자·알림톡", "화면 표시(데모 인증번호)", "미구현", "본인확인·안내 발송 업체 계약 필요"],
              ["결제 · 신원확인", "범위 밖", "미구현", "이번 단계에서 만들지 않음"],
            ].map(([a, b, c, d]) => (
              <li key={a} className="grid gap-1 px-5 py-3 @lg/shell:grid-cols-[1fr_1.3fr_auto_2fr] @lg/shell:items-center @lg/shell:gap-4">
                <p className="font-bold">{a}</p>
                <p className="text-[0.84rem] text-ink-2">{b}</p>
                <Badge tone="warning">{c}</Badge>
                <p className="text-[0.8rem] text-muted">{d}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Overlay
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="데모를 초기화할까요?"
        subtitle="Seed·진행률·예약·출입권한·문의·Proof Event가 모두 처음 상태로 돌아갑니다. 화면 설정(Theme·글자 크기)은 유지됩니다."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetOpen(false)}>취소</Button>
            <Button variant="danger" icon={RotateCcw} data-testid="demo-reset-confirm" onClick={() => { resetDemo(); setResetOpen(false); toast({ tone: "success", title: "데모를 초기화했습니다", body: "미팅 시연을 처음부터 진행할 수 있습니다." }); }}>
              초기화
            </Button>
          </>
        }
      >
        <p className="text-[0.9rem] text-ink-2">PC와 Mobile 화면 모두 같은 초기 상태로 바뀝니다.</p>
      </Overlay>
    </div>
  );
}
