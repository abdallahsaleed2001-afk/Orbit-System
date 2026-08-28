import { getGameStats, GAME_NAMES } from '../../services/games/gameStatsService.js';

const GAMES_ROLE_ID = '1543013490313400340';

function hasGamesRole(interaction) {
    return interaction.member?.roles?.cache?.has(GAMES_ROLE_ID)
        || interaction.member?.roles?.includes?.(GAMES_ROLE_ID);
}

async function runGameStats(interaction) {
    if (!hasGamesRole(interaction)) {
        return interaction.reply({ content: 'ليس لديك صلاحية استخدام ألعاب البوت.', ephemeral: true });
    }

    const guildId = interaction.guildId || interaction.guild?.id;
    if (!guildId) return interaction.reply({ content: 'لا يمكن عرض الإحصائيات هنا.' });

    const stats = await getGameStats(guildId, interaction.user.id);
    const lines = Object.entries(GAME_NAMES).map(([game, name]) =>
        `🎮 **${name}** — 🏆 ${stats[game].wins} فوز | ❌ ${stats[game].losses} خسارة`
    );

    return interaction.reply({
        content: [
            `**INFINITY GAMES — إحصائيات ${interaction.user.username}**`,
            '',
            ...lines,
        ].join('\n'),
    });
}

export default {
    data: { name: 'احصائياتي', options: [] },
    name: 'احصائياتي',
    category: 'Fun',
    prefixOnly: true,
    async execute(interaction) { return runGameStats(interaction); },
    async prefixExecute(interaction) { return runGameStats(interaction); },
};
