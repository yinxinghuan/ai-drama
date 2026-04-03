import { useState, useCallback } from 'react';
import type { Character, Shot, Phase } from './types';
import { useAigram, enrichCharacter } from './hooks/useAigram';
import { generateSceneImage } from './utils/imageApi';
import { generateVideo } from './utils/videoApi';
import SetupPage from './pages/SetupPage';
import ScriptPage from './pages/ScriptPage';
import GeneratingPage from './pages/GeneratingPage';
import TheaterPage from './pages/TheaterPage';
import './Drama.less';

function makeShot(prompt = ''): Shot {
  return { id: crypto.randomUUID(), prompt, status: 'idle' };
}

const INITIAL_SHOTS = [
  makeShot('开场，主角出现，镜头慢慢推进'),
  makeShot(''),
  makeShot(''),
];

function buildPrompt(userPrompt: string, character: Character): string {
  const parts: string[] = [];
  if (character.avatar_describe) parts.push(character.avatar_describe);
  if (character.style) parts.push(`${character.style} style`);
  parts.push('cinematic film');
  parts.push(userPrompt);
  return parts.join(', ');
}

export default function Drama() {
  const aigram = useAigram();
  const [phase, setPhase] = useState<Phase>('setup');
  const [character, setCharacter] = useState<Character | null>(null);
  const [shots, setShots] = useState<Shot[]>(INITIAL_SHOTS);

  const handleSelectCharacter = useCallback(async (char: Character) => {
    // Enrich via public API (by name, no token needed) — gets head_url, avatar_describe, style
    const enriched = await enrichCharacter(char);
    setCharacter(enriched);
    setPhase('script');
  }, []);

  const updateShot = useCallback((id: string, update: Partial<Shot>) => {
    setShots(prev => prev.map(s => s.id === id ? { ...s, ...update } : s));
  }, []);

  const generateShot = useCallback(async (shot: Shot, char: Character) => {
    const prompt = buildPrompt(shot.prompt, char);
    try {
      // Step 1: generate scene image (img2img with character as ref)
      updateShot(shot.id, { status: 'imaging' });
      const sceneImageUrl = await generateSceneImage(prompt, char.head_url);
      updateShot(shot.id, { sceneImageUrl });

      // Step 2: generate video from scene image using prompt_group (A→B→A, 10s)
      updateShot(shot.id, { status: 'generating' });
      const videoUrl = await generateVideo(prompt, sceneImageUrl);
      updateShot(shot.id, { status: 'done', videoUrl });
    } catch (err) {
      updateShot(shot.id, { status: 'error', error: err instanceof Error ? err.message : '生成失败' });
    }
  }, [updateShot]);

  const handleGenerate = useCallback(async () => {
    if (!character) return;
    const currentShots = shots.filter(s => s.prompt.trim());

    setShots(prev => prev.map(s => ({ ...s, status: 'idle', videoUrl: undefined, error: undefined })));
    setPhase('generating');

    await Promise.all(currentShots.map(shot => generateShot(shot, character)));

    setPhase('theater');
  }, [character, shots, generateShot]);

  const handleRegenShot = useCallback(async (shotId: string) => {
    if (!character) return;
    const shot = shots.find(s => s.id === shotId);
    if (!shot) return;
    await generateShot(shot, character);
  }, [character, shots, generateShot]);

  const handleRestart = () => {
    setShots(INITIAL_SHOTS.map(s => makeShot(s.prompt)));
    setCharacter(null);
    setPhase('setup');
  };

  return (
    <div className="ad-root">
      {phase === 'setup' && (
        <SetupPage aigram={aigram} onSelect={handleSelectCharacter} />
      )}
      {phase === 'script' && character && (
        <ScriptPage
          character={character}
          shots={shots}
          onShotsChange={setShots}
          onGenerate={handleGenerate}
          onBack={() => setPhase('setup')}
        />
      )}
      {phase === 'generating' && (
        <GeneratingPage shots={shots} totalCount={shots.filter(s => s.prompt.trim()).length} />
      )}
      {phase === 'theater' && character && (
        <TheaterPage
          shots={shots}
          character={character}
          onRestart={handleRestart}
          onRegenShot={handleRegenShot}
        />
      )}
    </div>
  );
}
