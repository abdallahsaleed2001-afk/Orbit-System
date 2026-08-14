import { randomUUID } from 'node:crypto';
import { getEconomyData, setEconomyData, getMaxBankCapacity } from '../utils/economy.js';
import { Mutex } from '../utils/mutex.js';
import { validateDiscordId } from '../utils/validation.js';
import { createError, ErrorTypes } from '../utils/errorHandler.js';

const DEFAULT_PROPERTIES = Object.freeze([
    { id: 'apartment', name: 'Apartment', emoji: '🏠', price: 250000, income: 2500, maintenance: 250, maxLevel: 10, materials: { concrete: 30, wood: 20 } },
    { id: 'office', name: 'Office', emoji: '🏢', price: 1000000, income: 12000, maintenance: 1200, maxLevel: 15, materials: { concrete: 120, steel: 70, electronics: 20 } },
    { id: 'factory', name: 'Factory', emoji: '🏭', price: 2500000, income: 35000, maintenance: 5000, maxLevel: 20, materials: { concrete: 500, steel: 250, wood: 150, machinery: 50 } },
]);

const COLLECTION_INTERVAL = 60 * 60 * 1000;

function catalogKey(guildId) {
    return `guild:${guildId}:orbit-properties:catalog`;
}

function ownershipKey(guildId, userId) {
    return `guild:${guildId}:orbit-properties:ownership:${userId}`;
}

function transactionKey(guildId, id) {
    return `guild:${guildId}:orbit-bank:transactions:${id}`;
}

function materialKey(name) {
    return `material_${String(name).toLowerCase()}`;
}

export async function getPropertyCatalog(client, guildId) {
    const validGuildId = validateDiscordId(guildId, 'guildId');
    const stored = await client.db.get(catalogKey(validGuildId), null);
    return Array.isArray(stored) && stored.length ? stored : DEFAULT_PROPERTIES.map(item => ({ ...item }));
}

export async function getOwnedProperties(client, guildId, userId) {
    const validGuildId = validateDiscordId(guildId, 'guildId');
    const validUserId = validateDiscordId(userId, 'userId');
    const stored = await client.db.get(ownershipKey(validGuildId, validUserId), {});
    return stored && typeof stored === 'object' ? stored : {};
}

export async function purchaseProperty(client, guildId, userId, propertyId) {
    const validGuildId = validateDiscordId(guildId, 'guildId');
    const validUserId = validateDiscordId(userId, 'userId');
    const id = String(propertyId).toLowerCase();

    return Mutex.runExclusive(`orbit-bank:ledger:${validGuildId}`, async () => {
        const [catalog, account, stored] = await Promise.all([
            getPropertyCatalog(client, validGuildId),
            getEconomyData(client, validGuildId, validUserId),
            getOwnedProperties(client, validGuildId, validUserId),
        ]);
        const property = catalog.find(item => item.id === id);
        if (!property) throw createError('Property not found', ErrorTypes.VALIDATION, 'This property is not available.');
        if (stored[id]) throw createError('Property already owned', ErrorTypes.VALIDATION, 'You already own this property.');
        if (account.bank < property.price) throw createError('Insufficient bank funds', ErrorTypes.VALIDATION, 'Properties must be purchased from your bank balance.');

        account.bank -= property.price;
        stored[id] = { propertyId: id, level: 1, lastCollectedAt: Date.now(), purchasedAt: Date.now() };
        const transaction = { id: randomUUID(), guildId: validGuildId, type: 'PROPERTY_PURCHASE', amount: property.price, users: [validUserId], metadata: { propertyId: id }, createdAt: Date.now(), status: 'completed' };
        await Promise.all([
            setEconomyData(client, validGuildId, validUserId, account),
            client.db.set(ownershipKey(validGuildId, validUserId), stored),
            client.db.set(transactionKey(validGuildId, transaction.id), transaction),
        ]);
        return { property, ownership: stored[id], bank: account.bank, transaction };
    });
}

export async function upgradeProperty(client, guildId, userId, propertyId) {
    const validGuildId = validateDiscordId(guildId, 'guildId');
    const validUserId = validateDiscordId(userId, 'userId');
    const id = String(propertyId).toLowerCase();

    return Mutex.runExclusive(`orbit-bank:ledger:${validGuildId}`, async () => {
        const [catalog, account, stored] = await Promise.all([
            getPropertyCatalog(client, validGuildId),
            getEconomyData(client, validGuildId, validUserId),
            getOwnedProperties(client, validGuildId, validUserId),
        ]);
        const property = catalog.find(item => item.id === id);
        const ownership = stored[id];
        if (!property || !ownership) throw createError('Property not owned', ErrorTypes.VALIDATION, 'You do not own this property.');
        if (ownership.level >= property.maxLevel) throw createError('Maximum level', ErrorTypes.VALIDATION, 'This property is already at its maximum level.');

        const multiplier = ownership.level;
        const required = Object.fromEntries(Object.entries(property.materials).map(([name, quantity]) => [name, quantity * multiplier]));
        for (const [name, quantity] of Object.entries(required)) {
            if ((account.inventory?.[materialKey(name)] || 0) < quantity) {
                throw createError('Missing materials', ErrorTypes.VALIDATION, `You need ${quantity} ${name} for this upgrade.`, { required });
            }
        }

        for (const [name, quantity] of Object.entries(required)) account.inventory[materialKey(name)] -= quantity;
        ownership.level += 1;
        ownership.updatedAt = Date.now();
        const transaction = { id: randomUUID(), guildId: validGuildId, type: 'PROPERTY_UPGRADE', amount: 0, users: [validUserId], metadata: { propertyId: id, level: ownership.level, materials: required }, createdAt: Date.now(), status: 'completed' };
        await Promise.all([
            setEconomyData(client, validGuildId, validUserId, account),
            client.db.set(ownershipKey(validGuildId, validUserId), stored),
            client.db.set(transactionKey(validGuildId, transaction.id), transaction),
        ]);
        return { property, ownership, required, transaction };
    });
}

export async function collectPropertyIncome(client, guildId, userId, propertyId) {
    const validGuildId = validateDiscordId(guildId, 'guildId');
    const validUserId = validateDiscordId(userId, 'userId');
    const id = String(propertyId).toLowerCase();

    return Mutex.runExclusive(`orbit-bank:ledger:${validGuildId}`, async () => {
        const [catalog, account, stored] = await Promise.all([
            getPropertyCatalog(client, validGuildId),
            getEconomyData(client, validGuildId, validUserId),
            getOwnedProperties(client, validGuildId, validUserId),
        ]);
        const property = catalog.find(item => item.id === id);
        const ownership = stored[id];
        if (!property || !ownership) throw createError('Property not owned', ErrorTypes.VALIDATION, 'You do not own this property.');

        const now = Date.now();
        const intervals = Math.floor((now - ownership.lastCollectedAt) / COLLECTION_INTERVAL);
        if (intervals < 1) throw createError('Income not ready', ErrorTypes.RATE_LIMIT, 'This property has no income ready yet.');
        const gross = property.income * ownership.level * intervals;
        const maintenance = property.maintenance * ownership.level * intervals;
        const net = Math.max(0, gross - maintenance);
        if (account.bank + net > getMaxBankCapacity(account)) throw createError('Bank capacity exceeded', ErrorTypes.VALIDATION, 'Withdraw bank funds before collecting property income.');

        account.bank += net;
        ownership.lastCollectedAt += intervals * COLLECTION_INTERVAL;
        const transaction = { id: randomUUID(), guildId: validGuildId, type: 'PROPERTY_INCOME', amount: net, users: [validUserId], metadata: { propertyId: id, gross, maintenance, intervals }, createdAt: now, status: 'completed' };
        await Promise.all([
            setEconomyData(client, validGuildId, validUserId, account),
            client.db.set(ownershipKey(validGuildId, validUserId), stored),
            client.db.set(transactionKey(validGuildId, transaction.id), transaction),
        ]);
        return { property, ownership, gross, maintenance, net, bank: account.bank, transaction };
    });
}

export async function getMaterials(client, guildId, userId) {
    const account = await getEconomyData(client, guildId, userId);
    return Object.entries(account.inventory || {})
        .filter(([key, quantity]) => key.startsWith('material_') && Number(quantity) > 0)
        .map(([key, quantity]) => ({ name: key.slice('material_'.length), quantity: Number(quantity) }));
}
