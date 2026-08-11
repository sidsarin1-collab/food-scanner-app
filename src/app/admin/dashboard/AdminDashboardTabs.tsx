"use client";

import { ReactNode, useState } from "react";
import ChemicalsTable from "./ChemicalsTable";
import SuggestedChemicalsTable from "./SuggestedChemicalsTable";

type Tab = "chemicals" | "suggestions";

export default function AdminDashboardTabs() {
  const [tab, setTab] = useState<Tab>("chemicals");

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-neutral-200">
        <TabButton active={tab === "chemicals"} onClick={() => setTab("chemicals")}>
          Chemicals
        </TabButton>
        <TabButton active={tab === "suggestions"} onClick={() => setTab("suggestions")}>
          Suggested Additions
        </TabButton>
      </div>
      {tab === "chemicals" ? <ChemicalsTable /> : <SuggestedChemicalsTable />}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
        active ? "border-neutral-900 text-neutral-900" : "border-transparent text-neutral-500 hover:text-neutral-700"
      }`}
    >
      {children}
    </button>
  );
}
