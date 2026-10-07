import { ZodError } from "zod";
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function errorResponse(error: unknown): Response {
  if (error instanceof AppError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof ZodError)
    return Response.json(
      { error: error.issues[0]?.message || "Invalid input" },
      { status: 400 },
    );
  if (error instanceof SyntaxError)
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  const code = (error as { code?: string })?.code;
  if (code === "23505")
    return Response.json(
      { error: "That name or email is already in use." },
      { status: 409 },
    );
  if (code === "23503")
    return Response.json(
      { error: "This item is still in use, or its parent no longer exists." },
      { status: 409 },
    );
  console.error("Request failed", error);
  return Response.json(
    { error: "Something went wrong. Please try again." },
    { status: 500 },
  );
}
