import { redirect } from "next/navigation";
import { isAuthedAdmin } from "@/lib/auth";
import ChemicalsTable from "./ChemicalsTable";

export default function AdminDashboardPage() {
  if (!isAuthedAdmin()) {
    redirect("/admin");
  }

  return (
    <div>
      <ChemicalsTable />
    </div>
  );
}
