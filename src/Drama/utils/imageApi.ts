// Dev: proxied via Vite to avoid CORS; Prod: Cloudflare Worker proxy (HTTPS)
const IMAGE_API = import.meta.env.DEV
  ? '/api/image/genl_image'
  : 'https://ai-drama-image-proxy.xinghuan-yin.workers.dev';

const COOLDOWN_MS = 75_000;

// Slot reservation: each request reserves the next available 75s slot
// JS is single-threaded so reserveSlot() is atomic
let nextSlot = 0; // epoch ms when the next request can fire

function reserveSlot(): number {
  const now = Date.now();
  const startAt = Math.max(now, nextSlot);
  nextSlot = startAt + COOLDOWN_MS;
  return Math.max(0, startAt - now); // ms to wait before firing
}

// Pub-sub for global cooldown display
type CooldownListener = (remaining: number) => void;
const cooldownListeners: CooldownListener[] = [];

export function subscribeCooldown(listener: CooldownListener): () => void {
  cooldownListeners.push(listener);
  return () => {
    const i = cooldownListeners.indexOf(listener);
    if (i >= 0) cooldownListeners.splice(i, 1);
  };
}

// Broadcast the time until the *first* available slot
function broadcastGlobalCooldown() {
  const left = Math.max(0, Math.ceil((nextSlot - COOLDOWN_MS - Date.now()) / 1000));
  cooldownListeners.forEach(l => l(left));
}

/**
 * Generate a scene image.
 * Slot is reserved synchronously on call — subsequent calls queue automatically.
 * @param onWaiting  called with remaining seconds while waiting for slot (fires every second)
 * @param onStart    called when HTTP request actually fires
 */
export function generateSceneImage(
  prompt: string,
  refUrl: string,
  onWaiting?: (remaining: number) => void,
  onStart?: () => void,
): Promise<string> {
  const waitMs = reserveSlot(); // reserve slot immediately (synchronous)
  broadcastGlobalCooldown();

  return (async () => {
    if (waitMs > 0) {
      let remaining = Math.ceil(waitMs / 1000);
      onWaiting?.(remaining);
      await new Promise<void>(resolve => {
        const interval = setInterval(() => {
          remaining--;
          const left = Math.max(0, remaining);
          onWaiting?.(left);
          broadcastGlobalCooldown();
          if (left <= 0) { clearInterval(interval); resolve(); }
        }, 1000);
      });
    }

    broadcastGlobalCooldown();
    onStart?.();

    const res = await fetch(IMAGE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: '',
        params: { url: refUrl, prompt, user_id: 618336286 },
      }),
      signal: AbortSignal.timeout(360_000),
    });

    if (!res.ok) throw new Error(`生图请求失败: ${res.status}`);
    const data = await res.json() as { code: number; url: string };
    if (data.code !== 200 || !data.url) throw new Error('生图失败，请重试');
    return data.url;
  })();
}
