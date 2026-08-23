/**
 * One place that builds an MCP tool response, so the wire format is a decision
 * rather than an accident.
 *
 * ── WHAT THIS FIXES ────────────────────────────────────────────────────
 *
 * All four tools independently wrote:
 *
 *     content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
 *     structuredContent: payload,
 *
 * which ships the same data twice, one copy indented with spaces for a machine
 * to read. Measured on a 25-row list_cities response:
 *
 *     pretty text        6,631 bytes
 *     structuredContent  4,980 bytes   <- the same rows again
 *     total             11,611 bytes per call
 *
 * Dropping the indentation alone removes 1,651 bytes a call, about 14%, for no
 * loss of information whatsoever. Over a million tool calls that is ~1.6 GB of
 * egress spent on whitespace.
 *
 * ── WHY THE DUPLICATE TEXT BLOCK IS KEPT AT ALL ────────────────────────
 *
 * Dropping `content` entirely would save 57% rather than 14%, and it is
 * tempting. It is not done here, because the two fields are not
 * interchangeable in practice:
 *
 *   * `structuredContent` is the machine-readable one, and a client that
 *     understands it needs nothing else.
 *   * `content` is what many clients actually RENDER. Several ignore
 *     structuredContent entirely, and for those, removing the text block makes
 *     every tool look like it returned nothing.
 *
 * Saving 43% more egress at the risk of the tools appearing empty in some
 * clients is a bad trade for a product with no users yet, and it is not a
 * decision to make from an inference. Test against a real client first; if the
 * clients you care about read structuredContent, switch `textMode` to "omit"
 * and take the rest of the saving.
 */

export type TextMode =
  /** Compact JSON in the text block. Same information, no indentation. */
  | "compact"
  /** No text block at all. Smallest, but invisible in some clients. */
  | "omit"
  /** Indented. Only for a human reading raw protocol traffic while debugging. */
  | "pretty";

/** Default for every tool. Conservative: keeps the text block, drops the padding. */
export const DEFAULT_TEXT_MODE: TextMode = "compact";

/**
 * `structuredContent` is an object, not `unknown`.
 *
 * The MCP SDK requires Record<string, unknown> here, and that is the right
 * constraint: a bare array or scalar as structuredContent gives a client
 * nothing to key on and no room to add fields later without a breaking change.
 * list_cities returns `{ count, cities }` rather than a bare array for exactly
 * that reason.
 */
export type McpPayload = Record<string, unknown>;

export type McpToolResponse = {
  content: { type: "text"; text: string }[];
  structuredContent: McpPayload;
};

/**
 * Build the response for a tool.
 *
 * `structuredContent` is always present and always the same object, so a
 * client that reads it is unaffected by `textMode`. That invariant is what
 * makes changing the mode safe, and it is asserted in the tests.
 */
export function toolResponse(
  payload: McpPayload,
  textMode: TextMode = DEFAULT_TEXT_MODE,
): McpToolResponse {
  const content =
    textMode === "omit"
      ? []
      : [
          {
            type: "text" as const,
            text:
              textMode === "pretty" ? JSON.stringify(payload, null, 2) : JSON.stringify(payload),
          },
        ];

  return { content, structuredContent: payload };
}

/** Bytes a response costs on the wire, for measuring rather than guessing. */
export function responseBytes(response: McpToolResponse): number {
  return JSON.stringify(response).length;
}
