/** True when the device is likely a phone/tablet pilot surface (coarse pointer
 * or touch). Used by /orca-strike to choose the mobile input path at mount
 * time rather than bolting touch on after the desktop pointer-lock flow. */
export function isMobilePilotDevice(): boolean {
  if (typeof window === "undefined") return false;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const touch = "ontouchstart" in window && navigator.maxTouchPoints > 0;
  return coarse || touch;
}
