import { TitleScreen } from "@/components/title/title-screen";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function TitlePage() {
  return <TitleScreen authEnabled={isSupabaseConfigured} />;
}
