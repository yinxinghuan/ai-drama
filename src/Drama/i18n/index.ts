type Locale = 'zh' | 'en';

function detectLocale(): Locale {
  const override = localStorage.getItem('game_locale');
  if (override === 'en' || override === 'zh') return override;
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

const locale = detectLocale();

const dict: Record<string, { zh: string; en: string }> = {
  // ── App ─────────────────────────────────────────────────────────────────
  'app.title':            { zh: 'AI 短剧导演', en: 'AI Short Film Director' },
  'app.myWorks':          { zh: '我的作品', en: 'My Works' },

  // ── HomePage ────────────────────────────────────────────────────────────
  'home.selectChar':      { zh: '选择角色', en: 'Select Character' },
  'home.defaultChar':     { zh: '默认角色 ›', en: 'Default Character ›' },
  'home.genBanner':       { zh: '拍摄进行中… 点击查看进度', en: 'Filming in progress… Tap to check' },
  'home.freeCreate':      { zh: '✦ 自由创作', en: '✦ Free Create' },
  'home.freeCreateDesc':  { zh: '从零开始，写你自己的剧本', en: 'Start from scratch, write your own script' },
  'home.director':        { zh: 'DIRECTOR', en: 'DIRECTOR' },
  'home.heroTitle':       { zh: '开始你的故事', en: 'Start Your Story' },
  'home.heroSub':         { zh: '选择角色，写你的剧本', en: 'Choose a character, write your script' },
  'home.inspiration':     { zh: '剧本灵感', en: 'Script Inspiration' },

  // ── ScriptPage ──────────────────────────────────────────────────────────
  'script.title':         { zh: '剧本编辑', en: 'Script Editor' },
  'script.shot':          { zh: '镜头', en: 'Shot' },
  'script.selectChar':    { zh: '选角色', en: 'Cast' },
  'script.default':       { zh: '默认', en: 'Default' },
  'script.aiSuggesting':  { zh: 'AI 正在续写…', en: 'AI writing…' },
  'script.placeholder':   { zh: '描述这个镜头的场景…', en: 'Describe this shot…' },
  'script.startFrame':    { zh: '首帧', en: 'Start' },
  'script.endFrame':      { zh: '尾帧', en: 'End' },
  'script.upload':        { zh: '点击上传', en: 'Tap to upload' },
  'script.replace':       { zh: '换图', en: 'Replace' },
  'script.genStart':      { zh: '✦ 生成首帧', en: '✦ Generate Start' },
  'script.genEnd':        { zh: '+ 尾帧', en: '+ End Frame' },
  'script.regen':         { zh: '重新生成', en: 'Regenerate' },
  'script.genFailed':     { zh: '生成失败，重试', en: 'Failed, Retry' },
  'script.generating':    { zh: '生成中…', en: 'Generating…' },
  'script.downloading':   { zh: '下载中…', en: 'Downloading…' },
  'script.aboutToGen':    { zh: '即将生成…', en: 'Starting…' },
  'script.cooldown':      { zh: '冷却中', en: 'Cooldown' },
  'script.usePrevEnd':    { zh: '← 用上镜尾帧', en: '← Use Prev End' },
  'script.addShot':       { zh: '+ 添加镜头', en: '+ Add Shot' },
  'script.go':            { zh: '开拍！生成', en: 'Action! Generate' },
  'script.shots':         { zh: '个镜头', en: ' shots' },

  // ── GeneratingPage ─────────────────────────────────────────────────────
  'gen.done':             { zh: '拍摄完成！', en: 'All Done!' },
  'gen.filming':          { zh: '正在拍摄…', en: 'Filming…' },
  'gen.overview':         { zh: '镜头总览', en: 'Shot Overview' },
  'gen.eta':              { zh: '每个镜头约需 2-3 分钟', en: 'Each shot takes about 2-3 minutes' },
  'gen.tip':              { zh: '生成完成后可直接预览，也可先离开稍后回来查看', en: 'Preview when done, or come back later to check' },
  'gen.imaging':          { zh: '生图中', en: 'Imaging' },
  'gen.cooldown':         { zh: '冷却中', en: 'Cooldown' },
  'gen.videoGen':         { zh: '生成视频', en: 'Generating' },
  'gen.regen':            { zh: '重拍', en: 'Redo' },
  'gen.continue':         { zh: '继续生成', en: 'Continue' },
  'gen.preview':          { zh: '预览', en: 'Preview' },
  'gen.loading':          { zh: '加载中', en: 'Loading' },
  'gen.allFailed':        { zh: '所有镜头均失败，请重拍', en: 'All shots failed, please retry' },

  // ── TheaterPage ─────────────────────────────────────────────────────────
  'theater.allFailed':    { zh: '所有镜头都生成失败了', en: 'All shots failed to generate' },
  'theater.restart':      { zh: '重新开始', en: 'Start Over' },
  'theater.regenCurrent': { zh: '重拍此镜头', en: 'Redo This Shot' },
  'theater.regenFailed':  { zh: '重拍镜头', en: 'Redo Shot' },
  'theater.failed':       { zh: '失败', en: 'failed' },
  'theater.reDirector':   { zh: '重新导演', en: 'Re-Direct' },
  'theater.share':        { zh: '分享', en: 'Share' },
  'gen.noChar':           { zh: '请先选择一个角色', en: 'Please select a character first' },
  'charsel.noChar':       { zh: '不用角色', en: 'No Character' },
  'charsel.noCharDesc':   { zh: '不指定角色形象', en: 'Generate without a character reference' },

  // ── WorksPage ───────────────────────────────────────────────────────────
  'works.loading':        { zh: '加载中…', en: 'Loading…' },
  'works.empty':          { zh: '还没有作品', en: 'No works yet' },
  'works.emptyDesc':      { zh: '生成第一部短剧吧', en: 'Create your first short film' },
  'works.shotsCompleted': { zh: '个镜头完成', en: ' shots completed' },
  'works.inProgress':     { zh: '生成中…', en: 'In progress…' },
  'works.pending':        { zh: '待完成', en: ' pending' },
  'works.delete':         { zh: '删除', en: 'Delete' },
  'works.share':          { zh: '分享', en: 'Share' },
  'works.copied':         { zh: '已复制', en: 'Copied' },

  // ── CharacterSelect ────────────────────────────────────────────────────
  'charsel.title':        { zh: '选择角色', en: 'Select Character' },
  'charsel.confirm':      { zh: '确认', en: 'Confirm' },
  'charsel.confirmed':    { zh: '✓ 已选定', en: '✓ Selected' },

  // ── Errors ──────────────────────────────────────────────────────────────
  'error.genFailed':      { zh: '生成失败', en: 'Generation failed' },
  'error.submitFailed':   { zh: '提交失败', en: 'Submission failed' },

  // ── Categories ──────────────────────────────────────────────────────────
  'cat.all':       { zh: '全部', en: 'All' },
  'cat.life':      { zh: '生活', en: 'Life' },
  'cat.emotion':   { zh: '情感', en: 'Emotion' },
  'cat.journey':   { zh: '旅途', en: 'Journey' },
  'cat.genre':     { zh: '风格片', en: 'Genre' },

  // ── Template labels ────────────────────────────────────────────────────
  'tpl.city_hustle':        { zh: '💼 都市奋斗', en: '💼 City Hustle' },
  'tpl.midnight_diner':     { zh: '🍜 深夜食堂', en: '🍜 Midnight Diner' },
  'tpl.city_romance':       { zh: '💘 城市爱情', en: '💘 City Romance' },
  'tpl.letter_never_sent':  { zh: '💌 寄不出的信', en: '💌 Letter Never Sent' },
  'tpl.youth_confession':   { zh: '🌅 青春告白', en: '🌅 Youth Confession' },
  'tpl.solo_journey':       { zh: '🗺️ 独自出发', en: '🗺️ Solo Journey' },
  'tpl.last_train':         { zh: '🚃 末班列车', en: '🚃 Last Train' },
  'tpl.heavy_heart':        { zh: '🌧️ 心事重重', en: '🌧️ Heavy Heart' },
  'tpl.spotlight':          { zh: '🎉 高光时刻', en: '🎉 Spotlight' },
  'tpl.noir_alley':         { zh: '🔍 暗巷追踪', en: '🔍 Noir Alley' },
  'tpl.ghibli_wind':        { zh: '🌿 风之旅人', en: '🌿 Wind Traveler' },
  'tpl.silent_film':        { zh: '🎬 默片时代', en: '🎬 Silent Film Era' },

  // ── Template shot descriptions ─────────────────────────────────────────
  // city_hustle
  'tpl.city_hustle.1': { zh: '清晨六点，闹钟响起，主角睁开眼，翻身看了一眼窗外还没亮的天，深吸一口气，从床上坐起', en: 'Six AM, alarm rings, protagonist opens eyes, rolls over to see the still-dark sky outside, takes a deep breath and sits up in bed' },
  'tpl.city_hustle.2': { zh: '拥挤的地铁车厢，主角被人群挤到角落，单手抓着扶手，低头看手机上的工作消息，嘴角微微绷紧', en: 'Crowded subway car, protagonist squeezed into a corner, gripping the handrail with one hand, reading work messages on phone, lips tightening slightly' },
  'tpl.city_hustle.3': { zh: '深夜十一点，空荡荡的办公室只剩主角一盏台灯，主角站起身走向落地窗，俯瞰整座城市的万家灯火，玻璃上映出自己疲惫又坚定的脸', en: 'Eleven PM, empty office lit only by protagonist\'s desk lamp, they stand and walk to the floor-to-ceiling window, overlooking the city\'s countless lights, their tired but determined face reflected in the glass' },
  'tpl.city_hustle.4': { zh: '第二天清晨，主角走出公寓大门，阳光洒在脸上，背起背包，大步走向街道尽头，步伐比昨天更快', en: 'Next morning, protagonist walks out the apartment door, sunlight on their face, shoulders their backpack and strides toward the end of the street, steps faster than yesterday' },

  // midnight_diner
  'tpl.midnight_diner.1': { zh: '凌晨一点，雨后的小巷弄，霓虹招牌在湿漉漉的地面上投下彩色倒影，主角推开一扇冒着热气的小店门帘', en: 'One AM, rain-soaked alley, neon signs casting colorful reflections on wet pavement, protagonist pushes through the steaming curtain of a small eatery' },
  'tpl.midnight_diner.2': { zh: '狭小温暖的店内，老板在灶台前忙碌，主角独自坐在吧台最角落的位置，两手捧着一碗冒着白烟的面，低头闻了闻，眼眶微微发红', en: 'Inside the cramped warm shop, the owner busy at the stove, protagonist sits alone at the far end of the counter, cradling a steaming bowl of noodles, leaning in to smell it, eyes reddening slightly' },
  'tpl.midnight_diner.3': { zh: '主角吃完面，把碗放下，从口袋掏出一张折得很旧的照片看了很久，然后小心翼翼地折好放回去', en: 'Protagonist finishes the noodles, sets the bowl down, pulls out a well-worn folded photo from their pocket, gazes at it for a long time, then carefully folds and puts it back' },
  'tpl.midnight_diner.4': { zh: '主角起身离开，走到门口回头对老板点了点头，推开门帘走进深夜的街道，背影渐渐被路灯拉长', en: 'Protagonist stands to leave, turns at the doorway to nod at the owner, pushes through the curtain into the late-night street, silhouette gradually stretched long by the streetlamp' },

  // city_romance
  'tpl.city_romance.1': { zh: '午后的咖啡馆，阳光透过落地窗照进来，主角推门进入，铃铛叮地一声，隔着错落的人群和咖啡机的蒸汽，与对面的人四目相对，时间仿佛慢了下来', en: 'Afternoon cafe, sunlight streaming through the window, protagonist pushes the door open with a chime, through the crowd and coffee steam, their eyes meet someone across the room, time seems to slow' },
  'tpl.city_romance.2': { zh: '雨夜的街头，两人共撑一把不太够大的伞，肩膀紧紧靠在一起，路灯在雨幕中晕开成一团暖黄色的光，两人的影子在积水中交叠', en: 'Rainy night street, two people sharing an umbrella barely big enough, shoulders pressed close, streetlamp blooming into warm yellow through the rain, their shadows overlapping in puddles' },
  'tpl.city_romance.3': { zh: '地铁站台，末班车的风吹过来，主角转身看向对方，嘴唇微动想说什么却没说出口，列车进站的灯光扫过两人的脸', en: 'Subway platform, the last train\'s wind blowing in, protagonist turns to look at the other person, lips parting to speak but words unspoken, the arriving train\'s light sweeping across both their faces' },

  // letter_never_sent
  'tpl.letter_never_sent.1': { zh: '午后书房，阳光照在桌面上，主角坐在老旧的木桌前，手里握着钢笔，面前摊开一张信纸，写了几行又停下，抬头望向窗外发呆', en: 'Afternoon study, sunlight on the desk, protagonist sits at an old wooden table holding a fountain pen, letter paper spread open with a few lines written then paused, gazing out the window' },
  'tpl.letter_never_sent.2': { zh: '主角起身走到窗边，手里握着那封信，窗外的梧桐树叶在风中沙沙作响，主角的表情又温柔又遗憾', en: 'Protagonist stands and walks to the window, letter in hand, plane tree leaves rustling outside, expression both tender and full of regret' },
  'tpl.letter_never_sent.3': { zh: '傍晚，主角走到街角的邮筒前，站了很久，手里的信举到投信口又放下来，反复了几次', en: 'Evening, protagonist stands before the corner mailbox for a long time, raising the letter to the slot then lowering it, again and again' },
  'tpl.letter_never_sent.4': { zh: '主角转身离开邮筒，把信折好放进大衣内袋，贴近心口的位置，夕阳把整条街染成金色，主角的背影缓缓走远', en: 'Protagonist turns from the mailbox, folds the letter into the coat\'s inner pocket, close to the heart, sunset painting the whole street gold as their silhouette slowly walks away' },

  // youth_confession
  'tpl.youth_confession.1': { zh: '放学后的操场，夕阳把跑道染成橘红色，主角从远处向镜头跑来，跑得气喘吁吁，在镜头前急停，弯腰撑着膝盖大口喘气', en: 'After-school playground, sunset turning the track orange-red, protagonist running toward camera from afar, breathless, skidding to a stop, bent over hands on knees gasping' },
  'tpl.youth_confession.2': { zh: '教学楼走廊尽头，主角靠在墙上给自己鼓劲，然后一个深呼吸，转过身走向走廊另一头等着的人，脚步越来越快', en: 'End of the school corridor, protagonist leaning against the wall psyching themselves up, one deep breath, then turns and walks toward the person waiting at the other end, steps quickening' },
  'tpl.youth_confession.3': { zh: '傍晚的天台上，两人并排背靠栏杆，谁也没说话，风吹过两人的衣角和头发，远处是一整片燃烧般的晚霞，主角偷偷侧头看了对方一眼', en: 'Evening rooftop, two people standing side by side against the railing in silence, wind blowing through their clothes and hair, a sky ablaze with sunset in the distance, protagonist sneaking a sideways glance' },

  // solo_journey
  'tpl.solo_journey.1': { zh: '凌晨五点，天还没完全亮，主角轻轻关上家门，拖着行李箱走下楼梯，在大门口停了一秒，回头看了一眼楼上还亮着的那盏灯', en: 'Five AM, sky not yet fully light, protagonist quietly closes the front door, wheels suitcase down the stairs, pauses at the entrance for a second, glancing back at the still-lit lamp upstairs' },
  'tpl.solo_journey.2': { zh: '火车车窗旁，主角侧脸靠在冰凉的玻璃上，窗外的风景飞速掠过——田野、铁塔、远山，车厢里的光影在主角脸上明暗交替', en: 'By the train window, protagonist\'s face resting against the cold glass, scenery racing past outside — fields, towers, distant mountains — light and shadow alternating across their face' },
  'tpl.solo_journey.3': { zh: '陌生城市的十字路口，主角站在路中间，摘下耳机，听见了街头艺人的手风琴声，缓缓环顾四周，嘴角不自觉地扬了起来', en: 'Intersection in a strange city, protagonist standing in the middle, removing earphones, hearing an accordion street performer, slowly looking around, a smile forming unconsciously' },
  'tpl.solo_journey.4': { zh: '海边公路的尽头，主角把行李箱放在身旁，面朝大海张开双臂，海风把外套吹得像翅膀一样鼓起来', en: 'End of a coastal road, protagonist sets the suitcase beside them, faces the ocean with arms wide open, sea breeze inflating their jacket like wings' },

  // last_train
  'tpl.last_train.1': { zh: '昏黄灯光下的老式火车站台，主角独自坐在长椅上，行李箱靠在脚边，抬头看着站台上方古旧的时刻表，指针缓缓移动', en: 'Old-fashioned train platform under dim yellow light, protagonist sitting alone on a bench, suitcase at their feet, looking up at the antique timetable, hands slowly moving' },
  'tpl.last_train.2': { zh: '末班列车缓缓进站，车窗里透出暖黄色的灯光，主角站起身，在蒸汽和灯光中拎起行李箱，走向车门', en: 'Last train slowly pulling in, warm light glowing through windows, protagonist stands, picks up suitcase amid steam and lamplight, walks toward the car door' },
  'tpl.last_train.3': { zh: '空荡荡的车厢里只有主角一个人，窗外是漆黑的夜和偶尔闪过的零星灯火，主角把额头贴在车窗上，看着自己在玻璃上的倒影', en: 'Empty carriage with only the protagonist, outside is pitch-black night with occasional scattered lights, protagonist pressing forehead against the window, watching their own reflection in the glass' },
  'tpl.last_train.4': { zh: '天蒙蒙亮时列车到站，主角走下车，站台上晨雾弥漫，远处有人举着接站牌，主角加快脚步走过去，雾气在身后散开', en: 'Train arrives as dawn breaks, protagonist steps off, morning mist filling the platform, someone in the distance holding a pickup sign, protagonist quickens pace toward them, mist parting behind' },

  // heavy_heart
  'tpl.heavy_heart.1': { zh: '雨天的公寓里，主角站在落地玻璃窗前，指尖沿着玻璃上的雨痕缓缓滑下，窗外是灰蒙蒙的城市天际线', en: 'Rainy day apartment, protagonist standing before floor-to-ceiling glass, fingertip tracing a raindrop trail down the pane, grey city skyline outside' },
  'tpl.heavy_heart.2': { zh: '便利店深夜，日光灯嗡嗡作响，主角一个人坐在窗边的小桌旁，手里攥着一杯热饮，眼睛出神地望着窗外空无一人的马路', en: 'Late-night convenience store, fluorescent lights humming, protagonist alone at the window table, clutching a warm drink, staring blankly at the empty street outside' },
  'tpl.heavy_heart.3': { zh: '傍晚的地铁站出口，主角戴着耳机走出来，汇入下班的人潮中，被人群裹挟着往前走，表情空白，逐渐消失在人潮的尽头', en: 'Evening subway exit, protagonist emerges wearing earphones, merging into the rush-hour crowd, carried forward by the flow, expression blank, gradually disappearing into the sea of people' },

  // spotlight
  'tpl.spotlight.1': { zh: '幕布缓缓拉开，主角从舞台侧面走出，一束聚光灯从头顶打下来，照亮整个人，主角停在舞台正中央，面对黑暗中的观众席', en: 'Curtain slowly rising, protagonist walks out from stage side, a single spotlight beaming down from above illuminating them entirely, stopping center stage facing the darkened audience' },
  'tpl.spotlight.2': { zh: '颁奖台上，主持人念到名字，主角从座位上站起，在掌声中走上台，接过奖杯的瞬间，灯光更亮了一级，主角转身面向观众，把奖杯高高举过头顶', en: 'Award stage, host reads the name, protagonist rises from their seat, walks up amid applause, the moment they take the trophy the lights brighten a notch, they turn to the audience and raise it high overhead' },
  'tpl.spotlight.3': { zh: '散场后，灯光关掉了大半，空旷的舞台上只剩主角一人站在那里，缓缓环顾四周空荡荡的座椅，然后仰头深吸一口气，露出一个只属于自己的微笑', en: 'After the show, most lights off, protagonist stands alone on the empty stage, slowly looking around at the vacant seats, then tilts their head back, takes a deep breath, and smiles a smile just for themselves' },

  // noir_alley
  'tpl.noir_alley.1': { zh: '深夜的老城区，路灯只亮了一半，主角竖起风衣领子，沿着湿漉漉的石板路快步走进一条窄巷，墙上的影子被拉得又长又扭曲', en: 'Late night in the old quarter, half the streetlamps lit, protagonist turns up their trenchcoat collar, hurrying down wet cobblestones into a narrow alley, shadow on the wall stretched long and distorted' },
  'tpl.noir_alley.2': { zh: '巷子尽头的路灯下，主角停下脚步，从口袋里掏出一张皱巴巴的黑白照片，借着昏暗的灯光仔细辨认，然后抬头打量对面那扇紧闭的铁门', en: 'Under the lamp at the alley\'s end, protagonist stops, pulls a crumpled black-and-white photo from their pocket, studies it in the dim light, then looks up at the sealed iron door across the way' },
  'tpl.noir_alley.3': { zh: '主角推开铁门走进去，楼梯间里只有自己的脚步声回荡，墙上的油漆斑驳脱落，每走一步楼梯都吱呀作响', en: 'Protagonist pushes open the iron door and enters, only their footsteps echoing in the stairwell, paint peeling off the walls, each stair step creaking underfoot' },
  'tpl.noir_alley.4': { zh: '顶楼房间的门虚掩着，主角伸手轻轻推开，门缝里透出一线光，映照出主角半张警觉的脸，紧接着门完全打开——房间里一张桌子、一盏台灯、一把空椅子', en: 'Top floor room door left ajar, protagonist reaches out and gently pushes it open, a sliver of light through the crack illuminating half their alert face, then the door swings fully open — a table, a desk lamp, an empty chair' },

  // ghibli_wind
  'tpl.ghibli_wind.1': { zh: '辽阔的翠绿山丘上，风吹过齐腰的草浪，主角站在山顶俯瞰远方连绵的云海，斗篷在风中猎猎作响，手里握着一根古旧的木杖', en: 'Vast green hillside, wind sweeping through waist-high grass, protagonist standing atop the hill overlooking an endless sea of clouds, cloak snapping in the wind, gripping an ancient wooden staff' },
  'tpl.ghibli_wind.2': { zh: '主角沿着山坡小径往下走，路过一棵巨大的古树，树冠遮天蔽日，树根间有萤火虫一样的光点在漂浮，主角停下来伸手去接了一颗', en: 'Protagonist descends the hillside path, passing an enormous ancient tree with a canopy blocking the sky, firefly-like points of light drifting among its roots, protagonist pauses to catch one in their hand' },
  'tpl.ghibli_wind.3': { zh: '黄昏时分，主角走过一座长满青苔的石拱桥，桥下是清澈的溪流，远处的天空被晚霞染成紫红和金色，几只不知名的鸟从头顶掠过', en: 'At dusk, protagonist crosses a moss-covered stone arch bridge, clear stream flowing beneath, the distant sky painted purple-red and gold by sunset, unknown birds swooping overhead' },
  'tpl.ghibli_wind.4': { zh: '夜幕降临，主角在巨石旁生起一堆小小的篝火，火光映着主角的脸，抬头望向满天繁星，远方的山脊上隐约浮现出巨大的、发着微光的神秘轮廓', en: 'Night falls, protagonist lights a small campfire beside a boulder, firelight flickering across their face, looking up at a sky full of stars, on the distant ridge a massive, faintly glowing mysterious silhouette emerges' },

  // silent_film
  'tpl.silent_film.1': { zh: '黑白画面，老式剧院门口，主角穿着礼帽和长风衣，站在旋转门前整理袖口，画面有轻微的胶片颗粒和竖条纹抖动', en: 'Black and white frame, old theater entrance, protagonist in a top hat and long coat, adjusting their cuffs before the revolving door, image with slight film grain and vertical line flicker' },
  'tpl.silent_film.2': { zh: '剧院大厅里，水晶吊灯的光芒在黑白画面中格外耀眼，主角穿过人群，每个人的动作都带着一种夸张的戏剧感，主角在人群中回头寻找着什么', en: 'Theater grand hall, crystal chandelier dazzling in the monochrome frame, protagonist moves through the crowd, everyone\'s gestures carrying exaggerated theatricality, protagonist turning back through the crowd searching for something' },
  'tpl.silent_film.3': { zh: '空荡的舞台上，一架三角钢琴，主角独自走向钢琴，坐下，手指落在琴键上，虽然是无声的默片，镜头用光影的变化传递出旋律的情感', en: 'Empty stage, a grand piano, protagonist walks alone to the piano, sits down, fingers landing on the keys, though it\'s a silent film, the camera conveys the melody\'s emotion through shifts of light and shadow' },
  'tpl.silent_film.4': { zh: '曲终，主角站起身，面向镜头缓缓鞠躬，胶片画面闪烁了几下，像是在致敬一个远去的时代', en: 'Music ends, protagonist stands, slowly bows to camera, the film frame flickers a few times, as if paying tribute to a bygone era' },

  // ── Shot presets ────────────────────────────────────────────────────────
  'preset.0':  { zh: '清晨，主角从床边站起，走向窗边，望向窗外晨光', en: 'Dawn, protagonist gets up from bed, walks to the window, gazing at the morning light' },
  'preset.1':  { zh: '街头，主角从人群中逆向走来，停步，抬头望向远方', en: 'Street, protagonist walks against the crowd, stops, looks up toward the distance' },
  'preset.2':  { zh: '咖啡馆，主角端起咖啡杯，转身，对视来人，嘴角微扬', en: 'Cafe, protagonist lifts the coffee cup, turns, eyes meet someone, a slight smile' },
  'preset.3':  { zh: '深夜，主角坐在台阶上，捧着外卖盒，抬头看月亮', en: 'Late night, protagonist sits on the steps, holding a takeout box, looking up at the moon' },
  'preset.4':  { zh: '雨中，主角从屋檐下跑出，冲入雨幕，回头大笑', en: 'In the rain, protagonist dashes out from under the eaves, plunging into the downpour, turning back to laugh' },
  'preset.5':  { zh: '主角从远处奔跑而来，在镜头前急停，大口喘气', en: 'Protagonist sprints from afar, skids to a halt before the camera, gasping for breath' },
  'preset.6':  { zh: '高楼顶端，主角走到边缘，俯身向下张望，风吹衣角', en: 'Rooftop edge, protagonist peers over, wind tugging at their clothes' },
  'preset.7':  { zh: '海边礁石上，主角站起身，向着海浪伸展双臂', en: 'On coastal rocks, protagonist stands up, stretching arms toward the waves' },
  'preset.8':  { zh: '主角收到消息，从低头到缓缓抬头，表情由惊变喜', en: 'Protagonist receives a message, slowly lifts head, expression shifting from shock to joy' },
  'preset.9':  { zh: '主角在镜子前整理衣领，转身，走向门口，推门而出', en: 'Protagonist adjusts collar in the mirror, turns, walks to the door and pushes out' },
  'preset.10': { zh: '夕阳下，主角从镜头前走远，在远处转身，挥手告别', en: 'Under the sunset, protagonist walks away from camera, turns in the distance, waves goodbye' },
  'preset.11': { zh: '主角背对镜头，站在路口，风吹发丝，缓缓转身', en: 'Back to camera, protagonist stands at the crossroads, wind in their hair, slowly turning around' },
};

export function t(key: string, vars?: Record<string, string | number>): string {
  const entry = dict[key];
  let str = entry ? entry[locale] : key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(`{${k}}`, String(v));
    }
  }
  return str;
}

export function getLocale(): Locale {
  return locale;
}
