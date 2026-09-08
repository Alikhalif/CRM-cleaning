import "server-only";
import { getCurrentUserProfile } from "@/lib/users-server";

// Le module Présence & Actions est réservé au SUPER ADMIN (= rôle slug "admin").
export async function isCurrentUserAdmin(): Promise<boolean> {
  const profile = await getCurrentUserProfile();
  return profile?.roles.some((r) => r.slug === "admin") ?? false;
}
