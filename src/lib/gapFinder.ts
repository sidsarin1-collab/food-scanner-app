import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./db";

const MODEL = "claude-sonnet-5";

const SYSTEM_PROMPT = `You are a food-safety research assistant for an ingredient-scanning app. You'll be given a single ingredient exactly as it appeared on a packaged food's label, which did not match anything in the app's existing chemical-safety database (~109 known food additives/chemicals of concern).

Decide whether this is actually a chemical additive worth flagging for health-conscious consumers (preservatives, artificial colors/sweeteners, emulsifiers, flavor enhancers, anti-caking agents, INS/E-numbers, etc.) -- as opposed to an ordinary whole-food ingredient (water, salt, sugar, flour, named fruits/vegetables/spices, milk, eggs, meat, common oils, etc.) which does NOT belong in a database like this.

If it's a plain ordinary ingredient with no real regulatory/health concern, call submit_suggestion with is_chemical_additive=false (other fields can be short placeholders).

If it IS a legitimate food-chemical/additive:
- Use the web_search tool if it would help confirm real regulatory status (FDA, EFSA, bans/restrictions in other countries, IARC classification) -- you don't need to search for extremely well-known additives you're already confident about.
- name: the canonical chemical/additive name suitable for a database entry (e.g. "Sodium Benzoate", not a raw abbreviation like "Sod. Benzoate").
- severity_tier: 1 = Bad (mild/limited-evidence concern), 2 = Badder (moderate concern, restricted in some jurisdictions or more consistent research), 3 = Ugly (serious concern -- banned or under active restriction in major markets like the EU, classified as a carcinogen/endocrine disruptor, or similar). Reserve tier 3 for the clearest cases.
- category: a short label, e.g. "Preservative", "Artificial Sweetener", "Artificial Color", "Emulsifier".
- health_effect: a 1-2 sentence plain-language summary a consumer would understand.
- reasoning: brief internal notes on sources/evidence used.

Always end by calling submit_suggestion exactly once with your conclusion.`;

const SUBMIT_TOOL: Anthropic.Tool = {
  name: "submit_suggestion",
  description: "Submit your researched classification for this ingredient.",
  input_schema: {
    type: "object",
    properties: {
      is_chemical_additive: {
        type: "boolean",
        description: "False if this is an ordinary whole-food ingredient that doesn't belong in a chemical-safety database.",
      },
      name: {
        type: "string",
        description: "Canonical chemical/additive name for a database entry. Only required when is_chemical_additive is true.",
      },
      severity_tier: {
        type: "integer",
        enum: [1, 2, 3],
        description: "1=Bad, 2=Badder, 3=Ugly. Only required when is_chemical_additive is true.",
      },
      category: { type: "string", description: "Short category label." },
      health_effect: { type: "string", description: "1-2 sentence plain-language health concern summary." },
      reasoning: { type: "string", description: "Brief reasoning and sources used." },
    },
    required: ["is_chemical_additive", "reasoning"],
  },
};

const WEB_SEARCH_TOOL: Anthropic.WebSearchTool20250305 = {
  type: "web_search_20250305",
  name: "web_search",
  max_uses: 3,
};

type SubmitToolInput = {
  is_chemical_additive: boolean;
  name?: string;
  severity_tier?: number;
  category?: string;
  health_effect?: string;
  reasoning?: string;
};

export type GapFinderSuggestion = {
  name: string;
  severityTier: number;
  category: string | null;
  healthEffect: string | null;
  reasoning: string | null;
};

type ResearchResult =
  | { ok: true; skip: true }
  | { ok: true; skip: false; suggestion: GapFinderSuggestion }
  | { ok: false };

async function researchUnknownIngredient(ingredientText: string): Promise<ResearchResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false };

  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Ingredient as printed on a food label: "${ingredientText}"`,
        },
      ],
      tools: [WEB_SEARCH_TOOL, SUBMIT_TOOL],
    });

    const toolUse = message.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === "submit_suggestion"
    );
    if (!toolUse) return { ok: false };

    const input = toolUse.input as SubmitToolInput;
    if (!input.is_chemical_additive) return { ok: true, skip: true };

    const name = typeof input.name === "string" ? input.name.trim() : "";
    const severityTier = Number(input.severity_tier);
    if (!name || ![1, 2, 3].includes(severityTier)) return { ok: false };

    return {
      ok: true,
      skip: false,
      suggestion: {
        name,
        severityTier,
        category: typeof input.category === "string" && input.category.trim() ? input.category.trim() : null,
        healthEffect:
          typeof input.health_effect === "string" && input.health_effect.trim() ? input.health_effect.trim() : null,
        reasoning: typeof input.reasoning === "string" && input.reasoning.trim() ? input.reasoning.trim() : null,
      },
    };
  } catch (err) {
    console.error("Gap-finder research failed:", err);
    return { ok: false };
  }
}

/**
 * Researches an ingredient the scoring engine couldn't match and, if it looks
 * like a real chemical additive, queues a suggestion for admin review. Never
 * writes to the live `chemicals` table. Designed to run fire-and-forget in
 * the background -- callers should not await this on the request path.
 */
export async function suggestChemicalForIngredient(ingredientText: string): Promise<void> {
  const sourceText = ingredientText.trim();
  if (!sourceText) return;

  try {
    const alreadyPending = await prisma.suggestedChemical.findFirst({
      where: { sourceIngredientText: { equals: sourceText, mode: "insensitive" } },
      select: { id: true },
    });
    if (alreadyPending) return;

    const research = await researchUnknownIngredient(sourceText);
    if (!research.ok || research.skip) return;

    await prisma.suggestedChemical.create({
      data: {
        name: research.suggestion.name,
        proposedTier: research.suggestion.severityTier,
        proposedCategory: research.suggestion.category,
        proposedHealthEffect: research.suggestion.healthEffect,
        sourceIngredientText: sourceText,
        reasoning: research.suggestion.reasoning,
      },
    });
  } catch (err) {
    console.error(`Gap-finder failed for "${sourceText}":`, err);
  }
}
