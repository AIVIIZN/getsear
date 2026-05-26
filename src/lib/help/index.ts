import Fuse from "fuse.js";
import {
  HELP_ARTICLES,
  HELP_CATEGORIES,
  type HelpArticle,
} from "@/app/(backoffice)/help/content";

export type HelpTopic = HelpArticle & {
  href: string;
  categoryName: string;
  keywords: string;
};

export type HelpVideo = {
  id: string;
  title: string;
  topicSlug: string;
  src: string | null;
  status: "needs_human_recording";
};

const categoryNameBySlug = new Map(
  HELP_CATEGORIES.map((category) => [category.slug, category.name]),
);

export const helpTopics: HelpTopic[] = HELP_ARTICLES.map((article) => ({
  ...article,
  href: `/help/${article.category}/${article.slug}`,
  categoryName: categoryNameBySlug.get(article.category) ?? "Help",
  keywords: `${article.title} ${article.summary} ${article.category} ${article.content}`,
}));

export const deferredHelpVideos: HelpVideo[] = [
  "First order",
  "Menu import",
  "Table service",
  "KDS bump and recall",
  "Payments and tips",
  "Splitting checks",
  "Staff clock-in",
  "Manager voids",
  "Reports export",
  "Printer setup",
  "Offline mode",
  "Campaign launch",
].map((title) => ({
  id: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
  title,
  topicSlug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
  src: null,
  status: "needs_human_recording",
}));

const fuse = new Fuse(helpTopics, {
  keys: [
    { name: "title", weight: 0.45 },
    { name: "summary", weight: 0.25 },
    { name: "categoryName", weight: 0.15 },
    { name: "content", weight: 0.15 },
  ],
  threshold: 0.36,
  ignoreLocation: true,
  minMatchCharLength: 2,
});

const pageTopicRules: Array<{ pattern: RegExp; category: string; fallbackSlug: string }> = [
  { pattern: /^\/orders|^\/checks|^\/tables|^\/payments/, category: "taking-orders", fallbackSlug: "first-order" },
  { pattern: /^\/kds/, category: "kitchen-display", fallbackSlug: "kds-basics" },
  { pattern: /^\/menu/, category: "menu-management", fallbackSlug: "add-menu-item" },
  { pattern: /^\/staff|^\/scheduling/, category: "staff-labor", fallbackSlug: "add-employee" },
  { pattern: /^\/reports/, category: "reports", fallbackSlug: "sales-report" },
  { pattern: /^\/settings\/(hardware|printers|terminals)/, category: "hardware", fallbackSlug: "receipt-printer" },
  { pattern: /^\/settings/, category: "getting-started", fallbackSlug: "setup-wizard" },
  { pattern: /^\/home|^\/backoffice|^\/onboarding/, category: "getting-started", fallbackSlug: "setup-wizard" },
  { pattern: /^\/marketing|^\/campaigns|^\/segments/, category: "reports", fallbackSlug: "sales-report" },
];

export function searchHelpTopics(query: string, limit = 8): HelpTopic[] {
  const normalized = query.trim();

  if (!normalized) {
    return helpTopics.slice(0, limit);
  }

  return fuse.search(normalized, { limit }).map((result) => result.item);
}

export function getContextualHelpTopics(pathname: string, limit = 4): HelpTopic[] {
  const rule = pageTopicRules.find((candidate) => candidate.pattern.test(pathname));
  if (!rule) {
    return helpTopics.filter((topic) => topic.category === "getting-started").slice(0, limit);
  }

  const categoryTopics = helpTopics.filter((topic) => topic.category === rule.category);
  const fallback = categoryTopics.find((topic) => topic.slug === rule.fallbackSlug);
  const ordered = fallback
    ? [fallback, ...categoryTopics.filter((topic) => topic.slug !== fallback.slug)]
    : categoryTopics;

  return ordered.slice(0, limit);
}

export function getHelpTopicCount() {
  return helpTopics.length;
}
