import { buildInterlagos, placeBrakeBoards } from '../track/interlagos';
import type { InputState } from './input';
import { GRID_SIZE, PLAYER_GRID_SLOT, Race } from './race';

const inp = (o: Partial<InputState>): InputState => ({ left: false, right: false, up: false, down: false, space: false, startPressed: false, mutePressed: false, muted: false, brakeHint: true, ...o });

const track = buildInterlagos();

function startRace(laps: number): Race {
  const r = new Race(track, laps);
  r.update(1 / 60, inp({ startPressed: true }));
  for (let i = 0; i < 60 * 8 && r.state.phase !== 'racing'; i++) r.update(1 / 60, inp({}));
  return r;
}

describe('corrida', () => {
  it('grid de 10 carros com o jogador em 8º', () => {
    const r = new Race(track);
    expect(r.rivals).toHaveLength(GRID_SIZE - 1);
    expect(PLAYER_GRID_SLOT).toBe(7);
    expect(r.position).toBe(8);
    const zs = r.rivals.map((c) => c.car.z).concat(r.state.player.z);
    expect(new Set(zs).size).toBe(GRID_SIZE);
  });

  it('IA: 3 voltas sem sair da pista nem sobrepor carros', () => {
    const r = startRace(3);
    expect(r.state.phase).toBe('racing');
    let minDx = Infinity;
    let maxAbsX = 0;
    let firstLap = 0;
    // o jogador fica parado (freando): só os rivais correm
    for (let i = 0; i < 60 * 270; i++) {
      r.update(1 / 60, inp({ down: true }));
      if (firstLap === 0 && r.rivals.some((c) => c.car.lap >= 2)) firstLap = i / 60;
      for (const c of r.rivals) maxAbsX = Math.max(maxAbsX, Math.abs(c.car.x));
      for (let a = 0; a < r.rivals.length; a++) {
        for (let b = a + 1; b < r.rivals.length; b++) {
          const A = r.rivals[a].car;
          const B = r.rivals[b].car;
          if (A.lap === B.lap && Math.abs(A.z - B.z) < 30) minDx = Math.min(minDx, Math.abs(A.x - B.x));
        }
      }
    }
    expect(maxAbsX).toBeLessThan(1);
    expect(minDx).toBeGreaterThan(0.1);
    // o líder fecha a primeira volta (com largada parada) em ~1:20 a 1:35
    expect(firstLap).toBeGreaterThan(75);
    expect(firstLap).toBeLessThan(95);
    expect(Math.max(...r.rivals.map((c) => c.car.lap))).toBeGreaterThanOrEqual(3);
  });

  it('o jogador completa 3 voltas acelerando e termina', () => {
    const r = startRace(3);
    for (let i = 0; i < 60 * 1500 && r.state.phase !== 'finished'; i++) r.update(1 / 60, inp({ up: true }));
    expect(r.state.phase).toBe('finished');
    expect(r.state.lapTimes).toHaveLength(3);
  });
});

describe('placas de frenagem', () => {
  it('300/200/100 m antes da curva 1, do lado de fora (direita)', () => {
    const boards = track.segments.flatMap((s) => s.props.filter((p) => p.kind.startsWith('brake')).map((p) => ({ m: s.meters ?? 0, ...p })));
    expect(boards.length).toBeGreaterThanOrEqual(6);
    const t1 = boards.filter((b) => b.m > 4000 || b.m < 300);
    expect(t1.map((b) => b.kind).sort()).toEqual(['brake100', 'brake200', 'brake300']);
    expect(t1.every((b) => b.offset > 1)).toBe(true);
  });

  it('só acrescenta o que conta', () => {
    const a = buildInterlagos();
    const before = a.segments.reduce((n, s) => n + s.props.length, 0);
    const added = placeBrakeBoards(a.segments, a.geo);
    const after = a.segments.reduce((n, s) => n + s.props.length, 0);
    expect(after - before).toBe(added);
  });
});
