export interface Character {
  telegram_id: string;
  name: string;
  head_url: string;
  avatar_describe?: string; // AI 角色外貌描述，用于 prompt 注入
  style?: string;           // 画风，如 "Ghibli"，用于 prompt 注入
}

export type ShotStatus = 'idle' | 'imaging' | 'waiting' | 'generating' | 'done' | 'error';

export interface Shot {
  id: string;
  prompt: string;
  status: ShotStatus;
  sceneImageUrl?: string; // intermediate generated scene image
  waitSeconds?: number;   // cooldown countdown before video generation
  videoUrl?: string;
  error?: string;
}

export type Phase = 'setup' | 'script' | 'generating' | 'theater';
