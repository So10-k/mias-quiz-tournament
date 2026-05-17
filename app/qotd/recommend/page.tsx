import Link from "next/link";
import { redirect } from "next/navigation";
import { Stage } from "@/components/Stage";
import { currentUser } from "@/lib/session";
import {
  listMyRecommendations,
  submitRecommendation,
  MAX_RECOMMENDATIONS_PER_USER,
} from "@/lib/qotd";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

async function submitAction(formData: FormData) {
  "use server";
  const me = await currentUser();
  if (!me) redirect("/signin?next=/qotd/recommend");
  const topic = String(formData.get("topic") ?? "");
  const result = await submitRecommendation({ userId: me.id, topic });
  if (!result.ok) {
    redirect(`/qotd/recommend?error=${encodeURIComponent(result.reason)}`);
  }
  revalidatePath("/qotd/recommend");
  redirect("/qotd/recommend?ok=1");
}

export default async function QotdRecommendPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const me = await currentUser();
  if (!me) redirect("/signin?next=/qotd/recommend");
  const sp = await searchParams;
  const mine = await listMyRecommendations(me.id);
  const remaining = Math.max(0, MAX_RECOMMENDATIONS_PER_USER - mine.length);

  return (
    <Stage scrollable>
      <div className="max-w-2xl mx-auto pt-4 px-4 flex flex-col gap-4 pb-12">
        <div className="card-sm px-5 py-3 flex items-baseline justify-between gap-3 flex-wrap">
          <h1 className="font-display text-3xl text-navy">
            💡 Suggest a question
          </h1>
          <Link href="/qotd" className="pop pop-white text-sm">
            ← Today&rsquo;s question
          </Link>
        </div>

        <div className="card px-6 py-6">
          <p className="font-body text-base text-navy">
            Each day a new question goes up on the board. Players answer A/B/C/D
            or type their own. You can suggest{" "}
            <strong>{MAX_RECOMMENDATIONS_PER_USER} topics in your lifetime</strong>{" "}
            — once they&rsquo;re used, they&rsquo;re used. Choose wisely.
          </p>

          {sp.ok ? (
            <div className="mt-4 card-sm bg-grass text-white px-4 py-3">
              <p className="font-display text-sm">
                ✓ Got it. Your suggestion is in the queue.
              </p>
            </div>
          ) : null}
          {sp.error ? (
            <div className="mt-4 card-sm bg-coral text-white px-4 py-3">
              <p className="font-display text-sm">⚠️ {sp.error}</p>
            </div>
          ) : null}

          {remaining > 0 ? (
            <form action={submitAction} className="mt-5 flex flex-col gap-3">
              <label className="font-display text-sm text-navy">
                Topic or specific question
                <textarea
                  name="topic"
                  required
                  maxLength={200}
                  rows={3}
                  className="card-sm bg-white px-3 py-2 w-full mt-1 text-base font-body"
                  placeholder='e.g. "what is the deepest lake?", or just a topic like "weird animals"'
                />
              </label>
              <p className="font-body text-xs text-navy-soft">
                You have <strong>{remaining}</strong> suggestion
                {remaining === 1 ? "" : "s"} left.
              </p>
              <button className="pop pop-coral text-base self-start">
                ✨ Submit suggestion
              </button>
            </form>
          ) : (
            <div className="mt-5 card-sm bg-sky1 px-4 py-3">
              <p className="font-display text-sm text-navy">
                You&rsquo;ve used all {MAX_RECOMMENDATIONS_PER_USER} of your
                lifetime suggestions. Watch the board for your topics.
              </p>
            </div>
          )}
        </div>

        <section className="card px-6 py-5">
          <h2 className="font-display text-lg text-navy">Your suggestions</h2>
          {mine.length === 0 ? (
            <p className="font-body text-sm text-navy-soft mt-2">
              You haven&rsquo;t submitted any yet.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {mine.map((r) => (
                <li
                  key={r.id}
                  className="card-sm bg-white px-3 py-2 flex items-center gap-3"
                >
                  <span className="font-body text-sm text-navy flex-1 min-w-0">
                    {r.topic}
                  </span>
                  <span
                    className={
                      "font-display text-xs px-2 py-0.5 rounded-md border-2 border-navy " +
                      (r.status === "used"
                        ? "bg-grass text-white"
                        : r.status === "rejected"
                          ? "bg-coral-deep text-white"
                          : "bg-sun text-navy")
                    }
                  >
                    {r.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Stage>
  );
}
