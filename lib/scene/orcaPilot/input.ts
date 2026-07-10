// HUNT-W2 Agent A - minimal, dependency-free WASD + mouse-look input sampler
// for the player-piloted orca. No `@react-three/drei` `KeyboardControls` /
// `PointerLockControls` import: this repo's convention (see
// web/lib/scene/camera/director.ts, web/lib/scene/tiles/useTilesLayer.ts) is a
// small hand-rolled class advanced per frame, not a UI-input library, so this
// sampler follows the same pattern.
//
// CLIENT-ONLY CONTRACT: this module reads/writes `window` and `document`
// directly inside `createOrcaPilotInputSampler` and intentionally has NO
// `typeof window === "undefined"` guard of its own. Per this repo's
// convention (see the `readParams()` guard in
// web/app/(sandbox)/orca/OrcaSandboxScene.tsx), that guard belongs to the
// calling "use client" component: only construct this sampler inside a
// `useEffect` (which never runs during SSR/build) or another call site that
// already guarantees a browser context.

/** Snapshot of player input for one simulation tick. All deltas are radians
 * accumulated since the previous `getInput()` read, then reset to zero. */
export interface OrcaPilotInput {
  /** Forward (W / ArrowUp) held. */
  forward: boolean;
  /** Back (S / ArrowDown) held. */
  back: boolean;
  /** Strafe/turn-assist left (A / ArrowLeft) held. */
  left: boolean;
  /** Strafe/turn-assist right (D / ArrowRight) held. */
  right: boolean;
  /** Throttle boost held (Shift). */
  boost: boolean;
  /** Horizontal look delta since last read, radians. + = turn right. */
  yawDelta: number;
  /** Vertical look delta since last read, radians. + = look up. */
  pitchDelta: number;
  /** Whether pointer lock is currently active (mouse-look enabled). */
  pointerLocked: boolean;
}

export interface OrcaPilotInputSampler {
  /** Read the accumulated input since the last call, then reset the deltas. */
  getInput(): OrcaPilotInput;
  /** Remove all listeners and exit pointer lock if currently locked. */
  dispose(): void;
}

/** Radians of look rotation per pixel of raw `movementX`/`movementY`. Typical
 * FPS-style mouse-look feel; tuned by eye, not derived from a spec. */
const MOUSE_SENSITIVITY = 0.0025;

const FORWARD_CODES = new Set(["KeyW", "ArrowUp"]);
const BACK_CODES = new Set(["KeyS", "ArrowDown"]);
const LEFT_CODES = new Set(["KeyA", "ArrowLeft"]);
const RIGHT_CODES = new Set(["KeyD", "ArrowRight"]);
const BOOST_CODES = new Set(["ShiftLeft", "ShiftRight"]);

/**
 * Construct a WASD + mouse-look sampler bound to `domElement` (typically the
 * r3f canvas `gl.domElement`). Registers a click-to-lock affordance on
 * `domElement` (pointer lock requires a user gesture, so it is never
 * auto-requested on mount) and tracks held keys + accumulated mouse deltas
 * while locked. `Escape` exits pointer lock via the browser default; this
 * sampler only reacts to the resulting `pointerlockchange` event, it adds no
 * special-case handling.
 */
export function createOrcaPilotInputSampler(domElement: HTMLElement): OrcaPilotInputSampler {
  let forward = false;
  let back = false;
  let left = false;
  let right = false;
  let boost = false;
  let pointerLocked = document.pointerLockElement === domElement;
  let accumYaw = 0;
  let accumPitch = 0;

  function onKeyDown(e: KeyboardEvent): void {
    if (FORWARD_CODES.has(e.code)) forward = true;
    else if (BACK_CODES.has(e.code)) back = true;
    else if (LEFT_CODES.has(e.code)) left = true;
    else if (RIGHT_CODES.has(e.code)) right = true;
    else if (BOOST_CODES.has(e.code)) boost = true;
  }

  function onKeyUp(e: KeyboardEvent): void {
    if (FORWARD_CODES.has(e.code)) forward = false;
    else if (BACK_CODES.has(e.code)) back = false;
    else if (LEFT_CODES.has(e.code)) left = false;
    else if (RIGHT_CODES.has(e.code)) right = false;
    else if (BOOST_CODES.has(e.code)) boost = false;
  }

  function onClick(): void {
    domElement.requestPointerLock();
  }

  function onMouseMove(e: MouseEvent): void {
    if (!pointerLocked) return;
    accumYaw += e.movementX * MOUSE_SENSITIVITY;
    // Screen movementY is positive downward; "+pitchDelta = look up" so a
    // downward mouse movement (positive movementY) must subtract.
    accumPitch += -e.movementY * MOUSE_SENSITIVITY;
  }

  function onPointerLockChange(): void {
    pointerLocked = document.pointerLockElement === domElement;
    if (!pointerLocked) {
      // Dropping lock (Escape, alt-tab, etc) should not leave a stale look
      // delta buffered for whenever the player re-locks.
      accumYaw = 0;
      accumPitch = 0;
    }
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  domElement.addEventListener("click", onClick);
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("pointerlockchange", onPointerLockChange);

  return {
    getInput(): OrcaPilotInput {
      const input: OrcaPilotInput = {
        forward,
        back,
        left,
        right,
        boost,
        yawDelta: accumYaw,
        pitchDelta: accumPitch,
        pointerLocked,
      };
      accumYaw = 0;
      accumPitch = 0;
      return input;
    },
    dispose(): void {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      domElement.removeEventListener("click", onClick);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      if (document.pointerLockElement === domElement) {
        document.exitPointerLock();
      }
    },
  };
}
