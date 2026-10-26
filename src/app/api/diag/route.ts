import { latestAuthErrors } from "@/lib/auth-error-store";

const DIAG_KEY = "d5f1c9a2";

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("k");
  if (key !== DIAG_KEY) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const rows = await latestAuthErrors(10);
    return Response.json({ ok: true, rows });
  } catch (error) {
    return Response.json(
      { ok: false, message: (error as Error).message },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const key = new URL(request.url).searchParams.get("k");
  if (key !== DIAG_KEY) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const { neon } = await import("@neondatabase/serverless");
  const q = neon(process.env.DATABASE_URL!);
  await q`DELETE FROM auth_diag`;
  return Response.json({ ok: true });
}
