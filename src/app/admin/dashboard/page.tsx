import { redirect } from "next/navigation";
import { isAuthedAdmin } from "@/lib/auth";
import AdminDashboardTabs from "./AdminDashboardTabs";

export default function AdminDashboardPage() {
  if (!isAuthedAdmin()) {
    redirect("/admin");
  }

  return (
    <div>
      <AdminDashboardTabs />
    </div>
  );
}
