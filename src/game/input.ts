export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  space: boolean;
  /** Pulsos consumidos por consume(): true uma vez por pressionamento. */
  startPressed: boolean;
  mutePressed: boolean;
  muted: boolean;
  /** Aviso "FREIE!" ligado; a tecla B alterna. */
  brakeHint: boolean;
}

export class Input {
  readonly s: InputState = { left: false, right: false, up: false, down: false, space: false, startPressed: false, mutePressed: false, muted: false, brakeHint: true };

  constructor(target: Window = window) {
    target.addEventListener('keydown', (e) => this.set(e, true));
    target.addEventListener('keyup', (e) => this.set(e, false));
    target.addEventListener('blur', () => {
      this.s.left = this.s.right = this.s.up = this.s.down = this.s.space = false;
    });
  }

  private set(e: KeyboardEvent, down: boolean): void {
    const s = this.s;
    switch (e.code) {
      case 'ArrowLeft': case 'KeyA': s.left = down; break;
      case 'ArrowRight': case 'KeyD': s.right = down; break;
      case 'ArrowUp': case 'KeyW': s.up = down; break;
      case 'ArrowDown': case 'KeyS': s.down = down; break;
      case 'Space': s.space = down; break;
      case 'Enter': if (down && !e.repeat) s.startPressed = true; break;
      case 'KeyM': if (down && !e.repeat) { s.mutePressed = true; s.muted = !s.muted; } break;
      case 'KeyB': if (down && !e.repeat) s.brakeHint = !s.brakeHint; break;
      default: return;
    }
    e.preventDefault();
  }

  /** Limpa os pulsos depois de cada passo de simulação. */
  consume(): void {
    this.s.startPressed = false;
    this.s.mutePressed = false;
  }
}
