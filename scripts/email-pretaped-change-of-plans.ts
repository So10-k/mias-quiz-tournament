// One-shot: announce the finals are pivoting from LIVE to PRE-TAPED.
//
// Renders the PRETAPED_CHANGE_OF_PLANS template (defined in
// lib/email-templates.ts) for every enrolled user in the active
// tournament and previews the result.
//
// Per the project's "no emails without permission" rule this script
// DOES NOT SEND by default. You'll see:
//   • the active provider
//   • the recipient count + first 10 addresses
//   • the rendered subject
//   • the rendered text body (full)
//   • the first 1.5 KB of the rendered HTML
//
// When you're happy with the preview, send by running:
//   SEND=1 npx tsx scripts/email-pretaped-change-of-plans.ts
//
// Dry-preview (default):
//   npx tsx scripts/email-pretaped-change-of-plans.ts
//
// Optional: limit to a single recipient for a final check:
//   ONLY=appdev7710@gmail.com npx tsx scripts/email-pretaped-change-of-plans.ts

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadDotenv() {
  for (const f of [".env.local", ".env.production.local"]) {
    const p = resolve(process.cwd(), f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq < 0) continue;
      let v = t.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      const k = t.slice(0, eq).trim();
      if (!process.env[k]) process.env[k] = v;
    }
  }
}
loadDotenv();

async function main() {
  const { db, schema } = await import("@/db");
  const { eq, inArray } = await import("drizzle-orm");
  const {
    getTemplate,
    recipientMergeValues,
    applyMergeVars,
  } = await import("@/lib/email-templates");

  const tpl = getTemplate("pretaped-change-of-plans");
  if (!tpl) throw new Error("template pretaped-change-of-plans missing");

  // Active tournament — same selection as the rest of the app.
  const [tournament] = await db
    .select()
    .from(schema.tournaments)
    .orderBy(schema.tournaments.createdAt)
    .limit(1);
  if (!tournament) throw new Error("no tournament");

  const enrollments = await db
    .select({ userId: schema.enrollments.userId })
    .from(schema.enrollments)
    .where(eq(schema.enrollments.tournamentId, tournament.id));
  const userIds = enrollments.map((e) => e.userId);

  // Pull contact info + names. Defensive: only deliverable rows.
  const users = userIds.length
    ? await db
        .select({
          id: schema.users.id,
          name: schema.users.name,
          email: schema.users.email,
        })
        .from(schema.users)
        .where(inArray(schema.users.id, userIds))
    : [];

  const onlyFilter = process.env.ONLY?.trim().toLowerCase();
  const filtered = onlyFilter
    ? users.filter((u) => (u.email ?? "").toLowerCase() === onlyFilter)
    : users.filter((u) => !!u.email);

  console.log(`Tournament:        ${tournament.title ?? tournament.id}`);
  console.log(`Enrolled users:    ${users.length}`);
  console.log(`After filter:      ${filtered.length}`);
  if (onlyFilter) console.log(`(ONLY=${onlyFilter})`);
  console.log("");

  if (filtered.length === 0) {
    console.log("No recipients matched. Bailing.");
    return;
  }

  console.log("First 10 recipients:");
  for (const r of filtered.slice(0, 10)) {
    console.log(`  • ${r.name ?? "(no name)"} <${r.email}>`);
  }
  if (filtered.length > 10) {
    console.log(`  … + ${filtered.length - 10} more`);
  }
  console.log("");

  // Render once with the first recipient so we can preview merge.
  const previewRecipient = filtered[0];
  const previewVars = recipientMergeValues({
    name: previewRecipient.name,
    email: previewRecipient.email,
  });
  const renderedFields: Record<string, string> = {};
  for (const f of tpl.fields) {
    renderedFields[f.key] = applyMergeVars(f.defaultValue, previewVars);
  }
  const rendered = tpl.render({
    subject: applyMergeVars(tpl.defaultSubject, previewVars),
    fields: renderedFields,
  });
  const previewSubject = applyMergeVars(rendered.subject, previewVars);
  const previewText = applyMergeVars(rendered.text, previewVars);
  const previewHtml = applyMergeVars(rendered.html, previewVars, true);

  console.log("───────── Subject ─────────");
  console.log(previewSubject);
  console.log("");
  console.log("───────── Text body ───────");
  console.log(previewText);
  console.log("");
  console.log("───────── HTML (first 1.5 KB) ───────");
  console.log(previewHtml.slice(0, 1500));
  console.log("");
  console.log("───────────────────────────");

  const send = process.env.SEND === "1";
  if (!send) {
    console.log("");
    console.log("Dry-run mode — nothing sent.");
    console.log("To send: SEND=1 npx tsx scripts/email-pretaped-change-of-plans.ts");
    return;
  }

  // ── SEND PATH ─────────────────────────────────────────────────
  const { sendBatch, getActiveProvider } = await import("@/lib/email-provider");
  console.log(`Active provider: ${await getActiveProvider()}`);

  const from =
    process.env.EMAIL_FROM ||
    "Mia's Quiz Tournament <noreply@miaswebsites.art>";

  type Msg = {
    from: string;
    to: string;
    subject: string;
    html: string;
    text: string;
    templateId: string;
  };
  const messages: Msg[] = [];
  for (const r of filtered) {
    const vars = recipientMergeValues({ name: r.name, email: r.email });
    const fields: Record<string, string> = {};
    for (const f of tpl.fields) {
      fields[f.key] = applyMergeVars(f.defaultValue, vars);
    }
    const out = tpl.render({
      subject: applyMergeVars(tpl.defaultSubject, vars),
      fields,
    });
    messages.push({
      from,
      to: r.email!,
      subject: applyMergeVars(out.subject, vars),
      html: applyMergeVars(out.html, vars, true),
      text: applyMergeVars(out.text, vars),
      templateId: "pretaped-change-of-plans",
    });
  }

  console.log(`Sending ${messages.length} emails…`);
  const result = await sendBatch(messages);
  console.log(`sent=${result.sent} errors=${result.errors.length}`);
  if (result.errors.length > 0) {
    for (const e of result.errors.slice(0, 10)) {
      console.log(`  ✗ ${e.to}: ${e.error}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
