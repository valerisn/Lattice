export interface UpdateCheck {
  status: "current" | "available" | "ahead" | "unreleased" | "unavailable";
  installed: string;
  latest: string | null;
  checkedAt: string;
  releaseUrl: string | null;
  message: string;
}
