import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function AppHeader({ email }: { email?: string | null }) {
  const navigate = useNavigate();
  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <header className="h-14 border-b border-border bg-background sticky top-0 z-10">
      <div className="h-full max-w-6xl mx-auto px-6 flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-primary text-primary-foreground grid place-items-center text-xs font-semibold">
            R
          </div>
          <span className="font-semibold text-foreground tracking-tight">
            Research Assistant
          </span>
        </Link>
        <div className="flex items-center gap-3">
          {email && (
            <span className="text-sm text-muted-foreground hidden sm:block">{email}</span>
          )}
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
