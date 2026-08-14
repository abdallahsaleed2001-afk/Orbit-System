import { randomUUID } from 'node:crypto';
import { getEconomyData, setEconomyData, getMaxBankCapacity } from '../utils/economy.js';
import { Mutex } from '../utils/mutex.js';
import { validateDiscordId, validateNumber } from '../utils/validation.js';
import { createError, ErrorTypes } from '../utils/errorHandler.js';

const DEFAULT_BANK_CONFIG = Object.freeze({
    enabled: true,
    transferTaxPercent: 0,
    frozenAccounts: {},
});

function configKey(guildId) {
    return `guild:${guildId}:orbit-bank:config`;
}

function transactionsPrefix(guildId) {
    return `guild:${guildId}:orbit-bank:transactions:`;
}

function getPositiveAmount(amount) {
    const value = validateNumber(amount, 'amount');
    if (value === null || !Number.isSafeInteger(value) || value <= 0) {
        throw createError('Invalid transaction amount', ErrorTypes.VALIDATION, 'Amount must be a positive whole number.');
    }
    return value;
}

function validateIds(guildId, userId) {
    return {
        guildId: validateDiscordId(guildId, 'guildId'),
        userId: validateDiscordId(userId, 'userId'),
    };
}

export async function getBankConfig(client, guildId) {
    const validGuildId = validateDiscordId(guildId, 'guildId');
    const stored = await client.db.get(configKey(validGuildId), {});
    return {
        ...DEFAULT_BANK_CONFIG,
        ...(stored && typeof stored === 'object' ? stored : {}),
        frozenAccounts: stored?.frozenAccounts && typeof stored.frozenAccounts === 'object'
            ? stored.frozenAccounts
            : {},
    };
}

export async function updateBankConfig(client, guildId, updates) {
    const current = await getBankConfig(client, guildId);
    const next = { ...current, ...updates, updatedAt: Date.now() };
    await client.db.set(configKey(guildId), next);
    return next;
}

export async function getBankTransaction(client, guildId, transactionId) {
    return client.db.get(`${transactionsPrefix(guildId)}${transactionId}`, null);
}

async function recordTransaction(client, guildId, transaction) {
    await client.db.set(`${transactionsPrefix(guildId)}${transaction.id}`, transaction);
    return transaction;
}

function assertBankAvailable(config, userIds) {
    if (!config.enabled) {
        throw createError('Bank maintenance', ErrorTypes.VALIDATION, 'The banking system is currently unavailable.');
    }

    for (const userId of userIds) {
        if (config.frozenAccounts?.[userId]) {
            throw createError('Account frozen', ErrorTypes.VALIDATION, 'This bank account is temporarily frozen.');
        }
    }
}

async function runLedgerTransaction(client, guildId, userIds, type, amount, mutate, metadata = {}) {
    const validGuildId = validateDiscordId(guildId, 'guildId');
    const uniqueUsers = [...new Set(userIds.map((id) => validateDiscordId(id, 'userId')))].sort();
    const value = getPositiveAmount(amount);

    return Mutex.runExclusive(`orbit-bank:ledger:${validGuildId}`, async () => {
        const config = await getBankConfig(client, validGuildId);
        assertBankAvailable(config, uniqueUsers);

        const accounts = {};
        for (const id of uniqueUsers) {
            accounts[id] = await getEconomyData(client, validGuildId, id);
        }

        const result = await mutate(accounts, config, value);
        const transaction = {
            id: randomUUID(),
            guildId: validGuildId,
            type,
            amount: value,
            users: uniqueUsers,
            metadata,
            createdAt: Date.now(),
            status: 'completed',
        };

        for (const id of uniqueUsers) {
            await setEconomyData(client, validGuildId, id, accounts[id]);
        }
        await recordTransaction(client, validGuildId, transaction);
        return { ...result, transaction };
    });
}

export async function depositToBank(client, guildId, userId, amount) {
    const ids = validateIds(guildId, userId);
    return runLedgerTransaction(client, ids.guildId, [ids.userId], 'BANK_DEPOSIT', amount, async (accounts, _config, value) => {
        const account = accounts[ids.userId];
        const capacity = getMaxBankCapacity(account);
        if (account.wallet < value) {
            throw createError('Insufficient cash', ErrorTypes.VALIDATION, 'You do not have enough cash for this deposit.');
        }
        if (account.bank + value > capacity) {
            throw createError('Bank capacity exceeded', ErrorTypes.VALIDATION, 'This deposit exceeds your bank capacity.');
        }
        account.wallet -= value;
        account.bank += value;
        return { wallet: account.wallet, bank: account.bank, capacity };
    });
}

export async function withdrawFromBank(client, guildId, userId, amount) {
    const ids = validateIds(guildId, userId);
    return runLedgerTransaction(client, ids.guildId, [ids.userId], 'BANK_WITHDRAWAL', amount, async (accounts, _config, value) => {
        const account = accounts[ids.userId];
        if (account.bank < value) {
            throw createError('Insufficient bank funds', ErrorTypes.VALIDATION, 'You do not have enough bank funds.');
        }
        account.bank -= value;
        account.wallet += value;
        return { wallet: account.wallet, bank: account.bank };
    });
}

export async function transferBetweenAccounts(client, guildId, fromUserId, toUserId, amount) {
    const from = validateIds(guildId, fromUserId);
    const to = validateDiscordId(toUserId, 'toUserId');
    if (from.userId === to) {
        throw createError('Invalid transfer target', ErrorTypes.VALIDATION, 'You cannot transfer money to the same account.');
    }

    return runLedgerTransaction(client, from.guildId, [from.userId, to], 'BANK_TRANSFER', amount, async (accounts, config, value) => {
        const sender = accounts[from.userId];
        const recipient = accounts[to];
        const taxPercent = Math.min(Math.max(Number(config.transferTaxPercent) || 0, 0), 100);
        const tax = Math.floor(value * taxPercent / 100);
        const creditedAmount = value - tax;
        const recipientCapacity = getMaxBankCapacity(recipient);

        if (sender.bank < value) {
            throw createError('Insufficient bank funds', ErrorTypes.VALIDATION, 'You do not have enough bank funds.');
        }
        if (recipient.bank + creditedAmount > recipientCapacity) {
            throw createError('Recipient capacity exceeded', ErrorTypes.VALIDATION, 'The recipient does not have enough bank capacity.');
        }

        sender.bank -= value;
        recipient.bank += creditedAmount;
        return { sent: value, received: creditedAmount, tax, senderBank: sender.bank, recipientBank: recipient.bank };
    }, { fromUserId: from.userId, toUserId: to });
}
