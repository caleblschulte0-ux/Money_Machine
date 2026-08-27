/**
 * Barkly's voice, server side.
 *
 * TWO ENGINES, and the default one costs nothing:
 *
 * - LOCAL (default). `tts/say.py` shells out to neural TTS that needs no
 *   account at all — edge-tts, with Kokoro and Gemini behind it. This is the
 *   same ladder Shorts-pipeline already runs in production, reused rather
 *   than reinvented, and it is why Barkly has a real voice today instead of
 *   the device's screen-reader.
 * - ELEVENLABS. A paid, higher-fidelity option for a designed voice later.
 *
 * Either way the app sends TEXT and gets AUDIO, and never names a voice —
 * WHICH voice is Barkly is a product decision held in server config, not a
 * field a modified client can swap for someone else's.
 *
 * ElevenLabs bills per CHARACTER, so the caps below exist for it. They apply
 * to the local engine too, which costs nothing, purely so a runaway loop
 * cannot pin a CPU forever.
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
  // Explicit choice wins; otherwise ElevenLabs only when it is fully
  // configured, and the free local engine the rest of the time.
  const requested = (env.BARKLY_VOICE_ENGINE || '').toLowerCase();
  const elevenReady = Boolean(apiKey && env.BARKLY_VOICE_ID);
  const engine = requested || (elevenReady ? 'elevenlabs' : 'local');
  return {
    engine,
    // The local engine needs nothing, so the voice is on by default.
    enabled: engine === 'local' ? true : elevenReady,
    /** Path to the synthesis helper and how long to let it run. */
    localBin: env.BARKLY_TTS_PYTHON || 'python3',
    localScript: env.BARKLY_TTS_SCRIPT || '',
    localVoice: env.BARKLY_TTS_VOICE || 'en-GB-RyanNeural',
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

/**
 * Run the local synthesis helper.
 *
 * The line goes in on STDIN, never in argv — it is a child's sentence, and
 * stdin has no quoting rules to get wrong. Audio comes back on stdout as
 * binary; the helper keeps every diagnostic on stderr so it cannot corrupt
 * the stream.
 *
 * @returns {Promise<{ ok: boolean, audio?: Buffer, error?: string }>}
 */
export function synthesizeLocal(text, voice, { spawnImpl, scriptPath } = {}) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawnImpl(voice.localBin, [scriptPath || voice.localScript], {
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, BARKLY_TTS_VOICE: voice.localVoice },
      });
    } catch (err) {
      return resolve({ ok: false, error: String(err?.message || err) });
    }

    const chunks = [];
    let err = '';
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        /* already gone */
      }
      finish({ ok: false, error: 'timeout' });
    }, voice.timeoutMs);

    child.stdout?.on('data', (c) => chunks.push(c));
    child.stderr?.on('data', (c) => {
      err += c;
    });
    child.on('error', (e) => finish({ ok: false, error: String(e?.message || e) }));
    child.on('close', (code) => {
      const audio = Buffer.concat(chunks);
      if (code !== 0 || audio.length === 0) {
        return finish({ ok: false, error: err.slice(0, 200) || `exit ${code}` });
      }
      finish({ ok: true, audio });
    });

    try {
      child.stdin.end(text);
    } catch (e) {
      finish({ ok: false, error: String(e?.message || e) });
    }
  });
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
