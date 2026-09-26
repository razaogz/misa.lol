/**
 * Pointer tilt eased on a rAF loop.
 *
 * Pointer samples only move a target, the loop eases the card toward it. Reading
 * raw pointer coordinates straight into `style.transform` steps once per mouse
 * event, which is what makes a tilt feel jumpy; easing here is frame-rate
 * independent, so the lean is identical on 60Hz and 144Hz displays.
 */
export interface TiltOptions {
  /** Peak rotateY in degrees at the horizontal edge of the card. */
  maxX: number;
  /** Peak rotateX in degrees at the vertical edge of the card. */
  maxY: number;
  /** Bakes a perspective into the transform instead of relying on a parent. */
  perspective?: number;
  /** Time constant in ms. Larger is lazier. */
  tau?: number;
}

const DEFAULT_TAU = 90;
const MAX_FRAME_MS = 64;
const REST_X = 0.005;
const REST_Y = 0.005;

export function createTilt({ maxX, maxY, perspective, tau = DEFAULT_TAU }: TiltOptions) {
  let node: HTMLElement | null = null;
  let frame = 0;
  let last = 0;
  let targetX = 0;
  let targetY = 0;
  let valueX = 0;
  let valueY = 0;

  const paint = (now: number) => {
    const dt = last ? Math.min(MAX_FRAME_MS, now - last) : 16;
    last = now;
    const step = 1 - Math.exp(-dt / tau);
    valueX += (targetX - valueX) * step;
    valueY += (targetY - valueY) * step;
    // Snap before painting so the last frame lands exactly on the target instead of
    // resting a fraction of a degree short of flat.
    const settled = Math.abs(targetX - valueX) < REST_X && Math.abs(targetY - valueY) < REST_Y;
    if (settled) {
      valueX = targetX;
      valueY = targetY;
    }
    const x = valueX.toFixed(3);
    const y = (-valueY).toFixed(3);
    if (node) node.style.transform = perspective
      ? `perspective(${perspective}px) rotateX(${y}deg) rotateY(${x}deg)`
      : `rotateX(${y}deg) rotateY(${x}deg)`;
    if (settled) {
      frame = 0;
      last = 0;
      return;
    }
    frame = requestAnimationFrame(paint);
  };

  const schedule = () => {
    if (frame) return;
    last = 0;
    frame = requestAnimationFrame(paint);
  };

  return {
    attach(element: HTMLElement | null) {
      node = element;
    },
    /** Offsets are normalized to -0.5..0.5 from the element centre. */
    aim(x: number, y: number) {
      if (!node) return;
      targetX = x * maxX;
      targetY = y * maxY;
      schedule();
    },
    /** Eases back to flat instead of snapping off the tilt. */
    release() {
      targetX = 0;
      targetY = 0;
      schedule();
    },
    stop() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
      node = null;
    },
  };
}

export type TiltController = ReturnType<typeof createTilt>;

/** Normalizes a pointer position against an element's box to -0.5..0.5. */
export function tiltOffset(element: Element, clientX: number, clientY: number) {
  const box = element.getBoundingClientRect();
  if (!box.width || !box.height) return { x: 0, y: 0 };
  return { x: (clientX - box.left) / box.width - 0.5, y: (clientY - box.top) / box.height - 0.5 };
}
