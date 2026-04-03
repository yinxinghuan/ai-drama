const API_URL = 'https://u545921-b746-8a491f44.westc.gpuhub.com:8443/video';

export async function generateVideo(
  prompt: string,
  imageUrl?: string,
  endImageUrl?: string,
): Promise<string> {
  const id = 'drama_' + Math.random().toString(36).slice(2, 10);
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: '',
      params: {
        prompt,
        env: 'test',
        id,
        image_url: imageUrl || '',
        end_image_url: endImageUrl || '',
      },
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) throw new Error(`视频生成请求失败: ${res.status}`);
  const data = await res.json() as { Flag: boolean; File: string };
  if (!data.Flag || !data.File) throw new Error('生成失败，请重试');
  return data.File;
}
