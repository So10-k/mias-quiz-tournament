import { NextRequest, NextResponse } from "next/server";
import { generateAndStoreDailyQuestion, todayKey } from "@/lib/qotd";
import { fetchCurrentEventsContext } from "@/lib/brave";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Daily cron — generates today's Question of the Day if it doesn't already
// exist. Wired in vercel.json's crons section to fire at 06:00 ET daily.
//
// Vercel's cron requests include an Authorization header with the project's
// CRON_SECRET so we can ignore arbitrary internet pokes. Locally / from
// /staff we accept a manual trigger via the same secret.
async function authorize(req: NextRequest): Promise<boolean> {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    // Fail CLOSED in production. Without this, an unset CRON_SECRET
    // leaves the daily generator open to the internet — an attacker
    // can spam it to burn Groq credits (idempotency stops re-creates
    // for today, but a single hit is still a free Groq call). Local
    // dev gets an explicit escape hatch via NODE_ENV.
    return process.env.NODE_ENV === "development";
  }
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${expected}`) return true;
  // Vercel Cron uses this exact format. Same check works locally.
  return false;
}

async function run() {
  const ctx = await fetchCurrentEventsContext();
  const result = await generateAndStoreDailyQuestion({
    currentEventsContext: ctx,
  });
  return result;
}

export async function GET(req: NextRequest) {
  if (!(await authorize(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await run();
    return NextResponse.json({ ok: true, date: todayKey(), result });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }
}

// Some Vercel cron setups POST instead of GET; accept either.
export async function POST(req: NextRequest) {
  return GET(req);
}
