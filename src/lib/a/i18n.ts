// Interface strings of /a in five languages. Muse writes its own text in the chosen language; the engine's Russian
// data lines go through dtx.ts. Plain module, no React: it moves to studio/web as is.
import { ES } from "./i18n-es";

export const LANGS = [
  { id: "ru", label: "Русский", short: "RU" },
  { id: "uk", label: "Українська", short: "UK" },
  { id: "en", label: "English", short: "EN" },
  { id: "zh", label: "中文", short: "中文" },
  { id: "es", label: "Español", short: "ES" },
] as const;
export type Lang = (typeof LANGS)[number]["id"];
export const isLang = (x: unknown): x is Lang => LANGS.some((l) => l.id === x);
/** ?lang=: the studio at /try calls Spanish es-419. */
export const asLang = (x: unknown): Lang | null => { const v = x === "es-419" ? "es" : x; return isLang(v) ? v : null; };
// One cookie for the whole site (/try and /a share the origin), so the language follows the reader from page to page.
export function savedLang(): Lang | null {
  try { return asLang(/(?:^|; )lang=([\w-]+)/.exec(document.cookie)?.[1]); } catch { return null; }
}
export function saveLang(l: Lang) {
  try { document.cookie = `lang=${l}; Path=/; Max-Age=31536000; SameSite=Lax`; } catch { /* cookies off */ }
  try { localStorage.setItem("cx-lang", l); } catch { /* private mode */ }
}
/** A first visit with no ?lang and no saved choice: the browser's language (ru, uk, zh, es), English for everyone else. */
export function browserLang(): Lang {
  const n = (typeof navigator === "undefined" ? "" : navigator.languages?.[0] ?? navigator.language ?? "").toLowerCase();
  return n.startsWith("uk") ? "uk" : n.startsWith("ru") || n.startsWith("be") || n.startsWith("kk") ? "ru" : n.startsWith("zh") ? "zh" : n.startsWith("es") ? "es" : "en";
}

let cur: Lang = "ru";
export const lang = () => cur;
export const setLangNow = (l: Lang) => { cur = l; };

type W = [string, string, string, string];
export const W = {
  // shell
  review: ["Разбор матча", "Match review", "比赛复盘", "Розбір матчу"],
  match: ["Матч", "Match", "比赛", "Матч"],
  modeTurbo: ["Турбо: модели учились на рейтинговых All Pick, здесь цифры приблизительные.", "Turbo: the models learned on ranked All Pick, so the numbers here are rough.", "加速模式：模型基于天梯全英雄选择训练，这里的数字只是近似。", "Турбо: моделі вчилися на рейтингових All Pick, тому тут цифри приблизні."],
  modeOther: ["Это не All Pick: модели учились на рейтинговых All Pick, здесь цифры приблизительные.", "Not All Pick: the models learned on ranked All Pick, so the numbers here are rough.", "这不是全英雄选择：模型基于天梯全英雄选择训练，这里的数字只是近似。", "Це не All Pick: моделі вчилися на рейтингових All Pick, тому тут цифри приблизні."],
  pending: ["Разбор ещё готовится. Страница обновится сама, когда он будет готов.", "The review is still being made. This page refreshes by itself when it is ready.", "复盘还在生成中。完成后页面会自动刷新。", "Розбір ще готується. Сторінка оновиться сама, коли він буде готовий."],
  notYours: ["Этот разбор открыт только тому, кто его заказал. Войдите в Crux тем же аккаунтом (Telegram или Steam), которым разбирали матч, и откройте ссылку ещё раз.", "This review is open only to the person who ordered it. Sign in to Crux with the same account (Telegram or Steam) you used for the match, then open the link again.", "这份复盘只对下单的人开放。请用分析这场比赛时的同一个账号（Telegram 或 Steam）登录 Crux，然后再次打开链接。", "Цей розбір відкритий лише тому, хто його замовив. Увійдіть у Crux тим самим акаунтом (Telegram або Steam), яким розбирали матч, і відкрийте посилання ще раз."],
  signIn: ["Войти в Crux", "Sign in to Crux", "登录 Crux", "Увійти в Crux"],
  sidePick: ["За кого разбирать матч? Выберите своего героя: разбор будет с точки зрения вашей команды.", "Whose match is it? Pick your hero: the review will be told from your team's side.", "这是谁的比赛？选择你的英雄，复盘将以你所在队伍的视角呈现。", "За кого розбирати матч? Оберіть свого героя: розбір буде з погляду вашої команди."],
  heroFoe: ["Соперники. Нажмите на героя, если играли им: разбор откроется за его команду.", "Opponents. Tap a hero if it was yours: the review switches to that team.", "对手。如果这是你玩的英雄，点击它，复盘会切换到他的队伍。", "Суперники. Натисніть на героя, якщо грали ним: розбір відкриється за його команду."],
  heroFoeDemo: ["Соперники. В демо разбор только за одну команду.", "Opponents. The demo is told from one team only.", "对手。演示只从一方讲述。", "Суперники. У демо розбір лише за одну команду."],
  heroFoeGo: ["Это мой герой: разбор за команду {0}", "This was me: review from the team of {0}", "这是我：从 {0} 的队伍复盘", "Це мій герой: розбір за команду {0}"],
  sideFail: ["Не удалось сохранить выбор. Попробуйте ещё раз.", "Could not save the choice. Try again.", "未能保存选择，请重试。", "Не вдалося зберегти вибір. Спробуйте ще раз."],
  toCrux: ["В Crux", "Back to Crux", "返回 Crux", "У Crux"],
  lang: ["Язык", "Language", "语言", "Мова"],
  themeLight: ["Светлая тема", "Light theme", "浅色", "Світла тема"],
  themeDark: ["Тёмная тема", "Dark theme", "深色", "Темна тема"],
  loading: ["Загружаем разбор матча", "Loading the match review", "正在加载比赛复盘", "Завантажуємо розбір матчу"],
  loadFail: ["Разбор не загрузился", "The review did not load", "复盘没有加载出来", "Розбір не завантажився"],
  loadFailWhy: ["Не удалось загрузить разбор ({0}). Проверьте сеть и загрузите ещё раз.", "Could not load the review ({0}). Check the connection and try again.", "复盘加载失败（{0}）。请检查网络后重试。", "Не вдалося завантажити розбір ({0}). Перевірте мережу й завантажте ще раз."],
  noFights: ["В файле разбора нет ни одной драки.", "The review file has no fights.", "复盘文件里没有团战。", "У файлі розбору немає жодного бою."],
  again: ["Загрузить ещё раз", "Load again", "重新加载", "Завантажити ще раз"],
  tabs: ["Разделы разбора", "Review sections", "复盘栏目", "Розділи розбору"],
  footer: ["Шанс победы и цену каждой драки считает движок Crux по реплею. Тексты разбора, ответы «Объясни» и чат пишутся по этим числам.", "Crux reads the replay and computes the win chance and the cost of every fight. Review text, Explain answers and chat are written from those numbers.", "Crux 根据录像计算胜率和每场团战的代价。复盘文字、“解释”和问答均根据这些数字撰写。", "Шанс перемоги та ціну кожного бою рахує рушій Crux за реплеєм. Тексти розбору, відповіді «Поясни» і чат пишуться за цими числами."],
  // tabs
  t_review: ["Разбор", "Review", "复盘", "Розбір"],
  t_moments: ["Моменты", "Moments", "关键时刻", "Моменти"],
  t_chain: ["Цепочка", "Chain", "连锁", "Ланцюжок"],
  t_versus: ["Противостояние", "Teams", "双方对比", "Протистояння"],
  t_hero: ["Мой герой", "My hero", "我的英雄", "Мій герой"],
  t_guess: ["Угадай", "Guess", "猜一猜", "Вгадай"],
  t_ask: ["Спросить", "Ask", "提问", "Запитати"],
  // match head
  you: ["вы", "you", "我方", "ви"],
  win: ["Победа", "Victory", "胜利", "Перемога"],
  loss: ["Поражение", "Defeat", "失败", "Поразка"],
  yourTeam: ["Ваша команда", "Your team", "我方队伍", "Ваша команда"],
  foeTeam: ["Команда соперника", "Enemy team", "敌方队伍", "Команда суперника"],
  kills: ["Убийства: {0} против {1}", "Kills: {0} to {1}", "击杀：{0} 比 {1}", "Вбивства: {0} проти {1}"],
  heroOpen: ["{0}: открыть карточку героя", "{0}: open the hero card", "{0}：打开英雄卡片", "{0}: відкрити картку героя"],
  // review tab
  by: ["Разбор собран для этого матча", "Review built for this match", "本场比赛的复盘", "Розбір зібрано для цього матчу"],
  byLive: ["Разбор только что собран заново", "The review was just rebuilt", "复盘刚刚重新生成", "Розбір щойно зібрано заново"],
  byStd: ["Стандартный разбор по числам движка", "Standard review from the engine numbers", "根据引擎数字生成的标准复盘", "Стандартний розбір за числами рушія"],
  byRun: ["Собираем разбор заново", "Rebuilding the review", "正在重新生成复盘", "Збираємо розбір заново"],
  byBad: ["Новая раскладка пришла с ошибкой, оставили прежнюю.", "The new layout came back broken, the previous one stays.", "新的版式有错误，保留原来的。", "Нова розкладка прийшла з помилкою, залишили попередню."],
  byFail: ["Сейчас пересобрать не получилось, оставили прежний разбор.", "Could not rebuild right now, the previous review stays.", "暂时无法重新生成，保留原来的复盘。", "Зараз перезібрати не вдалося, залишили попередній розбір."],
  rebuild: ["Пересобрать", "Rebuild", "重新生成", "Перезібрати"],
  stop: ["Остановить", "Stop", "停止", "Зупинити"],
  main: ["Главное", "The main thing", "要点", "Головне"],
  proof: ["Драки, где это видно", "Fights that show it", "能说明这一点的团战", "Бої, де це видно"],
  explainPic: ["Что значит эта картинка", "What this chart means", "这张图说明什么", "Що означає ця картинка"],
  explain: ["Объясни", "Explain", "解释", "Поясни"],
  explainFight: ["Объясни эту драку", "Explain this fight", "解释这场团战", "Поясни цей бій"],
  threeFights: ["Три драки, которые решили матч", "Three fights that decided the match", "决定比赛的三场团战", "Три бої, що вирішили матч"],
  chainT: ["Как матч ушёл", "How the match slipped away", "比赛是怎么输掉的", "Як матч пішов"],
  chainTW: ["Где матч мог уйти", "Where the match could have slipped", "比赛在哪里差点溜走", "Де матч міг піти"],
  forYou: ["Для тебя", "For you", "给你的建议", "Для тебе"],
  whose: ["Чей разбор показать", "Whose review to show", "查看谁的复盘", "Чий розбір показати"],
  team: ["вся команда", "whole team", "全队", "вся команда"],
  teamShort: ["все", "all", "全队", "усі"],
  teamCap: ["Вся команда", "Whole team", "全队", "Вся команда"],
  vsPro: ["{0}: против pro на той же позиции", "{0}: against pros in the same position", "{0}：与同位置职业选手对比", "{0}: проти pro на тій самій позиції"],
  // fight
  fightAt: ["Драка {0}", "Fight at {0}", "{0} 的团战", "Бій {0}"],
  fightOn: ["Драка на {0}", "Fight at {0}", "{0} 的团战", "Бій на {0}"],
  noFight: ["Драки {0} нет в этом матче.", "There is no fight {0} in this match.", "本场没有团战 {0}。", "Бою {0} немає в цьому матчі."],
  chance: ["Шанс", "Chance", "胜率", "Шанс"],
  chanceL: ["шанс", "chance", "胜率", "шанс"],
  became: [" стал ", " became ", " 变为 ", " став "],
  pPrep: ["до первого удара", "before the first hit", "首次出手前", "до першого удару"],
  pExec: ["первые 6 секунд", "first 6 seconds", "前 6 秒", "перші 6 секунд"],
  pExecS: ["первые 6 с", "first 6 s", "前 6 秒", "перші 6 с"],
  pRest: ["остальная драка", "rest of the fight", "团战其余部分", "решта бою"],
  fbNote: ["Пункты шанса победы. В «остальной драке» скиллшоты и выбор целей после первых секунд, их движок пока не раскладывает по героям.", "Points of win chance. The rest of the fight is skillshots and target choice after the first seconds, which the engine does not split by hero yet.", "单位是胜率百分点。“团战其余部分”包括技能命中和前几秒后的目标选择，引擎暂时无法按英雄拆分。", "Пункти шансу перемоги. У «решті бою» скілшоти та вибір цілей після перших секунд, їх рушій поки не розкладає по героях."],
  openFight: ["Открыть драку с реплеем", "Open the fight with the replay", "打开团战回放", "Відкрити бій з реплеєм"],
  you2: ["Вы", "You", "我方", "Ви"],
  foe: ["Враг", "Enemy", "敌方", "Ворог"],
  ult: ["ульт", "ult", "大招", "ульт"],
  tp: ["ТП", "TP", "TP", "ТП"],
  wiWho: ["{0} как у сильных игроков", "{0} like strong players", "{0}达到高分玩家水平", "{0} як у сильних гравців"],
  wiHero: ["{0} пришёл бы к драке как сильный игрок", "{0} came to the fight like a strong player", "如果 {0} 像高分玩家一样进入团战", "{0} прийшов би до бою як сильний гравець"],
  wiAfter: ["шанс после драки", "chance after the fight", "团战后胜率", "шанс після бою"],
  instead: ["вместо", "instead of", "而不是", "замість"],
  allBack: ["К началу драки все ваши, кто умер раньше, уже вернулись.", "Everyone on your team who died earlier was back by the start of the fight.", "团战开始时，之前阵亡的队友都已复活。", "До початку бою всі ваші, хто помер раніше, вже повернулися."],
  s_replay: ["Реплей", "Replay", "回放", "Реплей"],
  s_ready: ["Что было готово в первую секунду", "What was ready at the first second", "第一秒时有哪些技能就绪", "Що було готове в першу секунду"],
  s_whatif: ["Что если", "What if", "如果……", "Що як"],
  s_concepts: ["Командные факты", "Team facts", "团队数据", "Командні факти"],
  s_deaths: ["Смерти до драки", "Deaths before the fight", "团战前的阵亡", "Смерті до бою"],
  watch: ["Смотреть драку на миникарте, {0}", "Watch the fight on the minimap, {0}", "在小地图上观看团战，{0}", "Дивитися бій на мінікарті, {0}"],
  doInstead: ["Надо было", "Should have", "应该", "Треба було"],
  nextGame: ["На следующую игру.", "Next game.", "下一局：", "На наступну гру."],
  less: ["Свернуть", "Show less", "收起", "Згорнути"],
  whyDo: ["Почему и что делать", "Why, and what to do", "原因和做法", "Чому і що робити"],
  bySecond: ["Разбор драки по секундам", "Second-by-second breakdown", "逐秒分析", "Розбір бою по секундах"],
  k_death_before: ["смерть до драки", "death before a fight", "团战前阵亡", "смерть до бою"],
  k_fight_then_building: ["драка и здания", "fight, then buildings", "团战后丢建筑", "бій і будівлі"],
  k_drift: ["просадка без драки", "drop without a fight", "无团战下滑", "просадка без бою"],
  between: ["Между драками", "Between fights", "两场团战之间", "Між боями"],
  chainAria: ["Цепочка матча", "Match chain", "比赛连锁", "Ланцюжок матчу"],
  habBad: ["хуже pro", "worse than pro", "不如职业", "гірше за pro"],
  youL: ["вы", "you", "你", "ви"],
  more: ["больше лучше", "more is better", "越多越好", "більше краще"],
  lessB: ["меньше лучше", "less is better", "越少越好", "менше краще"],
  // moments tab
  mainFights: ["Главные драки", "Main fights", "主要团战", "Головні бої"],
  whatHappened: ["Что произошло", "What happened", "发生了什么", "Що сталося"],
  whyDecided: ["Почему это решило драку", "Why it decided the fight", "为什么这决定了团战", "Чому це вирішило бій"],
  howCame: ["Кто как пришёл к драке", "How each hero came to the fight", "每个英雄进入团战时的状态", "Хто як прийшов до бою"],
  howCameNote: ["Каждый герой против сильного игрока той же позиции в такой же ситуации, в пунктах шанса победы.", "Each hero against a strong player in the same position and situation, in points of win chance.", "每个英雄与同位置、同情形的高分玩家对比，单位为胜率百分点。", "Кожен герой проти сильного гравця тієї самої позиції в такій самій ситуації, у пунктах шансу перемоги."],
  deadAtStart: [", был мёртв к началу", ", dead at the start", "，开战时已阵亡", ", був мертвий на початок"],
  showOnMap: ["Показать на карте", "Show on the map", "在地图上显示", "Показати на мапі"],
  // chain tab
  allLinks: ["Все звенья", "All links", "全部环节", "Усі ланки"],
  linksDeath: ["Смерти до драк", "Deaths before fights", "团战前阵亡", "Смерті до боїв"],
  linksBld: ["Драка и здания", "Fight, then buildings", "团战后丢建筑", "Бій і будівлі"],
  linksDrift: ["Просадки без драки", "Drops without a fight", "无团战下滑", "Просадки без бою"],
  whichLinks: ["Какие звенья показать", "Which links to show", "显示哪些环节", "Які ланки показати"],
  allLinksT: ["Все звенья цепочки по времени", "Every link of the chain in time order", "按时间排列的全部环节", "Усі ланки ланцюжка за часом"],
  noLinks: ["В этом матче таких звеньев нет. Выберите другой вид.", "This match has no links of this kind. Pick another kind.", "本场没有这类环节，请换一种。", "У цьому матчі таких ланок немає. Оберіть інший вигляд."],
  // hero tab
  myHero: ["Мой герой", "My hero", "我的英雄", "Мій герой"],
  heroStats: ["{0} смертей в драках, участвовал в {1} драках из {2}.", "{0} deaths in fights, took part in {1} of {2} fights.", "团战中阵亡 {0} 次，参加了 {2} 场团战中的 {1} 场。", "{0} смертей у боях, брав участь у {1} боях із {2}."],
  heroWorse: ["Драки, где {0} пришёл хуже сильного игрока", "Fights where {0} came in worse than a strong player", "{0} 状态不如高分玩家的团战", "Бої, де {0} прийшов гірше за сильного гравця"],
  heroOk: ["В заметных драках {0} приходил не хуже сильного игрока своей позиции.", "In the notable fights {0} came in no worse than a strong player of his position.", "在重要团战中，{0} 的状态不比同位置高分玩家差。", "У помітних боях {0} приходив не гірше за сильного гравця своєї позиції."],
  habitsPro: ["Привычки против pro", "Habits against pros", "与职业选手的习惯对比", "Звички проти pro"],
  // versus
  hero: ["Герой", "Hero", "英雄", "Герой"],
  kda: ["У/С/П", "K/D/A", "杀/死/助", "У/С/П"],
  nw: ["Нетворс", "Net worth", "经济", "Нетворс"],
  lhdn: ["Добив / денай", "Last hits / denies", "正补 / 反补", "Ласт-хіти / деніі"],
  items: ["Предметы", "Items", "物品", "Предмети"],
  lvl: ["ур. {0}", "lvl {0}", "{0} 级", "рів. {0}"],
  rivals: ["Соперники", "Opponents", "对手", "Суперники"],
  // pics
  pBkb: ["Когда у кого появился BKB", "When each hero got BKB", "谁在什么时候出了 BKB", "Коли в кого з'явився BKB"],
  pBkbKey: ["главные драки", "main fights", "主要团战", "головні бої"],
  pBkbNoYou: ["У вас без BKB: {0}.", "No BKB on your side: {0}.", "我方没出 BKB：{0}。", "У вас без BKB: {0}."],
  pBkbNoFoe: ["У врага без BKB: {0}.", "No BKB on the enemy side: {0}.", "敌方没出 BKB：{0}。", "У ворога без BKB: {0}."],
  pBkbAt: ["{0}: BKB на {1}", "{0}: BKB at {1}", "{0}：{1} 出 BKB", "{0}: BKB на {1}"],
  pBkbAria: ["Время покупки BKB по героям", "BKB purchase time by hero", "各英雄购买 BKB 的时间", "Час купівлі BKB по героях"],
  pLead: ["Шанс победы вашей команды", "Your team's win chance", "我方胜率", "Шанс перемоги вашої команди"],
  pLeadA: ["до пика", "before the peak", "峰值前", "до піку"],
  pLeadB: ["после пика", "after the peak", "峰值后", "після піку"],
  pLeadAria: ["Шанс победы: пик {0} на {1}, в конце {2}", "Win chance: peak {0} at {1}, {2} at the end", "胜率：{1} 达到峰值 {0}，最后 {2}", "Шанс перемоги: пік {0} на {1}, наприкінці {2}"],
  pPeak: ["пик {0}, {1}", "peak {0}, {1}", "峰值 {0}，{1}", "пік {0}, {1}"],
  pGold: ["Разница в золоте по минутам", "Gold difference by minute", "每分钟经济差", "Різниця в золоті по хвилинах"],
  pGoldA: ["впереди вы", "you ahead", "我方领先", "попереду ви"],
  pGoldB: ["впереди враг", "enemy ahead", "敌方领先", "попереду ворог"],
  pGoldAria: ["Разница в нетворсе: лучший момент {0} на {1}, в конце враг впереди на {2}", "Net worth difference: best {0} at {1}, enemy ahead by {2} at the end", "经济差：{1} 最佳 {0}，最后敌方领先 {2}", "Різниця в нетворсі: найкращий момент {0} на {1}, наприкінці ворог попереду на {2}"],
  pGoldAt: ["+{0} на {1}", "+{0} at {1}", "{1} +{0}", "+{0} на {1}"],
  pVision: ["Обзор: варды за матч и что видели перед драками", "Vision: wards in the match and what each side saw before fights", "视野：全场守卫和团战前双方看到了什么", "Огляд: варди за матч і що бачили перед боями"],
  pVisFight: ["Драка", "Fight", "团战", "Бій"],
  pVisSeen: ["Видели врагов", "Enemies seen", "看到的敌人", "Бачили ворогів"],
  pVisOld: ["Картина врага устарела", "Enemy info age", "敌方信息过时", "Картина ворога застаріла"],
  pVisWards: ["Варды за 5 мин", "Wards in 5 min", "5 分钟内的守卫", "Варди за 5 хв"],
  pVisWardsN: ["вардов", "wards", "个守卫", "вардів"],
  vs: ["против", "vs", "对", "проти"],
  sec: ["{0} с", "{0} s", "{0} 秒", "{0} с"],
  pDeaths: ["Герой умер до драки и не вернулся к ней", "A hero died before a fight and was not back for it", "英雄在团战前阵亡且没能赶回", "Герой помер до бою й не повернувся до нього"],
  pDeathsKey: ["чем крупнее, тем дороже стоило", "bigger means it cost more", "越大代价越高", "чим більший, тим дорожче коштувало"],
  pDeathsNote: ["{0} раз за матч. Нажмите на героя, чтобы открыть драку.", "{0} times in the match. Click a hero to open the fight.", "全场 {0} 次。点击英雄打开团战。", "{0} разів за матч. Натисніть на героя, щоб відкрити бій."],
  pDeathsAria: ["{0} смертей до драк", "{0} deaths before fights", "团战前阵亡 {0} 次", "{0} смертей до боїв"],
  pDeathsT: ["{0}: умер до драки {1}", "{0}: died before the fight at {1}", "{0}：在 {1} 的团战前阵亡", "{0}: помер до бою {1}"],
  pFrame: ["Первая секунда драки {0}", "First second of the fight at {0}", "{0} 团战的第一秒", "Перша секунда бою {0}"],
  pFrameNote: ["{0}. Готовых ультов {1} против {2}, BKB {3} против {4}.", "{0}. Ultimates ready {1} vs {2}, BKB {3} vs {4}.", "{0}。就绪大招 {1} 对 {2}，BKB {3} 对 {4}。", "{0}. Готових ультів {1} проти {2}, BKB {3} проти {4}."],
  ofN: ["{0} из {1}", "{0} of {1}", "{0}/{1}", "{0} із {1}"],
  you3: ["вы", "you", "我方", "ви"],
  foe3: ["враг", "enemy", "敌方", "ворог"],
  // explain
  exAsk: ["Объясняет Crux", "Explained by Crux", "由 Crux 解释", "Пояснює Crux"],
  exWait: ["Читаем числа этой драки", "Reading the numbers of this fight", "正在读取这场团战的数据", "Читаємо числа цього бою"],
  exFail: ["Ответа нет: {0}", "No answer: {0}", "没有回答：{0}", "Відповіді немає: {0}"],
  exAgain: ["Спросить ещё раз", "Ask again", "再问一次", "Запитати ще раз"],
  exBy: ["Ответ Crux по числам этого матча", "Crux answer from this match's numbers", "Crux 根据本场数据回答", "Відповідь Crux за числами цього матчу"],
  // pop
  close: ["Закрыть", "Close", "关闭", "Закрити"],
  howCounted: ["Как это посчитано", "How this is counted", "如何计算", "Як це пораховано"],
  // replay player
  r_pause: ["Пауза", "Pause", "暂停", "Пауза"],
  r_play: ["Играть", "Play", "播放", "Грати"],
  r_band: ["Сама драка", "The fight itself", "团战本身", "Сам бій"],
  r_time: ["Время реплея", "Replay time", "回放时间", "Час реплею"],
  r_speed: ["Скорость", "Speed", "速度", "Швидкість"],
  r_soon: ["Начало драки через {0} с", "Fight starts in {0} s", "团战 {0} 秒后开始", "Початок бою через {0} с"],
  r_on: ["Драка идёт", "Fight in progress", "团战进行中", "Бій іде"],
  r_ult: ["ульт готов", "ult ready", "大招就绪", "ульт готовий"],
  r_bkb: ["BKB готов", "BKB ready", "BKB 就绪", "BKB готовий"],
  r_imm: ["иммунитет", "immune", "免疫", "імунітет"],
  r_ctrl: ["контроль", "disabled", "被控制", "контроль"],
  r_from: ["от начала драки", "from the fight start", "距团战开始", "від початку бою"],
  r_zoom: ["Масштаб карты", "Map zoom", "地图缩放", "Масштаб мапи"],
  r_near: ["К драке", "Fight", "团战", "До бою"],
  r_all: ["Вся карта", "Whole map", "全图", "Уся мапа"],
  r_map: ["Мини-реплей: позиции героев на карте по секундам", "Mini replay: hero positions on the map by second", "迷你回放：英雄每秒在地图上的位置", "Міні-реплей: позиції героїв на мапі по секундах"],
  r_mine: ["ваш", "yours", "我方", "ваш"],
  r_hp: ["здоровье {0}%", "health {0}%", "生命 {0}%", "здоров'я {0}%"],
  r_dead: ["погиб", "dead", "阵亡", "загинув"],
  // share
  share: ["Поделиться", "Share", "分享", "Поділитися"],
  shareH: ["Публичная ссылка на разбор", "Public link to this review", "分享这份复盘", "Публічне посилання на розбір"],
  shareNote: ["Любой, у кого есть ссылка, увидит этот разбор без входа, только для чтения. Чат и «Объясни» остаются у вас. В разбор не попадают ники и Steam ID. Ссылку можно отозвать в любой момент.", "Anyone with the link sees this review without signing in, read only. Chat and Explain stay with you. No player names or Steam IDs are in the review. You can revoke the link at any time.", "任何拿到链接的人无需登录即可只读查看这份复盘。问答和“解释”仅限你本人。复盘里没有玩家昵称或 Steam ID。你可以随时撤销链接。", "Будь-хто, у кого є посилання, побачить цей розбір без входу, лише для читання. Чат і «Поясни» лишаються у вас. У розбір не потрапляють ніки та Steam ID. Посилання можна відкликати будь-коли."],
  shareMake: ["Сделать публичную ссылку", "Make a public link", "生成公开链接", "Зробити публічне посилання"],
  shareCopy: ["Копировать ссылку", "Copy link", "复制链接", "Копіювати посилання"],
  shareCopied: ["Ссылка скопирована", "Link copied", "链接已复制", "Посилання скопійовано"],
  shareOff: ["Отозвать ссылку", "Revoke link", "撤销链接", "Відкликати посилання"],
  shareGone: ["Ссылка отозвана, по ней больше ничего не открывается.", "The link is revoked and opens nothing now.", "链接已撤销，不再能打开。", "Посилання відкликано, за ним більше нічого не відкривається."],
  shareDemo: ["Это демо-матч, он и так открыт всем. Скопируйте адрес страницы.", "This is a demo match, already open to everyone. Copy the page address.", "这是演示比赛，本来就对所有人开放。复制页面地址即可。", "Це демо-матч, він і так відкритий усім. Скопіюйте адресу сторінки."],
  shareFail: ["Не получилось: {0}", "That did not work: {0}", "没有成功：{0}", "Не вийшло: {0}"],
  sharedNote: ["Это публичный разбор, только для чтения. Чат и «Объясни» открываются после входа в Crux.", "This is a public, read-only review. Chat and Explain open after you sign in to Crux.", "这是公开的只读复盘。登录 Crux 后可使用问答和“解释”。", "Це публічний розбір, лише для читання. Чат і «Поясни» відкриваються після входу в Crux."],
  chatLogin: ["Чат с тренером открывается после входа в Crux и разбора своего матча.", "The coach chat opens after you sign in to Crux and analyse your own match.", "登录 Crux 并分析自己的比赛后即可使用教练问答。", "Чат із тренером відкривається після входу в Crux і розбору свого матчу."],
  // feedback
  fbQ: ["Этот блок полезен?", "Is this block useful?", "这个板块有用吗？", "Цей блок корисний?"],
  fbUp: ["Полезно", "Useful", "有用", "Корисно"],
  fbDown: ["Неправда", "Wrong", "不对", "Неправда"],
  fbWhat: ["Что не так? Необязательно, до 300 знаков", "What is off? Optional, up to 300 characters", "哪里不对？可不填，最多 300 字", "Що не так? Необов'язково, до 300 знаків"],
  fbSend: ["Отправить", "Send", "发送", "Надіслати"],
  fbThanks: ["Спасибо, мы это учтём.", "Thanks, we will use it.", "谢谢，我们会参考。", "Дякуємо, ми це врахуємо."],
  fbHow: ["Отзывы идут разработчикам и помогают проверять модель. Личные данные не собираются.", "Feedback goes to the developers and helps check the model. No personal data is collected.", "反馈会交给开发者，用于检验模型。不收集个人信息。", "Відгуки йдуть розробникам і допомагають перевіряти модель. Особисті дані не збираються."],
  // limits and errors (shown from server codes)
  e_pro: ["Это делает тренер Crux: он в Crux Pro за $3.99 в месяц, первая неделя бесплатно.", "This is done by the Crux coach: it is in Crux Pro, $3.99 a month, the first week free.", "这项由 Crux 教练完成：包含在 Crux Pro 中，每月 $3.99，首周免费。", "Це робить тренер Crux: він у Crux Pro за $3.99 на місяць, перший тиждень безкоштовно."],
  statsNote: ["Статистический разбор: числа движка без текста тренера. Текст тренера к своему матчу будет в Crux Pro или завтра: один разбор в день бесплатно.", "Statistical review: the engine's numbers without the coach's text. The coach's text for your match comes with Crux Pro, or tomorrow: one review a day is free.", "统计版复盘：引擎数据，没有教练文字。教练文字解读可在 Crux Pro 中获得，或明天再来：每天免费一次。", "Статистичний розбір: числа рушія без тексту тренера. Текст тренера до свого матчу буде в Crux Pro або завтра: один розбір на день безкоштовно."],
  demoNote: ["Демо-матч: так выглядит разбор Crux. Разберите свой матч по номеру или реплею.", "Demo match: this is what a Crux review looks like. Analyse your own match by its number or replay.", "演示比赛：这就是 Crux 复盘的样子。用比赛编号或录像分析你自己的比赛。", "Демо-матч: так виглядає розбір Crux. Розберіть свій матч за номером або реплеєм."],
  ownMatch: ["Разобрать свой матч", "Analyse my match", "分析我的比赛", "Розібрати свій матч"],
  getPro: ["Crux Pro", "Crux Pro", "Crux Pro", "Crux Pro"],
  chatPro: ["Чат с тренером по своему матчу есть в Crux Pro: $3.99 в месяц, первая неделя бесплатно. На демо-матче его можно попробовать.", "The coach chat about your own match is in Crux Pro: $3.99 a month, the first week free. You can try it on the demo match.", "关于你自己比赛的教练对话在 Crux Pro 中：每月 $3.99，首周免费。可以在演示比赛上试用。", "Чат із тренером по своєму матчу є в Crux Pro: $3.99 на місяць, перший тиждень безкоштовно. На демо-матчі його можна спробувати."],
  e_rate: ["Слишком много запросов. Подождите минуту.", "Too many requests. Wait a minute.", "请求太多，请等一分钟。", "Забагато запитів. Зачекайте хвилину."],
  e_day: ["Лимит на сегодня исчерпан. Завтра будет снова.", "Today's limit is used up. It resets tomorrow.", "今天的次数已用完，明天恢复。", "Ліміт на сьогодні вичерпано. Завтра буде знову."],
  e_budget: ["Бесплатные ответы тренера на сегодня разобраны: много новых игроков. Готовый разбор остаётся, а у Crux Pro свой запас ответов.", "Free coach answers are used up for today: lots of new players. The review stays, and Crux Pro has its own reserve of answers.", "今天的免费教练回答已用完：新玩家很多。复盘仍在，Crux Pro 有单独的回答额度。", "Безкоштовні відповіді тренера на сьогодні розібрали: багато нових гравців. Готовий розбір лишається, а в Crux Pro свій запас відповідей."],
  e_bad: ["Запрос не прошёл проверку.", "The request did not pass the check.", "请求未通过检查。", "Запит не пройшов перевірку."],
  e_down: ["Сервис ответов сейчас недоступен.", "The answer service is unavailable right now.", "回答服务暂时不可用。", "Сервіс відповідей зараз недоступний."],
  e_long: ["Вопрос длиннее 500 знаков, сократите его.", "The question is over 500 characters, shorten it.", "问题超过 500 个字符，请缩短。", "Питання довше за 500 знаків, скоротіть його."],
  e_net: ["Нет связи с сервером.", "No connection to the server.", "无法连接服务器。", "Немає зв'язку із сервером."],
  e_missing: ["Такого матча или элемента нет.", "There is no such match or element.", "没有这场比赛或这个元素。", "Такого матчу або елемента немає."],
  e_origin: ["Запрос пришёл не со страницы разбора.", "The request did not come from the review page.", "请求不是来自复盘页面。", "Запит прийшов не зі сторінки розбору."],
  // replay map labels
  evSmoke: ["смок", "smoke", "雾", "смок"],
  evTower: ["башня", "tower", "塔", "вежа"],
  evRax: ["бараки", "barracks", "兵营", "бараки"],
  evDeath: ["смерть", "death", "阵亡", "смерть"],
  // onboarding
  tourAgain: ["Как читать разбор", "How to read this", "如何阅读复盘", "Як читати розбір"],
  tourStep: ["{0} из {1}", "{0} of {1}", "{0} / {1}", "{0} із {1}"],
  tour1t: ["Твой матч", "Your match", "你的比赛", "Твій матч"],
  tour1: ["Сверху обе команды. Нажми на любого героя: роль, ульт, как он сыграл и его винрейт по рангам.", "Both teams are at the top. Click any hero for the role, ultimate, how he played and his win rate by rank.", "上方是双方队伍。点任意英雄，查看定位、大招、表现和各分段胜率。", "Зверху обидві команди. Натисни на будь-якого героя: роль, ульт, як він зіграв і його вінрейт за рангами."],
  tour2t: ["Почему проиграли", "Why you lost", "为什么输了", "Чому програли"],
  tour2: ["Главная причина одной фразой и картинка, которая показывает её на этом матче. Подчёркнутые слова объясняют себя, если навести или нажать.", "The main reason in one sentence and a chart that shows it in this match. Underlined words explain themselves on hover or tap.", "一句话说明主要原因，旁边的图展示本场的情况。带下划线的词，悬停或点击就能看到解释。", "Головна причина одним реченням і картинка, що показує її на цьому матчі. Підкреслені слова пояснюють себе, якщо навести або натиснути."],
  tour3t: ["Цена драки", "What a fight cost", "团战的代价", "Ціна бою"],
  tour3: ["74% → 37%: шанс победы до драки и после. Чем ниже второе число, тем дороже драка. Нажми, чтобы посмотреть её на миникарте.", "74% → 37%: the win chance before and after the fight. The lower the second number, the more the fight cost. Click to watch it on the minimap.", "74% → 37%：团战前后的胜率。第二个数字越低，这场团战代价越大。点击可在小地图上观看。", "74% → 37%: шанс перемоги до бою і після. Чим нижче друге число, тим дорожчий бій. Натисни, щоб подивитися його на мінікарті."],
  tour4t: ["Дальше по разбору", "The rest of the review", "复盘的其他部分", "Далі по розбору"],
  tour4: ["Драки по секундам, цепочка ошибок, твой герой и вопросы коучу. Значок ? у блока объясняет, что в нём.", "Fights second by second, the chain of mistakes, your hero and questions to the coach. The ? next to a block explains what it shows.", "逐秒团战、失误连锁、你的英雄和向教练提问。每个板块旁的 ? 会解释它展示了什么。", "Бої по секундах, ланцюжок помилок, твій герой і питання коучу. Значок ? біля блока пояснює, що в ньому."],
  tourSkip: ["Пропустить", "Skip", "跳过", "Пропустити"],
  tourNext: ["Дальше", "Next", "下一步", "Далі"],
  tourDone: ["Закрыть", "Close", "关闭", "Закрити"],
  tourGo: ["Понятно", "Got it", "知道了", "Зрозуміло"],
  // hero card
  hcUlt: ["Ульт:", "Ultimate:", "大招：", "Ульт:"],
  hcThrough: ["бьёт сквозь BKB", "goes through BKB", "无视BKB", "б'є крізь BKB"],
  hcRoles: ["Роли:", "Roles:", "定位：", "Ролі:"],
  hcCtrl: ["Контроль:", "Disables:", "控制：", "Контроль:"],
  hcFights: ["В трёх главных драках", "In the three main fights", "三场主要团战中", "У трьох головних боях"],
  hcIn: ["был жив к началу", "alive at the start", "开战时存活", "був живий на початок"],
  hcDead: ["был мёртв к началу", "dead at the start", "开战时已阵亡", "був мертвий на початок"],
  hcVs: ["против сильного игрока", "vs a strong player", "对比高分玩家", "проти сильного гравця"],
  vsShare: ["Доля в падении", "Share of the drop", "下滑占比", "Частка в падінні"],
  vsNote: ["Доля в падении: сколько шанса герой добавил или потерял в трёх главных драках по сравнению с сильным игроком той же позиции. Минус значит хуже.", "Share of the drop: how much chance the hero added or lost in the three main fights compared with a strong player of the same position. Minus means worse.", "下滑占比：与同位置高分玩家相比，该英雄在三场主要团战中增加或损失的胜率。负数表示更差。", "Частка в падінні: скільки шансу герой додав або втратив у трьох головних боях порівняно з сильним гравцем тієї самої позиції. Мінус означає гірше."],
  // chat
  chatHist: ["История вопросов", "Question history", "提问记录", "Історія питань"],
  chatMore: ["Спросить ещё", "Ask more", "继续提问", "Запитати ще"],
  chatTitle: ["Спроси про этот матч", "Ask about this match", "关于这场比赛提问", "Спитай про цей матч"],
  chatLead: ["Спрашивай как тиммейта: про драки, предметы, HP и ману в момент драки, варды, свою игру. Факты берутся из этого матча.", "Ask like you would a teammate: fights, items, HP and mana in a fight, wards, your own play. The facts come from this match.", "像问队友一样提问：团战、物品、团战时的血量和蓝量、守卫、你自己的打法。事实来自这场比赛。", "Питай як тімейта: про бійки, предмети, HP і ману під час бійки, варди, свою гру. Факти беруться з цього матчу."],
  chatYou: ["Вопрос", "Question", "问题", "Питання"],
  chatWait: ["Смотрим числа матча", "Reading the match numbers", "正在查看比赛数据", "Дивимось числа матчу"],
  chatBlocked: ["Здесь можно спросить только про этот матч.", "Here you can only ask about this match.", "这里只能问关于这场比赛的问题。", "Тут можна спитати лише про цей матч."],
  chatStopped: ["Ответ остановлен.", "Answer stopped.", "回答已停止。", "Відповідь зупинено."],
  chatLabel: ["Вопрос про матч", "Question about the match", "关于比赛的问题", "Питання про матч"],
  chatPh: ["Например: почему проиграли драку на базе?", "For example: why did we lose the fight at the base?", "例如：为什么在高地的团战输了？", "Наприклад: чому програли бій на базі?"],
  chatNew: ["Новый разговор", "New conversation", "新对话", "Нова розмова"],
  chatSend: ["Спросить", "Ask", "提问", "Запитати"],
  dockAsk: ["Спроси про этот матч", "Ask about this match", "问问这场比赛", "Запитай про цей матч"],
  dockSmall: ["Свернуть", "Minimize", "收起", "Згорнути"],
  dockBig: ["Развернуть", "Expand", "展开", "Розгорнути"],
  dockFull: ["Открыть целиком", "Open full view", "全屏打开", "Відкрити повністю"],
  chatLeft: ["На сегодня осталось около {0} слов чата", "About {0} chat words left today", "今天还剩约 {0} 个字的对话额度", "На сьогодні лишилося близько {0} слів чату"],
  tipFree: ["Общая цифра Dota, не из этого матча. Движок Crux её не проверял.", "A general Dota number, not from this match. The Crux engine did not check it.", "Dota 通用数字，不是这场比赛的数据，Crux 引擎没有核对。", "Загальна цифра Dota, не з цього матчу. Рушій Crux її не перевіряв."],
  tipTime: ["Что было на {0}", "What happened at {0}", "{0} 发生了什么", "Що було на {0}"],
  tipNoFight: ["Рядом с этим временем заметных драк нет.", "No notable fight near this time.", "这个时间附近没有明显的团战。", "Поруч із цим часом помітних боїв немає."],
  tipOpen: ["Открыть драку", "Open the fight", "打开团战", "Відкрити бій"],
  tipHero: ["{0}: уровень {1}, {2}, добито {3}, нетворс {4}", "{0}: level {1}, {2}, last hits {3}, net worth {4}", "{0}：等级 {1}，{2}，补刀 {3}，经济 {4}", "{0}: рівень {1}, {2}, добито {3}, нетворс {4}"],
  tipHas: ["В этом матче: {0}", "In this match: {0}", "这场比赛中：{0}", "У цьому матчі: {0}"],
  tipNobody: ["В этом матче его никто не собрал.", "Nobody built it in this match.", "这场比赛没人做这件装备。", "У цьому матчі його ніхто не зібрав."],
  probeThanks: ["Записал, спасибо. Это помогает Crux учиться понимать решения.", "Noted, thanks. This helps Crux learn how players decide.", "已记录，谢谢。这能帮助 Crux 理解玩家的决策。", "Записав, дякую. Це допомагає Crux вчитися розуміти рішення."],
  gQ: ["Кто заберёт эту драку?", "Who takes this fight?", "这波团战谁会赢？", "Хто забере цей бій?"],
  gStep: ["Драка {0} из {1}", "Fight {0} of {1}", "第 {0}/{1} 波", "Бій {0} з {1}"],
  gChance: ["шанс до драки {0}", "chance before {0}", "团战前胜率 {0}", "шанс до бою {0}"],
  gYou2: ["Точно мы", "Surely us", "我们稳赢", "Точно ми"],
  gYou1: ["Скорее мы", "Likely us", "大概我们", "Скоріше ми"],
  gFoe1: ["Скорее они", "Likely them", "大概对面", "Скоріше вони"],
  gFoe2: ["Точно они", "Surely them", "对面稳赢", "Точно вони"],
  gRight: ["Угадал.", "Right.", "猜对了。", "Вгадав."],
  gWrong: ["Мимо.", "Missed.", "猜错了。", "Не вгадав."],
  gWon: ["Драку забрали вы: шанс {0} → {1}.", "Your team took it: chance {0} → {1}.", "你们赢了：胜率 {0} → {1}。", "Бій забрали ви: шанс {0} → {1}."],
  gLost: ["Драку забрали они: шанс {0} → {1}.", "They took it: chance {0} → {1}.", "对面赢了：胜率 {0} → {1}。", "Бій забрали вони: шанс {0} → {1}."],
  gNext: ["Следующая", "Next", "下一波", "Наступний"],
  gEnd: ["Итог", "Result", "结果", "Підсумок"],
  gScore: ["Угадал {0} из {1}", "You read {0} of {1}", "猜对 {0}/{1}", "Вгадав {0} з {1}"],
  gWhy: ["Нажми на драку, чтобы посмотреть, что её решило.", "Tap a fight to see what decided it.", "点开团战，看是什么决定了结果。", "Натисни на бій, щоб побачити, що його вирішило."],
  gNone: ["В этом матче нет явных драк для угадайки.", "This match has no clear fights to guess.", "这场比赛没有可猜的团战。", "У цьому матчі немає явних боїв для вгадування."],
  gNote: ["Ответы без имени идут в разметку Crux: так модели учатся читать драки, как люди.", "Answers go, without your name, into Crux's labels: this is how the models learn to read fights like people.", "回答会匿名进入 Crux 的标注，帮助模型像人一样理解团战。", "Відповіді без імені йдуть у розмітку Crux: так моделі вчаться читати бої, як люди."],
  probeNote: ["Ответ без имени идёт в разметку Crux.", "Your answer goes, without your name, into Crux's labels.", "你的回答会匿名进入 Crux 的标注。", "Відповідь без імені йде в розмітку Crux."],
  privacy: ["Конфиденциальность", "Privacy", "隐私", "Конфіденційність"],
  probeOwn: ["Ответить своими словами", "Answer in your own words", "用自己的话回答", "Відповісти своїми словами"],
  heroAtDead: ["мёртв", "dead", "已阵亡", "мертвий"],
  heroAtNone: ["На это время позиций нет.", "No positions for this time.", "这个时间没有位置数据。", "На цей час позицій немає."],
  e_words: ["Лимит чата на сегодня исчерпан. Завтра он обновится, в Crux Pro он в 12 раз больше.", "Today's chat limit is used up. It resets tomorrow; Crux Pro has 12 times more.", "今天的对话额度已用完，明天重置；Crux Pro 的额度是 12 倍。", "Ліміт чату на сьогодні вичерпано. Завтра він оновиться, у Crux Pro він у 12 разів більший."],
  chatNote: ["Отвечает тренер Crux по числам движка. Числа из матча сверены с ним, общие цифры Dota подчёркнуты пунктиром.", "The Crux coach answers from the engine's numbers. Match numbers are checked against the match; general Dota numbers are underlined with dots.", "由 Crux 教练根据引擎数据回答。比赛数字已核对，Dota 通用数字用虚线标出。", "Відповідає тренер Crux за числами рушія. Числа з матчу звірено з ним, загальні цифри Dota підкреслено пунктиром."],
  chatSugs: ["Вопросы по этому матчу", "Questions about this match", "关于这场比赛的问题", "Питання по цьому матчу"],
  qWhy: ["Почему мы проиграли этот матч?", "Why did we lose this match?", "我们为什么输了这场比赛？", "Чому ми програли цей матч?"],
  qWhyW: ["Где мы теряли шанс, хотя выиграли?", "Where did we lose chance even though we won?", "虽然赢了，我们在哪里丢了胜率？", "Де ми втрачали шанс, хоч і виграли?"],
  qFight: ["Что пошло не так в драке на {0}?", "What went wrong in the fight at {0}?", "{0} 的团战哪里出了问题？", "Що пішло не так у бою на {0}?"],
  qHero: ["Где {0} мог сыграть лучше?", "Where could {0} have played better?", "{0} 哪里可以打得更好？", "Де {0} міг зіграти краще?"],
  qBkb: ["Как BKB решили драки?", "How did BKB decide the fights?", "BKB 是怎么决定团战的？", "Як BKB вирішили бої?"],
  qDeaths: ["Кто умирал до драк и не успевал вернуться?", "Who died before fights and was not back in time?", "谁在团战前阵亡又没赶回来？", "Хто помирав до боїв і не встигав повернутися?"],
  qVision: ["Почему мы не видели врагов?", "Why did we not see the enemies?", "为什么我们看不到敌人？", "Чому ми не бачили ворогів?"],
  qNewbie: ["Объясни как новичку: что решило матч?", "Explain like I am new: what decided the match?", "像给新手讲一样：什么决定了比赛？", "Поясни як новачку: що вирішило матч?"],
} satisfies Record<string, W>;

export type Key = keyof typeof W;
const IDX: Record<Exclude<Lang, "es">, number> = { ru: 0, en: 1, zh: 2, uk: 3 };

/** A string in the current language; {0}, {1} take the arguments. */
export function t(k: Key, ...a: (string | number)[]) {
  const s = cur === "es" ? ES[k] : (W[k] as W)[IDX[cur]] ?? (W[k] as W)[0];
  return a.length ? s.replace(/\{(\d)\}/g, (_, i) => String(a[Number(i)] ?? "")) : s;
}
/** The same string in a given language (server side, prompts). */
export const tIn = (l: Lang, k: Key) => (l === "es" ? ES[k] : (W[k] as W)[IDX[l]]);

/** Russian and Ukrainian write 4,2 and 12,3к; Spanish writes 4,2 like Russian; English and Chinese write 4.2 and 12.3k. */
export const dec = (x: number, dd = 1) => {
  const s = x.toFixed(dd).replace("-", "−");
  return cur === "ru" || cur === "uk" || cur === "es" ? s.replace(".", ",") : s;
};
export const kUnit = () => (cur === "ru" || cur === "uk" ? "к" : "k");

export const ROLES: Record<Lang, string[]> = {
  ru: ["", "керри", "мид", "оффлейн", "саппорт 4", "саппорт 5"],
  en: ["", "carry", "mid", "offlane", "support 4", "support 5"],
  zh: ["", "1号位", "2号位", "3号位", "4号位", "5号位"],
  uk: ["", "керрі", "мід", "оффлейн", "саппорт 4", "саппорт 5"],
  es: ["", "carry", "mid", "offlane", "support 4", "support 5"],
};
export const role = (r: number) => ROLES[cur][r] ?? "";

const CONCEPTS: Record<string, W> = {
  ult: ["ульты", "ultimates", "大招", "ульти"],
  bkb: ["BKB", "BKB", "BKB", "BKB"],
  revive: ["возрождение и байбек", "respawn and buyback", "复活和买活", "відродження та байбек"],
  reinforce: ["подкрепление и приход", "reinforcements and arrival", "支援和到场", "підкріплення та прихід"],
  vision: ["обзор", "vision", "视野", "огляд"],
  resources: ["золото, уровни, здоровье", "gold, levels, health", "经济、等级、血量", "золото, рівні, здоров'я"],
  status: ["контроль в первую секунду", "disables at the first second", "第一秒的控制", "контроль у першу секунду"],
  intent: ["чем были заняты перед дракой", "what heroes were doing before the fight", "团战前在做什么", "чим були зайняті перед боєм"],
  init: ["смок и урон до драки", "smoke and damage before the fight", "开雾和团战前的伤害", "смок і шкода до бою"],
};
const CONCEPTS_ES: Record<string, string> = {
  ult: "ultis", bkb: "BKB", revive: "reaparición y buyback", reinforce: "refuerzos y llegada", vision: "visión",
  resources: "oro, niveles, vida", status: "control en el primer segundo", intent: "qué hacían antes de la pelea", init: "humo y daño antes de la pelea",
};
export const concept = (k: string) => (CONCEPTS[k] ? (cur === "es" ? CONCEPTS_ES[k] : CONCEPTS[k][IDX[cur]]) : k);

/** Habit labels of the data, by key. */
const HABITS: Record<string, W> = {
  lh_pm: ["добивания крипов в минуту, 10–20 мин", "last hits per minute, 10 to 20 min", "第 10–20 分钟每分钟正补", "ласт-хіти в хвилину, 10–20 хв"],
  deaths: ["смертей в минуту, 0–10 мин", "deaths per minute, 0 to 10 min", "第 0–10 分钟每分钟死亡", "смертей за хвилину, 0–10 хв"],
  wards: ["вардов команды в минуту", "team wards per minute", "全队每分钟守卫数", "вардів команди за хвилину"],
};
const HABITS_ES: Record<string, string> = {
  lh_pm: "last hits por minuto, minutos 10 a 20", deaths: "muertes por minuto, minutos 0 a 10", wards: "guardianes del equipo por minuto",
};
export const habitLabel = (key: string, ru: string) => (cur === "ru" || !HABITS[key] ? ru : cur === "es" ? HABITS_ES[key] : HABITS[key][IDX[cur]]);
