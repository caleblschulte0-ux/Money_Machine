/**
 * Request validation — the proxy decides what may be asked, not the caller.
 *
 * The app ships its own EXPO_PUBLIC config, so anything the client can set is
 * something an attacker with the .ipa can also set. Model, output size,
 * conversation length and system-prompt size are therefore re-decided here
 * from the server's config, and the forwarded body is REBUILT from the fields
 * we recognise rather than passed through. A field we do not understand
 * cannot reach Anthropic on our key.
 */

export class ValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const ROLES = new Set(['user', 'assistant']);

function contentLength(content) {
  if (typeof content === 'string') return content.length;
  if (Array.isArray(content)) {
    let n = 0;
    for (const block of content) {
      if (block && typeof block === 'object' && typeof block.text === 'string') n += block.text.length;
    }
    return n;
  }
  return 0;
}

/**
 * @returns {{ body: object, model: string, estimatedInputChars: number }}
 */
export function validateMessagesRequest(raw, config) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ValidationError('body is not valid JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ValidationError('body must be a JSON object');
  }

  const model = typeof parsed.model === 'string' ? parsed.model : config.defaultModel;
  if (!config.allowedModels.includes(model)) {
    throw new ValidationError(`model "${model}" is not allowed by this deployment`, 400);
  }

  if (!Array.isArray(parsed.messages) || parsed.messages.length === 0) {
    throw new ValidationError('messages must be a non-empty array');
  }
  if (parsed.messages.length > config.maxMessages) {
    throw new ValidationError(`too many messages (max ${config.maxMessages})`, 413);
  }

  let chars = 0;
  const messages = parsed.messages.map((m, i) => {
    if (!m || typeof m !== 'object') throw new ValidationError(`messages[${i}] must be an object`);
    if (!ROLES.has(m.role)) throw new ValidationError(`messages[${i}].role must be user or assistant`);
    const len = contentLength(m.content);
    if (len === 0) throw new ValidationError(`messages[${i}].content is empty or unsupported`);
    chars += len;
    return { role: m.role, content: m.content };
  });

  let system;
  if (typeof parsed.system === 'string') {
    if (parsed.system.length > config.maxSystemChars) {
      throw new ValidationError(`system prompt too large (max ${config.maxSystemChars} chars)`, 413);
    }
    system = parsed.system;
    chars += parsed.system.length;
  } else if (parsed.system !== undefined) {
    throw new ValidationError('system must be a string');
  }

  const requested = Number(parsed.max_tokens);
  const maxTokens = Math.min(
    Number.isFinite(requested) && requested > 0 ? requested : config.maxOutputTokens,
    config.maxOutputTokens,
  );

  // Rebuilt, not forwarded: only these fields cross the boundary.
  const body = { model, max_tokens: maxTokens, messages };
  if (system !== undefined) body.system = system;
  if (parsed.temperature !== undefined) {
    const t = Number(parsed.temperature);
    if (Number.isFinite(t) && t >= 0 && t <= 1) body.temperature = t;
  }
  if (parsed.output_config && typeof parsed.output_config === 'object') {
    const effort = parsed.output_config.effort;
    if (['low', 'medium', 'high'].includes(effort)) body.output_config = { effort };
  }
  if (parsed.stop_sequences && Array.isArray(parsed.stop_sequences)) {
    const stops = parsed.stop_sequences.filter((s) => typeof s === 'string').slice(0, 4);
    if (stops.length) body.stop_sequences = stops;
  }

  return { body, model, estimatedInputChars: chars };
}
