// TourSession: a running tour on one device. It owns the engine, connects the
// device's sources to it, plays narration through the AudioPort, re-evaluates
// on the Scheduler, and hands the Display a fresh ViewModel whenever anything
// changes. This is the whole runtime a port gets for free; a port supplies
// the adapters in ports.ts and nothing else.

import { TourEngine, type EngineEvent, type EngineOptions } from "./engine.ts";
import type {
  AudioPort,
  Clock,
  Display,
  HeadingSource,
  LocationReading,
  LocationSource,
  MotionSource,
  Scheduler,
  Unsubscribe,
} from "./ports.ts";
import type { Tour } from "./types.ts";
import { buildView, type ViewModel } from "./view.ts";

export interface SessionPorts {
  clock: Clock;
  scheduler: Scheduler;
  audio: AudioPort;
  display: Display;
}

export interface SessionSources {
  location: LocationSource;
  heading?: HeadingSource;
  motion?: MotionSource;
}

export interface SessionOptions extends Omit<EngineOptions, "onEvent"> {
  /** whether the display shows a route map (changes one line of guidance) */
  hasMap?: boolean;
  /** re-evaluation period, ms */
  tickMs?: number;
}

/** Observers get every engine event and every reading (recorders, analytics). */
export interface SessionObserver {
  event?(e: EngineEvent): void;
  location?(r: LocationReading): void;
  heading?(deg: number, t: number): void;
  motion?(a: number, t: number): void;
}

export class TourSession {
  readonly engine: TourEngine;
  private readonly ports: SessionPorts;
  private readonly opts: SessionOptions;
  private readonly observers: SessionObserver[] = [];
  private stops: Unsubscribe[] = [];
  private caption = "";

  constructor(tour: Tour, ports: SessionPorts, opts: SessionOptions = {}) {
    this.ports = ports;
    this.opts = opts;
    this.engine = new TourEngine(tour, { ...opts, onEvent: (e) => this.onEvent(e) });
  }

  get tour(): Tour {
    return this.engine.tour;
  }

  observe(o: SessionObserver): void {
    this.observers.push(o);
  }

  /** Start feeding the engine. Call from a user gesture (audio unlock, permissions). */
  async start(sources: SessionSources): Promise<void> {
    this.ports.audio.unlock?.();
    if (sources.heading?.request) {
      const err = await sources.heading.request();
      if (err) this.ports.display.notify?.(err);
    }
    this.stops.push(
      sources.location.start((r) => {
        for (const o of this.observers) o.location?.(r);
        this.engine.location(r);
        this.render();
      }),
    );
    if (sources.heading) {
      this.stops.push(
        sources.heading.start((h, t) => {
          for (const o of this.observers) o.heading?.(h, t);
          this.engine.heading(h, t);
          this.render();
        }),
      );
    }
    if (sources.motion) {
      this.stops.push(
        sources.motion.start((a, t) => {
          for (const o of this.observers) o.motion?.(a, t);
          this.engine.motion(a, t);
        }),
      );
    }
    this.stops.push(
      this.ports.scheduler.every(this.opts.tickMs ?? 250, () => {
        this.engine.tick(this.ports.clock.now());
        this.render();
      }),
    );
    this.render();
  }

  stop(): void {
    for (const s of this.stops) s();
    this.stops = [];
    this.ports.audio.stop();
  }

  // ------------------------------------------------------------ commands

  calibrate(): void {
    const ok = this.engine.calibrate(this.ports.clock.now());
    const s = this.engine.state.atStop;
    if (ok && s) this.ports.display.notify?.(`Compass set: you are facing ${s.facing.target_name}.`);
    this.render();
  }

  force(): void {
    this.engine.force(this.ports.clock.now());
    this.render();
  }

  skip(): void {
    this.ports.audio.stop();
    this.engine.skip(this.ports.clock.now());
    this.render();
  }

  view(): ViewModel {
    return buildView(this.engine, this.caption, { hasMap: this.opts.hasMap ?? true });
  }

  render(): void {
    this.ports.display.render(this.view());
  }

  // ------------------------------------------------------------ events

  private onEvent(e: EngineEvent): void {
    for (const o of this.observers) o.event?.(e);
    if (e.type === "narrate") {
      const stop = e.stop;
      this.ports.audio.play(
        stop.narration,
        (text) => {
          this.caption = text;
          this.render();
        },
        () => {
          this.caption = "";
          this.engine.narrationEnded(stop.id, this.ports.clock.now());
          this.render();
        },
      );
    }
    if (e.type === "stop-done") {
      this.ports.display.notify?.(
        e.next ? `Stop ${e.stop.order} done. Next: ${e.next.name}.` : "Tour complete. Thanks for walking it.",
      );
    }
  }
}
