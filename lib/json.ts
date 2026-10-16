/** Pull the JSON object out of a model reply, tolerating code fences or a sentence of preamble. */
export function extractJSON(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end <= start) throw new SyntaxError("No JSON object found in the reply.");
  return JSON.parse(body.slice(start, end + 1));
}
