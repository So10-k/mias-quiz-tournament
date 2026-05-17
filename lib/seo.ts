// JSON-LD generators for the Quiz Book site.
//
// Each helper returns a fully-formed JSON-LD object you spread into a
// `<script type="application/ld+json" dangerouslySetInnerHTML={...} />`.
// Keep the structured output narrow and explicit so AI crawlers can
// extract canonical answers without guessing.
//
// Why no library: schema-dts is the formal type system, but our usage
// is small + we don't want to fight types when we want to add a
// non-standard property. Plain objects + JSON.stringify is fine.

import { AUTHOR_NAME, AUTHOR_AGE } from "@/lib/author";

export const SITE_URL =
  process.env.PUBLIC_BASE_URL ?? "https://quiz.miaswebsites.art";
export const ROOT_URL = "https://miaswebsites.art";
export const SITE_NAME = "Mia's Quiz Tournament";

// ─── core entities ─────────────────────────────────────────────────

export function organizationLD() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}#org`,
    name: SITE_NAME,
    url: SITE_URL,
    parentOrganization: {
      "@type": "Organization",
      "@id": `${ROOT_URL}#org`,
      name: "Mia's Websites",
      url: ROOT_URL,
    },
    logo: {
      "@type": "ImageObject",
      url: `${SITE_URL}/email-assets/sun.gif`,
    },
    sameAs: [ROOT_URL],
  };
}

export function websiteLD() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}#site`,
    url: SITE_URL,
    name: SITE_NAME,
    description:
      "A friends-and-family tournament quiz site. New questions every day, live finals, predictions bracket, and a blog.",
    publisher: { "@id": `${SITE_URL}#org` },
    inLanguage: "en-US",
  };
}

export function personLD() {
  // The in-app author. Mia is identified by name + age (no PII beyond
  // what's already on the homepage).
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${SITE_URL}#author`,
    name: AUTHOR_NAME,
    description: `${AUTHOR_NAME} is the in-app author of the Quiz Book — age ${AUTHOR_AGE}.`,
    url: SITE_URL,
  };
}

// ─── per-page generators ───────────────────────────────────────────

export function breadcrumbLD(
  items: { name: string; url: string }[]
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

export type ArticleLDInput = {
  title: string;
  slug: string;
  dek?: string | null;
  authorName: string;
  publishedAt?: Date | null;
  updatedAt?: Date | null;
  coverImageUrl?: string | null;
  bodyText: string;
  readMinutes: number;
};

export function articleLD(a: ArticleLDInput) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${SITE_URL}/blog/${a.slug}#article`,
    headline: a.title,
    description: a.dek ?? a.bodyText.slice(0, 200),
    author: {
      "@type": "Person",
      name: a.authorName,
    },
    datePublished: a.publishedAt?.toISOString(),
    dateModified: (a.updatedAt ?? a.publishedAt ?? new Date()).toISOString(),
    image: a.coverImageUrl ?? `${SITE_URL}/email-assets/sun.gif`,
    publisher: { "@id": `${SITE_URL}#org` },
    mainEntityOfPage: `${SITE_URL}/blog/${a.slug}`,
    inLanguage: "en-US",
    timeRequired: `PT${a.readMinutes}M`,
  };
}

export type FAQItem = { question: string; answer: string };
export function faqLD(items: FAQItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((q) => ({
      "@type": "Question",
      name: q.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: q.answer,
      },
    })),
  };
}

// Question-of-the-day specific. Uses Quiz/Question schema so AI
// crawlers can pull "today's question" as a stand-alone Q&A capsule.
export type QuizLDInput = {
  forDate: string;
  prompt: string;
  options: { value: string; label: string }[];
  context?: string | null;
};
export function quizLD(q: QuizLDInput) {
  return {
    "@context": "https://schema.org",
    "@type": "Quiz",
    "@id": `${SITE_URL}/qotd#${q.forDate}`,
    name: `Question of the Day · ${q.forDate}`,
    educationalLevel: "Beginner",
    learningResourceType: "Quiz",
    typicalAgeRange: "5-99",
    inLanguage: "en-US",
    assesses: q.prompt,
    about: q.context ?? "general knowledge",
    datePublished: q.forDate,
    hasPart: {
      "@type": "Question",
      name: q.prompt,
      suggestedAnswer: q.options.map((o) => ({
        "@type": "Answer",
        position: o.value.charCodeAt(0) - 64,
        name: o.label,
        text: o.label,
      })),
    },
    publisher: { "@id": `${SITE_URL}#org` },
  };
}

export type ChapterQuizLDInput = {
  chapterNumber: number;
  title: string;
  introProse?: string | null;
  questionCount: number;
  passThreshold: number;
};
// For tournament rounds — describes the round as an educational
// assessment with a pass threshold.
export function tournamentRoundQuizLD(r: ChapterQuizLDInput) {
  return {
    "@context": "https://schema.org",
    "@type": "Quiz",
    "@id": `${SITE_URL}/play/round/${r.chapterNumber}#quiz`,
    name: `Round ${r.chapterNumber} · ${r.title}`,
    description: r.introProse ?? `Round ${r.chapterNumber} of the Quiz Book.`,
    educationalLevel: "Beginner",
    learningResourceType: "Quiz",
    typicalAgeRange: "5-99",
    inLanguage: "en-US",
    numberOfItems: r.questionCount,
    assesses: r.title,
    educationalUse: "Assessment",
    passingScore: Math.round(r.passThreshold * 100) + "%",
    isAccessibleForFree: true,
    publisher: { "@id": `${SITE_URL}#org` },
  };
}

export type BlogLDInput = {
  articles: { title: string; slug: string; dek?: string | null }[];
};
export function blogLD({ articles }: BlogLDInput) {
  return {
    "@context": "https://schema.org",
    "@type": "Blog",
    "@id": `${SITE_URL}/blog#blog`,
    url: `${SITE_URL}/blog`,
    name: "The Quiz Book Blog",
    description:
      "Stories, recaps, and behind-the-scenes notes from Mia's Quiz Tournament.",
    inLanguage: "en-US",
    publisher: { "@id": `${SITE_URL}#org` },
    blogPost: articles.slice(0, 20).map((a) => ({
      "@type": "BlogPosting",
      headline: a.title,
      description: a.dek ?? "",
      url: `${SITE_URL}/blog/${a.slug}`,
    })),
  };
}

export function musicRecordingLD() {
  return {
    "@context": "https://schema.org",
    "@type": "MusicRecording",
    "@id": `${SITE_URL}/listen#track`,
    name: "The Quiz Book Theme",
    byArtist: {
      "@type": "Person",
      name: "Sam",
    },
    inAlbum: {
      "@type": "MusicAlbum",
      name: "Mia's Quiz Tournament — Original Score",
    },
    audio: {
      "@type": "AudioObject",
      contentUrl: `${SITE_URL}/audio/theme.mp3`,
      encodingFormat: "audio/mpeg",
    },
    publisher: { "@id": `${SITE_URL}#org` },
    inLanguage: "en-US",
  };
}

// ─── render helper ─────────────────────────────────────────────────

// Wraps a JSON-LD object into the script payload used in JSX:
//   <script type="application/ld+json" dangerouslySetInnerHTML={ld(obj)}/>
export function ld(obj: unknown): { __html: string } {
  // No HTML escaping on purpose — JSON inside <script type="application/ld+json">
  // is parsed as JSON, not HTML, so `<` and `&` are valid. We DO replace `</`
  // to defend against the rare "</script>" appearing in a string field
  // (which would otherwise close the script tag).
  return {
    __html: JSON.stringify(obj).replace(/<\/(script)/gi, "<\\/$1"),
  };
}
