import Ajv from "ajv";
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const schema = JSON.parse(readFileSync("./src/schema/canonical-frame.schema.json", "utf-8"));
const ajv = new Ajv();
const validate = ajv.compile(schema);

describe("canonical frame schema", () => {
  it("validates example frame", () => {
    const example = {
      "frame.title": "User turn",
      "frame.content": "Hello world",
      "frame.search_text": "Hello world",
      "frame.uri": "mv2://session/1",
      "frame.source": "session-auto-capture",
      "frame.session_key": "sess-1",
      "frame.role": "user",
      "frame.timestamp": Date.now(),
      "frame.metadata": { src: "test" },
      "frame.summary": "Hello world",
      "frame.sensitivity": "public",
      "frame.retention": { tier: "hot" },
    };

    const ok = validate(example);
    if (!ok) console.log(validate.errors);
    expect(ok).toBe(true);
  });
});
