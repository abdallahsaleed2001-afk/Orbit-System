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
  ['🇹🇷', ['تركيا', 'turkey']],
  ['🇩🇪', ['ألمانيا', 'المانيا', 'germany']],
  ['🇫🇷', ['فرنسا', 'france']],
  ['🇮🇹', ['إيطاليا', 'ايطاليا', 'italy']],
  ['🇪🇸', ['إسبانيا', 'اسبانيا', 'spain']],
  ['🇬🇧', ['بريطانيا', 'المملكة المتحدة', 'uk', 'united kingdom']],
  ['🇺🇸', ['أمريكا', 'امريكا', 'الولايات المتحدة', 'usa', 'united states']],
  ['🇨🇦', ['كندا', 'canada']],
  ['🇧🇷', ['البرازيل', 'brazil']],
  ['🇦🇷', ['الأرجنتين', 'الارجنتين', 'argentina']],
  ['🇯🇵', ['اليابان', 'japan']],
  ['🇨🇳', ['الصين', 'china']],
  ['🇰🇷', ['كوريا الجنوبية', 'south korea']],
  ['🇮🇳', ['الهند', 'india']],
  ['🇷🇺', ['روسيا', 'russia']],
  ['🇦🇺', ['أستراليا', 'استراليا', 'australia']],
  ['🇲🇽', ['المكسيك', 'mexico']],
  ['🇿🇦', ['جنوب أفريقيا', 'جنوب افريقيا', 'south africa']],
  ['🇳🇱', ['هولندا', 'netherlands', 'holland']],
  ['🇵🇹', ['البرتغال', 'portugal']],
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
