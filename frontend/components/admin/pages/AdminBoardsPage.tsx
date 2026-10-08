import { Platform, View } from "react-native";
import AdminBoardsWebPage from "./AdminBoardsWebPage";
import AdminBoardContentPanel, { AdminBoardTargetQueryState } from "../../../components/admin/AdminBoardContentPanel";
import AdminBoardManagementNavigator from "../../../components/admin/AdminBoardManagementNavigator";
import AdminBoardSettingsPanel from "../../../components/admin/AdminBoardSettingsPanel";
import { Panel } from "../AdminControls";
import { useAdminWorkspace } from "../AdminWorkspace";
export default function AdminBoardsPage() {
  return Platform.OS === "web" ? <AdminBoardsWebPage /> : <AdminBoardsNativePage />;
}
function AdminBoardsNativePage() {
  const { boardManagementBoardId, boardManagementScope, boardManagementTab, boardSettingsDraft, boardSettingsSaving, boards, boardsQuery, creatingBoard, handleBoardManagementBoardChange, handleBoardManagementScopeChange, handleBoardManagementTabChange, handleCreateManagedBoard, handleSaveBoardSettings, hasManagedContentTarget, managedContentRenderers, managedContentTarget, managedNavigationLocked, renderBoardFormPanel, selectedBoardCapability, selectedManagedBoard, setBoardSettingsDraft } = useAdminWorkspace();
  return (<View style={{ gap: 12 }}>
    <Panel>
      <AdminBoardManagementNavigator
        boards={boards}
        scope={boardManagementScope}
        selectedBoardId={boardManagementBoardId}
        selectedTab={boardManagementTab}
        creatingBoard={creatingBoard}
        disabled={managedNavigationLocked || !boardsQuery.isSuccess}
        onScopeChange={handleBoardManagementScopeChange}
        onBoardChange={handleBoardManagementBoardChange}
        onTabChange={handleBoardManagementTabChange}
        onCreateBoard={handleCreateManagedBoard}
      />
    </Panel>

    <AdminBoardTargetQueryState
      status={managedContentTarget.status}
      missingReason={managedContentTarget.status === "missing" ? managedContentTarget.reason : undefined}
      onRetry={() => void boardsQuery.refetch()}
    />

    {boardsQuery.isSuccess && creatingBoard && boardManagementTab === "settings" ? renderBoardFormPanel() : null}

    {!creatingBoard && boardManagementTab === "settings" && selectedManagedBoard && boardSettingsDraft ? (
      <Panel>
        <AdminBoardSettingsPanel
          board={selectedManagedBoard}
          draft={boardSettingsDraft}
          lockedPolicies={selectedBoardCapability.lockedPolicies}
          saving={boardSettingsSaving}
          onChange={setBoardSettingsDraft}
          onSave={() => void handleSaveBoardSettings()}
        />
      </Panel>
    ) : null}

    {!creatingBoard && boardManagementTab === "content" && hasManagedContentTarget ? (
      <AdminBoardContentPanel
        board={selectedManagedBoard}
        capability={selectedBoardCapability}
        renderers={managedContentRenderers}
      />
    ) : null}
  </View>);
}
