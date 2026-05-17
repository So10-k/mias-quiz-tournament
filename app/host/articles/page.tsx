// The CMS lives on the staff portal now. Anyone landing here from a
// stale bookmark gets redirected over.

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HostArticlesRedirect() {
  redirect("/staff/articles");
}
