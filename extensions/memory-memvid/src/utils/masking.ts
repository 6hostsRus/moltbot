export function maskPII(text: string) {
  if (!text) return text;
  // naive masking: emails, phone numbers, credit-card-like numbers
  let out = text.replace(
    /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    (m, p1, p2) => `${p1[0]}***@${p2}`,
  );
  out = out.replace(/\b(\+?\d[\d\s().-]{7,}\d)\b/g, (m) => m.replace(/\d/g, "X"));
  out = out.replace(/\b(\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4})\b/g, (m) => "XXXX-XXXX-XXXX-XXXX");
  return out;
}

export function applyMaskToFrameContent(content: string) {
  return maskPII(content);
}

export default { maskPII, applyMaskToFrameContent };
