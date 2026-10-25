import { handlers } from "@/auth";

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
