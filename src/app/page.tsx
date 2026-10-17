import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/auth/currentAccount";
import { ReplynApp } from "@/components/ReplynApp";

export default async function Home() {
  const account = await currentAccount();
  if (!account) redirect("/login");
  return <ReplynApp account={account} />;
}
