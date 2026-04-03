// Dev: proxied via Vite to avoid CORS
// Prod: Cloudflare Worker proxy (HTTPS)
const IMAGE_API = import.meta.env.DEV
  ? '/api/image/genl_image'
  : 'https://ai-drama-image-proxy.xinghuan-yin.workers.dev';

/** Generate a scene image using character head_url as reference (img2img) */
export async function generateSceneImage(
  prompt: string,
  refUrl: string,
): Promise<string> {
  const res = await fetch(IMAGE_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: '',
      params: {
        url: refUrl,
        prompt,
        user_id: 618336286,
      },
    }),
    signal: AbortSignal.timeout(360_000),
  });

  if (!res.ok) throw new Error(`生图请求失败: ${res.status}`);
  const data = await res.json() as { code: number; url: string };
  if (data.code !== 200 || !data.url) throw new Error('生图失败，请重试');
  return data.url;
}
