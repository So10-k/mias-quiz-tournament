import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Stage } from "@/components/Stage";
import { FileUploader } from "@/components/files/FileUploader";
import { FileRow } from "@/components/files/FileRow";
import { currentUser } from "@/lib/session";
import { listFiles } from "@/lib/files";
import { isR2Configured } from "@/lib/r2";

export const dynamic = "force-dynamic";

export default async function FilesPage() {
  const user = await currentUser();
  if (!user) redirect("/signin");
  if (user.role !== "author") redirect("/play");

  const configured = isR2Configured();
  const files = configured ? await listFiles() : [];

  // Build absolute origin so the row can show shareable links.
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const origin = `${proto}://${host}`;

  return (
    <Stage scrollable>
      <div className="max-w-4xl mx-auto pt-4 px-4 flex flex-col gap-5">
        <div className="card-sm px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
          <h1 className="font-display text-3xl md:text-4xl text-navy">
            📁 Files
          </h1>
          <Link href="/host" className="pop pop-white text-sm">
            ← Host panel
          </Link>
        </div>

        {!configured ? (
          <div className="card-sm bg-coral-deep text-white px-5 py-4">
            <p className="font-display text-lg">⚠️ R2 isn&rsquo;t configured.</p>
            <p className="font-body text-sm mt-1">
              Set <code>R2_ACCOUNT_ID</code>, <code>R2_ACCESS_KEY_ID</code>,
              <code> R2_SECRET_ACCESS_KEY</code>, <code>R2_BUCKET</code>, and
              <code> R2_ENDPOINT</code> in env vars, then redeploy.
            </p>
          </div>
        ) : (
          <>
            <section className="card px-5 py-5">
              <h2 className="font-display text-2xl text-navy">⬆ Upload</h2>
              <p className="font-body text-sm text-navy-soft mt-1">
                Files go straight to your R2 bucket{" "}
                <code className="font-display">miasthing</code>. New files
                default to <strong>Anyone signed in</strong> — change that in
                the row below after upload.
              </p>
              <div className="mt-3">
                <FileUploader />
              </div>
            </section>

            <section className="card px-5 py-5">
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <h2 className="font-display text-2xl text-navy">
                  📚 All files
                </h2>
                <span className="font-body text-sm text-navy-soft">
                  {files.length} item{files.length === 1 ? "" : "s"}
                </span>
              </div>
              {files.length === 0 ? (
                <p className="font-body text-base text-navy-soft mt-3">
                  No files yet. Upload one above and shareable links appear
                  here.
                </p>
              ) : (
                <ul className="mt-3 flex flex-col gap-3">
                  {files.map((f) => (
                    <FileRow
                      key={f.id}
                      id={f.id}
                      originalName={f.originalName}
                      mimeType={f.mimeType}
                      size={f.size}
                      accessMode={f.accessMode as any}
                      hasPassword={!!f.passwordHash}
                      allowedEmails={f.allowedEmails}
                      allowDownload={f.allowDownload}
                      note={f.note}
                      origin={origin}
                    />
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </Stage>
  );
}
