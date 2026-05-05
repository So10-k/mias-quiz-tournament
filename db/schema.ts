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
export const fileAccessMode = pgEnum("file_access_mode", [
  "public",
  "login",
  "users",
  "password",
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
