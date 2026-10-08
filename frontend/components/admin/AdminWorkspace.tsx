import { createContext, useContext, type ReactNode } from "react";
import { useAdminController, type AdminWorkspaceState } from "./useAdminController";

const Workspace = createContext<AdminWorkspaceState | null>(null);

export function AdminWorkspaceProvider({ children }: { children: ReactNode }) {
  const state = useAdminController();
  return <Workspace.Provider value={state}>{children}</Workspace.Provider>;
}

export function useAdminWorkspace() {
  const state = useContext(Workspace);
  if (!state) throw new Error("Administrator page requires its workspace layout.");
  return state;
}
