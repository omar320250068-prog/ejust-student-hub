import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const { handlers } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  trustHost: true,
  secret: process.env.AUTH_SECRET,
});

export const GET = async (req: Request) => {
  try {
    return await handlers.GET(req as never);
  } catch (error) {
    const err = error as Error;
    console.error("[auth GET]", err);
    return Response.json(
      { error: err.name, message: err.message },
      { status: 500 },
    );
  }
};

export const POST = async (req: Request) => {
  try {
    return await handlers.POST(req as never);
  } catch (error) {
    const err = error as Error;
    console.error("[auth POST]", err);
    return Response.json(
      { error: err.name, message: err.message },
      { status: 500 },
    );
  }
};
