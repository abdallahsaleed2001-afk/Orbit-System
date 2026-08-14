import { randomUUID } from 'node:crypto';
import { getEconomyData, setEconomyData } from '../utils/economy.js';
import { Mutex } from '../utils/mutex.js';
import { validateDiscordId } from '../utils/validation.js';
import { createError, ErrorTypes } from '../utils/errorHandler.js';

const PROTECTION_LEVELS = Object.freeze({
    NONE: { reduction: 0, label: 'NONE' },
    BRONZE: { reduction: 0.2, label: 'BRONZE' },
    SILVER: { reduction: 0.45, label: 'SILVER' },
    GOLD: { reduction: 0.7, label: 'GOLD' },
});

const DEFAULTS = Object.freeze({
    cooldownMs: 4 * 60 * 60 * 1000,
    successChance: 0.4,
    maxStealPercent: 0.15,
    minTargetCash: 500,
    failureFinePercent: 0.1,
});

function transactionKey(guildId, id) {
    return `guild:${guildId}:orbit-bank:transactions:${id}`;
}

export function getAccountProtection(account, now = Date.now()) {
    const protection = account?.protection?.account || {};
    const level = String(protection.level || 'NONE').toUpperCase();
    const expiresAt = Number(protection.expiresAt) || 0;
    const active = level !== 'NONE' && (!expiresAt || expiresAt > now);
    return {
        level: active && PROTECTION_LEVELS[level] ? level : 'NONE',
        expiresAt: active ? expiresAt : 0,
        reduction: active && PROTECTION_LEVELS[level] ? PROTECTION_LEVELS[level].reduction : 0,
    };
}

export async function setAccountProtection(client, guildId, userId, level, expiresAt = 0) {
    const validGuildId = validateDiscordId(guildId, 'guildId');
    const validUserId = validateDiscordId(userId, 'userId');
    const normalizedLevel = String(level || 'NONE').toUpperCase();
    if (!PROTECTION_LEVELS[normalizedLevel]) {
        throw createError('Invalid protection level', ErrorTypes.VALIDATION, 'Unknown account protection level.');
    }

    return Mutex.runExclusive(`orbit-bank:ledger:${validGuildId}`, async () => {
        const account = await getEconomyData(client, validGuildId, validUserId);
        account.protection = {
            ...(account.protection || {}),
            account: { level: normalizedLevel, expiresAt: Math.max(0, Number(expiresAt) || 0) },
        };
        await setEconomyData(client, validGuildId, validUserId, account);
        return getAccountProtection(account);
    });
}

export async function executeRobbery(client, guildId, robberId, victimId, options = {}) {
    const validGuildId = validateDiscordId(guildId, 'guildId');
    const robber = validateDiscordId(robberId, 'robberId');
    const victim = validateDiscordId(victimId, 'victimId');
    if (robber === victim) {
        throw createError('Cannot rob self', ErrorTypes.VALIDATION, 'You cannot rob yourself.');
    }

    const settings = { ...DEFAULTS, ...options };
    return Mutex.runExclusive(`orbit-bank:ledger:${validGuildId}`, async () => {
        const [robberAccount, victimAccount] = await Promise.all([
            getEconomyData(client, validGuildId, robber),
            getEconomyData(client, validGuildId, victim),
        ]);
        const now = Date.now();
        const remaining = (Number(robberAccount.lastRob) || 0) + settings.cooldownMs - now;
        if (remaining > 0) {
            throw createError('Robbery cooldown active', ErrorTypes.RATE_LIMIT, `Wait ${Math.ceil(remaining / 60000)} minutes before attempting another robbery.`, { remaining });
        }
        if (victimAccount.wallet < settings.minTargetCash) {
            throw createError('Target has insufficient cash', ErrorTypes.VALIDATION, 'This user does not have enough cash to rob.');
        }

        robberAccount.lastRob = now;
        const protection = getAccountProtection(victimAccount, now);
        const success = Math.random() < settings.successChance;
        let stolen = 0;
        let blocked = 0;
        let fine = 0;

        if (success) {
            const attempted = Math.max(1, Math.floor(victimAccount.wallet * settings.maxStealPercent));
            blocked = Math.floor(attempted * protection.reduction);
            stolen = attempted - blocked;
            victimAccount.wallet -= stolen;
            robberAccount.wallet += stolen;
        } else {
            fine = Math.min(robberAccount.wallet, Math.floor(robberAccount.wallet * settings.failureFinePercent));
            robberAccount.wallet -= fine;
        }

        const transaction = {
            id: randomUUID(),
            guildId: validGuildId,
            type: success ? 'ROBBERY_SUCCESS' : 'ROBBERY_FAILED',
            amount: success ? stolen : fine,
            users: [robber, victim],
            metadata: { protectionLevel: protection.level, protectionBlocked: blocked, fine },
            createdAt: now,
            status: 'completed',
        };

        await Promise.all([
            setEconomyData(client, validGuildId, robber, robberAccount),
            setEconomyData(client, validGuildId, victim, victimAccount),
        ]);
        await client.db.set(transactionKey(validGuildId, transaction.id), transaction);

        return {
            success,
            stolen,
            blocked,
            fine,
            protection,
            robberWallet: robberAccount.wallet,
            victimWallet: victimAccount.wallet,
            cooldownMs: settings.cooldownMs,
            transaction,
        };
    });
}
