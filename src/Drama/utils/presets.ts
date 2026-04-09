import { t } from '../i18n';
import type { DramaTemplate, TemplateCategory } from '../types';

import prevCityHustle from '../img/templates/city_hustle.jpg';
import prevCityRomance from '../img/templates/city_romance.jpg';
import prevYouthConfession from '../img/templates/youth_confession.jpg';
import prevSoloJourney from '../img/templates/solo_journey.jpg';
import prevHeavyHeart from '../img/templates/heavy_heart.jpg';
import prevSpotlight from '../img/templates/spotlight.jpg';
import prevNoirAlley from '../img/templates/noir_alley.jpg';
import prevGhibliWind from '../img/templates/ghibli_wind.jpg';
import prevSilentFilm from '../img/templates/silent_film.jpg';
import prevMidnightDiner from '../img/templates/midnight_diner.jpg';
import prevLetterNeverSent from '../img/templates/letter_never_sent.jpg';
import prevLastTrain from '../img/templates/last_train.jpg';

export const SHOT_PRESETS = [
  t('preset.0'),
  t('preset.1'),
  t('preset.2'),
  t('preset.3'),
  t('preset.4'),
  t('preset.5'),
  t('preset.6'),
  t('preset.7'),
  t('preset.8'),
  t('preset.9'),
  t('preset.10'),
  t('preset.11'),
];

export const TEMPLATE_CATEGORIES: { key: TemplateCategory; label: string }[] = [
  { key: 'all',     label: t('cat.all') },
  { key: 'life',    label: t('cat.life') },
  { key: 'emotion', label: t('cat.emotion') },
  { key: 'journey', label: t('cat.journey') },
  { key: 'genre',   label: t('cat.genre') },
];

export const DRAMA_TEMPLATES: DramaTemplate[] = [
  // ── 都市 ──────────────────────────────────────────────────────────────────
  {
    id: 'city_hustle',
    label: t('tpl.city_hustle'),
    category: 'life',
    preview: prevCityHustle,
    shots: [
      t('tpl.city_hustle.1'),
      t('tpl.city_hustle.2'),
      t('tpl.city_hustle.3'),
      t('tpl.city_hustle.4'),
    ],
  },
  {
    id: 'midnight_diner',
    label: t('tpl.midnight_diner'),
    category: 'life',
    preview: prevMidnightDiner,
    shots: [
      t('tpl.midnight_diner.1'),
      t('tpl.midnight_diner.2'),
      t('tpl.midnight_diner.3'),
      t('tpl.midnight_diner.4'),
    ],
  },

  // ── 爱情 ──────────────────────────────────────────────────────────────────
  {
    id: 'city_romance',
    label: t('tpl.city_romance'),
    category: 'emotion',
    preview: prevCityRomance,
    shots: [
      t('tpl.city_romance.1'),
      t('tpl.city_romance.2'),
      t('tpl.city_romance.3'),
    ],
  },
  {
    id: 'letter_never_sent',
    label: t('tpl.letter_never_sent'),
    category: 'emotion',
    preview: prevLetterNeverSent,
    shots: [
      t('tpl.letter_never_sent.1'),
      t('tpl.letter_never_sent.2'),
      t('tpl.letter_never_sent.3'),
      t('tpl.letter_never_sent.4'),
    ],
  },

  // ── 青春 ──────────────────────────────────────────────────────────────────
  {
    id: 'youth_confession',
    label: t('tpl.youth_confession'),
    category: 'emotion',
    preview: prevYouthConfession,
    shots: [
      t('tpl.youth_confession.1'),
      t('tpl.youth_confession.2'),
      t('tpl.youth_confession.3'),
    ],
  },

  // ── 旅行 ──────────────────────────────────────────────────────────────────
  {
    id: 'solo_journey',
    label: t('tpl.solo_journey'),
    category: 'journey',
    preview: prevSoloJourney,
    shots: [
      t('tpl.solo_journey.1'),
      t('tpl.solo_journey.2'),
      t('tpl.solo_journey.3'),
      t('tpl.solo_journey.4'),
    ],
  },
  {
    id: 'last_train',
    label: t('tpl.last_train'),
    category: 'journey',
    preview: prevLastTrain,
    shots: [
      t('tpl.last_train.1'),
      t('tpl.last_train.2'),
      t('tpl.last_train.3'),
      t('tpl.last_train.4'),
    ],
  },

  // ── 情绪 ──────────────────────────────────────────────────────────────────
  {
    id: 'heavy_heart',
    label: t('tpl.heavy_heart'),
    category: 'emotion',
    preview: prevHeavyHeart,
    shots: [
      t('tpl.heavy_heart.1'),
      t('tpl.heavy_heart.2'),
      t('tpl.heavy_heart.3'),
    ],
  },

  // ── 高光 ──────────────────────────────────────────────────────────────────
  {
    id: 'spotlight',
    label: t('tpl.spotlight'),
    category: 'life',
    preview: prevSpotlight,
    shots: [
      t('tpl.spotlight.1'),
      t('tpl.spotlight.2'),
      t('tpl.spotlight.3'),
    ],
  },

  // ── 悬疑 ──────────────────────────────────────────────────────────────────
  {
    id: 'noir_alley',
    label: t('tpl.noir_alley'),
    category: 'genre',
    preview: prevNoirAlley,
    shots: [
      t('tpl.noir_alley.1'),
      t('tpl.noir_alley.2'),
      t('tpl.noir_alley.3'),
      t('tpl.noir_alley.4'),
    ],
  },

  // ── 奇幻 ──────────────────────────────────────────────────────────────────
  {
    id: 'ghibli_wind',
    label: t('tpl.ghibli_wind'),
    category: 'genre',
    preview: prevGhibliWind,
    shots: [
      t('tpl.ghibli_wind.1'),
      t('tpl.ghibli_wind.2'),
      t('tpl.ghibli_wind.3'),
      t('tpl.ghibli_wind.4'),
    ],
  },

  // ── 复古 ──────────────────────────────────────────────────────────────────
  {
    id: 'silent_film',
    label: t('tpl.silent_film'),
    category: 'genre',
    preview: prevSilentFilm,
    shots: [
      t('tpl.silent_film.1'),
      t('tpl.silent_film.2'),
      t('tpl.silent_film.3'),
      t('tpl.silent_film.4'),
    ],
  },
];
