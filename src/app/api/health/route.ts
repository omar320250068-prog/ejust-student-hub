export async function GET() {
  const raw = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL;
  let urlValid: boolean | null = null;
  let urlProtocol: string | null = null;

  if (raw) {
    try {
      const parsed = new URL(raw);
      urlValid = true;
      urlProtocol = parsed.protocol;
    } catch {
      urlValid = false;
    }
  }

  return Response.json({
    AUTH_SECRET: Boolean(process.env.AUTH_SECRET),
    NEXTAUTH_SECRET: Boolean(process.env.NEXTAUTH_SECRET),
    GOOGLE_CLIENT_ID: Boolean(process.env.GOOGLE_CLIENT_ID),
    GOOGLE_CLIENT_SECRET: Boolean(process.env.GOOGLE_CLIENT_SECRET),
    AUTH_URL_present: Boolean(process.env.AUTH_URL),
    URL_present: Boolean(raw),
    URL_valid: urlValid,
    URL_protocol: urlProtocol,
    NEXTAUTH_URL_present: Boolean(process.env.NEXTAUTH_URL),
    VERCEL_URL_present: Boolean(process.env.VERCEL_URL),
    VERCEL_ENV: process.env.VERCEL_ENV ?? null,
  });
}
