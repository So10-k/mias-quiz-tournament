import { db, schema } from "@/db";
import { and, asc, desc, eq, gte, lte, ilike, or, sql, inArray } from "drizzle-orm";
import { id as makeId } from "./ids";
import type { LibraryOption } from "@/db/schema";

const { libraryQuestions } = schema;

export type LibraryFilter = {
  subject?: string | null;
  ageMin?: number | null;
  ageMax?: number | null;
  difficulty?: number | null;
  search?: string | null;
  source?: "seed" | "host" | null;
  limit?: number;
  offset?: number;
};

export type LibraryRow = typeof libraryQuestions.$inferSelect;

export async function getLibraryQuestions(
  filter: LibraryFilter = {}
): Promise<LibraryRow[]> {
  const conditions: any[] = [];
  if (filter.subject) {
    conditions.push(eq(libraryQuestions.subject, filter.subject as any));
  }
  // Age range overlap: question's [ageMin, ageMax] overlaps with player's age.
  // We support either a single age (ageMin == ageMax) or an explicit range.
  if (filter.ageMin != null) {
    conditions.push(lte(libraryQuestions.ageMin, filter.ageMin));
  }
  if (filter.ageMax != null) {
    conditions.push(gte(libraryQuestions.ageMax, filter.ageMax));
  }
  if (filter.difficulty != null) {
    conditions.push(eq(libraryQuestions.difficulty, filter.difficulty));
  }
  if (filter.source) {
    conditions.push(eq(libraryQuestions.source, filter.source));
  }
  if (filter.search && filter.search.trim()) {
    conditions.push(ilike(libraryQuestions.prompt, `%${filter.search.trim()}%`));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const rows = await db
    .select()
    .from(libraryQuestions)
    .where(where)
    .orderBy(desc(libraryQuestions.source), asc(libraryQuestions.difficulty), asc(libraryQuestions.ageMin))
    .limit(filter.limit ?? 60)
    .offset(filter.offset ?? 0);
  return rows;
}

export async function countLibraryQuestions(filter: LibraryFilter = {}) {
  const conditions: any[] = [];
  if (filter.subject) {
    conditions.push(eq(libraryQuestions.subject, filter.subject as any));
  }
  if (filter.ageMin != null) {
    conditions.push(lte(libraryQuestions.ageMin, filter.ageMin));
  }
  if (filter.ageMax != null) {
    conditions.push(gte(libraryQuestions.ageMax, filter.ageMax));
  }
  if (filter.difficulty != null) {
    conditions.push(eq(libraryQuestions.difficulty, filter.difficulty));
  }
  if (filter.source) {
    conditions.push(eq(libraryQuestions.source, filter.source));
  }
  if (filter.search && filter.search.trim()) {
    conditions.push(ilike(libraryQuestions.prompt, `%${filter.search.trim()}%`));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [{ count }] = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(libraryQuestions)
    .where(where);
  return Number(count ?? 0);
}

export async function getLibraryQuestionsByIds(ids: string[]): Promise<LibraryRow[]> {
  if (ids.length === 0) return [];
  return db
    .select()
    .from(libraryQuestions)
    .where(inArray(libraryQuestions.id, ids));
}

export type AddLibraryInput = {
  prompt: string;
  options: LibraryOption[];
  subject?: string;
  ageMin?: number;
  ageMax?: number;
  difficulty?: number;
  createdByUserId?: string | null;
};

export async function addLibraryQuestion(input: AddLibraryInput) {
  const [row] = await db
    .insert(libraryQuestions)
    .values({
      id: makeId(),
      prompt: input.prompt,
      options: input.options,
      subject: (input.subject as any) ?? "general",
      ageMin: input.ageMin ?? 5,
      ageMax: input.ageMax ?? 99,
      difficulty: Math.min(5, Math.max(1, input.difficulty ?? 2)),
      source: "host",
      createdByUserId: input.createdByUserId ?? null,
    })
    .returning();
  return row;
}

export async function deleteLibraryQuestion(id: string) {
  await db.delete(libraryQuestions).where(eq(libraryQuestions.id, id));
}

// Subject summary for the host filter UI: how many questions per subject.
export async function getSubjectCounts() {
  const rows = await db
    .select({
      subject: libraryQuestions.subject,
      n: sql<number>`cast(count(*) as int)`,
    })
    .from(libraryQuestions)
    .groupBy(libraryQuestions.subject);
  return rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.subject] = Number(r.n ?? 0);
    return acc;
  }, {});
}

// silence unused imports — the helpers are kept for future filter expansions.
void or;
void desc;
