import { useState, useEffect } from 'react';
import type { Character } from '../types';
import { fetchPublicUserByName } from '../utils/aigramPublicApi';

const DEMO_CONTACTS: Character[] = [
  { telegram_id: '1', name: 'Algram', head_url: '', avatar_describe: 'young man with stylish hair, casual outfit' },
  { telegram_id: '2', name: 'Jenny', head_url: '', avatar_describe: 'young woman with long hair, cheerful expression' },
  { telegram_id: '3', name: 'ghostpixel', head_url: '', avatar_describe: 'cool guy with headphones, urban streetwear style' },
  { telegram_id: '4', name: 'JM·F', head_url: '', avatar_describe: 'creative person with artistic style' },
  { telegram_id: '5', name: 'Isaya', head_url: '', avatar_describe: 'young woman with headphones on ears, anime style' },
];

function getUrlParams() {
  const p = new URLSearchParams(window.location.search);
  return { apiOrigin: p.get('api_origin'), telegramId: p.get('telegram_id') };
}

function postMessageCall(apiOrigin: string, url: string, timeoutMs = 8000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const payload = { url, method: 'GET', data: null, request_id: requestId, emitter: window.location.origin };
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));

    const timer = setTimeout(() => {
      window.removeEventListener('message', handler);
      reject(new Error('timeout'));
    }, timeoutMs);

    function handler(event: MessageEvent) {
      if (typeof event.data !== 'string' || !event.data.startsWith('callAPIResult-')) return;
      try {
        const result = JSON.parse(decodeURIComponent(escape(atob(event.data.slice('callAPIResult-'.length)))));
        if (result.request_id !== requestId) return;
        clearTimeout(timer);
        window.removeEventListener('message', handler);
        result.success ? resolve(result.data) : reject(new Error(result.error));
      } catch { /* not our message */ }
    }

    window.addEventListener('message', handler);
    window.parent.postMessage(`callAPI-${encoded}`, apiOrigin);
  });
}

interface RawUser {
  telegram_id: string | number;
  name?: string;
  head_url?: string;
  avatar_describe?: string | null;
}

function parseUser(raw: RawUser, fallbackName = ''): Character {
  return {
    telegram_id: String(raw.telegram_id),
    name: raw.name || fallbackName,
    head_url: raw.head_url || '',
    avatar_describe: raw.avatar_describe || undefined,
  };
}

async function fetchUserInfo(apiOrigin: string, telegramId: string): Promise<Character | null> {
  try {
    const res = await postMessageCall(
      apiOrigin,
      `/note/telegram/user/get/info/by/telegram_id?telegram_id=${telegramId}`,
      5000
    ) as { data?: RawUser } | RawUser | null;

    // Handle both { data: {...} } and direct object
    const raw = (res && 'data' in res && res.data && typeof res.data === 'object')
      ? res.data as RawUser
      : res as RawUser | null;

    if (!raw || !raw.telegram_id) return null;
    return parseUser(raw, '你');
  } catch {
    return null;
  }
}

/** Enrich a character with full AI profile via public API (by name, no token needed) */
export async function enrichCharacter(char: Character): Promise<Character> {
  if (char.avatar_describe && char.head_url && char.style) return char; // already complete
  const data = await fetchPublicUserByName(char.name);
  if (!data) return char;
  return {
    ...char,
    head_url: data.head_url || char.head_url,
    avatar_describe: data.avatar_describe || char.avatar_describe,
    style: data.style || char.style,
  };
}

export interface AigramState {
  me: Character | null;
  contacts: Character[];
  loading: boolean;
  isDemo: boolean;
  apiOrigin: string | null;
}

export function useAigram(): AigramState {
  const [me, setMe] = useState<Character | null>(null);
  const [contacts, setContacts] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  const { apiOrigin, telegramId } = getUrlParams();

  useEffect(() => {
    if (!apiOrigin || !telegramId) {
      setIsDemo(true);
      // Auto-enrich demo contacts via public API
      Promise.all(
        DEMO_CONTACTS.map(c => fetchPublicUserByName(c.name).then(d => d ? {
          ...c,
          head_url: d.head_url || c.head_url,
          avatar_describe: d.avatar_describe || c.avatar_describe,
          style: d.style,
        } : c))
      ).then(enriched => {
        setContacts(enriched);
        setLoading(false);
      });
      return;
    }

    async function load() {
      try {
        // Fetch self + contacts in parallel
        const [meUser, contactsRaw] = await Promise.all([
          fetchUserInfo(apiOrigin!, telegramId!),
          postMessageCall(apiOrigin!, `/note/telegram/user/contact/list?telegram_id=${telegramId}`, 10000),
        ]);

        setMe(meUser || { telegram_id: telegramId!, name: '你', head_url: '', avatar_describe: undefined });

        // Contacts: handle both array and { data: [...] }
        let rawList: RawUser[] = [];
        if (Array.isArray(contactsRaw)) {
          rawList = contactsRaw as RawUser[];
        } else if (contactsRaw && typeof contactsRaw === 'object' && 'data' in contactsRaw && Array.isArray((contactsRaw as { data: unknown }).data)) {
          rawList = (contactsRaw as { data: RawUser[] }).data;
        }

        const friends = rawList.slice(0, 8).map(u => parseUser(u));
        setContacts(friends.length > 0 ? friends : DEMO_CONTACTS);
        setIsDemo(friends.length === 0);
      } catch {
        setMe({ telegram_id: telegramId!, name: '你', head_url: '', avatar_describe: undefined });
        setContacts(DEMO_CONTACTS);
        setIsDemo(true);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [apiOrigin, telegramId]);

  return { me, contacts, loading, isDemo, apiOrigin };
}
