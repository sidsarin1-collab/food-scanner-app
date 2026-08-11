import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./db";

const MODEL = "claude-sonnet-5";

const SYSTEM_PROMPT = `You are a food-safety research assistant for an ingredient-scanning app. You'll be given a single ingredient exactly as it appeared on a packaged food's label, which did not match anything in the app's existing chemical-safety database (~109 known food additives/chemicals of concern).

Decide whether this is actually a chemical additive worth flagging for health-conscious consumers (preservatives, artificial colors/sweeteners, emulsifiers, flavor enhancers, anti-caking agents, INS/E-numbers, etc.) -- as opposed to an ordinary whole-food ingredient (water, salt, sugar, flour, named fruits/vegetables/spices, milk, eggs, meat, common oils, etc.) which does NOT belong in a database like this.

If it's a plain ordinary ingredient with no real regulatory/health concern, call submit_suggestion with is_chemical_additive=false (other fields can be short placeholders).

If it IS a legitimate food-chemical/additive, use the web_search tool to verify its actual regulatory status -- don't guess, and don't rely on general impressions. Determine severity_tier using this exact rule, checking these 5 regions specifically: European Union (EU), United Kingdom (UK), Canada, Australia, Japan. US status does NOT count -- "still permitted in the US" never disqualifies a tier-3 result, since that's precisely the tier-3 scenario.

- severity_tier = 3 ("Ugly"): the substance is banned outright (prohibited from use in food) in the EU, UK, Canada, Australia, or Japan -- even if the US still permits it. Search for the specific regulation/action (e.g. an EU Commission Regulation revoking authorization, a national ban) before concluding this.
- severity_tier = 2 ("Badder"): not banned outright in any of those 5 regions, but restricted to specific food categories, capped at a maximum level, or requires a mandatory warning label in at least one of them.
- severity_tier = 1 ("Bad"): permitted (no ban, no special restriction/cap/warning-label) in all 5 regions, but still worth flagging for a separate reason unrelated to a regulatory ban -- e.g. processing-method concerns (like acrylamide formation), glycemic impact, or transparency/labeling-vagueness (like generic "natural flavor").

Do one or two targeted searches (e.g. "<substance> banned restricted EU UK Canada Australia Japan food additive") -- confirm the specific country and action before picking a tier. If after searching you genuinely can't find a clear regulatory status in any of the 5 regions, default to tier 1 and say so plainly in your reasoning rather than guessing at a higher tier.

Fields to submit:
- name: the canonical chemical/additive name suitable for a database entry (e.g. "Sodium Benzoate", not a raw abbreviation like "Sod. Benzoate").
- category: a short label, e.g. "Preservative", "Artificial Sweetener", "Artificial Color", "Emulsifier".
- health_effect: a 1-2 sentence plain-language summary a consumer would understand.
- reasoning: name the SPECIFIC country/region and the SPECIFIC regulatory action that justifies the tier (e.g. "EU Regulation (EU) 2022/63 revoked authorization of E171 as a food additive, effective Aug 2022" -- not just "banned in EU"), plus any sources used.

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
