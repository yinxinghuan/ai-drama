const BASE = 'http://api.wdabuliu.com';

interface PublicUserData {
  head_url?: string;
  avatar_describe?: string;
  style?: string;
  telegram_id?: string;
}

export async function fetchPublicUserByName(name: string): Promise<PublicUserData | null> {
  try {
    const res = await fetch(`${BASE}/note/telegram/user/get/one/by/name?name=${encodeURIComponent(name)}`);
    if (!res.ok) return null;
    const json = await res.json() as { retcode: number; data?: PublicUserData };
    if (json.retcode !== 0 || !json.data) return null;
    return json.data;
  } catch {
    return null;
  }
}
