/** Which help topics exist and how the help drawer and page group them. Pure data. */
import type { Messages } from "@/lib/i18n/messages";

export type HelpTopic = keyof Messages["help"]["topics"];
export type HelpSection = keyof Messages["help"]["sections"];

/** Topics per section, in the order the help drawer and the help page list them. Every topic appears once. */
export const HELP_SECTIONS: { id: HelpSection; topics: HelpTopic[] }[] = [
  { id: "studio", topics: ["productPhoto", "samples", "sampleFilter", "category", "photoType", "model", "modelFilter", "ownModel", "advanced", "quality", "seed", "review"] },
  { id: "results", topics: ["qualityChecks", "compare", "downloads", "share", "variation"] },
  { id: "post", topics: ["postFields", "postShop", "postCta", "template", "palette", "postSize", "caption", "tone", "postReview"] },
  { id: "research", topics: ["research", "researchPrices", "researchReview"] },
  { id: "library", topics: ["library", "librarySort", "libraryView"] },
  { id: "account", topics: ["quota", "language"] },
];

export const HELP_TOPICS: HelpTopic[] = HELP_SECTIONS.flatMap((s) => s.topics);
