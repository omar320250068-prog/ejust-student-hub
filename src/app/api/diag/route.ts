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

export async function POST(request: Request) {
  const key = new URL(request.url).searchParams.get("k");
  if (key !== DIAG_KEY) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const clientId = (
    process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID
  )?.trim();
  const clientSecret = (
    process.env.GOOGLE_CLIENT_SECRET || process.env.AUTH_GOOGLE_SECRET
  )?.trim();

  if (!clientId || !clientSecret) {
    return Response.json({ ok: false, error: "credentials missing" });
  }

  const origin = new URL(request.url).origin;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code: "diag-probe-invalid-code",
      redirect_uri: `${origin}/api/auth/callback/google`,
    }),
  });

  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;

  return Response.json({
    clientId,
    clientIdLength: clientId.length,
    clientSecretLength: clientSecret.length,
    tokenEndpointStatus: res.status,
    googleResponse: body,
  });
}

