import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Collection } from 'discord.js';
import { logger } from '../../utils/logger.js';
import botConfig from '../../config/bot.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getSubcommandInfo(commandData) {
    const subcommands = [];
    if (commandData.options) {
        for (const option of commandData.options) {
            if (option.type === 1) subcommands.push(option.name);
            else if (option.type === 2 && option.options) {
                for (const subOption of option.options) {
                    if (subOption.type === 1) subcommands.push(`${option.name}/${subOption.name}`);
                }
            }
        }
    }
    return subcommands;
}

async function getAllFiles(directory, fileList = []) {
    const files = await fs.readdir(directory, { withFileTypes: true });
    for (const file of files) {
        const filePath = path.join(directory, file.name);
        if (file.isDirectory()) {
            if (file.name === 'modules') continue;
            await getAllFiles(filePath, fileList);
        } else if (file.name.endsWith('.js')) fileList.push(filePath);
    }
    return fileList;
}

export async function loadCommands(client) {
    client.commands = new Collection();
    const commandsPath = path.join(__dirname, '../../commands');
    const commandFiles = await getAllFiles(commandsPath);
    const uniqueCommandNames = new Set();

    for (const filePath of commandFiles) {
        try {
            const commandModule = await import(`file://${filePath}`);
            const command = commandModule.default || commandModule;
            if (!command.data || !command.execute) {
                logger.warn(`Command at ${filePath} is missing required "data" or "execute" property.`);
                continue;
            }
            const commandName = command.data.name;
            const category = path.basename(path.dirname(filePath));
            command.category = category;
            command.filePath = filePath.replace(/\\/g, '/');
            if (!uniqueCommandNames.has(commandName)) {
                uniqueCommandNames.add(commandName);
                client.commands.set(commandName, command);
            }
        } catch (error) {
            logger.error(`Error loading command from ${filePath}:`, error);
        }
    }

    // Keep prefix-only commands available to the bot, but never register them as Discord slash commands.
    const slashCount = [...client.commands.values()].filter(command => !command.prefixOnly && !command.slashOnly === false).length;
    const prefixOnlyCount = [...client.commands.values()].filter(command => command.prefixOnly === true).length;
    logger.info(`Loaded ${client.commands.size} commands (${slashCount} slash candidates, ${prefixOnlyCount} prefix-only)`);
    return client.commands;
}

function collectCommandPayloads(client) {
    const commands = [];
    let totalSubcommands = 0;
    const registeredNames = new Set();

    for (const command of client.commands.values()) {
        if (command.prefixOnly === true) continue;
        if (!command.data || typeof command.data.toJSON !== 'function') continue;
        const commandName = command.data.name;
        if (registeredNames.has(commandName)) continue;
        registeredNames.add(commandName);
        const commandJson = command.data.toJSON();
        commands.push(commandJson);
        totalSubcommands += getSubcommandInfo(commandJson).length;
    }

    if (commands.length > 100) {
        logger.error(`Slash command limit exceeded: ${commands.length}/100. Only the first 100 commands will be registered.`);
        commands.length = 100;
    }

    return { commands, totalSubcommands };
}

function validateCommands(commands) {
    const errors = [];
    for (const cmd of commands) {
        if (cmd.name?.length > 32) errors.push(`Command ${cmd.name} has name longer than 32 chars`);
        if (cmd.description?.length > 110) errors.push(`Command ${cmd.name} has description longer than 110 chars`);
    }
    if (errors.length) throw new Error(`Command validation failed: ${errors.join('; ')}`);
}

async function registerGuildCommands(client, clientId, guildId, commands, totalSubcommands) {
    if (!clientId) throw new Error('CLIENT_ID is required for slash command registration');
    if (!guildId) throw new Error('GUILD_ID is required for guild slash command registration');
    if (!client.rest) throw new Error('Discord REST client is not available for slash command registration');

    validateCommands(commands);
    if (botConfig.commands?.deleteCommands) {
        await client.rest.put(`/applications/${clientId}/guilds/${guildId}/commands`, { body: [] });
    }
    await client.rest.put(`/applications/${clientId}/guilds/${guildId}/commands`, { body: commands });
    logger.info(`Successfully registered ${commands.length} guild slash commands (${totalSubcommands} subcommands)`);
}

export async function registerCommands(client, options = {}) {
    const clientId = options.clientId || process.env.CLIENT_ID;
    const guildId = options.guildId || process.env.GUILD_ID;
    const { commands, totalSubcommands } = collectCommandPayloads(client);
    try {
        await registerGuildCommands(client, clientId, guildId, commands, totalSubcommands);
    } catch (error) {
        logger.error('Error registering commands:', error);
        throw error;
    }
}

export async function reloadCommand(client, commandName) {
    const command = client.commands.get(commandName);
    if (!command) return { success: false, message: `Command "${commandName}" not found` };
    return { success: true, command };
}
