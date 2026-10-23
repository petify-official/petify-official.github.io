import { useContext } from "react";
import WorkspaceAccessContext from "./workspaceAccessContext.js";

export default function useWorkspaceAccess() {
  const context = useContext(WorkspaceAccessContext);
  if (!context) throw new Error("useWorkspaceAccess must be used inside WorkspaceAccessProvider.");
  return context;
}
