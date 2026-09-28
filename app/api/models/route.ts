import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listModels } from "@/lib/models";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const catalogue = await listModels();
  return NextResponse.json(catalogue, {
    headers: { "Cache-Control": "private, max-age=300" },
  });
}
