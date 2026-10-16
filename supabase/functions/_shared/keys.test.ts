import { describe, expect, it } from "vitest";
import { EDGE_FUNCTIONS_KEY_NAME, pickNamedKey } from "./keys";

const dict = (o: Record<string, unknown>) => JSON.stringify(o);
const SOURCE = "SUPABASE_SECRET_KEYS.edge_functions";

describe("pickNamedKey", () => {
  it("selects the edge_functions key by name, whatever the dictionary order", () => {
    for (const raw of [
      dict({ default: "sb_secret_default", edge_functions: "sb_secret_edge" }),
      dict({ edge_functions: "sb_secret_edge", default: "sb_secret_default" }),
    ]) {
      expect(pickNamedKey(raw, EDGE_FUNCTIONS_KEY_NAME)).toEqual({ key: "sb_secret_edge", source: SOURCE });
    }
  });

  it("never falls back to another key (default, first entry or anything else)", () => {
    for (const raw of [dict({ default: "sb_secret_default" }), dict({ other: "sb_secret_other" })]) {
      expect(pickNamedKey(raw, EDGE_FUNCTIONS_KEY_NAME)).toEqual({ key: "", source: SOURCE });
    }
  });

  it("reports the key as missing when the dictionary is absent or malformed", () => {
    for (const raw of [undefined, "", "  ", "{not json", "sb_secret_bare", dict({ edge_functions: "" }), dict({ edge_functions: 42 })]) {
      expect(pickNamedKey(raw, EDGE_FUNCTIONS_KEY_NAME)).toEqual({ key: "", source: SOURCE });
    }
  });
});
