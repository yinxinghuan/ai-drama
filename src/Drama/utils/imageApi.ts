// Dev: proxied via Vite to avoid CORS; Prod: Cloudflare Worker proxy (HTTPS)
const IMAGE_API = import.meta.env.DEV
  ? '/api/image/genl_image'
  : 'https://ai-drama-image-proxy.xinghuan-yin.workers.dev';

const SUGGEST_API = 'https://ai-drama-image-proxy.xinghuan-yin.workers.dev/suggest';
const END_FRAME_API = 'https://ai-drama-image-proxy.xinghuan-yin.workers.dev/end-frame';
const REHOST_API = 'https://ai-drama-image-proxy.xinghuan-yin.workers.dev/rehost';
const UPLOAD_API = 'https://ai-drama-image-proxy.xinghuan-yin.workers.dev/upload';
const ENHANCE_API = 'https://ai-drama-image-proxy.xinghuan-yin.workers.dev/enhance';

/**
 * Use GLM to rewrite a Chinese scene description into an optimized image prompt.
 * Falls back to the original text on any error.
 */
export async function enhancePrompt(prompt: string, imageUrl?: string): Promise<string> {
  try {
    const res = await fetch(ENHANCE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, imageUrl }),
      signal: AbortSignal.timeout(30_000),
    });
    const data = await res.json() as { prompt?: string };
    return data.prompt?.trim() || prompt;
  } catch {
    return prompt; // always fall back
  }
}

/**
 * Ask GLM to suggest the next shot based on previous shots.
 * Returns empty string on any error.
 */
export async function suggestNextShot(previousShots: string[]): Promise<string> {
  try {
    const res = await fetch(SUGGEST_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ previousShots }),
      signal: AbortSignal.timeout(30_000),
    });
    const data = await res.json() as { suggestion?: string };
    return data.suggestion?.trim() || '';
  } catch {
    return '';
  }
}

/**
 * Generate a differentiated end-frame prompt via GLM.
 * Returns an English image prompt describing how the scene looks at its END.
 */
export async function generateEndFramePrompt(scene: string, characterDesc?: string): Promise<string> {
  try {
    const res = await fetch(END_FRAME_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scene, character: characterDesc }),
      signal: AbortSignal.timeout(30_000),
    });
    const data = await res.json() as { prompt?: string };
    return data.prompt?.trim() || '';
  } catch {
    return '';
  }
}

export async function uploadImage(file: File): Promise<string> {
  const res = await fetch(UPLOAD_API, {
    method: 'POST',
    headers: { 'Content-Type': file.type || 'image/png' },
    body: file,
  });
  const data = await res.json() as { url?: string; error?: string };
  if (!data.url) throw new Error(data.error ?? 'upload failed');
  return data.url;
}

/** Rehost a temporary CDN URL to R2 so the video server can access it stably. */
export async function rehostImage(tempUrl: string): Promise<string> {
  if (import.meta.env.DEV) return tempUrl; // skip in dev
  const res = await fetch(REHOST_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: tempUrl }),
  });
  const data = await res.json() as { url?: string; error?: string };
  if (!data.url) throw new Error(data.error ?? 'rehost failed');
  return data.url;
}

const COOLDOWN_MS = 20_000;

// Serial queue for scheduling only — HTTP fetches run concurrently outside the queue.
// First call always fires immediately; subsequent calls wait only if within 20s of the last send.
let lastSendTime = 0;
let sendQueue: Promise<void> = Promise.resolve();

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

// After a request fires, keep broadcasting the countdown until it reaches 0.
// Without this, the global cooldownLeft gets set to 20 and never decrements
// because the queue's setInterval only runs while waiting for a slot.
let broadcastTimer: ReturnType<typeof setInterval> | null = null;

function startCooldownBroadcast() {
  if (broadcastTimer) clearInterval(broadcastTimer);
  broadcastTimer = setInterval(() => {
    const left = Math.max(0, Math.ceil((lastSendTime + COOLDOWN_MS - Date.now()) / 1000));
    cooldownListeners.forEach(l => l(left));
    if (left <= 0) {
      clearInterval(broadcastTimer!);
      broadcastTimer = null;
    }
  }, 1000);
}

/**
 * Generate a scene image.
 * Requests are queued and serialized for scheduling — only the wait phase is serial.
 * The HTTP fetch runs concurrently after the slot is claimed.
 * @param onWaiting    called with remaining seconds while waiting in queue
 * @param onStart      called when HTTP request fires
 * @param isCancelled  if returns true before the request fires, slot is released without penalty
 */
export function generateSceneImage(
  prompt: string,
  refUrl: string,
  onWaiting?: (remaining: number) => void,
  onStart?: () => void,
  isCancelled?: () => boolean,
  skipRehost?: boolean,
): Promise<string> {
  // Reserve a position in the send queue
  let resolveReady!: () => void;
  let rejectReady!: (e: Error) => void;
  const ready = new Promise<void>((res, rej) => { resolveReady = res; rejectReady = rej; });

  sendQueue = sendQueue.then(async () => {
    if (isCancelled?.()) { rejectReady(new Error('cancelled')); return; }

    const now = Date.now();
    const waitMs = lastSendTime === 0 ? 0 : Math.max(0, COOLDOWN_MS - (now - lastSendTime));

    if (waitMs > 0) {
      let remaining = Math.ceil(waitMs / 1000);
      onWaiting?.(remaining);
      // Global countdown is driven by startCooldownBroadcast — don't double-broadcast here
      await new Promise<void>(resolve => {
        const interval = setInterval(() => {
          if (isCancelled?.()) { clearInterval(interval); resolve(); return; }
          remaining--;
          const left = Math.max(0, remaining);
          onWaiting?.(left); // per-slot countdown only; global handled by startCooldownBroadcast
          if (left <= 0) { clearInterval(interval); resolve(); }
        }, 1000);
      });
    }

    // If cancelled during wait, release without marking lastSendTime
    if (isCancelled?.()) { rejectReady(new Error('cancelled')); return; }

    // Claim the slot and let the queue move on — HTTP fetch runs independently
    lastSendTime = Date.now();
    startCooldownBroadcast(); // sole driver of global cooldownLeft from here on
    onStart?.();
    resolveReady();
  });

  // HTTP fetch starts after slot is claimed, runs concurrently with next queued scheduling
  return ready.then(() =>
    fetch(IMAGE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: '',
        params: { url: refUrl, prompt, user_id: 618336286 },
      }),
      signal: AbortSignal.timeout(360_000),
    })
    .then(res => {
      if (!res.ok) throw new Error(`生图请求失败: ${res.status}`);
      return res.json() as Promise<{ code: number; url: string }>;
    })
    .then(data => {
      if (data.code !== 200 || !data.url) throw new Error('生图失败，请重试');
      return skipRehost ? data.url : rehostImage(data.url);
    })
  );
}
