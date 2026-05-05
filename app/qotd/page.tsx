import Link from "next/link";
import { redirect } from "next/navigation";
import { Stage } from "@/components/Stage";
import { currentUser } from "@/lib/session";
import {
  getTodayQuestion,
  listResponses,
  getMyResponse,
  recordResponse,
  todayKey,
} from "@/lib/qotd";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

async function answerAction(formData: FormData) {
  "use server";
  const me = await currentUser();
  if (!me) redirect("/signin?next=/qotd");
  const questionId = String(formData.get("questionId") ?? "");
  const choice = String(formData.get("choice") ?? "") as
    | "A"
    | "B"
    | "C"
    | "D"
    | "other";
  const otherText = String(formData.get("otherText") ?? "");
  if (!questionId || !choice) redirect("/qotd?error=missing");
  if (
    choice !== "A" &&
    choice !== "B" &&
    choice !== "C" &&
    choice !== "D" &&
    choice !== "other"
  ) {
    redirect("/qotd?error=bad-choice");
  }
  const result = await recordResponse({
    userId: me.id,
    questionId,
    choice,
    otherTextRaw: choice === "other" ? otherText : null,
  });
  if (!result.ok) {
    redirect(`/qotd?error=${encodeURIComponent(result.reason)}`);
  }
  revalidatePath("/qotd");
  redirect("/qotd?ok=1");
}

export default async function QotdPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const me = await currentUser();
  const question = await getTodayQuestion();
  const myResp = me && question
    ? await getMyResponse({ userId: me.id, questionId: question.id })
    : null;
  const responses = question ? await listResponses(question.id) : [];

  return (
    <Stage scrollable>
      <div className="max-w-2xl mx-auto pt-4 px-4 flex flex-col gap-5 pb-12">
        <div className="card-sm px-5 py-3 flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-display text-3xl text-navy">
              💡 Question of the Day
            </h1>
            <p className="font-body text-xs text-navy-soft mt-1">
              Fresh every morning · {todayKey()}
            </p>
          </div>
          <div className="flex gap-2">
            {me ? (
              <Link href="/qotd/recommend" className="pop pop-yellow text-sm">
                💡 Suggest a topic
              </Link>
            ) : null}
            <Link href="/" className="pop pop-white text-sm">
              ← Home
            </Link>
          </div>
        </div>

        {sp.ok ? (
          <div className="card-sm bg-grass text-white px-4 py-3">
            <p className="font-display text-sm">
              ✓ Saved! See your answer below.
            </p>
          </div>
        ) : null}
        {sp.error ? (
          <div className="card-sm bg-coral text-white px-4 py-3">
            <p className="font-display text-sm">⚠️ {sp.error}</p>
          </div>
        ) : null}

        {!question ? (
          <div className="card px-7 py-9 text-center">
            <p className="text-5xl">🌅</p>
            <h2 className="font-display text-2xl text-navy mt-3">
              Today&rsquo;s question is still brewing
            </h2>
            <p className="font-body text-base text-navy-soft mt-2">
              Check back in a bit — it goes up first thing in the morning.
            </p>
          </div>
        ) : (
          <>
            <section className="card px-6 py-7">
              <p className="font-display text-xs text-coral-deep uppercase tracking-widest">
                Today&rsquo;s question
              </p>
              <h2 className="font-display text-2xl md:text-3xl text-navy mt-2 leading-tight">
                {question.prompt}
              </h2>

              {!me ? (
                <div className="mt-5 card-sm bg-sky1 px-4 py-3">
                  <p className="font-body text-sm text-navy">
                    <Link
                      href="/signin?next=/qotd"
                      className="font-display text-coral-deep underline"
                    >
                      Sign in
                    </Link>{" "}
                    to answer and see what others said.
                  </p>
                </div>
              ) : myResp ? (
                <YourAnswer myResp={myResp} options={question.options} />
              ) : (
                <AnswerForm
                  questionId={question.id}
                  options={question.options}
                  onSubmit={answerAction}
                />
              )}
            </section>

            {/* Board — public board of responses */}
            <section className="card px-5 py-5">
              <h2 className="font-display text-lg text-navy">
                The board ({responses.length} answer
                {responses.length === 1 ? "" : "s"})
              </h2>
              {responses.length === 0 ? (
                <p className="font-body text-sm text-navy-soft mt-3">
                  Nobody&rsquo;s answered yet — be the first.
                </p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2">
                  {responses.map((r) => {
                    const labelFor =
                      r.choice === "other"
                        ? r.otherTextClean ?? "(unprintable)"
                        : (
                            question.options.find(
                              (o) => o.value === r.choice
                            )?.label ?? r.choice
                          );
                    return (
                      <li
                        key={r.id}
                        className="card-sm bg-white px-3 py-2 flex items-center gap-3"
                      >
                        <span className="font-display text-sm text-navy flex-1 min-w-0 truncate">
                          <span className="text-coral-deep mr-2">
                            {r.choice === "other" ? "💬" : `${r.choice}.`}
                          </span>
                          {labelFor}
                        </span>
                        <span className="font-body text-xs text-navy-soft truncate max-w-[40%]">
                          {r.userName ?? r.userEmail ?? "—"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </Stage>
  );
}

function AnswerForm({
  questionId,
  options,
  onSubmit,
}: {
  questionId: string;
  options: { label: string; value: string }[];
  onSubmit: (fd: FormData) => Promise<void>;
}) {
  return (
    <form action={onSubmit} className="mt-5 flex flex-col gap-3">
      <input type="hidden" name="questionId" value={questionId} />
      <div className="grid grid-cols-1 gap-2">
        {options.map((o) => (
          <label
            key={o.value}
            className="card-sm bg-white px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-sun/30 transition-colors"
          >
            <input
              type="radio"
              name="choice"
              value={o.value}
              required
              className="w-5 h-5 accent-coral"
            />
            <span className="font-display text-base text-navy">
              <span className="text-coral-deep mr-2">{o.value}.</span>
              {o.label}
            </span>
          </label>
        ))}
        <label className="card-sm bg-white px-4 py-3 flex flex-col gap-2 cursor-pointer">
          <span className="flex items-center gap-3">
            <input
              type="radio"
              name="choice"
              value="other"
              className="w-5 h-5 accent-coral"
            />
            <span className="font-display text-base text-navy">
              <span className="text-coral-deep mr-2">💬</span>
              Other (type below)
            </span>
          </span>
          <textarea
            name="otherText"
            rows={2}
            maxLength={200}
            className="card-sm bg-sky1 px-3 py-2 w-full text-sm font-body"
            placeholder="Up to 200 characters. Tidied up by the safeguard before posting."
          />
        </label>
      </div>
      <button className="pop pop-coral text-base self-start">
        📨 Submit
      </button>
    </form>
  );
}

function YourAnswer({
  myResp,
  options,
}: {
  myResp: { choice: string; otherTextClean: string | null };
  options: { label: string; value: string }[];
}) {
  const text =
    myResp.choice === "other"
      ? myResp.otherTextClean ?? "(your answer is being reviewed)"
      : (options.find((o) => o.value === myResp.choice)?.label ?? myResp.choice);
  return (
    <div className="mt-5 card-sm bg-grass text-white px-4 py-3">
      <p className="font-display text-sm uppercase tracking-widest">
        Your answer
      </p>
      <p className="font-display text-lg mt-1">
        <span className="opacity-80 mr-2">
          {myResp.choice === "other" ? "💬" : `${myResp.choice}.`}
        </span>
        {text}
      </p>
    </div>
  );
}
