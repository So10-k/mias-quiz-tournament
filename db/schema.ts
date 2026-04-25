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
    // 1 = first bracket round (the most players), 2 = next, etc.
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
    resolvedVia: matchupResolver("resolved_via"),
    resolvedAt: timestamp("resolved_at", { mode: "date" }),
  },
  (t) => ({
    uniqSlot: uniqueIndex("matchups_round_slot_idx").on(
      t.tournamentId,
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
