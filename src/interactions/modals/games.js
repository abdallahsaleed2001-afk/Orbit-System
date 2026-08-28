export default {
  name: 'games_fight_modal',
  async execute(interaction, client) {
    const raw = interaction.fields.getTextInputValue('opponent')?.trim();
    const match = raw?.match(/^<@!?(\d+)>$/) || raw?.match(/^(\d{15,25})$/);
    const opponentId = match?.[1];

    if (!opponentId) {
      return interaction.reply({ content: 'من فضلك منشن مستخدمًا صالحًا أو أدخل ID صحيحًا.', ephemeral: true });
    }

    const member = await interaction.guild?.members.fetch(opponentId).catch(() => null);
    if (!member) {
      return interaction.reply({ content: 'لم أتمكن من العثور على هذا المستخدم في السيرفر.', ephemeral: true });
    }

    const command = client.gameCommands?.get('fight');
    if (!command) {
      return interaction.reply({ content: 'لعبة القتال غير متاحة حاليًا.', ephemeral: true });
    }

    const originalGetUser = interaction.options?.getUser?.bind(interaction.options);
    const proxy = new Proxy(interaction, {
      get(target, property, receiver) {
        if (property === 'options') {
          return {
            ...target.options,
            getUser: (name) => name === 'opponent' ? member.user : originalGetUser?.(name),
          };
        }
        return Reflect.get(target, property, receiver);
      },
    });

    return command.execute(proxy, null, client);
  },
};
