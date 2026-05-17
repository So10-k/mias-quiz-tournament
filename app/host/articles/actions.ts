"use server";

// Article actions moved to the staff portal at /staff/articles. These
// stubs exist only so any in-flight Server Action references compile;
// they immediately bounce to the new home.

import { redirect } from "next/navigation";

export async function createArticleAction() {
  redirect("/staff/articles");
}
export async function saveArticleAction() {
  redirect("/staff/articles");
}
export async function deleteArticleAction() {
  redirect("/staff/articles");
}
