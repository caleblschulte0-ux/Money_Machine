/**
 * Barkly's brain on a Claude SUBSCRIPTION instead of a metered API key.
 *
 * The operator asked for exactly this: "a Claude CLI, so that he could
 * actually respond with real responses." The headless `claude` CLI runs on
 * the subscription token, so a working Barkly costs nothing per message and
 * needs no ANTHROPIC_API_KEY at all — which is the difference between a demo
 * anyone can run and one that waits on billing setup.
 *
 * The important design choice: this speaks the ANTHROPIC MESSAGES SHAPE both
 * ways. It takes the same validated body the API path takes and returns the
 * same `{content:[{type:'text'}], usage:{...}}` envelope. So the app has no
 * idea which brain answered, the dialogue engine is unchanged, and switching
 * back to the API is one environment variable.
 *
 * SAFETY: the child's words end up in an argv slot, never a shell string.
 * `spawn` with an argument array and no shell means there is nothing to
 * escape and nothing to inject — a message containing backticks, `$(...)`, or
 * a newline is just text. Never rewrite this to use `exec` or a template
 * string.
 */

import { spawn } from 'node:child_process';

export function loadCliConfig(env = process.env) {
  const brain = (env.BARKLY_BRAIN || 'api').toLowerCase();
  return {
    enabled: brain === 'cli',
    bin: env.BARKLY_CLI_BIN || 'claude',
    // Barkly says three sentences. The small model is the right tool, and it
    // is several seconds faster than the big one, which a child notices.
    model: env.BARKLY_CLI_MODEL || 'haiku',
    timeoutMs: Number(env.BARKLY_CLI_TIMEOUT_MS || 25_000),
    cwd: env.BARKLY_CLI_CWD || '/tmp',
  };
}

/** Fold the conversation into one prompt, fenced so it reads as a transcript. */
export function buildCliPrompt(body) {
  const turns = Array.isArray(body.messages) ? body.messages : [];
  const latest = turns[turns.length - 1];
  const earlier = turns.slice(0, -1);

  const text = (m) => {
    if (typeof m?.content === 'string') return m.content;
    if (Array.isArray(m?.content)) {
      return m.content
        .filter((b) => b && typeof b.text === 'string')
        .map((b) => b.text)
        .join(' ');
    }
    return '';
  };

  const lines = [];
  if (earlier.length > 0) {
    lines.push('Recent conversation, oldest first:');
    for (const m of earlier) {
      lines.push(`${m.role === 'user' ? 'Your person' : 'You'}: ${text(m)}`);
    }
    lines.push('');
  }
  lines.push(`Your person just said: ${text(latest)}`);
  return lines.join('\n');
}

/**
 * Run one turn through the CLI.
 * @returns {{ status: number, text: string, attempts: number, retried: boolean }}
 *   in the same shape callUpstream returns, so the handler treats both alike.
 */
export function runCli(body, cfg, { spawnImpl = spawn } = {}) {
  return new Promise((resolve) => {
    const args = [
      '-p',
      '--model',
      cfg.model,
      // Replaces Claude Code's own system prompt outright: this process is
      // Barkly, not a coding agent that has been asked to act like a dog.
      '--system-prompt',
      typeof body.system === 'string' ? body.system : 'You are Barkly, a small opinionated dog.',
      buildCliPrompt(body),
    ];

    let child;
    try {
      child = spawnImpl(cfg.bin, args, {
        cwd: cfg.cwd,
        // No shell. The child's words are an argv entry, never a command.
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      return resolve(fail(502, 'cli_unavailable', String(err?.message || err)));
    }

    let out = '';
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
      finish(fail(504, 'cli_timeout', 'the brain took too long'));
    }, cfg.timeoutMs);

    child.stdout?.on('data', (c) => {
      out += c;
    });
    child.stderr?.on('data', (c) => {
      err += c;
    });
    child.on('error', (e) => finish(fail(502, 'cli_unavailable', String(e?.message || e))));

    child.on('close', (code) => {
      const body = out.trim();
      if (code !== 0 || !body) {
        return finish(fail(502, 'cli_failed', err.slice(0, 200) || `exit ${code}`));
      }
      finish({
        status: 200,
        text: JSON.stringify({
          type: 'message',
          role: 'assistant',
          model: `claude-cli:${cfg.model}`,
          content: [{ type: 'text', text: body }],
          // The CLI does not report token usage, and inventing a number that
          // feeds the budget ledger would be worse than reporting none.
          usage: { input_tokens: 0, output_tokens: 0 },
        }),
        attempts: 1,
        retried: false,
      });
    });
  });
}

function fail(status, type, message) {
  return {
    status,
    text: JSON.stringify({ type: 'error', error: { type, message } }),
    attempts: 1,
    retried: false,
  };
}
