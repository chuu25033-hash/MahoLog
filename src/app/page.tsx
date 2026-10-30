import { PrologueGate } from "@/components/prologue/prologue-gate";
import { TitleScreen } from "@/components/title/title-screen";
import { isEmailAuthMode } from "@/lib/supabase/config";

export default function TitlePage() {
  return (
    <PrologueGate>
      <TitleScreen authEnabled={isEmailAuthMode} />
    </PrologueGate>
  );
}
