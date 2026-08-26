/**
 * Anthropic (Claude) dialogue adapter, via the official @anthropic-ai/sdk.
 *
 * SECRETS: EXPO_PUBLIC_* vars are bundled into the app binary and are NOT
 * secret. Calling Anthropic directly from the device with an API key is a
 * DEVELOPMENT convenience only. For production, run a thin backend proxy that
 * holds the real key and point EXPO_PUBLIC_BARKLY_BACKEND_URL at it — this
 * adapter then talks to the proxy through the same SDK surface (baseURL) and
 * sends a placeholder key.
 */

import Anthropic from '@anthropic-ai/sdk';
import { DialogueProvider, DialogueRequest } from '../types';

export interface AnthropicDialogueConfig {
  apiKey?: string;
  /** Backend proxy URL for production; defaults to Anthropic's API for dev. */
  baseURL?: string;
  model?: string;
}

const DEFAULT_MODEL = 'claude-opus-5';

export function createAnthropicDialogue(config: AnthropicDialogueConfig): DialogueProvider {
  const { apiKey, baseURL } = config;
  const model = config.model || DEFAULT_MODEL;
  const available = Boolean(apiKey || baseURL);

  // Lazy so simply importing this module never constructs a client.
  let client: Anthropic | null = null;
  const getClient = () => {
    if (!client) {
      client = new Anthropic({
        apiKey: apiKey ?? 'backend-proxy',
        baseURL,
        // We are intentionally in a client-side runtime for dev; see header note.
        dangerouslyAllowBrowser: true,
      });
    }
    return client;
  };

  return {
    name: `anthropic:${model}`,
    isAvailable: () => available,

    async complete(req: DialogueRequest): Promise<string> {
      const messages: Anthropic.MessageParam[] = [
        ...req.turns.map((t): Anthropic.MessageParam => ({
          role: t.role === 'user' ? 'user' : 'assistant',
          content: t.text,
        })),
        { role: 'user', content: req.userText },
      ];

      const response = await getClient().messages.create({
        model,
        // Barkly speaks in 1-3 short sentences; the JSON envelope is small.
        max_tokens: 600,
        // Low effort keeps latency down for casual chat; thinking stays adaptive.
        output_config: { effort: 'low' },
        system: req.systemPrompt,
        messages,
      });

      let text = '';
      for (const block of response.content) {
        if (block.type === 'text') text += block.text;
      }
      return text;
    },
  };
}
