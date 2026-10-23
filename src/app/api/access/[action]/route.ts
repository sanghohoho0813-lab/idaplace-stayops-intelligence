import { NextResponse } from "next/server";
import { getAccessConfig, getAccessProvider } from "@/lib/access/server";
import { LiveProviderNotImplementedError } from "@/lib/access/server/liveProvider";
import type { ProvisionInput, RevokeInput } from "@/lib/access/contract";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

function fail(status: number, error: string, message: string) {
  return NextResponse.json({ error, message }, { status, headers: noStore });
}

export async function GET(req: Request, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  if (action === "config") return NextResponse.json(getAccessConfig(), { headers: noStore });
  if (action === "status") {
    const ref = new URL(req.url).searchParams.get("ref");
    if (!ref || ref.length > 600) return fail(400, "BAD_REQUEST", "ref 필요");
    try {
      return NextResponse.json(await getAccessProvider().getProvisioningStatus(ref), { headers: noStore });
    } catch (e) {
      if (e instanceof LiveProviderNotImplementedError) return fail(503, "LIVE_PROVIDER_NOT_IMPLEMENTED", e.message);
      return fail(500, "PROVIDER_ERROR", "상태 확인 실패");
    }
  }
  return fail(404, "NOT_FOUND", "unknown action");
}

export async function POST(req: Request, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, "BAD_REQUEST", "JSON 본문 필요");
  }
  try {
    const provider = getAccessProvider();
    if (action === "provision") {
      const b = body as ProvisionInput;
      if (typeof b?.grantId !== "string" || typeof b?.idempotencyKey !== "string") return fail(400, "BAD_REQUEST", "grantId, idempotencyKey 필요");
      return NextResponse.json(await provider.createTemporaryAccess(b), { headers: noStore });
    }
    if (action === "revoke") {
      const b = body as RevokeInput;
      if (typeof b?.providerRef !== "string") return fail(400, "BAD_REQUEST", "providerRef 필요");
      return NextResponse.json(await provider.revokeTemporaryAccess(b), { headers: noStore });
    }
  } catch (e) {
    if (e instanceof LiveProviderNotImplementedError) return fail(503, "LIVE_PROVIDER_NOT_IMPLEMENTED", e.message);
    return fail(500, "PROVIDER_ERROR", "Provider 처리 실패");
  }
  return fail(404, "NOT_FOUND", "unknown action");
}
