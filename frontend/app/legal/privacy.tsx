import LegalDocumentScreen from "../../components/LegalDocumentScreen";
import { useMeQuery } from "../../hooks/useApi";
import { useUserStore } from "../../stores/userStore";
import { createPrivacyConsentScreenDocument } from "../../utils/privacyPolicy";

export default function PrivacyScreen() {
  const { data } = useMeQuery();
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);
  const document = createPrivacyConsentScreenDocument(
    isAuthenticated && data ? data.data.privacy_consented_at ?? null : undefined,
  );
  return <LegalDocumentScreen {...document} />;
}
