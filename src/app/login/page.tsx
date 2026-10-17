import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/auth/currentAccount";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Đăng nhập — Replyn" };

export default async function LoginPage() {
  if (await currentAccount()) redirect("/");
  return <LoginForm />;
}
