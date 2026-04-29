import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AUTHOR_NAME } from "@/lib/author";
import { SunsetScene } from "@/components/SunsetScene";

export const dynamic = "force-dynamic";

export default async function Sunset() {
  // Authors get a one-shot bypass: bouncing through `?permissionlevel=granted`
  // sets the cookie via middleware, so they never see this page again.
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role === "author") {
    redirect("/?permissionlevel=granted");
  }

  return <SunsetScene authorName={AUTHOR_NAME} />;
}
