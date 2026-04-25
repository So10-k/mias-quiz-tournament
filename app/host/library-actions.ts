"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/session";
import {
  addLibraryQuestion,
  deleteLibraryQuestion,
  getLibraryQuestions,
  getLibraryQuestionsByIds,
  countLibraryQuestions,
  getSubjectCounts,
  type LibraryFilter,
} from "@/lib/library";

async function requireHost() {
  const u = await requireUser();
  if (u.role !== "author") redirect("/play");
  return u;
}

// Re-export the read helpers under server-action friendly wrappers so we can
// call them from client components when needed.
export async function fetchLibrary(filter: LibraryFilter) {
  await requireHost();
  const [rows, count, subjectCounts] = await Promise.all([
    getLibraryQuestions(filter),
    countLibraryQuestions(filter),
    getSubjectCounts(),
  ]);
  return { rows, count, subjectCounts };
}

export async function fetchLibraryByIds(ids: string[]) {
  await requireHost();
  return getLibraryQuestionsByIds(ids);
}

const AddInput = z.object({
  prompt: z.string().min(1).max(400),
  options: z
    .array(
      z.object({
        label: z.string().min(1).max(200),
        isCorrect: z.boolean(),
      })
    )
    .min(2)
    .max(6),
  subject: z.enum([
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
  ]),
  ageMin: z.number().int().min(3).max(99),
  ageMax: z.number().int().min(3).max(99),
  difficulty: z.number().int().min(1).max(5),
});

export async function addLibraryAction(input: z.infer<typeof AddInput>) {
  const user = await requireHost();
  const parsed = AddInput.parse(input);
  const correctCount = parsed.options.filter((o) => o.isCorrect).length;
  if (correctCount !== 1) {
    throw new Error("Pick exactly one correct answer.");
  }
  if (parsed.ageMin > parsed.ageMax) {
    throw new Error("Min age must be less than or equal to max age.");
  }
  const row = await addLibraryQuestion({
    prompt: parsed.prompt,
    options: parsed.options,
    subject: parsed.subject,
    ageMin: parsed.ageMin,
    ageMax: parsed.ageMax,
    difficulty: parsed.difficulty,
    createdByUserId: user.id,
  });
  revalidatePath("/host");
  return row;
}

export async function deleteLibraryAction(id: string) {
  await requireHost();
  await deleteLibraryQuestion(id);
  revalidatePath("/host");
}
