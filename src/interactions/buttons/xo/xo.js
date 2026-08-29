import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getXO, joinXO, leaveXO, pickXOCell, timeoutXO, endXO, isXOPlayer, currentXOPlayer, advanceTournament, XO_TURN_MS, XO_MAX_PLAYERS } from '../../../services/games/xoService.js';
import { recordGameResult } from '../../../services/games/gameStatsService.js';

const timers=new Map();
const key=game=>`${game.guildId}:${game.channelId}`;
const clearTimer=game=>{const k=key(game);if(timers.get(k))clearTimeout(timers.get(k));timers.delete(k);};
const emptyLabel='ㅤ';
export function xoGrid(game,disabled=false){const buttons=Array.from({length:9},(_,i)=>{const value=game.board[i];return new ButtonBuilder().setCustomId(`xo_cell:${game.guildId}:${game.channelId}:${i}`).setLabel(value||emptyLabel).setStyle(value==='❌'?ButtonStyle.Danger:value==='⭕'?ButtonStyle.Primary:ButtonStyle.Secondary).setDisabled(disabled||Boolean(value)||!game.active);});return[0,1,2].map(row=>new ActionRowBuilder().addComponents(...buttons.slice(row*3,row*3+3)));}
function players(game){return `❌ <@${game.players[0]?.id}>  ×  ⭕ <@${game.players[1]?.id}>`;}
function content(game,extra=''){const turn=currentXOPlayer(game);const symbol=turn?game.symbols[turn.id]:'—';return `**INFINITY GAMES — إكس أو**\n\n${extra?`${extra}\n\n`:''}🏆 الجولة **${game.round}**\n${players(game)}\n\nدور: ${turn?`${symbol} <@${turn.id}>`:'—'}\nلديك **10 ثوانٍ** للتفاعل.`;}
function lobbyComponents(game){return[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`xo_join:${game.guildId}:${game.channelId}`).setLabel('انضم').setStyle(ButtonStyle.Success),new ButtonBuilder().setCustomId(`xo_leave:${game.guildId}:${game.channelId}`).setLabel('خروج').setStyle(ButtonStyle.Secondary))];}
function lobbyContent(game,extra=''){const list=game.participants.map((p,i)=>`${i===0?'❌':'•'} <@${p.id}>`).join('\n');return `**INFINITY GAMES — إكس أو — البطولة**\n\n${extra?`${extra}\n\n`:''}التسجيل مفتوح لمدة **20 ثانية**.\nوقت الدخول: <t:${game.joinEndsAt}:R>\n\nاللاعبون (**${game.participants.length}/${XO_MAX_PLAYERS}**):\n${list}`;}

async function continueTournament(interaction,game,result){
    clearTimer(game);
    await recordGameResult(game.guildId,'xo',[result.winner.id],[result.loser.id]);
    const next=advanceTournament(game,result.winner);
    if(next.champion){
        await interaction.update({content:`**INFINITY GAMES — إكس أو — البطولة**\n\n🏆 بطل البطولة: <@${next.champion.id}>\n\nانتهت جميع الجولات.`,components:xoGrid(game,true)}).catch(()=>{});
        endXO(game);return;
    }
    if(!next.ok)return endXO(game);
    const matchLabel=`المباراة ${game.matchIndex}`;
    await interaction.update({content:content(game,`${next.newRound?'🔄 بدأت جولة جديدة.\n\n':''}⚔️ ${matchLabel}`),components:xoGrid(game)}).catch(()=>{});
    startTurnTimer(interaction.channel,game);
}

async function startTurnTimer(channel,game){clearTimer(game);const k=key(game);timers.set(k,setTimeout(async()=>{timers.delete(k);if(!game.active||game.phase!=='turn')return;const result=timeoutXO(game);if(!result?.loser||!result.winner)return;await channel.send({content:`**INFINITY GAMES — إكس أو**\n\n⏱️ انتهى وقت <@${result.loser.id}> وتم اعتباره خاسرًا.\n\n🏆 الفائز بالمباراة: <@${result.winner.id}>`}).catch(()=>{});await recordGameResult(game.guildId,'xo',[result.winner.id],[result.loser.id]);const next=advanceTournament(game,result.winner);if(next.champion){await channel.send({content:`**INFINITY GAMES — إكس أو — البطولة**\n\n🏆 بطل البطولة: <@${next.champion.id}>\n\nانتهت جميع الجولات.`}).catch(()=>{});endXO(game);return;}if(!next.ok){endXO(game);return;}await channel.send({content:content(game,`${next.newRound?'🔄 بدأت جولة جديدة.\n\n':''}⚔️ المباراة ${game.matchIndex}`),components:xoGrid(game)}).then(msg=>{game.currentMessageId=msg.id;startTurnTimer(channel,game);}).catch(()=>{});},XO_TURN_MS));}
export function startXOTurnTimer(channel,game){return startTurnTimer(channel,game);}

async function executeXOButton(interaction){
    const parts=interaction.customId.split(':');const action=parts[0];const game=getXO(interaction.guildId,interaction.channelId);
    if(!game||!game.active)return interaction.reply({content:'هذه اللعبة انتهت.',ephemeral:true});
    if(action==='xo_join'){
        if(game.phase!=='join')return interaction.reply({content:'انتهى وقت الدخول.',ephemeral:true});
        const result=joinXO(game,interaction.user);
        if(result.error==='already')return interaction.reply({content:'أنت داخل البطولة بالفعل.',ephemeral:true});
        if(result.error==='full')return interaction.reply({content:`اكتمل عدد المشاركين (${XO_MAX_PLAYERS}).`,ephemeral:true});
        if(result.error)return interaction.reply({content:'لا يمكنك الانضمام الآن.',ephemeral:true});
        return interaction.update({content:lobbyContent(game),components:lobbyComponents(game)});
    }
    if(action==='xo_leave'){
        if(!isXOPlayer(game,interaction.user.id))return interaction.reply({content:'أنت لست داخل البطولة.',ephemeral:true});
        const result=leaveXO(game,interaction.user.id);if(result.error)return interaction.reply({content:'تعذر الخروج من البطولة.',ephemeral:true});
        clearTimer(game);if(result.empty){endXO(game);return interaction.update({content:'تم إلغاء البطولة لعدم وجود لاعبين.',components:[]});}
        return interaction.update({content:lobbyContent(game,`🚪 خرج <@${interaction.user.id}> من التسجيل.`),components:lobbyComponents(game)});
    }
    if(action==='xo_cell'){
        if(!isXOPlayer(game,interaction.user.id))return interaction.reply({content:'أنت لست مشاركًا في البطولة.',ephemeral:true});
        if(!game.players.some(p=>p.id===interaction.user.id))return interaction.reply({content:'هذه المباراة ليست دورك.',ephemeral:true});
        const cell=Number(parts[3]);const result=pickXOCell(game,interaction.user.id,cell);
        if(result.error==='not_turn')return interaction.reply({content:`ليس دورك. الدور على ${currentXOPlayer(game)?`<@${currentXOPlayer(game).id}>`:'اللاعب الآخر'}.`,ephemeral:true});
        if(result.error==='occupied')return interaction.reply({content:'هذه الخانة مستخدمة بالفعل.',ephemeral:true});
        if(result.error)return interaction.reply({content:'تعذر تنفيذ الاختيار.',ephemeral:true});
        if(result.finished)return continueTournament(interaction,game,result);
        const extra=result.draw?'🤝 تعادل في المباراة، بدأت لوحة جديدة.':`تم وضع ${game.symbols[result.player.id]} في الخانة.`;
        await interaction.update({content:content(game,extra),components:xoGrid(game)});startTurnTimer(interaction.channel,game);
    }
}
export default ['xo_join','xo_leave','xo_cell'].map(name=>({name,execute:executeXOButton}));
