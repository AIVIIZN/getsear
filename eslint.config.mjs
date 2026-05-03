import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// React-19 compiler-driven react-hooks rules flag latent bugs (refs accessed
// during render, setState-in-effect cascades, components defined during render,
// variables reassigned after render completes). Each existing violation is real
// signal but requires a careful per-file refactor with regression risk to
// realtime / POS / KDS code paths. Bucket-B lint debt is tracked file-by-file
// here; each future task removes its file from the override and fixes the
// underlying issue. See build-pipeline/STATE.yaml task ids referenced below.
const bucketBLintDebt = [
  // V5 batch 5.0.6 — easy one-offs (target: NOW)
  "src/components/kds/KdsCapacityIndicator.tsx", // immutability
  "src/app/order/*/confirmation/page.tsx", // set-state-in-effect ([slug] dynamic route — bracket-globs are interpreted as char classes)
  "src/app/reserve/*/confirmation/page.tsx", // set-state-in-effect ([slug] dynamic route)
  "src/app/(auth)/error.tsx", // set-state-in-effect ×2
  "src/workers/sms-delivery.worker.ts", // (worker context — no useEffect, but rule fires)

  // V5 batch 5.4.4 — staff/operator dialogs (target: V5 concurrency batch)
  "src/components/staff/ScheduleTemplateDialog.tsx",
  "src/components/staff/PayrollTab.tsx",
  "src/components/staff/ScheduleTab.tsx",
  "src/components/staff/CashDrawerDetail.tsx",
  "src/components/staff/CashDrawersTab.tsx", // already has inline disable from 5.0.5a

  // V6 batch 6.7.4 — POS dialogs and menu tabs (target: V6 visual polish bonus)
  "src/components/pos/TableMoveDialog.tsx",
  "src/components/pos/OrderTransferDialog.tsx",
  "src/components/pos/ModifierSheet.tsx",
  "src/components/pos/OrderPanel.tsx",
  "src/components/menu/tabs/AllergensTab.tsx",
  "src/components/offline/OfflineBanner.tsx",
  "src/components/offline/SyncStatusIndicator.tsx",

  // V7 batch 7.5.2 — TableListView component-during-render refactor (target: V7 reliability)
  "src/components/tables/TableListView.tsx",

  // V7 batch 7.5.3 — realtime hooks ref-init refactor (target: V7 reliability, highest risk)
  "src/hooks/use-realtime.ts",
  "src/hooks/use-kds-realtime.ts",
  "src/hooks/use-kds-heartbeat.ts",
  "src/hooks/use-table-realtime.ts",
  "src/hooks/use-reservation-realtime.ts",
  "src/hooks/use-realtime-86.ts",
  "src/hooks/use-printer-failover.ts",
  "src/hooks/use-sync-queue.ts",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".claude/worktrees/**",
    "supabase/_archived_migrations/**",
    "build-pipeline/**",
  ]),
  {
    files: bucketBLintDebt,
    rules: {
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/immutability": "warn",
    },
  },
]);

export default eslintConfig;
