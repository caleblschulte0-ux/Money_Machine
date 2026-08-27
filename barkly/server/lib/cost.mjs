/**
 * Token and cost accounting.
 *
 * Tokens are always exact — they come from the upstream response's usage
 * block. Dollars are only reported when the operator has configured a price
 * (BARKLY_PRICE_*_PER_MTOK); an invented price list that drifts out of date
 * is worse than an honest token count, so the default is null, not a guess.
 *
 * The ledger is a rolling per-UTC-day tally used for two things: the /admin
 * report, and the daily caps that stop a runaway loop costing real money.
 */

export function dayKey(ts) {
  return new Date(ts).toISOString().slice(0, 10);
}

export function usdFor(usage, pricing) {
  if (!pricing) return null;
  const inTok = (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0);
  const outTok = usage.output_tokens || 0;
  return (inTok / 1e6) * pricing.inputPerMTok + (outTok / 1e6) * pricing.outputPerMTok;
}

export function createLedger({ pricing = null, keepDays = 7, now = () => Date.now() } = {}) {
  const days = new Map(); // 'YYYY-MM-DD' -> { requests, inputTokens, outputTokens, usd, devices: Map }

  const dayFor = (ts) => {
    const key = dayKey(ts);
    let d = days.get(key);
    if (!d) {
      d = { requests: 0, inputTokens: 0, outputTokens: 0, usd: 0, devices: new Map() };
      days.set(key, d);
      // Keep the map bounded without a cron.
      if (days.size > keepDays) {
        const oldest = [...days.keys()].sort()[0];
        days.delete(oldest);
      }
    }
    return d;
  };

  return {
    record(deviceId, usage) {
      const d = dayFor(now());
      const input = (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0);
      const output = usage.output_tokens || 0;
      d.requests += 1;
      d.inputTokens += input;
      d.outputTokens += output;
      const usd = usdFor(usage, pricing);
      if (usd !== null) d.usd += usd;
      d.devices.set(deviceId, (d.devices.get(deviceId) || 0) + input + output);
      return { input, output, usd };
    },

    today() {
      const d = dayFor(now());
      return {
        date: dayKey(now()),
        requests: d.requests,
        inputTokens: d.inputTokens,
        outputTokens: d.outputTokens,
        totalTokens: d.inputTokens + d.outputTokens,
        usd: pricing ? Number(d.usd.toFixed(4)) : null,
        devices: d.devices.size,
      };
    },

    deviceTokensToday(deviceId) {
      return dayFor(now()).devices.get(deviceId) || 0;
    },

    /** Which cap (if any) this request would blow through. */
    overCap(deviceId, { dailyTokenCap, dailyUsdCap, perDeviceDailyTokenCap }) {
      const t = this.today();
      if (dailyTokenCap && t.totalTokens >= dailyTokenCap) return 'daily_token_cap';
      if (dailyUsdCap !== null && dailyUsdCap !== undefined && t.usd !== null && t.usd >= dailyUsdCap) {
        return 'daily_usd_cap';
      }
      if (perDeviceDailyTokenCap && this.deviceTokensToday(deviceId) >= perDeviceDailyTokenCap) {
        return 'device_daily_token_cap';
      }
      return null;
    },

    report() {
      return [...days.entries()]
        .sort((a, b) => (a[0] < b[0] ? 1 : -1))
        .map(([date, d]) => ({
          date,
          requests: d.requests,
          inputTokens: d.inputTokens,
          outputTokens: d.outputTokens,
          usd: pricing ? Number(d.usd.toFixed(4)) : null,
          devices: d.devices.size,
        }));
    },
  };
}
