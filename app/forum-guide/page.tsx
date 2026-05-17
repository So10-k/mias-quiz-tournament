// /forum-guide — friendlier alias for /finals-guide. Same content,
// just a URL that doesn't say "finals" (since the guide is also
// useful for non-finalists going through the regular first-login
// terms PM).

import { redirect } from "next/navigation";

export default function ForumGuideAlias() {
  redirect("/finals-guide");
}
