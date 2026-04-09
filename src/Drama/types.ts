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
  character?: Character;   // per-shot character override; falls back to shot[0] then default
  startImageUrl?: string;  // pre-generated start frame
  endImageUrl?: string;    // optional pre-generated end frame
  waitSeconds?: number;    // cooldown countdown before video generation
  taskId?: string;         // async video job ID — persisted so polling can resume after app close
  videoUrl?: string;
  error?: string;
}

export type Phase = 'home' | 'script' | 'generating' | 'theater' | 'works';

export type TemplateCategory = 'all' | 'city' | 'romance' | 'youth' | 'travel' | 'mood' | 'action' | 'mystery' | 'fantasy' | 'retro';

export interface DramaTemplate {
  id: string;
  label: string;
  category: TemplateCategory;
  shots: string[];
  preview?: string; // imported image URL
}

export interface Work {
  id: string;
  createdAt: number;
  character: Character; // primary character (from shot[0]), kept for backward compat
  shots: Shot[];
}
