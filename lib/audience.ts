// Shared types/constants for the announcement audience selector. Lives
// outside the "use server" actions file so the client component can import
// labels, the zod schema and types directly without the server-actions
// boundary stripping them.

import { z } from "zod";

export const AudienceFilterSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("still_in") }),
  z.object({ mode: z.literal("eliminated") }),
  z.object({ mode: z.literal("all") }),
  z.object({ mode: z.literal("all_users") }),
  z.object({
    mode: z.literal("eliminated_in_round"),
    roundId: z.string().min(1),
  }),
  z.object({
    mode: z.literal("survived_round"),
    roundId: z.string().min(1),
  }),
  z.object({
    mode: z.literal("no_submit_in_round"),
    roundId: z.string().min(1),
  }),
  z.object({
    mode: z.literal("with_strikes"),
    strikes: z.number().int().min(0).max(20),
  }),
  z.object({
    mode: z.literal("specific"),
    userIds: z.array(z.string().min(1)).min(1).max(500),
  }),
]);
export type AudienceFilter = z.infer<typeof AudienceFilterSchema>;
export type AudienceMode = AudienceFilter["mode"];

export const AUDIENCE_LABELS: Record<AudienceMode, string> = {
  still_in: "Players still in the tournament",
  eliminated: "Players eliminated (any round)",
  all: "All signed-up players",
  all_users: "EVERY user in the DB (use with care)",
  eliminated_in_round: "Eliminated in a specific round",
  survived_round: "Players who passed a specific round",
  no_submit_in_round: "Enrolled but didn't submit a specific round",
  with_strikes: "Players with an exact strike count",
  specific: "Hand-picked players",
};

export const AUDIENCE_MODES: AudienceMode[] = [
  "still_in",
  "eliminated",
  "all",
  "specific",
  "eliminated_in_round",
  "survived_round",
  "no_submit_in_round",
  "with_strikes",
  "all_users",
];

export const ROUND_AUDIENCE_MODES: AudienceMode[] = [
  "eliminated_in_round",
  "survived_round",
  "no_submit_in_round",
];

export type AudienceUniverse = {
  rounds: Array<{
    id: string;
    chapterNumber: number;
    title: string;
    isPractice: boolean;
    status: string;
  }>;
  players: Array<{
    userId: string;
    name: string | null;
    email: string;
    enrollmentId: string;
    eliminatedAt: string | null;
    strikeCount: number;
  }>;
};
