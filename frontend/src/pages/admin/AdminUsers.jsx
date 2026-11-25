import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { errMsg, fmtDate, useApi } from "@/lib/api";

export default function AdminUsers() {
  const api = useApi();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-users"], queryFn: async () => (await api.get("/users")).data });
  const setRole = useMutation({
    mutationFn: async ({ id, role }) => (await api.patch(`/users/${id}/role`, { role })).data,
    onSuccess: () => { toast.success("Role updated"); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e) => { toast.error(errMsg(e)); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
  });
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-extrabold">Users</h1>
        <p className="text-sm text-muted-foreground">Drivers are normally added by approving their application on the Drivers page.</p>
      </div>
      {isLoading && <Loader2 className="mx-auto h-6 w-6 animate-spin" />}
      <div className="divide-y rounded-3xl border bg-card">
        {(data?.users || []).map((u) => (
          <div key={u.user_id} data-testid={`user-row-${u.user_id}`} className="flex flex-wrap items-center gap-3 p-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary font-bold">{(u.name || u.email || "?")[0]?.toUpperCase()}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{u.name || "—"}</p>
              <p className="truncate text-xs text-muted-foreground">{u.email} {u.phone && `· ${u.phone}`} · joined {fmtDate(u.created_at)}</p>
            </div>
            <select data-testid={`user-role-${u.user_id}`} value={u.role} disabled={setRole.isPending}
              onChange={(e) => setRole.mutate({ id: u.user_id, role: e.target.value })} className="h-11 rounded-xl border bg-background px-3 text-base capitalize">
              {data.roles.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
