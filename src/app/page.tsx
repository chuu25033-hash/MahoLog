import { TitleScreen } from "@/components/title/title-screen";
import { isEmailAuthMode } from "@/lib/supabase/config";

export default function TitlePage() {
  return <TitleScreen authEnabled={isEmailAuthMode} />;
}
