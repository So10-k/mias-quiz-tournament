import {
  pgTable,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  uniqueIndex,
  primaryKey,
  pgEnum,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── enums ──────────────────────────────────────────────────────────────────

export const userRole = pgEnum("user_role", ["author", "reader"]);
export const tournamentStatus = pgEnum("tournament_status", [
  "registration",
  "in_progress",
  "complete",
]);
export const roundStatus = pgEnum("round_status", [
  "draft",
  "active",
  "closed",
]);
export const questionType = pgEnum("question_type", [
  "multiple_choice",
  "true_false",
]);
export const strikeReason = pgEnum("strike_reason", [
  "failed_chapter",
  "did_not_submit",
]);
export const matchupResolver = pgEnum("matchup_resolver", ["auto", "manual"]);

export const subject = pgEnum("subject", [
  "general",
  "math",
  "reading",
  "science",
  "history",
  "geography",
  "animals",
  "words",
  "riddles",
  "logic",
  "art",
  "music",
  "sports",
]);
export const librarySource = pgEnum("library_source", ["seed", "host"]);
export const articleStatus = pgEnum("article_status", [
  "draft",
  "published",
  "archived",
]);
export const articleVisibility = pgEnum("article_visibility", [
  "public",
  "subscribers_only",
  "unlisted",
]);
export const subscriptionFrequency = pgEnum("subscription_frequency", [
  "daily",
  "weekly",
  "monthly",
]);
export const fileAccessMode = pgEnum("file_access_mode", [
  "public",
  "login",
  "users",
  "password",
]);

// Pre-production "writing session" — the four-step doc workflow that
// goes AI draft → Sam review → Mia delegating → Mia + Juliette editing
// → Sam finalize. See lib/writing-session.ts.
export const writingScriptStatus = pgEnum("writing_script_status", [
  "draft", // AI generated; Sam reviewing/editing
  "delegating", // Mia assigning lines to herself / Juliette
  "editing", // Mia + Juliette editing their assigned lines
  "finalized", // Locked; PDFs available
]);

export const writingScriptCharacter = pgEnum("writing_script_character", [
  "narrator", // off-camera voiceover
  "host", // generic show host before assignment
  "cohost", // generic co-host
  "sam", // director / floor / cue
  "mia",
  "juliette",
  "both", // unison
]);

// ─── core ───────────────────────────────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    email: text("email").notNull(),
    name: text("name"),
    emailVerified: timestamp("email_verified", { mode: "date" }),
    image: text("image"),
    role: userRole("role").notNull().default("reader"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    // Set when the user agrees to the finals confidentiality terms
    // via the Discourse NDA PM. Used by the SSO flow to hold any
    // ungagreed finalist in `pending_finals_nda`.
    finalsNdaAgreedAt: timestamp("finals_nda_agreed_at", { mode: "date" }),
  },
  (t) => ({
    emailIdx: uniqueIndex("users_email_idx").on(t.email),
  })
);

// NextAuth tables (Drizzle adapter shape).
export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.provider, t.providerAccountId] }),
  })
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.identifier, t.token] }),
  })
);

// ─── tournament ─────────────────────────────────────────────────────────────

export const tournaments = pgTable("tournaments", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  registrationOpen: boolean("registration_open").notNull().default(true),
  status: tournamentStatus("status").notNull().default("registration"),
  strikeLimit: integer("strike_limit").notNull().default(2),
  winnerUserId: text("winner_user_id").references(() => users.id),
  startedAt: timestamp("started_at", { mode: "date" }),
  endedAt: timestamp("ended_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const enrollments = pgTable(
  "enrollments",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tournamentId: text("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    strikeCount: integer("strike_count").notNull().default(0),
    eliminatedAt: timestamp("eliminated_at", { mode: "date" }),
    eliminatedInRoundId: text("eliminated_in_round_id"),
    registeredAt: timestamp("registered_at", { mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniqUserTournament: uniqueIndex("enrollments_user_tournament_idx").on(
      t.userId,
      t.tournamentId
    ),
  })
);

export const rounds = pgTable("rounds", {
  id: text("id").primaryKey(),
  tournamentId: text("tournament_id")
    .notNull()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  chapterNumber: integer("chapter_number").notNull(),
  title: text("title").notNull(),
  introProse: text("intro_prose"),
  passThreshold: numeric("pass_threshold", { precision: 4, scale: 2 })
    .notNull()
    .default("0.6"),
  status: roundStatus("status").notNull().default("draft"),
  // Practice rounds let players try the format before the tournament begins.
  // They never give strikes, never feed the bracket, and stay open.
  isPractice: boolean("is_practice").notNull().default(false),
  // When set, this round is a tiebreaker for a specific bracket matchup.
  // Only the two players in that matchup can access the round; it's hidden
  // from public practice listings.
  tiebreakerMatchupId: text("tiebreaker_matchup_id"),
  // When set, this round resolves a specific losers-bracket matchup
  // (similar gating to tiebreakerMatchupId).
  losersMatchupId: text("losers_matchup_id"),
  opensAt: timestamp("opens_at", { mode: "date" }),
  closesAt: timestamp("closes_at", { mode: "date" }),
  // ─── live mode ────────────────────────────────────────────────────
  // When true, this round is hosted live: the host drives question
  // advancement for everyone, players answer in sync, and spectators
  // see the same thing without writing answers. Used for the finals
  // over Zoom/webinar.
  isLive: boolean("is_live").notNull().default(false),
  // 'pre_start' = round set up but not started; 'running' = a question
  // is up; 'revealing' = all questions done, host walking through
  // answers; 'complete' = scoreboard frozen.
  liveStatus: text("live_status").notNull().default("pre_start"),
  // Index into the question list (zero-based). null = not yet started.
  liveCurrentQuestionIndex: integer("live_current_question_index"),
  // Set whenever the host advances; server-side lock is computed as
  // `liveCurrentQuestionStartedAt + liveQuestionSeconds`.
  liveCurrentQuestionStartedAt: timestamp(
    "live_current_question_started_at",
    { mode: "date" }
  ),
  // Per-question time budget. Default 30s — generous for read-aloud.
  liveQuestionSeconds: integer("live_question_seconds").notNull().default(30),
  // When the host clicked "Start Round" — used for analytics and the
  // spectator UI's "live since…" badge.
  liveStartedAt: timestamp("live_started_at", { mode: "date" }),
  // ─── live effects ────────────────────────────────────────────────
  // Host-triggered visual/audio effects that fire on every connected
  // client at once. Three columns power the whole system:
  //   liveEffect         — the effect identifier (confetti, fanfare,
  //                        boom, fireworks, drumroll, approve, tomato,
  //                        hearts, pressure, banner). Null = no effect.
  //   liveEffectAt       — fires the effect; doubles as a dedup key
  //                        (clients only play effects whose timestamp
  //                        is newer than the last one they played).
  //   liveEffectMessage  — optional text for "banner"-style effects
  //                        where the host types a custom string.
  liveEffect: text("live_effect"),
  liveEffectAt: timestamp("live_effect_at", { mode: "date" }),
  liveEffectMessage: text("live_effect_message"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const questions = pgTable("questions", {
  id: text("id").primaryKey(),
  roundId: text("round_id")
    .notNull()
    .references(() => rounds.id, { onDelete: "cascade" }),
  order: integer("order").notNull(),
  prompt: text("prompt").notNull(),
  questionType: questionType("question_type")
    .notNull()
    .default("multiple_choice"),
  points: integer("points").notNull().default(1),
});

export const options = pgTable("options", {
  id: text("id").primaryKey(),
  questionId: text("question_id")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }),
  order: integer("order").notNull(),
  label: text("label").notNull(),
  isCorrect: boolean("is_correct").notNull().default(false),
});

export const attempts = pgTable(
  "attempts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roundId: text("round_id")
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { mode: "date" })
      .notNull()
      .defaultNow(),
    submittedAt: timestamp("submitted_at", { mode: "date" }),
    score: numeric("score", { precision: 4, scale: 2 }),
    passed: boolean("passed"),
  },
  (t) => ({
    uniqUserRound: uniqueIndex("attempts_user_round_idx").on(
      t.userId,
      t.roundId
    ),
  })
);

export const answers = pgTable("answers", {
  id: text("id").primaryKey(),
  attemptId: text("attempt_id")
    .notNull()
    .references(() => attempts.id, { onDelete: "cascade" }),
  questionId: text("question_id")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }),
  optionId: text("option_id").references(() => options.id, {
    onDelete: "set null",
  }),
  isCorrect: boolean("is_correct").notNull().default(false),
});

// ─── site-level key/value settings ─────────────────────────────────────────

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value"),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

// ─── IP blocklist ──────────────────────────────────────────────────────────

export const blockedIps = pgTable("blocked_ips", {
  id: text("id").primaryKey(),
  ip: text("ip").notNull().unique(),
  reason: text("reason"),
  createdByUserId: text("created_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

// ─── visitor analytics ─────────────────────────────────────────────────────

// One row per page-view ping. The client mounts a tiny logger that POSTs
// once per route load; the server enriches with IP / Vercel geo headers.
export const visitLogs = pgTable("visit_logs", {
  id: text("id").primaryKey(),
  // Random per-device cookie ID so we can group anonymous visits before they
  // sign in, and join later with their userId once they do.
  fingerprint: text("fingerprint").notNull(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  path: text("path").notNull(),
  referrer: text("referrer"),
  userAgent: text("user_agent"),
  ip: text("ip"),
  country: text("country"),
  region: text("region"),
  city: text("city"),
  // The IANA timezone name reported by the browser (e.g. America/Chicago).
  timezone: text("timezone"),
  // BCP-47 language tag (en-US, en-GB, …).
  language: text("language"),
  // "WxH@DPR" e.g. "1440x900@2"
  screen: text("screen"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

// ─── file vault (R2-backed) ─────────────────────────────────────────────────

export const files = pgTable("files", {
  id: text("id").primaryKey(),
  // R2 object key, e.g. "files/abc123/intro.pdf". Unique so we can find by key.
  storageKey: text("storage_key").notNull().unique(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull().default(0),
  accessMode: fileAccessMode("access_mode").notNull().default("login"),
  // scrypt(salt + key) for password mode. Stored as "salt:hex.key:hex".
  passwordHash: text("password_hash"),
  // For 'users' mode — comma-separated lowercase emails.
  allowedEmails: text("allowed_emails"),
  // When false, the viewer hides download buttons and the asset endpoint
  // strips Content-Disposition (best-effort — clients can still right-click).
  allowDownload: boolean("allow_download").notNull().default(true),
  // Optional human-friendly note shown to viewers.
  note: text("note"),
  createdByUserId: text("created_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

// ─── question library ──────────────────────────────────────────────────────

export type LibraryOption = { label: string; isCorrect: boolean };

export const libraryQuestions = pgTable("library_questions", {
  id: text("id").primaryKey(),
  prompt: text("prompt").notNull(),
  // [{ label, isCorrect }, …] — stored inline for fast filtering & picking.
  options: jsonb("options").$type<LibraryOption[]>().notNull(),
  subject: subject("subject").notNull().default("general"),
  // Inclusive age range. ageMin=5 ageMax=99 means "good for everyone".
  ageMin: integer("age_min").notNull().default(5),
  ageMax: integer("age_max").notNull().default(99),
  // 1=easy … 5=hard. 2 is the default.
  difficulty: integer("difficulty").notNull().default(2),
  source: librarySource("source").notNull().default("seed"),
  createdByUserId: text("created_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

// ─── bracket ────────────────────────────────────────────────────────────────

export const matchups = pgTable(
  "matchups",
  {
    id: text("id").primaryKey(),
    tournamentId: text("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    // 'main' or 'losers'. Default 'main' keeps existing rows working.
    bracket: text("bracket").notNull().default("main"),
    // 1 = first round (most players), 2 = next, etc.
    roundIndex: integer("round_index").notNull(),
    // 0..N-1 within the round, top-to-bottom in bracket display order.
    slot: integer("slot").notNull(),
    playerAUserId: text("player_a_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    playerBUserId: text("player_b_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    winnerUserId: text("winner_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    // For main-bracket R1 matchups in double-elim mode: where the *loser*
    // gets routed to (a losers-bracket matchup) and which side. Null on
    // either = loser is just out.
    loserNextMatchupId: text("loser_next_matchup_id"),
    loserNextSide: text("loser_next_side"), // 'a' | 'b'
    // Prediction-game lock. When set, no further predictions can be made
    // or edited for this matchup. Auto-set when the matchup resolves; the
    // host can also lock manually from /host/predictions.
    predictionsLockedAt: timestamp("predictions_locked_at", { mode: "date" }),
    resolvedVia: matchupResolver("resolved_via"),
    resolvedAt: timestamp("resolved_at", { mode: "date" }),
  },
  (t) => ({
    uniqSlot: uniqueIndex("matchups_bracket_round_slot_idx").on(
      t.tournamentId,
      t.bracket,
      t.roundIndex,
      t.slot
    ),
  })
);

export const strikes = pgTable("strikes", {
  id: text("id").primaryKey(),
  enrollmentId: text("enrollment_id")
    .notNull()
    .references(() => enrollments.id, { onDelete: "cascade" }),
  roundId: text("round_id")
    .notNull()
    .references(() => rounds.id, { onDelete: "cascade" }),
  reason: strikeReason("reason").notNull(),
  givenAt: timestamp("given_at", { mode: "date" }).notNull().defaultNow(),
});

// ─── email tracking + Miamail ──────────────────────────────────────────
// Every outgoing email is persisted so recipients can read their own
// inbox in /miamail and the host can see open/click analytics.
export const emailSends = pgTable("email_sends", {
  id: text("id").primaryKey(),
  recipientEmail: text("recipient_email").notNull(),
  recipientUserId: text("recipient_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  subject: text("subject").notNull(),
  htmlBody: text("html_body").notNull(),
  textBody: text("text_body").notNull(),
  templateId: text("template_id"),
  sendBatchId: text("send_batch_id"),
  provider: text("provider").notNull(),
  sentAt: timestamp("sent_at", { mode: "date" }).notNull().defaultNow(),
  openedAt: timestamp("opened_at", { mode: "date" }),
});

export const emailClicks = pgTable("email_clicks", {
  id: text("id").primaryKey(),
  sendId: text("send_id")
    .notNull()
    .references(() => emailSends.id, { onDelete: "cascade" }),
  originalUrl: text("original_url").notNull(),
  clickedAt: timestamp("clicked_at", { mode: "date" }).notNull().defaultNow(),
  userAgent: text("user_agent"),
  ip: text("ip"),
});

// ─── staff portal (Duo-backed) ─────────────────────────────────────────
// Separate from `users` — staff identities are provisioned via Duo SSO and
// don't share rows with tournament players, even if the email matches.
export const staffUsers = pgTable("staff_users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  duoSubject: text("duo_subject"),
  role: text("role").notNull().default("staff"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { mode: "date" }),
});

export const staffSessions = pgTable("staff_sessions", {
  sessionToken: text("session_token").primaryKey(),
  staffUserId: text("staff_user_id")
    .notNull()
    .references(() => staffUsers.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

// Audit log of staff actions — feeds the real-time staff dashboard.
export const staffActions = pgTable("staff_actions", {
  id: text("id").primaryKey(),
  staffUserId: text("staff_user_id").references(() => staffUsers.id, {
    onDelete: "set null",
  }),
  staffEmail: text("staff_email").notNull(),
  action: text("action").notNull(),
  target: text("target"),
  details: jsonb("details"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

// ─── forms ────────────────────────────────────────────────────────────
// Native forms feature. Authored from /staff/forms, served at /forms/[slug]
// with a typeform-style one-question-per-page runner. Forms can require
// authentication (link submissions to a `users.id`), or accept anonymous
// responses for public collection.

export const forms = pgTable("forms", {
  id: text("id").primaryKey(),
  // URL-safe slug. Public form lives at /forms/<slug>.
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  // Optional intro shown before the first question (typeform-style cover).
  intro: text("intro"),
  // Optional thank-you body shown after submit.
  outro: text("outro"),
  // 'draft' = invisible publicly; 'published' = live; 'closed' = no new
  // submissions but the URL still resolves.
  status: text("status").notNull().default("draft"),
  // Authentication gate. When true, /forms/<slug> redirects to /signin
  // for unauthenticated visitors and stamps users.id on each submission.
  requireAuth: boolean("require_auth").notNull().default(false),
  // When true (and requireAuth is true), only one submission per user.
  oneSubmissionPerUser: boolean("one_submission_per_user")
    .notNull()
    .default(false),
  // Tracks who created it for audit. Nullable so cascading staff deletion
  // doesn't drop forms.
  createdByStaffId: text("created_by_staff_id").references(
    () => staffUsers.id,
    { onDelete: "set null" }
  ),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const formQuestionType = pgEnum("form_question_type", [
  "short_text",
  "long_text",
  "email",
  "single_select",
  "multi_select",
  "yes_no",
  "scale",
  "statement",
]);

export const formQuestions = pgTable(
  "form_questions",
  {
    id: text("id").primaryKey(),
    formId: text("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    order: integer("order").notNull(),
    type: formQuestionType("type").notNull(),
    prompt: text("prompt").notNull(),
    helperText: text("helper_text"),
    required: boolean("required").notNull().default(true),
    // Choices for single_select / multi_select. Format: [{label, value}].
    // Scale uses a numeric range encoded here too: [{label:"1",value:"1"},...].
    options: jsonb("options").$type<Array<{ label: string; value: string }>>(),
    // For scale: { min: 1, max: 5, minLabel, maxLabel } (typed loose).
    config: jsonb("config"),
  },
  (t) => ({
    formOrder: index("form_questions_form_order_idx").on(t.formId, t.order),
  })
);

export const formSubmissions = pgTable(
  "form_submissions",
  {
    id: text("id").primaryKey(),
    formId: text("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    // Player who submitted, when authed. Null = anonymous response.
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    submittedAt: timestamp("submitted_at", { mode: "date" })
      .notNull()
      .defaultNow(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    // Per-question answers stored inline for cheap reads. The flatter
    // join table (form_answers) is the source of truth; this is just a
    // denormalised cache so /staff/forms/[id]/responses doesn't N+1.
    answersJson: jsonb("answers_json").$type<
      Record<string, string | string[] | number | boolean | null>
    >(),
  },
  (t) => ({
    formIdx: index("form_submissions_form_idx").on(t.formId),
    userIdx: index("form_submissions_user_idx").on(t.userId),
  })
);

export const formAnswers = pgTable(
  "form_answers",
  {
    id: text("id").primaryKey(),
    submissionId: text("submission_id")
      .notNull()
      .references(() => formSubmissions.id, { onDelete: "cascade" }),
    questionId: text("question_id")
      .notNull()
      .references(() => formQuestions.id, { onDelete: "cascade" }),
    // Stored as JSON so any answer shape works (string, array, number).
    value: jsonb("value"),
  },
  (t) => ({
    submissionIdx: index("form_answers_submission_idx").on(t.submissionId),
    questionIdx: index("form_answers_question_idx").on(t.questionId),
  })
);

// ─── question of the day ──────────────────────────────────────────────
// Daily fun question, generated by Groq from a queue of player-submitted
// topic suggestions, blended with current-events context. Each player can
// submit up to 2 suggestions in their lifetime; the daily cron picks one,
// drafts a 4-option MC question, and posts it. Players answer A–D or pick
// "Other" with a free-text response that gets sanitised by the safeguard
// model before going on the public board.

export const qotdRecommendations = pgTable(
  "qotd_recommendations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    topic: text("topic").notNull(),
    // 'pending' = in queue, 'used' = already inspired a question,
    // 'rejected' = staff or safeguard pruned it.
    status: text("status").notNull().default("pending"),
    rejectionReason: text("rejection_reason"),
    pickedForQuestionId: text("picked_for_question_id"),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("qotd_recs_user_idx").on(t.userId),
    statusIdx: index("qotd_recs_status_idx").on(t.status),
  })
);

export const qotdQuestions = pgTable("qotd_questions", {
  id: text("id").primaryKey(),
  // YYYY-MM-DD (the local date the question is "for"), unique so the
  // cron can't accidentally double-create.
  forDate: text("for_date").notNull().unique(),
  prompt: text("prompt").notNull(),
  // Always 4 options. Format: [{label, value}] where value is A/B/C/D.
  options: jsonb("options")
    .$type<Array<{ label: string; value: string }>>()
    .notNull(),
  // Optional: which recommendation seeded this question.
  basedOnRecommendationId: text("based_on_recommendation_id").references(
    () => qotdRecommendations.id,
    { onDelete: "set null" }
  ),
  // Free-text capture of what context (current events etc.) Groq used.
  // Useful for "why did this question get picked?" debugging.
  context: text("context"),
  // Optional: signed URL to TTS audio (Orpheus). Generated lazily.
  audioUrl: text("audio_url"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const qotdResponses = pgTable(
  "qotd_responses",
  {
    id: text("id").primaryKey(),
    questionId: text("question_id")
      .notNull()
      .references(() => qotdQuestions.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    // 'A' | 'B' | 'C' | 'D' | 'other'
    choice: text("choice").notNull(),
    // For 'other' choices only. The user's raw input (kept for audit) and
    // the sanitised version (what shows publicly).
    otherTextRaw: text("other_text_raw"),
    otherTextClean: text("other_text_clean"),
    // Hidden = safeguard model flagged it; staff can still see in audit.
    hidden: boolean("hidden").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    questionIdx: index("qotd_responses_question_idx").on(t.questionId),
    userIdx: index("qotd_responses_user_idx").on(t.userId),
    // One response per user per question.
    uniqUserQuestion: uniqueIndex("qotd_responses_user_question_uniq").on(
      t.userId,
      t.questionId
    ),
  })
);

// ─── articles / blog ──────────────────────────────────────────────────
// Block-document CMS. Articles are authored by in-app users (Mia +
// Sam — both have role=author) or staff users (when delegated). The
// body lives in `bodyJson` as an ordered array of block objects;
// shape is validated at save-time in lib/article-blocks.ts.

export const articles = pgTable(
  "articles",
  {
    id: text("id").primaryKey(),
    // URL-safe identifier — public article lives at /blog/<slug>.
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    // 1–2 sentence summary used on the index card and in the email
    // digest preheader. Optional.
    dek: text("dek"),
    coverImageUrl: text("cover_image_url"),
    // Ordered array of blocks — { id, type, data }. Source of truth
    // for the rendered article + email body.
    bodyJson: jsonb("body_json").notNull().default([]),
    // Plaintext flatten of bodyJson — used for search snippets +
    // email-client text fallback.
    bodyText: text("body_text").notNull().default(""),
    readMinutes: integer("read_minutes").notNull().default(1),
    status: articleStatus("status").notNull().default("draft"),
    visibility: articleVisibility("visibility").notNull().default("public"),
    // Author resolution: prefer authorUserId (Mia/Sam) and fall back
    // to authorStaffId. Denormalized authorName/avatar preserve
    // attribution if accounts are deleted.
    authorUserId: text("author_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    authorStaffId: text("author_staff_id").references(() => staffUsers.id, {
      onDelete: "set null",
    }),
    authorName: text("author_name").notNull(),
    authorAvatarUrl: text("author_avatar_url"),
    publishedAt: timestamp("published_at", { mode: "date" }),
    // Cron picks articles with publishedAt > subscriber.lastSentAt;
    // this column lets us also flag "skip from digest" manually.
    digestEligible: boolean("digest_eligible").notNull().default(true),
    viewCount: integer("view_count").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    statusIdx: index("articles_status_idx").on(t.status),
    publishedIdx: index("articles_published_idx").on(t.publishedAt),
  })
);

// Newsletter subscriptions. Email-keyed (one active sub per email).
// Anonymous signups are allowed — userId is filled when the
// subscriber is also a signed-in player. Confirmation token gates
// double opt-in; unsubscribe token lets recipients leave with one
// click from any email.
export const newsletterSubscriptions = pgTable(
  "newsletter_subscriptions",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    frequency: subscriptionFrequency("frequency").notNull().default("weekly"),
    confirmationToken: text("confirmation_token").notNull().unique(),
    confirmedAt: timestamp("confirmed_at", { mode: "date" }),
    unsubscribeToken: text("unsubscribe_token").notNull().unique(),
    unsubscribedAt: timestamp("unsubscribed_at", { mode: "date" }),
    lastSentAt: timestamp("last_sent_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: uniqueIndex("newsletter_subs_email_idx").on(t.email),
  })
);

// ─── forum group grants ────────────────────────────────────────────────
// Manual group memberships on the discuss.miaswebsites.art forum,
// granted from /host/forum-roles. The Discourse SSO flow combines
// these with bracket-derived auto-groups (players / spectators /
// semi_finalists / finalists) on every login.
//
// Grantable groups are intentionally limited (see lib/forum-grants.ts
// MANUAL_FORUM_GROUPS) — staff-style mod tiers + the author group.
export const forumGroupGrants = pgTable(
  "forum_group_grants",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Discourse group name (matches what the SSO payload sends as
    // add_groups). e.g. "authors", "trial_moderators", "honorary_mods",
    // "regulars".
    groupName: text("group_name").notNull(),
    grantedAt: timestamp("granted_at", { mode: "date" })
      .notNull()
      .defaultNow(),
    grantedByUserId: text("granted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (t) => ({
    uniqUserGroup: uniqueIndex("forum_group_grants_user_group_idx").on(
      t.userId,
      t.groupName
    ),
    userIdx: index("forum_group_grants_user_idx").on(t.userId),
  })
);

// ─── support tickets ───────────────────────────────────────────────────
// Mirror of Discourse ticket topics. Each row is created when a user
// submits the /support form; the canonical thread lives in the
// "Support Tickets" Discourse category and we fetch messages from
// there on demand. We persist enough metadata locally to:
//   • list a logged-in user's tickets without searching Discourse
//   • show the right status badge
//   • map back to the topic for replies + admin lookups
//
// Status mirrors what the @support_bot changestatus command sets.
// The plugin POSTs to /api/support/sync-status when status changes
// so this row stays in sync with Discourse.
export const supportTicketStatus = pgEnum("support_ticket_status", [
  "open",
  "pending",
  "resolved",
  "closed",
]);

export const supportTickets = pgTable(
  "support_tickets",
  {
    id: text("id").primaryKey(),
    // Canonical topic id on discuss.miaswebsites.art. Unique because
    // each ticket gets its own topic.
    discourseTopicId: integer("discourse_topic_id").notNull(),
    discoursePostId: integer("discourse_post_id").notNull(),
    subject: text("subject").notNull(),
    // Submitter info. email is the load-bearing field — used for
    // the bot's `respond` command. userId is set when the submitter
    // was signed in; null for anonymous submissions.
    submitterEmail: text("submitter_email").notNull(),
    submitterName: text("submitter_name").notNull(),
    submitterUserId: text("submitter_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    // Optional category tag from the dropdown ("bug", "tournament", ...)
    topic: text("topic"),
    // Latest known status. Updated via the plugin's sync-status hook.
    status: supportTicketStatus("status").notNull().default("open"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    uniqTopic: uniqueIndex("support_tickets_topic_idx").on(t.discourseTopicId),
    userIdx: index("support_tickets_user_idx").on(t.submitterUserId),
    emailIdx: index("support_tickets_email_idx").on(t.submitterEmail),
  })
);

// ─── prediction game ───────────────────────────────────────────────────
// March-madness style: signed-in users predict winners of undecided
// matchups for points. Per-matchup edits are allowed until the matchup is
// locked (host action, or auto when the matchup resolves).
export const predictions = pgTable(
  "predictions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    matchupId: text("matchup_id")
      .notNull()
      .references(() => matchups.id, { onDelete: "cascade" }),
    predictedWinnerUserId: text("predicted_winner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniqUserMatchup: uniqueIndex("predictions_user_matchup_idx").on(
      t.userId,
      t.matchupId
    ),
  })
);

// ─── host workflows ────────────────────────────────────────────────────
// Host-runnable workflows (audit, sync, email blast, etc.). Each row is
// one run, with the structured result_json blob shaped per workflow.
// PDF reports are generated on demand from this row.

export const workflowRuns = pgTable(
  "workflow_runs",
  {
    id: text("id").primaryKey(),
    /** Static workflow id (e.g. "finals-readiness"). Maps to a
        registered lib/workflows/<id>.ts module. */
    workflowId: text("workflow_id").notNull(),
    triggeredByUserId: text("triggered_by_user_id").references(
      () => users.id,
      { onDelete: "set null" }
    ),
    startedAt: timestamp("started_at", { mode: "date" })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { mode: "date" }),
    /** 'running' | 'ok' | 'failed' */
    status: text("status").notNull().default("running"),
    /** Human-readable one-liner shown in the run list. */
    summary: text("summary"),
    /** Per-workflow structured result. Used by the PDF renderer. */
    resultJson: jsonb("result_json"),
    /** How many emails the workflow actually sent. */
    emailsSent: integer("emails_sent").notNull().default(0),
    /** Error message if status='failed'. */
    error: text("error"),
  },
  (t) => ({
    workflowIdx: index("workflow_runs_workflow_idx").on(t.workflowId),
    startedIdx: index("workflow_runs_started_idx").on(t.startedAt),
  })
);

// ─── writing session ───────────────────────────────────────────────────
// AI-drafted show script that goes through a four-stage approval +
// delegation flow. See lib/writing-session.ts for the state machine.

export const writingScripts = pgTable("writing_scripts", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  // Free-text brief used by the generator + a record of intent.
  brief: text("brief").notNull().default(""),
  status: writingScriptStatus("status").notNull().default("draft"),
  // Soft references to the in-app users for analytics; null when the
  // script was created before users were wired in (e.g. for finals).
  createdByUserId: text("created_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  finalizedAt: timestamp("finalized_at", { mode: "date" }),
});

export const writingScriptParts = pgTable(
  "writing_script_parts",
  {
    id: text("id").primaryKey(),
    scriptId: text("script_id")
      .notNull()
      .references(() => writingScripts.id, { onDelete: "cascade" }),
    order: integer("order").notNull(),
    title: text("title").notNull(),
    // Optional one-paragraph description of what happens in this part.
    description: text("description"),
  },
  (t) => ({
    scriptOrderIdx: index("writing_script_parts_script_order_idx").on(
      t.scriptId,
      t.order
    ),
  })
);

export const writingScriptLines = pgTable(
  "writing_script_lines",
  {
    id: text("id").primaryKey(),
    partId: text("part_id")
      .notNull()
      .references(() => writingScriptParts.id, { onDelete: "cascade" }),
    order: integer("order").notNull(),
    character: writingScriptCharacter("character").notNull(),
    // The spoken line.
    text: text("text").notNull(),
    // Stage direction / cue — shown only on Sam's master PDF.
    cue: text("cue"),
    // Filled during "delegating": which helper owns edit rights when we
    // hit "editing" phase. 'mia' | 'juliette' | null (unassigned).
    assignedTo: text("assigned_to"),
    // Audit columns so the host dashboard can show "Juliette edited 3
    // mins ago".
    lastEditedBy: text("last_edited_by"),
    lastEditedAt: timestamp("last_edited_at", { mode: "date" }),
  },
  (t) => ({
    partOrderIdx: index("writing_script_lines_part_order_idx").on(
      t.partId,
      t.order
    ),
  })
);

// Public access to /writing-session is PIN-gated. Sam generates a
// distinct 4-digit PIN per helper from /host/writing-session/[id].
export const writingScriptPins = pgTable(
  "writing_script_pins",
  {
    id: text("id").primaryKey(),
    scriptId: text("script_id")
      .notNull()
      .references(() => writingScripts.id, { onDelete: "cascade" }),
    pin: text("pin").notNull(),
    // 'mia' | 'juliette' — drives which lines the holder can edit
    // during the "editing" phase.
    forPerson: text("for_person").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { mode: "date" }),
    revokedAt: timestamp("revoked_at", { mode: "date" }),
  },
  (t) => ({
    // PINs are unique across all scripts so the public landing page
    // can resolve a PIN to its script without asking which script.
    pinIdx: uniqueIndex("writing_script_pins_pin_idx").on(t.pin),
    scriptIdx: index("writing_script_pins_script_idx").on(t.scriptId),
  })
);

// ─── relations ──────────────────────────────────────────────────────────────

export const userRelations = relations(users, ({ many }) => ({
  enrollments: many(enrollments),
  attempts: many(attempts),
}));

export const tournamentRelations = relations(tournaments, ({ many, one }) => ({
  rounds: many(rounds),
  enrollments: many(enrollments),
  winner: one(users, {
    fields: [tournaments.winnerUserId],
    references: [users.id],
  }),
}));

export const roundRelations = relations(rounds, ({ many, one }) => ({
  questions: many(questions),
  attempts: many(attempts),
  tournament: one(tournaments, {
    fields: [rounds.tournamentId],
    references: [tournaments.id],
  }),
}));

export const questionRelations = relations(questions, ({ many, one }) => ({
  options: many(options),
  round: one(rounds, {
    fields: [questions.roundId],
    references: [rounds.id],
  }),
}));

export const optionRelations = relations(options, ({ one }) => ({
  question: one(questions, {
    fields: [options.questionId],
    references: [questions.id],
  }),
}));

export const attemptRelations = relations(attempts, ({ many, one }) => ({
  answers: many(answers),
  user: one(users, { fields: [attempts.userId], references: [users.id] }),
  round: one(rounds, { fields: [attempts.roundId], references: [rounds.id] }),
}));

export const enrollmentRelations = relations(enrollments, ({ one, many }) => ({
  user: one(users, { fields: [enrollments.userId], references: [users.id] }),
  tournament: one(tournaments, {
    fields: [enrollments.tournamentId],
    references: [tournaments.id],
  }),
  strikes: many(strikes),
}));
