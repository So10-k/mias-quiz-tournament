// Card variant for blog entries that originated as Discourse topics
// in the public Announcements category. Visually distinct from the
// native ArticleCard so readers can see at a glance that following
// the link takes them to the forum, not a long-form article page.

import type { MirroredTopic } from "@/lib/forum-mirror";

export function MirrorCard({
  topic,
  size = "md",
}: {
  topic: MirroredTopic;
  size?: "sm" | "md" | "lg";
}) {
  const fontSize = size === "lg" ? "text-3xl md:text-4xl" : "text-2xl";
  return (
    <a
      href={topic.url}
      target="_blank"
      rel="noopener noreferrer"
      className="card relative px-5 py-5 flex flex-col gap-3 hover:-translate-y-0.5 transition-transform"
      style={{ textDecoration: "none" }}
    >
      <span
        aria-hidden
        className="absolute -top-2 -right-2 font-display text-[10px] uppercase tracking-[0.18em] px-2 py-0.5 rounded-full border-2 border-navy bg-sky1 text-navy shadow-pop-sm rotate-3"
      >
        💬 From the forum
      </span>

      <div
        className="w-full rounded-xl border-3 border-navy aspect-[3/2] flex flex-col items-center justify-center gap-2 px-4"
        style={{
          background:
            "linear-gradient(135deg,#B7E5FF 0%,#87CEEB 60%,#FFD93D 100%)",
        }}
      >
        <span className="text-5xl">💬</span>
        <p className="font-display text-xs uppercase tracking-[0.2em] text-navy">
          Announcement
        </p>
      </div>

      <div>
        <p className="font-display text-xs uppercase tracking-[0.18em] text-coral-deep">
          {new Date(topic.postedAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}{" "}
          · {topic.posts} {topic.posts === 1 ? "post" : "posts"}
        </p>
        <h2
          className={`font-display ${fontSize} text-navy mt-1 leading-tight`}
        >
          {topic.title}
        </h2>
        {topic.excerpt ? (
          <p className="font-body text-sm md:text-base text-navy-soft mt-2 line-clamp-3">
            {topic.excerpt}
          </p>
        ) : null}
        <p className="font-body text-xs text-navy-soft mt-2">
          {topic.authorUsername ? (
            <>
              By @{topic.authorUsername} · Open on the forum →
            </>
          ) : (
            <>Open on the forum →</>
          )}
        </p>
      </div>
    </a>
  );
}
