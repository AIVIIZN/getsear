import { describe, expect, it } from "vitest";
import {
  deferredHelpVideos,
  getContextualHelpTopics,
  getHelpTopicCount,
  searchHelpTopics,
} from "@/lib/help";

describe("V8.1 in-app help", () => {
  it("indexes at least 30 help topics for fuzzy search", () => {
    expect(getHelpTopicCount()).toBeGreaterThanOrEqual(30);
    expect(searchHelpTopics("payment declined")[0]?.title).toMatch(/declined|payment/i);
  });

  it("returns page-specific recommendations", () => {
    expect(getContextualHelpTopics("/kds")[0]?.category).toBe("kitchen-display");
    expect(getContextualHelpTopics("/menu")[0]?.category).toBe("menu-management");
    expect(getContextualHelpTopics("/orders")[0]?.category).toBe("taking-orders");
  });

  it("tracks the 12 screencasts as human-recording deferred", () => {
    expect(deferredHelpVideos).toHaveLength(12);
    expect(deferredHelpVideos.every((video) => video.status === "needs_human_recording")).toBe(true);
  });
});
