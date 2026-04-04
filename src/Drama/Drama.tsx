import { useState, useCallback } from 'react';
import type { Character, Shot, Phase, Work } from './types';
import { useAigram, enrichCharacter } from './hooks/useAigram';
import { generateSceneImage } from './utils/imageApi';
import { generateVideo, waitForVideoCooldown, markVideoCallStart } from './utils/videoApi';
import { saveWork } from './utils/works';
import SetupPage from './pages/SetupPage';
import ScriptPage from './pages/ScriptPage';
import GeneratingPage from './pages/GeneratingPage';
import TheaterPage from './pages/TheaterPage';
import WorksPage from './pages/WorksPage';
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
  const [prevPhase, setPrevPhase] = useState<Phase>('generating');
  const [character, setCharacter] = useState<Character | null>(null);
  const [shots, setShots] = useState<Shot[]>(INITIAL_SHOTS);

  const goTheater = (from: Phase) => { setPrevPhase(from); setPhase('theater'); };

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
      // Step 1: generate start frame if not pre-generated in script phase
      let startUrl = shot.startImageUrl;
      if (!startUrl) {
        updateShot(shot.id, { status: 'imaging' });
        startUrl = await generateSceneImage(prompt, char.head_url);
        updateShot(shot.id, { startImageUrl: startUrl });
      }

      // Step 2: wait for video cooldown (100s between calls)
      updateShot(shot.id, { status: 'waiting' });
      await waitForVideoCooldown(remaining => {
        updateShot(shot.id, { waitSeconds: remaining });
      });

      // Step 3: generate video
      // With endImageUrl: explicit start→end mode; without: prompt_group A→B→A auto mode
      markVideoCallStart();
      updateShot(shot.id, { status: 'generating' });
      const videoUrl = await generateVideo(prompt, startUrl, shot.endImageUrl);
      updateShot(shot.id, { status: 'done', videoUrl });
    } catch (err) {
      updateShot(shot.id, { status: 'error', error: err instanceof Error ? err.message : '生成失败' });
    }
  }, [updateShot]);

  const handleGenerate = useCallback(async (enrichedShots: Shot[]) => {
    if (!character) return;
    const activeShots = enrichedShots.filter(s => s.prompt.trim());

    setShots(enrichedShots.map(s => ({
      ...s, status: 'idle', videoUrl: undefined, error: undefined, waitSeconds: undefined,
    })));
    setPhase('generating');

    // Sequential: one shot at a time to respect API rate limits
    for (const shot of activeShots) {
      await generateShot(shot, character);
    }

    // Auto-save to works (cloud if logged in, localStorage if demo)
    setShots(prev => {
      const work: Work = { id: crypto.randomUUID(), createdAt: Date.now(), character, shots: prev };
      saveWork(aigram.me?.telegram_id, work);
      return prev;
    });
  }, [character, generateShot]);

  const handleRegenShot = useCallback(async (shotId: string) => {
    if (!character) return;
    const shot = shots.find(s => s.id === shotId);
    if (!shot) return;
    await generateShot(shot, character);
  }, [character, shots, generateShot]);

  const handleRestart = () => {
    setShots(prev => prev.map(s => ({
      ...s, status: 'idle' as const, videoUrl: undefined, error: undefined, waitSeconds: undefined,
    })));
    setPhase('script');
  };

  const handleLoadWork = useCallback((work: Work) => {
    setCharacter(work.character);
    setShots(work.shots);
    goTheater('works');
  }, []);

  const handleEditWork = useCallback((work: Work) => {
    setCharacter(work.character);
    setShots(work.shots.map(s => ({
      ...s, status: 'idle' as const, videoUrl: undefined, error: undefined, waitSeconds: undefined,
    })));
    setPhase('script');
  }, []);

  return (
    <div className="ad-root">
      {phase === 'setup' && (
        <SetupPage aigram={aigram} onSelect={handleSelectCharacter} onOpenWorks={() => setPhase('works')} />
      )}
      {phase === 'works' && (
        <WorksPage
          uid={aigram.me?.telegram_id}
          onBack={() => setPhase('setup')}
          onPlay={handleLoadWork}
          onEdit={handleEditWork}
        />
      )}
      {phase === 'script' && character && (
        <ScriptPage
          character={character}
          shots={shots}
          onShotsChange={(updater) => setShots(updater)}
          onGenerate={handleGenerate}
          onBack={() => setPhase('setup')}
        />
      )}
      {phase === 'generating' && character && (
        <GeneratingPage
          shots={shots}
          onRegen={handleRegenShot}
          onPreview={() => goTheater('generating')}
          onBack={() => {
            setShots(prev => prev.map(s => ({
              ...s, status: 'idle' as const, videoUrl: undefined, error: undefined, waitSeconds: undefined,
            })));
            setPhase('script');
          }}
        />
      )}
      {phase === 'theater' && character && (
        <TheaterPage
          shots={shots}
          character={character}
          onBack={() => setPhase(prevPhase)}
          onRestart={handleRestart}
          onRegenShot={handleRegenShot}
        />
      )}
    </div>
  );
}
