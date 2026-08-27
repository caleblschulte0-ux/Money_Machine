/**
 * Barkly's voice, server side.
 *
 * Same reasoning as the dialogue route: the ElevenLabs key is a real secret,
 * so it lives here and the app asks for audio by text. The app never sees a
 * voice id it can change either — WHICH voice is Barkly is a product decision
 * held in server config, not a field a modified client can swap for someone
 * else's cloned voice.
 *
 * Billing here is per CHARACTER, not per token, so it has its own caps. A
 * runaway loop reciting the dictionary is the failure mode to stop.
 */

import { ValidationError } from './validate.mjs';

/** Strip control characters without putting any in this file's source. */
function stripControlChars(s) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    out += c < 32 || (c >= 127 && c <= 159) ? ' ' : s[i];
  }
  return out;
}

export function loadVoiceConfig(env = process.env) {
  const apiKey = env.ELEVENLABS_API_KEY || '';
  return {
    enabled: Boolean(apiKey && env.BARKLY_VOICE_ID),
    apiKey,
    voiceId: env.BARKLY_VOICE_ID || '',
    modelId: env.BARKLY_VOICE_MODEL || 'eleven_turbo_v2_5',
    upstream: env.ELEVENLABS_BASE_URL || 'https://api.elevenlabs.io',
    outputFormat: env.BARKLY_VOICE_FORMAT || 'mp3_44100_128',
    // Voice settings are the character. Defaults lean lively and consistent;
    // tune them once against the real voice, then leave them alone.
    stability: Number(env.BARKLY_VOICE_STABILITY ?? 0.45),
    similarityBoost: Number(env.BARKLY_VOICE_SIMILARITY ?? 0.8),
    style: Number(env.BARKLY_VOICE_STYLE ?? 0.35),
    maxChars: Number(env.BARKLY_VOICE_MAX_CHARS || 400),
    dailyCharCap: Number(env.BARKLY_VOICE_DAILY_CHAR_CAP || 200_000),
    perDeviceDailyCharCap: Number(env.BARKLY_VOICE_DEVICE_DAILY_CHAR_CAP || 8_000),
    timeoutMs: Number(env.BARKLY_VOICE_TIMEOUT_MS || 15_000),
  };
}

/** Barkly says short sentences. Anything else is not Barkly. */
export function validateVoiceRequest(raw, voice) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ValidationError('body is not valid JSON');
  }
  const text = typeof parsed?.text === 'string' ? stripControlChars(parsed.text).trim() : '';
  if (!text) throw new ValidationError('text is required');
  if (text.length > voice.maxChars) {
    throw new ValidationError(`text too long (max ${voice.maxChars} chars)`, 413);
  }
  return { text };
}

export function voiceUrl(voice) {
  return `${voice.upstream}/v1/text-to-speech/${voice.voiceId}?output_format=${encodeURIComponent(
    voice.outputFormat,
  )}`;
}

export function voiceBody(text, voice) {
  return JSON.stringify({
    text,
    model_id: voice.modelId,
    voice_settings: {
      stability: voice.stability,
      similarity_boost: voice.similarityBoost,
      style: voice.style,
      use_speaker_boost: true,
    },
  });
}
