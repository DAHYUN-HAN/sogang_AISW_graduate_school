import { ADMIN_PAGES } from "../../../utils/adminNavigation";
import AdminMain from "../AdminMain";
import AdminPageFrame from "../AdminPageFrame";
import { useAdminWorkspace } from "../AdminWorkspace";
import AdminAccountsPage from "./AdminAccountsPage";
import AdminAuditPage from "./AdminAuditPage";
import AdminBannersPage from "./AdminBannersPage";
import AdminBoardsPage from "./AdminBoardsPage";
import AdminDashboardLegacy from "./AdminDashboardPage";
import AdminDuesPage from "./AdminDuesPage";
import AdminMigrationPage from "./AdminMigrationPage";
import AdminRegistrationPage from "./AdminRegistrationPage";
import AdminReportsPage from "./AdminReportsPage";
import AdminRosterPage from "./AdminRosterPage";

const pages = { accounts: AdminAccountsPage, audit: AdminAuditPage, banners: AdminBannersPage, boardManagement: AdminBoardsPage, dashboard: AdminDashboardLegacy, duesPayments: AdminDuesPage, registration: AdminRegistrationPage, reports: AdminReportsPage, studentRoster: AdminRosterPage, migration: AdminMigrationPage };
export default function AdminCurrentPage() {
  const state = useAdminWorkspace();
  if (state.section === "main") return <AdminMain onSection={state.openAdminSection} onAll={(kind) => {
    if (kind === "mutual_aid") { state.setMutualAidFilter("all"); state.openManagedBoard("mutual-aid"); }
    else { state.setSuggestionFilter("all"); state.openManagedBoard("suggestions"); }
  }} />;
  const Page = pages[state.section as keyof typeof pages];
  return Page ? <AdminPageFrame title={ADMIN_PAGES.find((page) => page.key === state.section)?.label ?? "관리자"}><Page /></AdminPageFrame> : null;
}
