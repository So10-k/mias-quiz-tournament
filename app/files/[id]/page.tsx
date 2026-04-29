import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { Stage } from "@/components/Stage";
import { ImageViewer } from "@/components/files/ImageViewer";
import { PdfViewer } from "@/components/files/PdfViewer";
import { PasswordGate } from "@/components/files/PasswordGate";
import { MeetMiaPlayer } from "@/components/MeetMiaPlayer";
import {
  checkAccess,
  getFileById,
  presignAssetUrl,
  PASSWORD_COOKIE,
  viewerKind,
} from "@/lib/files";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function FileViewerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const file = await getFileById(id);
  if (!file) notFound();

  const user = await currentUser();
  const jar = await cookies();
  const passwordCookieOk =
    jar.get(PASSWORD_COOKIE(file.id))?.value === "ok";

  const access = await checkAccess(file, {
    userEmail: user?.email ?? null,
    userIsAuthor: user?.role === "author",
    passwordCookieOk,
  });

  if (!access.ok) {
    return (
      <Stage>
        <div className="max-w-2xl mx-auto pt-9 px-4">
          {access.reason === "login" ? (
            <div className="card px-7 py-7 text-center">
              <div className="text-5xl">🔐</div>
              <h2 className="font-display text-2xl text-navy mt-3">
                Sign in to view this file
              </h2>
              <p className="font-body text-base text-navy-soft mt-2">
                {file.note ? `"${file.note}"` : null}
              </p>
              <div className="mt-5">
                <Link href="/signin" className="pop pop-coral">
                  Sign in →
                </Link>
              </div>
            </div>
          ) : access.reason === "users" ? (
            <div className="card px-7 py-7 text-center">
              <div className="text-5xl">🚫</div>
              <h2 className="font-display text-2xl text-navy mt-3">
                Not for this account
              </h2>
              <p className="font-body text-base text-navy-soft mt-2">
                Mia restricted this file. Ask her to add your email if you
                think this is a mistake.
              </p>
            </div>
          ) : access.reason === "password" ? (
            <PasswordGate fileId={file.id} />
          ) : (
            <div className="card px-7 py-7 text-center">
              <div className="text-5xl">🤷</div>
              <h2 className="font-display text-2xl text-navy mt-3">
                Can&rsquo;t open this one.
              </h2>
            </div>
          )}
        </div>
      </Stage>
    );
  }

  // Authorised — generate a short-lived URL the viewer components can embed.
  const inlineUrl = await presignAssetUrl(file, { attachment: false });
  const downloadHref = `/r/${file.id}?download=1`;
  const kind = viewerKind(file.mimeType);

  return (
    <Stage scrollable>
      <div className="max-w-4xl mx-auto pt-4 px-4 flex flex-col gap-4">
        <div className="card-sm px-5 py-3 flex items-baseline justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl text-navy truncate">
              {file.originalName}
            </h1>
            {file.note ? (
              <p className="font-body text-sm text-navy-soft mt-1">
                {file.note}
              </p>
            ) : null}
          </div>
          <span className="font-display text-xs text-white bg-navy border-2 border-navy rounded-md px-2 py-0.5">
            {file.mimeType}
          </span>
        </div>

        {kind === "image" ? (
          <ImageViewer
            src={inlineUrl}
            name={file.originalName}
            allowDownload={file.allowDownload}
            downloadHref={downloadHref}
          />
        ) : kind === "pdf" ? (
          <PdfViewer
            src={inlineUrl}
            name={file.originalName}
            allowDownload={file.allowDownload}
            downloadHref={downloadHref}
          />
        ) : kind === "video" ? (
          <div className="card bg-cloud p-3">
            <MeetMiaPlayer src={inlineUrl} triggerLabel={`▶ Play "${file.originalName}"`} />
            {file.allowDownload ? (
              <div className="mt-3">
                <a href={downloadHref} className="pop pop-grass text-sm">
                  ⬇ Download
                </a>
              </div>
            ) : null}
          </div>
        ) : kind === "audio" ? (
          <div className="card bg-cloud p-5 flex flex-col items-center gap-3">
            <span className="text-5xl">🎵</span>
            <audio src={inlineUrl} controls className="w-full max-w-xl" />
            {file.allowDownload ? (
              <a href={downloadHref} className="pop pop-grass text-sm">
                ⬇ Download
              </a>
            ) : null}
          </div>
        ) : (
          <div className="card bg-cloud p-7 text-center flex flex-col items-center gap-3">
            <span className="text-5xl">📦</span>
            <p className="font-display text-lg text-navy">
              No preview for this kind of file.
            </p>
            <div className="flex gap-2">
              <a
                href={inlineUrl}
                target="_blank"
                rel="noreferrer"
                className="pop pop-white text-sm"
              >
                Open in new tab
              </a>
              {file.allowDownload ? (
                <a href={downloadHref} className="pop pop-grass text-sm">
                  ⬇ Download
                </a>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </Stage>
  );
}
