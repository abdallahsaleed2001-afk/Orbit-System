import { recordGameResult } from './gameStatsService.js';

const GAME = 'flags';
const ROUND_TTL_MS = 20_000;
const activeRounds = new Map();

const FLAGS = [
  ['🇸🇦', ['السعودية', 'السعوديه', 'saudi arabia', 'ksa']],
  ['🇯🇴', ['الأردن', 'الاردن', 'jordan']],
  ['🇦🇪', ['الإمارات', 'الامارات', 'uae', 'united arab emirates']],
  ['🇰🇼', ['الكويت', 'kuwait']],
  ['🇶🇦', ['قطر', 'qatar']],
  ['🇧🇭', ['البحرين', 'bahrain']],
  ['🇴🇲', ['عمان', 'سلطنة عمان', 'oman']],
  ['🇪🇬', ['مصر', 'egypt']],
  ['🇮🇶', ['العراق', 'iraq']],
  ['🇸🇾', ['سوريا', 'سورية', 'syria']],
  ['🇱🇧', ['لبنان', 'lebanon']],
  ['🇵🇸', ['فلسطين', 'palestine']],
  ['🇾🇪', ['اليمن', 'yemen']],
  ['🇱🇾', ['ليبيا', 'libya']],
  ['🇹🇳', ['تونس', 'tunisia']],
  ['🇩🇿', ['الجزائر', 'algeria']],
  ['🇲🇦', ['المغرب', 'morocco']],
  ['🇸🇩', ['السودان', 'sudan']],
  ['🇸🇴', ['الصومال', 'somalia']],
  ['🇩🇯', ['جيبوتي', 'djibouti']],
  ['🇲🇷', ['موريتانيا', 'mauritania']],
  ['🇰🇲', ['جزر القمر', 'comoros']],
  ['🇹🇷', ['تركيا', 'turkey']],
  ['🇮🇷', ['إيران', 'ايران', 'iran']],
  ['🇮🇱', ['إسرائيل', 'اسرائيل', 'israel']],
  ['🇩🇪', ['ألمانيا', 'المانيا', 'germany']],
  ['🇫🇷', ['فرنسا', 'france']],
  ['🇮🇹', ['إيطاليا', 'ايطاليا', 'italy']],
  ['🇪🇸', ['إسبانيا', 'اسبانيا', 'spain']],
  ['🇵🇹', ['البرتغال', 'portugal']],
  ['🇬🇷', ['اليونان', 'greece']],
  ['🇳🇱', ['هولندا', 'netherlands', 'holland']],
  ['🇧🇪', ['بلجيكا', 'belgium']],
  ['🇨🇭', ['سويسرا', 'switzerland']],
  ['🇦🇹', ['النمسا', 'austria']],
  ['🇸🇪', ['السويد', 'sweden']],
  ['🇳🇴', ['النرويج', 'norway']],
  ['🇩🇰', ['الدنمارك', 'denmark']],
  ['🇫🇮', ['فنلندا', 'finland']],
  ['🇮🇪', ['ايرلندا', 'إيرلندا', 'ireland']],
  ['🇬🇧', ['بريطانيا', 'المملكة المتحدة', 'uk', 'united kingdom']],
  ['🇺🇸', ['أمريكا', 'امريكا', 'الولايات المتحدة', 'usa', 'united states']],
  ['🇨🇦', ['كندا', 'canada']],
  ['🇲🇽', ['المكسيك', 'mexico']],
  ['🇧🇷', ['البرازيل', 'brazil']],
  ['🇦🇷', ['الأرجنتين', 'الارجنتين', 'argentina']],
  ['🇨🇱', ['تشيلي', 'chile']],
  ['🇨🇴', ['كولومبيا', 'colombia']],
  ['🇵🇪', ['بيرو', 'peru']],
  ['🇺🇾', ['أوروغواي', 'اوروجواي', 'uruguay']],
  ['🇵🇾', ['باراغواي', 'باراجواي', 'paraguay']],
  ['🇯🇵', ['اليابان', 'japan']],
  ['🇨🇳', ['الصين', 'china']],
  ['🇰🇷', ['كوريا الجنوبية', 'south korea']],
  ['🇰🇵', ['كوريا الشمالية', 'north korea']],
  ['🇮🇳', ['الهند', 'india']],
  ['🇵🇰', ['باكستان', 'pakistan']],
  ['🇧🇩', ['بنغلاديش', 'بنجلاديش', 'bangladesh']],
  ['🇦🇫', ['أفغانستان', 'افغانستان', 'afghanistan']],
  ['🇮🇩', ['إندونيسيا', 'اندونيسيا', 'indonesia']],
  ['🇲🇾', ['ماليزيا', 'malaysia']],
  ['🇸🇬', ['سنغافورة', 'singapore']],
  ['🇹🇭', ['تايلاند', 'تايلند', 'thailand']],
  ['🇻🇳', ['فيتنام', 'vietnam']],
  ['🇵🇭', ['الفلبين', 'philippines']],
  ['🇦🇺', ['أستراليا', 'استراليا', 'australia']],
  ['🇳🇿', ['نيوزيلندا', 'new zealand']],
  ['🇷🇺', ['روسيا', 'russia']],
  ['🇺🇦', ['أوكرانيا', 'ukraine']],
  ['🇵🇱', ['بولندا', 'poland']],
  ['🇨🇿', ['التشيك', 'جمهورية التشيك', 'czech republic', 'czechia']],
  ['🇷🇴', ['رومانيا', 'romania']],
  ['🇭🇺', ['المجر', 'هنغاريا', 'hungary']],
  ['🇧🇬', ['بلغاريا', 'bulgaria']],
  ['🇭🇷', ['كرواتيا', 'croatia']],
  ['🇷🇸', ['صربيا', 'serbia']],
  ['🇸🇰', ['سلوفاكيا', 'slovakia']],
  ['🇸🇮', ['سلوفينيا', 'slovenia']],
  ['🇧🇦', ['البوسنة', 'البوسنة والهرسك', 'bosnia', 'bosnia and herzegovina']],
  ['🇦🇱', ['ألبانيا', 'البانيا', 'albania']],
  ['🇲🇰', ['مقدونيا الشمالية', 'north macedonia']],
  ['🇮🇸', ['آيسلندا', 'ايسلندا', 'iceland']],
  ['🇱🇺', ['لوكسمبورغ', 'luxembourg']],
  ['🇲🇹', ['مالطا', 'malta']],
  ['🇨🇾', ['قبرص', 'cyprus']],
  ['🇮🇱', ['إسرائيل', 'اسرائيل', 'israel']],
  ['🇰🇿', ['كازاخستان', 'kazakhstan']],
  ['🇺🇿', ['أوزبكستان', 'اوزبكستان', 'uzbekistan']],
  ['🇦🇿', ['أذربيجان', 'اذربيجان', 'azerbaijan']],
  ['🇬🇪', ['جورجيا', 'georgia']],
  ['🇦🇲', ['أرمينيا', 'ارمينيا', 'armenia']],
  ['🇲🇳', ['منغوليا', 'mongolia']],
  ['🇳🇵', ['نيبال', 'nepal']],
  ['🇱🇰', ['سريلانكا', 'sri lanka']],
  ['🇧🇹', ['بوتان', 'bhutan']],
  ['🇲🇻', ['المالديف', 'maldives']],
  ['🇿🇦', ['جنوب أفريقيا', 'جنوب افريقيا', 'south africa']],
  ['🇳🇬', ['نيجيريا', 'nigeria']],
  ['🇰🇪', ['كينيا', 'kenya']],
  ['🇪🇹', ['إثيوبيا', 'اثيوبيا', 'ethiopia']],
  ['🇬🇭', ['غانا', 'ghana']],
  ['🇹🇿', ['تنزانيا', 'tanzania']],
  ['🇺🇬', ['أوغندا', 'اوغندا', 'uganda']],
  ['🇿🇼', ['زيمبابوي', 'zimbabwe']],
  ['🇿🇲', ['زامبيا', 'zambia']],
  ['🇷🇼', ['رواندا', 'rwanda']],
  ['🇨🇲', ['الكاميرون', 'cameroon']],
  ['🇸🇳', ['السنغال', 'senegal']],
  ['🇨🇮', ['ساحل العاج', 'كوت ديفوار', 'ivory coast', 'cote divoire']],
  ['🇲🇱', ['مالي', 'mali']],
  ['🇳🇪', ['النيجر', 'niger']],
  ['🇹🇩', ['تشاد', 'chad']],
  ['🇨🇩', ['الكونغو الديمقراطية', 'جمهورية الكونغو الديمقراطية', 'dr congo']],
  ['🇨🇬', ['الكونغو', 'جمهورية الكونغو', 'republic of congo']],
  ['🇲🇬', ['مدغشقر', 'madagascar']],
  ['🇲🇺', ['موريشيوس', 'mauritius']],
  ['🇸🇨', ['سيشل', 'seychelles']],
  ['🇳🇦', ['ناميبيا', 'namibia']],
  ['🇧🇼', ['بوتسوانا', 'botswana']],
  ['🇲🇿', ['موزمبيق', 'mozambique']],
  ['🇦🇴', ['أنغولا', 'انغولا', 'angola']],
  ['🇸🇸', ['جنوب السودان', 'south sudan']],
  ['🇨🇺', ['كوبا', 'cuba']],
  ['🇩🇴', ['جمهورية الدومينيكان', 'dominican republic']],
  ['🇯🇲', ['جامايكا', 'jamaica']],
  ['🇭🇹', ['هايتي', 'haiti']],
  ['🇵🇦', ['بنما', 'panama']],
  ['🇨🇷', ['كوستاريكا', 'costa rica']],
  ['🇬🇹', ['غواتيمالا', 'جواتيمالا', 'guatemala']],
  ['🇭🇳', ['هندوراس', 'honduras']],
  ['🇳🇮', ['نيكاراغوا', 'nicaragua']],
  ['🇸🇻', ['السلفادور', 'el salvador']],
  ['🇧🇴', ['بوليفيا', 'bolivia']],
  ['🇪🇨', ['الإكوادور', 'الاكوادور', 'ecuador']],
  ['🇻🇪', ['فنزويلا', 'venezuela']],
  ['🇬🇾', ['غيانا', 'guyana']],
  ['🇸🇷', ['سورينام', 'suriname']],
  ['🇫🇯', ['فيجي', 'fiji']],
  ['🇵🇬', ['بابوا غينيا الجديدة', 'papua new guinea']],
  ['🇸🇧', ['جزر سليمان', 'solomon islands']],
  ['🇻🇺', ['فانواتو', 'vanuatu']],
  ['🇼🇸', ['ساموا', 'samoa']],
  ['🇹🇴', ['تونغا', 'tonga']],
  ['🇵🇼', ['بالاو', 'palau']],
  ['🇲🇭', ['جزر مارشال', 'marshall islands']],
  ['🇫🇲', ['ميكرونيسيا', 'micronesia']],
  ['🇰🇮', ['كيريباتي', 'kiribati']],
  ['🇳🇷', ['ناورو', 'nauru']],
  ['🇹🇻', ['توفالو', 'tuvalu']],
  ['🇸🇲', ['سان مارينو', 'san marino']],
  ['🇻🇦', ['الفاتيكان', 'vatican city']],
  ['🇲🇨', ['موناكو', 'monaco']],
  ['🇱🇮', ['ليختنشتاين', 'liechtenstein']],
  ['🇦🇩', ['أندورا', 'اندورا', 'andorra']],
  ['🇲🇪', ['الجبل الأسود', 'مونتينيغرو', 'montenegro']],
  ['🇲🇩', ['مولدوفا', 'moldova']],
  ['🇧🇾', ['بيلاروسيا', 'روسيا البيضاء', 'belarus']],
  ['🇱🇹', ['ليتوانيا', 'lithuania']],
  ['🇱🇻', ['لاتفيا', 'latvia']],
  ['🇪🇪', ['إستونيا', 'استونيا', 'estonia']],
  ['🇧🇸', ['جزر البهاما', 'bahamas']],
  ['🇧🇧', ['بربادوس', 'barbados']],
  ['🇹🇹', ['ترينيداد وتوباغو', 'trinidad and tobago']],
  ['🇧🇿', ['بليز', 'belize']],
  ['🇬🇩', ['غرينادا', 'grenada']],
  ['🇱🇨', ['سانت لوسيا', 'saint lucia']],
  ['🇻🇨', ['سانت فنسنت والغرينادين', 'saint vincent and the grenadines']],
  ['🇦🇬', ['أنتيغوا وبربودا', 'antigua and barbuda']],
  ['🇩🇲', ['دومينيكا', 'dominica']],
  ['🇰🇳', ['سانت كيتس ونيفيس', 'saint kitts and nevis']],
  ['🇸🇷', ['سورينام', 'suriname']],
  ['🇹🇱', ['تيمور الشرقية', 'east timor', 'timor leste']],
  ['🇧🇳', ['بروناي', 'brunei']],
  ['🇱🇦', ['لاوس', 'laos']],
  ['🇰🇭', ['كمبوديا', 'cambodia']],
  ['🇲🇲', ['ميانمار', 'بورما', 'myanmar', 'burma']],
  ['🇵🇷', ['بورتوريكو', 'puerto rico']],
];

function normalize(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ـ/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isCorrectAnswer(content, answers) {
  const answer = normalize(content);
  return answers.some(value => normalize(value) === answer);
}

function key(guildId, channelId) {
  return `${guildId}:${channelId}`;
}

function randomFlag() {
  return FLAGS[Math.floor(Math.random() * FLAGS.length)];
}

export function getFlags(guildId, channelId) {
  return activeRounds.get(key(guildId, channelId)) || null;
}

export function startFlags(guildId, channelId) {
  const stateKey = key(guildId, channelId);
  if (activeRounds.has(stateKey)) return { error: 'active' };

  const [flag, answers] = randomFlag();
  const round = { flag, answers, startedAt: Date.now() };
  activeRounds.set(stateKey, round);

  setTimeout(() => {
    const current = activeRounds.get(stateKey);
    if (current !== round) return;
    activeRounds.delete(stateKey);
  }, ROUND_TTL_MS);

  return { round, prompt: `## 🏳️ لعبة الأعلام\n\n# ${flag}\n\n**أول شخص يكتب اسم الدولة يفوز!**\n⏱️ لديك **20 ثانية**.` };
}

export async function handleFlagsMessage(message) {
  if (!message.guild || message.author.bot) return false;
  const stateKey = key(message.guild.id, message.channel.id);
  const round = activeRounds.get(stateKey);
  if (!round) return false;

  if (Date.now() - round.startedAt > ROUND_TTL_MS) {
    activeRounds.delete(stateKey);
    return false;
  }

  if (!isCorrectAnswer(message.content, round.answers)) return false;

  activeRounds.delete(stateKey);
  await recordGameResult(message.guild.id, GAME, [message.author.id], []);
  await message.channel.send(`🏆 ${message.author} **أجاب بشكل صحيح!**`).catch(() => {});
  return true;
}

export function stopFlags(guildId, channelId) {
  return activeRounds.delete(key(guildId, channelId));
}
