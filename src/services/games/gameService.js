import { logger } from '../../utils/logger.js';

const GAME_TTL_MS = 20_000;
const activeGames = new Map();

const WORDS = {
  easy: ['بيت','باب','قلم','كتاب','شمس','قمر','بحر','نهر','ورد','ماء','خبز','تفاح','موز','كرسي','طاولة','مدرسة','سيارة','هاتف','ساعة','شجرة','حجر','طير','سمك','ليل','نهار','صوت','نور','جبل','طريق','شارع','حديقة','نافذة','غرفة','ملعب','كرة','مفتاح','حقيبة','دفتر','قهوة'],
  medium: ['مكتبة','مستشفى','طائرة','قطار','حاسوب','مزرعة','مطار','مغارة','مظلة','مرآة','سفينة','جزيرة','صحراء','مدينة','قرية','جامعة','مسرح','مخبز','صيدلية','مطعم','مغسلة','مسبح','مركبة','دراجة','حافلة','مصباح','بطارية','شاحن','سماعة','خريطة','مقعد','سبورة','ممحاة','مقص','مجلد','مفكرة','مغناطيس','بوصلة','مخدة','ستارة'],
  hard: ['استكشاف','مغامرة','معلوماتية','استراتيجية','مستقبل','تكنولوجيا','ابتكار','مخترع','مكتشف','جغرافيا','برمجة','اتصالات','مستودع','مختبر','منظار','ميكروسكوب','كهرباء','إلكترونيات','روبوت','فضاء','مجرة','كوكب','بركان','زلزال','محيطات','ديناصور','فراشة','سلحفاة','تمساح','ببغاء','مخطوطة','حضارة','تاريخ','فلسفة','هندسة','معمار','اقتصاد','موسيقى','مسرحية','اكتشاف'],
};
const CONNECT_WORDS = {
  easy: ['مدرسة','سيارة','شجرة','نافذة','حديقة','كتاب','حقيبة','مفتاح','قلم','هاتف','طاولة','كرسي','قمر','شمس','بحر','نهر','جبل','طريق','وردة','تفاحة','موزة','ساعة','باب','غرفة','ملعب','كرة','مطر','سحاب','نجم','بيت'],
  medium: ['مكتبة','مستشفى','طائرة','حاسوب','سفينة','جزيرة','مطار','جامعة','مسرح','مزرعة','صيدلية','مطعم','مركبة','دراجة','حافلة','مصباح','بطارية','شاحن','سماعة','خريطة','بوصلة','مغناطيس','مظلة','مرآة','مسبح','مخبز','مغسلة','سبورة','مقص','مجلد'],
  hard: ['استراتيجية','تكنولوجيا','ابتكار','استكشاف','معلوماتية','إلكترونيات','ميكروسكوب','مخطوطة','حضارة','جغرافيا','اقتصاد','فلسفة','هندسة','معمار','اتصالات','روبوت','مجرة','محيطات','ديناصور','بركان','زلزال','مستقبل','مستودع','منظار','مخترع','مكتشف','مسرحية','موسيقى','مغامرة','برمجة'],
};
const GIRL_NAMES = ['آمنة','آية','آلاء','آمال','إسراء','إيمان','ابتسام','ابتهال','أبرار','أروى','أريج','أسماء','أفنان','أميرة','أنفال','أنوار','إلهام','بتول','بسمة','بيان','جنى','جود','جوري','حنان','حنين','حلا','حور','خديجة','دانية','دعاء','دلال','رنا','ريم','ريما','رزان','رغد','رانيا','رؤى','سارة','سلمى','سما','سمر','سندس','شذى','صفاء','ضحى','عبير','عائشة','علا','غادة','غفران','فرح','فاطمة','لجين','ليان','ليلى','لارا','لمى','لينا','ميس','مريم','ملك','منار','مها','مي','نادية','ندى','نور','نهى','هبة','هدى','هند','يارا','ياسمين','يقين','زينب','زهراء','زينة','ربى','رقية','روان','سمية','شيماء','صبا','عهد','غالية','كوثر','كرمة','لبنى','ميساء','مودة','نوال','وفاء','وسام','ولاء','هيا','هناء','جمانة','تالا','تالين','تمارا','دانة','سجى','سهاد','شروق','صفية','لانا','لارين','ليال','ميرا','ميرال','نورا','رلى'];
const BOY_NAMES = ['آدم','أحمد','إبراهيم','إياد','إياس','إيهاب','إسلام','إسماعيل','أنس','أيمن','أمين','باسم','بدر','براء','بلال','بشير','تامر','ثامر','جاد','جاسم','جلال','جمال','حاتم','حازم','حسام','حسن','حسين','حمزة','خالد','خليل','رامي','راشد','رائد','ريان','زياد','زيد','سامر','سامي','سعد','سالم','سلمان','سيف','شادي','شاهر','صالح','طارق','طلال','عادل','عامر','عبدالله','عبدالرحمن','عبدالعزيز','عثمان','عمر','علي','عيسى','غسان','فارس','فهد','فواز','فيصل','كريم','كمال','مازن','مالك','ماهر','محمد','محمود','مراد','مصعب','معاذ','منصور','مهند','نايف','نبيل','ناصر','نادر','نبراس','هادي','هاني','هيثم','وائل','وليد','ياسر','يحيى','يزن','يوسف','يونس','زاهر','سامح','شريف','شوقي','صفوان','ضياء','ظافر','عمار','عدي','علاء','غالب','فادي','قاسم','قصي','كنان','لؤي','ليث','مروان','معتز','موسى','نواف','وسيم','وضاح','ياسين','سراج','سفيان','سعيد','شهاب','طه','عاصم','عماد','كاظم','هشام','همام'];
const OBJECTS = ['باب','بيت','كتاب','قلم','كرسي','طاولة','هاتف','حاسوب','شاحن','سماعة','مفتاح','ساعة','حقيبة','دفتر','ممحاة','مسطرة','مقص','مرآة','نافذة','مصباح','سرير','وسادة','بطانية','خزانة','ثلاجة','فرن','ملعقة','شوكة','سكين','كوب','صحن','زجاجة','مظلة','حذاء','قميص','بنطال','قبعة','حزام','سيارة','دراجة','حافلة','قطار','طائرة','سفينة','كرة','مضرب','شبكة','مجلة','جريدة','لوحة','صورة','فرشاة','قفل','سجادة','ستارة','مروحة','تلفاز','راديو','كاميرا','ميكروفون','بطارية','مغناطيس','بوصلة','خريطة','منظار','عدسة','مطرقة','مسمار','مفك','منشار','حبل','صندوق','سلة','ورقة','بطاقة','عملة','خاتم','سوار','قلادة','شمعة','ولاعة','منبه','حاسبة','طابعة','شاشة','فأرة','ذاكرة','قرص','كابل','شريط','علبة','مرطبان','ملقط','إبرة','خيط','إبريق','قدر','مقلاة','مغرفة','صينية','مصفاة','مبرد','مظروف','طابع','ألوان','مجلد','دباسة','مشبك'];
const ARABIC_LETTERS = ['ا','ب','ت','ث','ج','ح','خ','د','ذ','ر','ز','س','ش','ص','ض','ط','ظ','ع','غ','ف','ق','ك','ل','م','ن','ه','و','ي'];

function normalize(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[ًٌٍَُِّْـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/[^\u0621-\u063A\u0641-\u064A0-9]/g, '');
}
function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
function pickDifficulty() { return pick(['easy', 'medium', 'hard']); }
function weightedWord(bank) { const difficulty = pickDifficulty(); return { word: pick(bank[difficulty]), difficulty }; }
function key(guildId, channelId) { return `${guildId}:${channelId}`; }

export function startGame(guildId, channelId, type) {
  const k = key(guildId, channelId);
  if (activeGames.has(k)) return { error: 'active' };
  let game;
  if (type === 'fakk') {
    const selected = weightedWord(WORDS);
    game = { type, answer: normalize(selected.word), display: selected.word, difficulty: selected.difficulty, prompt: `🔤 **فكك الكلمة:** \`${selected.word}\`` };
  } else if (type === 'ashbak') {
    const selected = weightedWord(CONNECT_WORDS);
    game = { type, answer: normalize(selected.word), display: selected.word, difficulty: selected.difficulty, prompt: `🔗 **اشبك الحروف:** \`${[...selected.word].join(' ')}\`\nأول شخص يكتب الكلمة كاملة يفوز!` };
  } else if (type === 'asra') {
    const selected = weightedWord(WORDS);
    game = { type, answer: normalize(selected.word), display: selected.word, difficulty: selected.difficulty, prompt: `⚡ **أسرع!**\nاكتب الكلمة التالية بأسرع ما تستطيع: **${selected.word}**` };
  } else if (type === 'ism') {
    const category = pick(['girl','boy','object']);
    const labels = { girl: 'اسم بنت', boy: 'اسم ولد', object: 'جماد' };
    const list = category === 'girl' ? GIRL_NAMES : category === 'boy' ? BOY_NAMES : OBJECTS;
    const letter = pick(ARABIC_LETTERS);
    game = { type, category, answerLetter: letter, prompt: `🎯 **${labels[category]}**\nالحرف: **${letter}**\nأول شخص يكتب ${labels[category]} يبدأ بهذا الحرف يفوز!`, dictionary: new Set(list.map(normalize)) };
  } else if (type === 'hisab') {
    const a = Math.floor(Math.random() * 30) + 5; const b = Math.floor(Math.random() * 20) + 2; const op = pick(['+','-','×']);
    const answer = op === '+' ? a + b : op === '-' ? a - b : a * b;
    game = { type, answer: String(answer), prompt: `🧮 **احسب بسرعة:** \`${a} ${op} ${b}\`\nأول إجابة صحيحة تفوز!` };
  } else if (type === 'ratib') {
    const selected = weightedWord(WORDS); const chars = [...selected.word];
    for (let i = chars.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [chars[i], chars[j]] = [chars[j], chars[i]]; }
    game = { type, answer: normalize(selected.word), display: selected.word, prompt: `🔀 **رتب الحروف:** \`${chars.join(' ')}\`\nما الكلمة؟` };
  } else if (type === 'aks') {
    const selected = weightedWord(WORDS); game = { type, answer: normalize([...selected.word].reverse().join('')), display: selected.word, prompt: `↩️ **اعكس الكلمة:** \`${selected.word}\`\nاكتبها بالعكس!` };
  } else if (type === 'harf') {
    const letter = pick(ARABIC_LETTERS); game = { type, letter, prompt: `🔠 **تحدي الحرف**\nأول شخص يكتب كلمة تبدأ بحرف **${letter}** يفوز!` };
  } else if (type === 'mokhtalef') {
    const groups = [['تفاح','موز','برتقال','سيارة'],['قلم','دفتر','كتاب','موز'],['سيارة','حافلة','قطار','تفاحة'],['أحمر','أزرق','أخضر','كتاب']];
    const group = pick(groups); const odd = group[group.length - 1];
    game = { type, answer: normalize(odd), prompt: `🕵️ **مختلف!**\nأي كلمة مختلفة؟\n${group.map((x,i)=>`${i+1}. ${x}`).join('  ')}` };
  } else if (type === 'thakira') {
    const sequence = Array.from({ length: 5 }, () => Math.floor(Math.random() * 10)).join('');
    game = { type, answer: sequence, prompt: `🧠 **ذاكرة!**\nاحفظ الرقم: **${sequence}**\nسيختفي خلال ثانيتين...` };
  } else return { error: 'unknown' };
  game.startedAt = Date.now(); game.expiresAt = Date.now() + GAME_TTL_MS; activeGames.set(k, game); return game;
}

export function getActiveGame(guildId, channelId) { return activeGames.get(key(guildId, channelId)) || null; }
export function cancelGame(guildId, channelId) { activeGames.delete(key(guildId, channelId)); }
export function checkAnswer(game, content) {
  const value = normalize(content);
  if (game.type === 'ism') return game.dictionary?.has(value) && value.startsWith(normalize(game.answerLetter));
  if (game.type === 'harf') return value.length > 0 && value.startsWith(normalize(game.letter));
  return value === normalize(game.answer);
}
export async function handleGameMessage(message) {
  const game = getActiveGame(message.guild.id, message.channel.id);
  if (!game) return false;
  if (Date.now() > game.expiresAt) { cancelGame(message.guild.id, message.channel.id); await message.channel.send('⏱️ انتهى وقت الجولة. حاول مرة ثانية!').catch(() => {}); return true; }
  if (message.author.bot) return true;
  if (!checkAnswer(game, message.content)) return true;
  cancelGame(message.guild.id, message.channel.id);
  await message.channel.send(`🏆 **${message.author} فاز!**`).catch(() => {});
  return true;
}

export function getGameHelp() { return ['-فكك','-اشبك','-اسرع','-اسم','-حساب','-رتب','-ذاكرة','-مختلف','-عكس','-حرف']; }
