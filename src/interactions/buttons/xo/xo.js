import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getXO, joinXO, leaveXO, pickXOCell, timeoutXO, endXO, isXOPlayer, currentXOPlayer, XO_TURN_MS } from '../../../services/games/xoService.js';
import { recordGameResult } from '../../../services/games/gameStatsService.js';

const timers = new Map();
const key = game => `${game.guildId}:${game.channelId}`;
const clearTimer = game => {
    const k = key(game);
    if (timers.get(k)) clearTimeout(timers.get(k));
    timers.delete(k);
};
const emptyLabel = 'ㅤ';

export function xoGrid(game, disabled = false) {
    const buttons = Array.from({ length: 9 }, (_, i) => {
        const value = game.board[i];
        return new ButtonBuilder()
            .setCustomId(`xo_cell:${game.guildId}:${game.channelId}:${i}`)
            .setLabel(value || emptyLabel)
            .setStyle(value === '❌' ? ButtonStyle.Danger : value === '⭕' ? ButtonStyle.Primary : ButtonStyle.Secondary)
            .setDisabled(disabled || Boolean(value) || !game.active);
    });

    return [0, 1, 2].map(row => new ActionRowBuilder().addComponents(...buttons.slice(row * 3, row * 3 + 3)));
}

function players(game) {
    return `❌ <@${game.players[0]?.id}>  ×  ⭕ <@${game.players[1]?.id}>`;
}

function content(game, extra = '') {
    const turn = currentXOPlayer(game);
    const symbol = turn ? game.symbols[turn.id] : '—';
    return `**INFINITY GAMES — إكس أو**\n\n${extra ? `${extra}\n\n` : ''}${players(game)}\n\nدور: ${turn ? `${symbol} <@${turn.id}>` : '—'}\nلديك **10 ثوانٍ** للتفاعل.`;
}

function lobbyComponents(game) {
    return [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`xo_join:${game.guildId}:${game.channelId}`).setLabel('انضم').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`xo_leave:${game.guildId}:${game.channelId}`).setLabel('خروج').setStyle(ButtonStyle.Secondary),
    )];
}

async function finishWithResult(interaction, game, result, extra) {
    clearTimer(game);
    if (result.draw) {
        await interaction.update({ content: content(game, '🤝 انتهت اللعبة بالتعادل.'), components: xoGrid(game, true) }).catch(() => {});
    } else {
        await interaction.update({ content: content(game, `🏆 الفائز: <@${result.winner.id}>\n❌ الخاسر: <@${result.loser.id}>${extra ? `\n\n${extra}` : ''}`), components: xoGrid(game, true) }).catch(() => {});
        await recordGameResult(game.guildId, 'xo', [result.winner.id], [result.loser.id]);
    }
    endXO(game);
}

async function startTurnTimer(channel, game) {
    clearTimer(game);
    const k = key(game);
    timers.set(k, setTimeout(async () => {
        timers.delete(k);
        if (!game.active || game.phase !== 'turn') return;
        const result = timeoutXO(game);
        if (!result?.loser || !result.winner) return;
        await channel.send({
            content: `**INFINITY GAMES — إكس أو**\n\n⏱️ انتهى وقت <@${result.loser.id}> وتم اعتباره خاسرًا.\n\n🏆 الفائز: <@${result.winner.id}>`,
        }).catch(() => {});
        await recordGameResult(game.guildId, 'xo', [result.winner.id], [result.loser.id]);
        endXO(game);
    }, XO_TURN_MS));
}

export function startXOTurnTimer(channel, game) { return startTurnTimer(channel, game); }

async function executeXOButton(interaction) {
    const parts = interaction.customId.split(':');
    const action = parts[0];
    const guildId = interaction.guildId;
    const channelId = interaction.channelId;
    const game = getXO(guildId, channelId);

    if (!game || !game.active) return interaction.reply({ content: 'هذه اللعبة انتهت.', ephemeral: true });

    if (action === 'xo_join') {
        if (game.phase !== 'join') return interaction.reply({ content: 'انتهى وقت الدخول.', ephemeral: true });
        const result = joinXO(game, interaction.user);
        if (result.error === 'already') return interaction.reply({ content: 'أنت داخل اللعبة بالفعل.', ephemeral: true });
        if (result.error === 'full') return interaction.reply({ content: 'اللعبة اكتملت بلاعبين.', ephemeral: true });
        if (result.error) return interaction.reply({ content: 'لا يمكنك الانضمام الآن.', ephemeral: true });

        return interaction.update({
            content: `**INFINITY GAMES — إكس أو**\n\nالتسجيل مفتوح لمدة **20 ثانية**.\n\n❌ <@${game.players[0].id}>\n⭕ <@${game.players[1].id}>\n\nاكتمل عدد اللاعبين، ستبدأ اللعبة عند انتهاء التسجيل.`,
            components: lobbyComponents(game),
        });
    }

    if (action === 'xo_leave') {
        if (!isXOPlayer(game, interaction.user.id)) return interaction.reply({ content: 'أنت لست داخل اللعبة.', ephemeral: true });
        const leavingId = interaction.user.id;
        const result = leaveXO(game, leavingId);
        if (result.error) return interaction.reply({ content: 'تعذر الخروج من اللعبة.', ephemeral: true });

        clearTimer(game);
        if (game.phase === 'join') {
            if (result.empty) {
                endXO(game);
                return interaction.update({ content: 'تم إلغاء اللعبة لعدم وجود لاعبين.', components: [] });
            }
            return interaction.update({
                content: `**INFINITY GAMES — إكس أو**\n\nخرج <@${leavingId}> من التسجيل.\n\n❌ <@${game.players[0]?.id}>\n⭕ بانتظار لاعب`,
                components: lobbyComponents(game),
            });
        }

        const winner = game.players[0] || null;
        if (winner) {
            await interaction.update({
                content: `**INFINITY GAMES — إكس أو**\n\n🚪 خرج <@${leavingId}> من اللعبة.\n\n🏆 الفائز: <@${winner.id}>`,
                components: xoGrid(game, true),
            }).catch(() => {});
            await recordGameResult(game.guildId, 'xo', [winner.id], [leavingId]);
        }
        endXO(game);
        return;
    }

    if (action === 'xo_cell') {
        if (!isXOPlayer(game, interaction.user.id)) return interaction.reply({ content: 'أنت لست داخل اللعبة.', ephemeral: true });
        const cell = Number(parts[3]);
        const result = pickXOCell(game, interaction.user.id, cell);
        if (result.error === 'not_turn') return interaction.reply({ content: `ليس دورك. الدور على ${currentXOPlayer(game) ? `<@${currentXOPlayer(game).id}>` : 'اللاعب الآخر'}.`, ephemeral: true });
        if (result.error === 'occupied') return interaction.reply({ content: 'هذه الخانة مستخدمة بالفعل.', ephemeral: true });
        if (result.error) return interaction.reply({ content: 'تعذر تنفيذ الاختيار.', ephemeral: true });

        if (result.finished) {
            return finishWithResult(interaction, game, result);
        }

        await interaction.update({ content: content(game, `تم وضع ${game.symbols[result.player.id]} في الخانة.`), components: xoGrid(game) });
        startTurnTimer(interaction.channel, game);
    }
}

export default ['xo_join', 'xo_leave', 'xo_cell'].map(name => ({ name, execute: executeXOButton }));
