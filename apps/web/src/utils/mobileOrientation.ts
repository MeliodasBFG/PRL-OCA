/**
 * Helpers for automatic mobile landscape orientation and fullscreen handling.
 * Safe no-op on desktop browsers and iOS Safari where orientation lock is unsupported.
 */

interface FullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

type OrientationLockable = ScreenOrientation & {
  lock?: (orientation: 'landscape' | 'landscape-primary' | 'portrait' | 'any') => Promise<void>;
};

export function isTouchPointerEvent(e: {
  pointerType?: unknown;
  nativeEvent?: unknown;
}): boolean {
  if (e.pointerType === 'touch') return true;
  const native = e.nativeEvent as { pointerType?: unknown } | undefined;
  return native?.pointerType === 'touch';
}

export function isMobileTouchDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const mobileUa = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
  const smallestSide = Math.min(window.innerWidth, window.innerHeight);
  return (coarsePointer || mobileUa) && smallestSide <= 950;
}

export function isPortraitViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerHeight > window.innerWidth;
}

let landscapeLockedByApp = false;

/**
 * Attempts to switch a mobile touch device into fullscreen landscape orientation.
 * Should be invoked inside user gesture handlers (click/submit) whenever entering the game.
 */
export async function enterGameLandscapeMode(): Promise<boolean> {
  if (!isMobileTouchDevice()) return false;

  try {
    const docEl = document.documentElement as FullscreenElement;
    if (!document.fullscreenElement) {
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen({ navigationUI: 'hide' }).catch(() => undefined);
      } else if (docEl.webkitRequestFullscreen) {
        await Promise.resolve(docEl.webkitRequestFullscreen());
      }
    }
  } catch {
    // Fullscreen blocked or unsupported (e.g. iOS Safari)
  }

  try {
    const orientation = window.screen?.orientation as OrientationLockable | undefined;
    if (orientation?.lock) {
      await orientation.lock('landscape');
      landscapeLockedByApp = true;
      return true;
    }
  } catch {
    // Ignore NotSupportedError / SecurityError on browsers without orientation lock
  }

  return false;
}

/**
 * Releases orientation lock / fullscreen cleanly when returning to the main menu.
 */
export async function exitGameLandscapeMode(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const orientation = window.screen?.orientation as OrientationLockable | undefined;
    if (landscapeLockedByApp && orientation?.unlock) {
      orientation.unlock();
    }
  } catch {
    // Ignore
  } finally {
    landscapeLockedByApp = false;
  }

  try {
    if (document.fullscreenElement && document.exitFullscreen) {
      await document.exitFullscreen().catch(() => undefined);
    }
  } catch {
    // Ignore
  }
}

export function getContrastTextColor(hexColor: string): '#0F172A' | '#FFFFFF' {
  const clean = hexColor.replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return '#FFFFFF';
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#0F172A' : '#FFFFFF';
}
