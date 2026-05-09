"use client";

import { toast } from "sonner";

const BACKEND_ERROR_TOAST_ID = "backend-error";

export function isNextRedirectError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeRedirect = error as { digest?: unknown; message?: unknown };
  return (
    maybeRedirect.message === "NEXT_REDIRECT" ||
    (typeof maybeRedirect.digest === "string" && maybeRedirect.digest.startsWith("NEXT_REDIRECT"))
  );
}

export function showBackendErrorToast(error: unknown, fallback = "操作失败，请稍后重试。") {
  const description = error instanceof Error && error.message ? error.message : fallback;

  toast.error("操作失败", {
    id: BACKEND_ERROR_TOAST_ID,
    description,
    style: {
      background: "#ff3333",
      color: "#fff",
      borderColor: "#111"
    }
  });
}
