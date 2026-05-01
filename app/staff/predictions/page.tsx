import Link from "next/link";
import { Stage } from "@/components/Stage";
import { AutoRefresh } from "@/components/AutoRefresh";
import { requireStaff } from "@/lib/staff-auth";
import { staffCan } from "@/lib/staff-permissions";
import {
  getPredictionsSettings,
  setPredictionsSettings,
  getLeaderboard,
  lockAllMatchups,
} from "@/lib/predictions";
import { logStaffAction } from "@/lib/staff-audit";
import {
  getActiveTournament,
  getLatestTournament,
} from "@/lib/engine";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

async function setEnabledAction(formData: FormData) {
  "use server";
  const me = await requireStaff({
    next: "/staff/predictions",
    permission: "predictions:write",
  });
  const enabled = formData.get("enabled") === "yes";
  await setPredictionsSettings({ enabled });
  await logStaffAction({
    actor: { id: me.id, email: me.email },
    action: "predictions.set_enabled",
    target: enabled ? "on" : "off",
  });
  revalidatePath("/staff/predictions");
}

async function setPrizeAction(formData: FormData) {
  "use server";
  const me = await requireStaff({
    next: "/staff/predictions",
    permission: "predictions:write",
  });
  const prize = String(formData.get("prize") ?? "").slice(0, 200);
  await setPredictionsSettings({ prize });
  await logStaffAction({
    actor: { id: me.id, email: me.email },
    action: "predictions.set_prize",
    target: prize.slice(0, 60),
  });
  revalidatePath("/staff/predictions");
}

async function lockAllAction(formData: FormData) {
  "use server";
  const me = await requireStaff({
    next: "/staff/predictions",
    permission: "predictions:write",
  });
  const locked = formData.get("locked") === "yes";
  const t =
    (await getActiveTournament()) ?? (await getLatestTournament());
  if (!t) return;
  await lockAllMatchups(t.id, locked);
  await logStaffAction({
    actor: { id: me.id, email: me.email },
    action: "predictions.lock_all",
    target: locked ? "lock" : "unlock",
  });
  revalidatePath("/staff/predictions");
}

export default async function StaffPredictionsPage() {
  const me = await requireStaff({
    next: "/staff/predictions",
    permission: "predictions:read",
  });
  const canWrite = staffCan(me.role, "predictions:write");

  const settings = await getPredictionsSettings();
  const t =
    (await getActiveTournament()) ?? (await getLatestTournament());
  const leaderboard = t ? await getLeaderboard(t.id) : [];

  return (
    <Stage scrollable>
      <AutoRefresh seconds={10} />
      <div className="max-w-3xl mx-auto pt-4 px-4 flex flex-col gap-4 pb-12">
        <div className="card-sm px-5 py-3 flex items-baseline justify-between gap-3 flex-wrap">
          <h1 className="font-display text-3xl text-navy">🔮 Predictions</h1>
          <Link href="/staff" className="pop pop-white text-sm">
            ← Overview
          </Link>
        </div>

        <section className="card px-5 py-5 flex flex-col gap-3">
          <h2 className="font-display text-xl text-navy">Settings</h2>
          <p className="font-body text-sm text-navy-soft">
            Enabled: <strong>{settings.enabled ? "yes" : "no"}</strong> · Prize:{" "}
            <strong>{settings.prize || "—"}</strong>
          </p>
          {canWrite ? (
            <div className="flex flex-col gap-3">
              <form action={setEnabledAction} className="flex gap-2">
                <input
                  type="hidden"
                  name="enabled"
                  value={settings.enabled ? "no" : "yes"}
                />
                <button className="pop pop-coral text-sm">
                  {settings.enabled ? "Disable game" : "Enable game"}
                </button>
              </form>
              <form action={setPrizeAction} className="flex gap-2">
                <input
                  name="prize"
                  defaultValue={settings.prize}
                  placeholder="Prize description"
                  className="card-sm px-3 py-2 flex-1 text-sm"
                  maxLength={200}
                />
                <button className="pop pop-yellow text-sm">Save prize</button>
              </form>
              <div className="flex gap-2">
                <form action={lockAllAction}>
                  <input type="hidden" name="locked" value="yes" />
                  <button className="pop pop-white text-sm">
                    🔒 Lock all matchups
                  </button>
                </form>
                <form action={lockAllAction}>
                  <input type="hidden" name="locked" value="no" />
                  <button className="pop pop-white text-sm">
                    🔓 Unlock all matchups
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <p className="font-body text-xs text-navy-soft">
              Read-only. Ask an admin to change.
            </p>
          )}
        </section>

        <section className="card px-5 py-5">
          <h2 className="font-display text-xl text-navy mb-3">Leaderboard</h2>
          {leaderboard.length === 0 ? (
            <p className="font-body text-sm text-navy-soft">
              No predictions yet.
            </p>
          ) : (
            <ol className="flex flex-col gap-1">
              {leaderboard.map((r, i) => (
                <li
                  key={r.userId}
                  className="flex items-center gap-3 text-sm font-body text-navy"
                >
                  <span className="w-6 text-right">{i + 1}.</span>
                  <span className="flex-1 truncate">
                    {r.name ?? r.email ?? "—"}
                  </span>
                  <span className="text-navy-soft">
                    {r.correctCount}/{r.resolvedCount}
                  </span>
                  <span className="font-display">{r.totalPoints} pts</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </Stage>
  );
}
