"use server";

import { redirect } from "next/navigation";

import { signInOwner, signOutOwner } from "@/server/services/auth-service";

export async function loginAction(formData: FormData) {
  const password = formData.get("password");
  if (typeof password !== "string") {
    throw new Error("Password is required.");
  }

  await signInOwner(password);
  redirect("/dashboard");
}

export async function logoutAction() {
  await signOutOwner();
  redirect("/login");
}
