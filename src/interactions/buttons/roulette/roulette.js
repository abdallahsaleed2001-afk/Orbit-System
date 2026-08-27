import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import {
  addRoulettePlayer,
  beginRouletteRound,
  chooseRandomTarget,
  chooseRouletteTarget,
  finishRouletteAction,
  getRoulette,
  getRoulettePlayerStats,
  getWinner,
  isParticipant,
  isSelected,
  removeRoulettePlayer,
  cancelRoulette,
  recordRouletteElimination,
  recordRouletteWinner,
  scheduleJoinTimeout,
  DECISION_MS,
} from '../../../services/games/rouletteService.js';
import { createRouletteGif } from '../../../services/games/rouletteGif.js';
import { createRouletteJoinImage } from '../../../services/games/rouletteJoinImage.js';
import { createRouletteWinnerImage } from '../../../services/games/rouletteWinnerImage.js';

const decisionTimers = new Map();
function gameKey(game) { return `${game.guildId}:${game.channelId}`; }
function clearDecisionTimer(game) { const key=gameKey(game); const timer=decisionTimers.get(key); if(timer)clearTimeout(timer); decisionTimers.delete(key); }
function buildRows(game) {
  if(game.phase==='join') return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`roulette_join:${game.id}`).setLabel('انضم').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`roulette_stats:${game.id}`).setLabel('إحصائياتي').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`roulette_leave_join:${game.id}`).setLabel('انسحاب').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`roulette_stop:${game.id}`).setLabel('إيقاف').setStyle(ButtonStyle.Secondary),
  )];
  if(game.phase!=='decision'||!game.selectedId)return [];
  const targetButtons=game.participants.filter(p=>p.id!==game.selectedId).map(p=>new ButtonBuilder().setCustomId(`roulette_target:${game.id}:${p.id}`).setLabel(String(p.username).slice(0,80)).setStyle(ButtonStyle.Secondary));
  const rows=[]; for(let i=0;i<targetButtons.length&&rows.length<4;i+=5)rows.push(new ActionRowBuilder().addComponents(...targetButtons.slice(i,i+5)));
  if(rows.length<5)rows.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`roulette_random:${game.id}`).setLabel('اطرد شخصًا عشوائيًا').setStyle(ButtonStyle.Secondary),new ButtonBuilder().setCustomId(`roulette_leave:${game.id}`).setLabel('انسحاب').setStyle(ButtonStyle.Secondary)));
  return rows.slice(0,5);
}
const joinContent=game=>`**INFINITY GAMES — ROULETTE**\n\nالتسجيل مفتوح الآن.\nوقت الدخول: <t:${game.joinEndsAt}:R>\nعدد اللاعبين: **${game.participants.length}/100**`;
const playerCount=game=>`عدد اللاعبين: **${game.participants.length}/100**`;
const roundContent=(game,selected)=>`**INFINITY GAMES — ROULETTE**\n\n🎯 **دور <@${selected.id}>**\nاختر لاعبًا لإقصائه.\n\n${playerCount(game)} • الجولة **#${game.round}**`;
function statsText(user,stats){const winRate=stats.rounds?((stats.wins/stats.rounds)*100).toFixed(1):'0.0';return `إحصائيات ${user}\n\nالجولات: **${stats.rounds}**\nالفوز: **${stats.wins}**\nالخسائر: **${stats.losses}**\nالإقصاءات: **${stats.eliminations}**\nنسبة الفوز: **${winRate}%**`;}
async function sendRoundMessage(channel,game,result){const gif=createRouletteGif(game,result.index);const attachment=new AttachmentBuilder(gif,{name:`roulette-round-${game.round}.gif`,description:'INFINITY GAMES animated roulette round'});const sent=await channel.send({content:roundContent(game,result.participant),files:[attachment],components:buildRows(game)});game.currentMessageId=sent.id;return sent;}
async function sendWinnerMessage(channel,winner){const gif=createRouletteWinnerImage(winner);const attachment=new AttachmentBuilder(gif,{name:'roulette-winner.gif',description:'INFINITY GAMES roulette winner GIF'});await channel.send({content:`🏆 **INFINITY GAMES — الفائز في الروليت**\n**${winner.username}**\n<@${winner.id}>`,files:[attachment]});}
async function startNextRound(channel,game){await new Promise(resolve=>setTimeout(resolve,1200));if(getRoulette(game.guildId,game.channelId)!==game||game.phase==='finished')return;await spinRound(channel,game);}
function startDecisionTimer(channel,game){clearDecisionTimer(game);const key=gameKey(game);const timeout=setTimeout(async()=>{decisionTimers.delete(key);if(getRoulette(game.guildId,game.channelId)!==game||game.phase!=='decision'||!game.selectedId)return;const timedOutId=game.selectedId;if(!game.participants.some(p=>p.id===timedOutId))return;removeRoulettePlayer(game,timedOutId);recordRouletteElimination(game.guildId,timedOutId);finishRouletteAction(game);await channel.send({content:`تم طرد <@${timedOutId}> لعدم التفاعل`}).catch(()=>{});if(game.phase==='finished'){const winner=getWinner(game);if(winner){recordRouletteWinner(game.guildId,winner.id);cancelRoulette(game.guildId,game.channelId);await sendWinnerMessage(channel,winner).catch(()=>{});}return;}await startNextRound(channel,game);},DECISION_MS);decisionTimers.set(key,timeout);}
export async function sendJoinMessage(message,game){game.joinEndsAt=Math.floor((Date.now()+60000)/1000);const guildName=message.guild?.name||'INFINITY';const gif=createRouletteJoinImage(guildName);const attachment=new AttachmentBuilder(gif,{name:'roulette-registration.gif',description:'INFINITY GAMES animated roulette registration GIF'});const payload={content:joinContent(game),files:[attachment],components:buildRows(game)};const sent=message.author?.bot?await message.edit(payload):await message.channel.send(payload);game.messageId=sent.id;game.currentMessageId=sent.id;const startRound=async()=>{if(getRoulette(game.guildId,game.channelId)!==game||game.phase!=='join')return;if(game.participants.length<2){await sent.edit({content:'**INFINITY GAMES — ROULETTE**\n\nانتهى التسجيل — يجب أن يشارك شخصان على الأقل.',components:[],attachments:[]}).catch(()=>{});cancelRoulette(game.guildId,game.channelId);return;}await sent.edit({content:'**INFINITY GAMES — ROULETTE**\n\nانتهى التسجيل. بدأت الجولة الأولى.',components:[],attachments:[]}).catch(()=>{});await spinRound(message.channel,game);};game.onJoinTimeout=startRound;scheduleJoinTimeout(game,startRound);return sent;}
export async function spinRound(channel,game){clearDecisionTimer(game);const result=beginRouletteRound(game);if(!result){if(game.participants.length<=1){const winner=getWinner(game);if(winner){recordRouletteWinner(game.guildId,winner.id);cancelRoulette(game.guildId,game.channelId);await sendWinnerMessage(channel,winner).catch(()=>{});}}return;}await new Promise(resolve=>setTimeout(resolve,3600));if(getRoulette(game.guildId,game.channelId)!==game||game.phase!=='spinning')return;try{game.phase='decision';await sendRoundMessage(channel,game,result);startDecisionTimer(channel,game);}catch(error){console.error('[roulette] Failed to send round message:',error);game.phase='decision';startDecisionTimer(channel,game);}}
export async function handleRouletteButton(interaction,client,args){const action=interaction.customId.split(':')[0].replace('roulette_','');const gameId=args[0];const targetId=args[1];const game=getRoulette(interaction.guildId,interaction.channelId);if(!game||game.id!==gameId)return interaction.reply({content:'هذه الجولة انتهت.',ephemeral:true});if(game.phase!=='join'&&interaction.message.id!==game.currentMessageId)return interaction.reply({content:'هذه رسالة جولة قديمة. انتظر الجولة الحالية.',ephemeral:true});
  if(action==='join'){const result=addRoulettePlayer(interaction.guildId,interaction.channelId,interaction.user);if(result.error==='joined')return interaction.reply({content:'أنت داخل الجولة بالفعل.',ephemeral:true});if(result.error==='full')return interaction.reply({content:'وصلت الروليت للحد الأقصى من المشاركين.',ephemeral:true});if(result.error)return interaction.reply({content:'انتهى وقت الدخول.',ephemeral:true});await interaction.update({content:joinContent(game),components:buildRows(game)});return;}
  if(action==='leave_join'){if(!isParticipant(game,interaction.user.id))return interaction.reply({content:'أنت لست داخل اللعبة.',ephemeral:true});if(game.phase!=='join')return interaction.reply({content:'انتهى وقت الدخول.',ephemeral:true});removeRoulettePlayer(game,interaction.user.id);await interaction.update({content:joinContent(game),components:buildRows(game)});return;}
  if(action==='stats'){if(game.phase!=='join')return interaction.reply({content:'انتهى وقت الدخول.',ephemeral:true});const stats=getRoulettePlayerStats(game.guildId,interaction.user.id);return interaction.reply({content:statsText(interaction.user,stats),ephemeral:true});}
  if(action==='stop'){if(!interaction.memberPermissions?.has('ManageGuild'))return interaction.reply({content:'لا تملك صلاحية إيقاف الروليت.',ephemeral:true});clearDecisionTimer(game);cancelRoulette(game.guildId,game.channelId);await interaction.update({content:'**INFINITY GAMES — ROULETTE**\n\nتم إيقاف الروليت.',components:[],attachments:[]});return;}
  if(action==='leave'){if(game.phase!=='decision')return interaction.reply({content:'لا يمكنك الانسحاب الآن.',ephemeral:true});if(!isParticipant(game,interaction.user.id))return interaction.reply({content:'أنت لست داخل اللعبة.',ephemeral:true});if(!isSelected(game,interaction.user.id))return interaction.reply({content:'الانسحاب متاح للاعب صاحب الدور فقط.',ephemeral:true});removeRoulettePlayer(game,interaction.user.id);finishRouletteAction(game);clearDecisionTimer(game);if(game.phase==='finished'){const winner=getWinner(game);if(winner){recordRouletteWinner(game.guildId,winner.id);cancelRoulette(game.guildId,game.channelId);await interaction.reply({content:'تم الانسحاب من الدور.',ephemeral:true});await sendWinnerMessage(interaction.channel,winner);return;}}await interaction.reply({content:'تم الانسحاب من الدور.',ephemeral:true});await startNextRound(interaction.channel,game);return;}
  if(action==='random'){if(!isSelected(game,interaction.user.id))return interaction.reply({content:'ليس دورك.',ephemeral:true});const result=chooseRandomTarget(game);if(!result)return interaction.reply({content:'لا يوجد لاعب آخر.',ephemeral:true});removeRoulettePlayer(game,result.target.id);recordRouletteElimination(game.guildId,result.target.id);finishRouletteAction(game);clearDecisionTimer(game);await interaction.reply({content:`تم إقصاء <@${result.target.id}> عشوائيًا.`,ephemeral:true});if(game.phase==='finished'){const winner=getWinner(game);if(winner){recordRouletteWinner(game.guildId,winner.id);cancelRoulette(game.guildId,game.channelId);await sendWinnerMessage(interaction.channel,winner);}return;}await startNextRound(interaction.channel,game);return;}
  if(action==='target'){if(!isSelected(game,interaction.user.id))return interaction.reply({content:'ليس دورك.',ephemeral:true});const result=chooseRouletteTarget(game,targetId);if(result.error==='not_found')return interaction.reply({content:'اللاعب غير موجود.',ephemeral:true});if(result.error==='self')return interaction.reply({content:'لا يمكنك اختيار نفسك.',ephemeral:true});removeRoulettePlayer(game,result.target.id);recordRouletteElimination(game.guildId,result.target.id);finishRouletteAction(game);clearDecisionTimer(game);await interaction.reply({content:`تم إقصاء <@${result.target.id}>.`,ephemeral:true});if(game.phase==='finished'){const winner=getWinner(game);if(winner){recordRouletteWinner(game.guildId,winner.id);cancelRoulette(game.guildId,game.channelId);await sendWinnerMessage(interaction.channel,winner);}return;}await startNextRound(interaction.channel,game);}
}
