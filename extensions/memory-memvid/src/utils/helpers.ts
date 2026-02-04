// Helper to check if text should be captured
export const shouldCapture = (text: string): boolean => {
     if (!text || text.length < 10) return false;

     const triggers = [
          /\b(remember|zapamatuj|recall|save this|note that)\b/i,
          /\b(prefer|like|want|favorite)\b/i,
          /\b(decided|will use|going to)\b/i,
          /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/, // phone
          /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i, // email
     ];

     return triggers.some((pattern) => pattern.test(text));
};
