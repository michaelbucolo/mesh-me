/** Only a direct command may dispatch a message. A quotation, question, or
 * description containing "message @name: ..." never has that authority. */
export function parseMeshiMessageIntent(query: string): { recipient: string; message: string } | null {
  const original = query.trim();
  const match = original.match(/^(?:send|message|dm)\s+@?([a-z0-9_]{3,30})\s*:\s*([^\r\n][\s\S]*)$/i)
    || original.match(/^(?:send|message|dm)\s+@?([a-z0-9_]{3,30})\s+that\s+([^\r\n][\s\S]*)$/i);
  if (!match || ["me", "my", "myself"].includes(match[1].toLowerCase())) return null;
  const message = match[2].trim();
  if (message.length < 3 || message.length > 2000) return null;
  return { recipient: match[1].toLowerCase(), message };
}
