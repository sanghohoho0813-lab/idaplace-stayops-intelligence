import type { ISODate, OpeningCategory, OpeningTask, Room } from "./types";
import { diffDays } from "./time";

export const CATEGORY_META: Record<OpeningCategory, { label: string; short: string; order: number }> = {
  FACILITY: { label: "공사·시설", short: "시설", order: 1 },
  ROOM: { label: "객실 세팅", short: "객실", order: 2 },
  SUPPLY: { label: "비품·소모품", short: "비품", order: 3 },
  ACCESS: { label: "출입·도어락", short: "출입", order: 4 },
  OPERATION: { label: "운영 준비", short: "운영", order: 5 },
};

export const CATEGORIES = (Object.keys(CATEGORY_META) as OpeningCategory[]).sort((a, b) => CATEGORY_META[a].order - CATEGORY_META[b].order);

export const TASK_STATUS_LABEL = { TODO: "대기", IN_PROGRESS: "진행중", DONE: "완료", CANCELLED: "취소" } as const;

export function activeTasks(tasks: OpeningTask[]) {
  return tasks.filter((t) => t.status !== "CANCELLED");
}

export function taskProgress(t: OpeningTask): { done: number; total: number; ratio: number } {
  const total = t.checklist.length;
  const done = t.status === "DONE" ? total : t.checklist.filter((c) => c.done).length;
  return { done, total, ratio: total === 0 ? (t.status === "DONE" ? 1 : 0) : done / total };
}

export function requiredChecklistDone(t: OpeningTask): boolean {
  return t.checklist.filter((c) => c.required).every((c) => c.done);
}

export function isOpen(t: OpeningTask) {
  return t.status === "TODO" || t.status === "IN_PROGRESS";
}

export function isOverdue(t: OpeningTask, today: ISODate) {
  return isOpen(t) && t.dueDate < today;
}

/** 개업 준비율 = (완료 체크리스트 항목 수) / (취소 제외 전체 항목 수) — 결정론적 계산 */
export function readiness(tasks: OpeningTask[]) {
  const list = activeTasks(tasks);
  let done = 0;
  let total = 0;
  for (const t of list) {
    const p = taskProgress(t);
    done += p.done;
    total += p.total;
  }
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

export function readinessByCategory(tasks: OpeningTask[]) {
  return CATEGORIES.map((cat) => {
    const r = readiness(tasks.filter((t) => t.category === cat));
    const list = activeTasks(tasks).filter((t) => t.category === cat);
    return { category: cat, ...r, taskCount: list.length, doneCount: list.filter((t) => t.status === "DONE").length };
  });
}

export function openingSummary(tasks: OpeningTask[], rooms: Room[], today: ISODate) {
  const list = activeTasks(tasks);
  const open = list.filter(isOpen);
  return {
    readiness: readiness(tasks),
    requiredOpen: open.filter((t) => t.required).length,
    overdue: open.filter((t) => t.dueDate < today).length,
    dueToday: open.filter((t) => t.dueDate === today).length,
    dueSoon: open.filter((t) => diffDays(today, t.dueDate) >= 0 && diffDays(today, t.dueDate) <= 2).length,
    doneCount: list.filter((t) => t.status === "DONE").length,
    totalCount: list.length,
    roomsReady: rooms.filter((r) => r.prepStatus === "READY").length,
    roomsTotal: rooms.length,
    budgetPlanned: list.reduce((s, t) => s + (t.costPlanned ?? 0), 0),
    budgetActual: list.reduce((s, t) => s + (t.costActual ?? 0), 0),
  };
}

/** 객실 연결 업무가 모두 완료되면 해당 객실은 '준비완료' */
export function roomPrepFromTasks(roomId: string, tasks: OpeningTask[]): "READY" | "NOT_READY" {
  const related = activeTasks(tasks).filter((t) => t.roomId === roomId);
  if (related.length === 0) return "NOT_READY";
  return related.every((t) => t.status === "DONE") ? "READY" : "NOT_READY";
}
