const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Credentials injected via Cloudflare Worker Secrets (not stored in code)
const OSS_BUCKET  = 'aigram-jp';
const OSS_ENDPOINT = 'oss-ap-northeast-1.aliyuncs.com';
const CDN_HOST    = 'https://cdn.aiwaves.tech';

async function hmacSha1Base64(secret, msg) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function uploadToOSS(data, objKey, contentType, keyId, secret) {
  const date = new Date().toUTCString();
  const canonResource = `/${OSS_BUCKET}/${objKey}`;
  const stringToSign = `PUT\n\n${contentType}\n${date}\n${canonResource}`;
  const sig = await hmacSha1Base64(secret, stringToSign);
  const auth = `OSS ${keyId}:${sig}`;

  const res = await fetch(`https://${OSS_BUCKET}.${OSS_ENDPOINT}/${objKey}`, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'Date': date,
      'Authorization': auth,
      'Content-Length': String(data.byteLength),
    },
    body: data,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OSS upload failed: ${res.status} ${text}`);
  }
  return `${CDN_HOST}/${objKey}`;
}

async function readJsonFromOSS(objKey, keyId, secret) {
  const date = new Date().toUTCString();
  const canonResource = `/${OSS_BUCKET}/${objKey}`;
  const stringToSign = `GET\n\n\n${date}\n${canonResource}`;
  const sig = await hmacSha1Base64(secret, stringToSign);
  const auth = `OSS ${keyId}:${sig}`;

  const res = await fetch(`https://${OSS_BUCKET}.${OSS_ENDPOINT}/${objKey}`, {
    method: 'GET',
    headers: { 'Date': date, 'Authorization': auth },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`OSS read failed: ${res.status}`);
  return res.json();
}

async function writeJsonToOSS(objKey, value, keyId, secret) {
  const data = new TextEncoder().encode(JSON.stringify(value));
  await uploadToOSS(data, objKey, 'application/json', keyId, secret);
}

async function enhancePromptGLM(userPrompt, imageUrl, apiKey) {
  const contentParts = [
    {
      type: 'text',
      text: `你是专业的AI视频生成提示词专家。将以下中文场景描述优化为适合AI图片生成的英文提示词。要求：电影感构图、丰富细节、光影氛围，直接输出英文提示词，不要任何解释或标题。\n\n场景：${userPrompt}`,
    },
  ];
  if (imageUrl) {
    contentParts.push({ type: 'image_url', image_url: { url: imageUrl } });
  }

  const res = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'glm-4.1v-thinking-flash',
      stream: false,
      do_sample: true,
      temperature: 0.8,
      top_p: 0.6,
      messages: [{ role: 'user', content: contentParts }],
    }),
  });
  if (!res.ok) throw new Error(`GLM API error: ${res.status}`);
  const data = await res.json();
  let result = data.choices?.[0]?.message?.content ?? '';
  // Strip thinking tags if present
  if (result.includes('<|begin_of_box|>')) {
    result = result.split('<|begin_of_box|>').pop().split('<|end_of_box|>')[0];
  }
  return result.trim();
}

function jsonResp(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);

    // ── /enhance: optimize user prompt via GLM ───────────────────────────────
    if (url.pathname === '/enhance') {
      try {
        const { prompt, imageUrl } = await request.json();
        if (!prompt) return jsonResp({ error: 'prompt required' }, 400);
        const enhanced = await enhancePromptGLM(prompt, imageUrl || null, env.GLM_API_KEY);
        return jsonResp({ prompt: enhanced || prompt });
      } catch (e) {
        // Always return something usable — fall back to original prompt
        const body = await request.clone().json().catch(() => ({}));
        return jsonResp({ prompt: body.prompt ?? '' });
      }
    }

    // ── /works: cloud draft storage (D1) ─────────────────────────────────────
    if (url.pathname === '/works') {
      const uid = request.method === 'GET'
        ? url.searchParams.get('uid')
        : (await request.clone().json().catch(() => ({}))).uid;

      if (!uid || !/^\d+$/.test(String(uid))) {
        return jsonResp({ error: 'invalid uid' }, 400);
      }

      // GET /works?uid=xxx → list all works for user
      if (request.method === 'GET') {
        try {
          const { results } = await env.DB.prepare(
            'SELECT id, telegram_id, created_at, character, shots FROM works WHERE telegram_id = ? ORDER BY created_at DESC LIMIT 50'
          ).bind(uid).all();
          const works = results.map(r => ({
            id: r.id,
            telegram_id: r.telegram_id,
            createdAt: r.created_at,
            character: JSON.parse(r.character),
            shots: JSON.parse(r.shots),
          }));
          return jsonResp(works);
        } catch (e) {
          return jsonResp({ error: String(e) }, 500);
        }
      }

      // POST /works { uid, work } → upsert one work
      if (request.method === 'POST') {
        try {
          const { work } = await request.json();
          await env.DB.prepare(
            'INSERT INTO works (id, telegram_id, created_at, character, shots) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET shots = excluded.shots, character = excluded.character, created_at = excluded.created_at'
          ).bind(work.id, uid, work.createdAt, JSON.stringify(work.character), JSON.stringify(work.shots)).run();
          return jsonResp({ ok: true });
        } catch (e) {
          return jsonResp({ error: String(e) }, 500);
        }
      }

      // DELETE /works { uid, work_id } → delete one work (uid must match)
      if (request.method === 'DELETE') {
        try {
          const { work_id } = await request.json();
          await env.DB.prepare(
            'DELETE FROM works WHERE id = ? AND telegram_id = ?'
          ).bind(work_id, uid).run();
          return jsonResp({ ok: true });
        } catch (e) {
          return jsonResp({ error: String(e) }, 500);
        }
      }
    }

    // ── /upload: accept raw image body and upload to OSS ─────────────────────
    if (url.pathname === '/upload') {
      try {
        const contentType = request.headers.get('Content-Type') || 'image/png';
        const data = await request.arrayBuffer();
        const ext = contentType.includes('webp') ? 'webp' : contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' : 'png';
        const key = `prod/video/drama/upload_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const stableUrl = await uploadToOSS(data, key, contentType, env.OSS_KEY_ID, env.OSS_SECRET);
        return jsonResp({ url: stableUrl });
      } catch (e) {
        return jsonResp({ error: String(e) }, 500);
      }
    }

    // ── /rehost: fetch a temporary image URL and rehost it on OSS ────────────
    if (url.pathname === '/rehost') {
      try {
        const { url: srcUrl } = await request.json();
        const imgRes = await fetch(srcUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!imgRes.ok) throw new Error(`fetch source image failed: ${imgRes.status}`);
        const data = await imgRes.arrayBuffer();

        const now = new Date();
        const ts = now.toISOString().replace(/[-:T]/g, '').slice(0, 15);
        const rand = Math.random().toString(36).slice(2, 7);
        const ext = srcUrl.includes('.webp') ? 'webp' : 'png';
        const contentType = ext === 'webp' ? 'image/webp' : 'image/png';
        const objKey = `prod/video/drama/${ts}_${rand}_0.${ext}`;

        const stableUrl = await uploadToOSS(data, objKey, contentType, env.OSS_KEY_ID, env.OSS_SECRET);
        return jsonResp({ url: stableUrl });
      } catch (e) {
        return jsonResp({ error: String(e) }, 500);
      }
    }

    // ── /video: proxy to video generation API ────────────────────────────────
    if (url.pathname === '/video') {
      const body = await request.text();
      const res = await fetch('https://u545921-b746-8a491f44.westc.gpuhub.com:8443/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      const data = await res.text();
      return new Response(data, {
        status: res.status,
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    // ── Default: proxy to image generation API ───────────────────────────────
    const body = await request.text();
    const res = await fetch('http://aiservice.wdabuliu.com:8019/genl_image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    const data = await res.text();
    return new Response(data, {
      status: res.status,
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  },
};
