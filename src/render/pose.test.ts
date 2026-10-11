import { carBounce, poseForSteer, rivalSteer } from './pose';

describe('poseForSteer', () => {
  it('escolhe left, center e right pelo esterço', () => {
    expect(poseForSteer(-1)).toBe('left');
    expect(poseForSteer(-0.3)).toBe('left');
    expect(poseForSteer(-0.29)).toBe('center');
    expect(poseForSteer(0)).toBe('center');
    expect(poseForSteer(0.29)).toBe('center');
    expect(poseForSteer(0.3)).toBe('right');
    expect(poseForSteer(1)).toBe('right');
  });

  it('respeita um limiar customizado', () => {
    expect(poseForSteer(0.5, 0.6)).toBe('center');
    expect(poseForSteer(0.5, 0.4)).toBe('right');
  });
});

describe('rivalSteer', () => {
  it('segue o sinal da curva e do movimento lateral', () => {
    expect(poseForSteer(rivalSteer(5, 0))).toBe('right');
    expect(poseForSteer(rivalSteer(-5, 0))).toBe('left');
    expect(poseForSteer(rivalSteer(0, 0))).toBe('center');
    expect(poseForSteer(rivalSteer(0, -0.5))).toBe('left');
  });
});

describe('carBounce', () => {
  it('só quica na zebra ou na grama', () => {
    expect(carBounce(false, false, 1, 0.5)).toBe(0);
    expect(carBounce(true, false, 1, 0.04)).toBeGreaterThan(0);
    expect(carBounce(false, true, 1, 0.04)).toBeGreaterThan(0);
  });
});
