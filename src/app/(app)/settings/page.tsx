"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<{ display_name: string; email: string } | null>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("display_name, email").eq("id", user.id).single();
      setProfile(data);
    })();
  }, []);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <Card>
        <CardHeader><CardTitle>Account</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div><span className="text-[var(--muted-foreground)]">Signed in as:</span> <span className="font-medium">{profile?.display_name ?? "—"}</span></div>
          <div><span className="text-[var(--muted-foreground)]">Email:</span> {profile?.email ?? "—"}</div>
          <Button variant="outline" onClick={signOut}>Sign out</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>About</CardTitle></CardHeader>
        <CardContent className="text-sm text-[var(--muted-foreground)]">
          Methodic Off-Market Tracker · Internal tool · v0.1
        </CardContent>
      </Card>
    </div>
  );
}
