import CompletionState from "../../../../components/CompletionState";
import { navigateToTabRoot } from "../../../../utils/tabNavigation";

export default function MutualAidCompleteScreen() {
  return <CompletionState title="신청이 완료되었어요!" onConfirm={() => navigateToTabRoot("council")} />;
}
