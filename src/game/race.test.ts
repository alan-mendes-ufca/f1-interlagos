import { buildTrack } from '../track/build';
import { sampleTrack } from '../track/sample';
import type { InputState } from './input';
import { Race } from './race';

const inp = (o: Partial<InputState>): InputState => ({ left: false, right: false, up: false, down: false, space: false, startPressed: false, mutePressed: false, muted: false, ...o });

describe('corrida', () => {
  it('vai de grid a finished com 3 voltas e jogador em 6º na largada', () => {
    const r = new Race(buildTrack(sampleTrack));
    expect(r.position).toBe(6);
    r.update(1 / 60, inp({ startPressed: true }));
    expect(r.state.phase).toBe('countdown');
    for (let i = 0; i < 60 * 8 && r.state.phase !== 'racing'; i++) r.update(1 / 60, inp({}));
    expect(r.state.phase).toBe('racing');
    for (let i = 0; i < 60 * 600 && r.state.phase !== 'finished'; i++) r.update(1 / 60, inp({ up: true }));
    expect(r.state.phase).toBe('finished');
    expect(r.state.lapTimes).toHaveLength(3);
  });
});
