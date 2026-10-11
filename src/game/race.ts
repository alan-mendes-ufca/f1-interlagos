import { SEGMENT_LENGTH, type RaceState, type Segment } from '../contracts';
import { createRival, RIVAL_DEFS, stepRival, type Rival } from './ai';
import type { InputState } from './input';
import { collideCars, collideProps, createDynamics, gearForSpeed, rpmFor, stepPlayer, type Controls, type Dynamics } from './physics';

export interface TrackData {
  segments: Segment[];
  length: number;
}

const LIGHT_HOLD_MIN = 0.7;
const LIGHT_HOLD_VAR = 1.0;

export class Race {
  state!: RaceState;
  dyn!: Dynamics;
  rivals!: Rival[];
  /** Luzes vermelhas acesas (0..5) durante a largada. */
  lights = 0;
  /** Posição atual do jogador (1..6). */
  position = 6;
  /** Tempo da volta em andamento. */
  lapTime = 0;
  /** Último steer aplicado (-1..1), para o volante. */
  steer = 0;
  /** Houve batida neste passo (para áudio futuro). */
  crashed = false;
  finishOrder: string[] = [];
  private lapStart = 0;
  private cdTime = 0;
  private hold = 1;
  private finishTime = new Map<CarStateKey, number>();

  constructor(readonly track: TrackData, readonly totalLaps = 3) {
    this.reset();
  }

  reset(): void {
    const L = this.track.length;
    const slot = (k: number) => ({ x: k % 2 === 0 ? -0.42 : 0.42, z: L - 400 - Math.floor(k / 2) * 700 - (k % 2) * 330 });
    this.rivals = RIVAL_DEFS.map((_, i) => {
      const s = slot(i);
      return createRival(i, s.z, s.x);
    });
    const ps = slot(5);
    this.state = {
      player: { z: ps.z, x: ps.x, speed: 0, lap: 0, sprite: -1, name: 'Você', finished: false },
      rivals: this.rivals.map((r) => r.car),
      totalLaps: this.totalLaps,
      time: 0,
      lapTimes: [],
      bestLap: null,
      phase: 'grid',
      sectionName: this.track.segments[0].sectionName,
      gear: 1,
      rpm: 0.38,
    };
    this.dyn = createDynamics();
    this.lights = 0;
    this.position = 6;
    this.lapTime = 0;
    this.lapStart = 0;
    this.cdTime = 0;
    this.finishTime.clear();
    this.finishOrder = [];
    this.steer = 0;
  }

  /** Passo fixo de simulação. */
  update(dt: number, input: InputState): void {
    const st = this.state;
    this.crashed = false;

    if (st.phase === 'grid') {
      if (input.startPressed) {
        st.phase = 'countdown';
        this.cdTime = 0;
        this.hold = LIGHT_HOLD_MIN + Math.random() * LIGHT_HOLD_VAR;
      }
    } else if (st.phase === 'countdown') {
      this.cdTime += dt;
      this.lights = Math.min(5, Math.floor(this.cdTime));
      if (this.cdTime >= 5 + this.hold) {
        st.phase = 'racing';
        this.lights = 0;
        st.time = 0;
      }
    } else if (st.phase === 'finished' && input.startPressed) {
      this.reset();
      return;
    }

    const racing = st.phase === 'racing';
    const finished = st.phase === 'finished';
    if (racing) st.time += dt;

    // jogador
    const p = st.player;
    const ctrl: Controls = {
      steer: (input.right ? 1 : 0) - (input.left ? 1 : 0),
      throttle: racing && input.up ? 1 : 0,
      brake: finished ? 0.35 : input.down ? 1 : 0,
      handbrake: input.space,
    };
    if (!racing && !finished) ctrl.brake = 1;
    if (finished) ctrl.steer = Math.max(-1, Math.min(1, -p.x));
    this.steer += (ctrl.steer - this.steer) * Math.min(1, dt * 10);
    const seg = this.segAt(p.z);
    stepPlayer(p, this.dyn, ctrl, dt, seg);
    if (collideProps(p, this.dyn, this.track.segments)) this.crashed = true;

    // rivais
    for (let i = 0; i < this.rivals.length; i++) {
      const r = this.rivals[i];
      const others = [p, ...this.rivals.filter((o) => o !== r).map((o) => o.car)];
      stepRival(r, others, this.track.segments, this.track.length, dt, racing || finished);
    }
    if (racing || finished) {
      for (const r of this.rivals) if (collideCars(p, r.car, this.track.length)) { this.dyn.crashTimer = Math.max(this.dyn.crashTimer, 0.5); this.crashed = true; }
      for (let i = 0; i < this.rivals.length; i++) for (let j = i + 1; j < this.rivals.length; j++) collideCars(this.rivals[i].car, this.rivals[j].car, this.track.length);
    }

    // voltas
    if (this.advanceLap(p)) this.onPlayerLap();
    for (const r of this.rivals) if (this.advanceLap(r.car)) this.checkFinish(r.car);

    if (racing) this.lapTime = st.time - this.lapStart;
    st.sectionName = this.segAt(p.z).sectionName;
    st.gear = gearForSpeed(p.speed);
    st.rpm = rpmFor(p.speed, st.gear);
    this.position = this.computePosition();
  }

  private segAt(z: number): Segment {
    const n = this.track.segments.length;
    return this.track.segments[Math.floor(z / SEGMENT_LENGTH) % n];
  }

  private advanceLap(c: { z: number; lap: number }): boolean {
    let crossed = false;
    while (c.z >= this.track.length) {
      c.z -= this.track.length;
      c.lap++;
      crossed = true;
    }
    return crossed;
  }

  private onPlayerLap(): void {
    const st = this.state;
    const p = st.player;
    if (st.phase !== 'racing') return;
    if (p.lap > 1) {
      const t = st.time - this.lapStart;
      st.lapTimes.push(t);
      st.bestLap = st.bestLap === null ? t : Math.min(st.bestLap, t);
    }
    this.lapStart = st.time;
    this.checkFinish(p);
  }

  private checkFinish(c: { lap: number; finished: boolean; name: string }): void {
    if (c.finished || c.lap <= this.totalLaps) return;
    c.finished = true;
    this.finishTime.set(c.name, this.state.time);
    this.finishOrder.push(c.name);
    if (c === (this.state.player as unknown)) this.state.phase = 'finished';
  }

  /** Progresso total em unidades de mundo. */
  progress(c: { z: number; lap: number }): number {
    return c.lap * this.track.length + c.z;
  }

  private computePosition(): number {
    const p = this.state.player;
    const rank = (c: { z: number; lap: number; finished: boolean; name: string }) =>
      c.finished ? 1e12 - this.finishOrder.indexOf(c.name) : this.progress(c);
    const mine = rank(p);
    return 1 + this.rivals.filter((r) => rank(r.car) > mine).length;
  }
}

type CarStateKey = string;
