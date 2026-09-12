import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "professor" | "aluno";

export type SessionInfo = {
  user: User | null;
  role: AppRole | null;
  fullName: string;
  loading: boolean;
};

export function useSession(): SessionInfo {
  const [state, setState] = useState<SessionInfo>({
    user: null,
    role: null,
    fullName: "",
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data } = await supabase.auth.getUser();
      const user = data.user ?? null;
      if (!user) {
        if (!cancelled) setState({ user: null, role: null, fullName: "", loading: false });
        return;
      }

      const [{ data: roleRow }, { data: profile }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
        supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
      ]);

      if (cancelled) return;
      setState({
        user,
        role: (roleRow?.role as AppRole | undefined) ?? null,
        fullName: profile?.full_name || (user.email ?? ""),
        loading: false,
      });
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

export async function signOutAndGoHome() {
  await supabase.auth.signOut();
  window.location.href = "/";
}
