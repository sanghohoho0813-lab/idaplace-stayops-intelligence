import type { DemoState, RoleId } from "@/domain/types";
import { ROLE_META } from "@/domain/permissions";
import { maskName } from "@/domain/format";

export interface Actor {
  id: string;
  name: string;
  role: RoleId | "SYSTEM";
}

export const SYSTEM: Actor = { id: "system", name: "시스템", role: "SYSTEM" };

/** Business AX 화면에서의 행위자 (Demo Role 기준) */
export function axActor(s: DemoState): Actor {
  const role = s.ui.role;
  if (role === "OPS_MANAGER") {
    const m = s.staff.find((x) => x.team === "MANAGER");
    return { id: m?.id ?? "m1", name: `${m?.name ?? "운영관리자"}`, role };
  }
  if (role === "STAFF") {
    const p = s.staff.find((x) => x.id === s.ui.staffPersonaId) ?? s.staff[0];
    return { id: p.id, name: p.name, role };
  }
  return { id: role.toLowerCase(), name: ROLE_META[role].short, role };
}

/** 직원 앱에서의 행위자 */
export function staffActor(s: DemoState): Actor {
  const p = s.staff.find((x) => x.id === s.ui.staffPersonaId) ?? s.staff[0];
  return { id: p.id, name: p.name, role: "STAFF" };
}

export function guestActor(guestName: string, reservationId: string): Actor {
  return { id: `guest:${reservationId}`, name: `고객 ${maskName(guestName)}`, role: "GUEST" };
}
