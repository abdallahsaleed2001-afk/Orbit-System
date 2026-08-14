import { randomUUID } from 'node:crypto';
import { getEconomyData, setEconomyData, getMaxBankCapacity } from '../utils/economy.js';
import { Mutex } from '../utils/mutex.js';
import { validateDiscordId, validateNumber } from '../utils/validation.js';
import { createError, ErrorTypes } from '../utils/errorHandler.js';

const DEFAULT_ASSETS = Object.freeze([
    { symbol: 'NVDA', name: 'NVIDIA', type: 'stock', price: 184, volatility: 0.08 },
    { symbol: 'ORBT', name: 'Orbit Technologies', type: 'stock', price: 120, volatility: 0.06 },
    { symbol: 'GOLD', name: 'Gold', type: 'commodity', price: 2480, volatility: 0.025 },
    { symbol: 'SILVER', name: 'Silver', type: 'commodity', price: 31, volatility: 0.045 },
    { symbol: 'PLAT', name: 'Platinum', type: 'commodity', price: 980, volatility: 0.04 },
    { symbol: 'OIL', name: 'Oil', type: 'commodity', price: 75, volatility: 0.06 },
]);

function assetsKey(guildId) {
    return `guild:${guildId}:orbit-market:assets`;
}

function holdingKey(guildId, userId) {
    return `guild:${guildId}:orbit-market:holdings:${userId}`;
}

function transactionsKey(guildId, id) {
    return `guild:${guildId}:orbit-bank:transactions:${id}`;
}

function normalizeAsset(asset) {
    const price = Math.max(1, Math.round(Number(asset.price) || 1));
    return {
        ...asset,
        symbol: String(asset.symbol).toUpperCase(),
        price,
        openPrice: Math.max(1, Math.round(Number(asset.openPrice) || price)),
        highPrice: Math.max(price, Math.round(Number(asset.highPrice) || price)),
        lowPrice: Math.min(price, Math.max(1, Math.round(Number(asset.lowPrice) || price))),
        volatility: Math.min(Math.max(Number(asset.volatility) || 0.03, 0.001), 0.25),
        history: Array.isArray(asset.history) ? asset.history.slice(-48) : [],
        updatedAt: Number(asset.updatedAt) || Date.now(),
    };
}

function validAmount(value, name) {
    const amount = validateNumber(value, name);
    if (amount === null || !Number.isSafeInteger(amount) || amount <= 0) {
        throw createError('Invalid amount', ErrorTypes.VALIDATION, `${name} must be a positive whole number.`);
    }
    return amount;
}

export async function getMarketAssets(client, guildId) {
    const validGuildId = validateDiscordId(guildId, 'guildId');
    const stored = await client.db.get(assetsKey(validGuildId), null);
    const assets = Array.isArray(stored) && stored.length ? stored : DEFAULT_ASSETS;
    return assets.map(normalizeAsset);
}

export async function saveMarketAssets(client, guildId, assets) {
    const validGuildId = validateDiscordId(guildId, 'guildId');
    const normalized = assets.map(normalizeAsset);
    await client.db.set(assetsKey(validGuildId), normalized);
    return normalized;
}

export async function getPortfolio(client, guildId, userId) {
    const validGuildId = validateDiscordId(guildId, 'guildId');
    const validUserId = validateDiscordId(userId, 'userId');
    const [assets, holdingData] = await Promise.all([
        getMarketAssets(client, validGuildId),
        client.db.get(holdingKey(validGuildId, validUserId), {}),
    ]);
    const holdings = holdingData && typeof holdingData === 'object' ? holdingData : {};
    const assetMap = new Map(assets.map(asset => [asset.symbol, asset]));
    const positions = Object.entries(holdings)
        .filter(([, holding]) => Number(holding?.quantity) > 0 && assetMap.has(holding.symbol))
        .map(([, holding]) => {
            const asset = assetMap.get(holding.symbol);
            const quantity = Number(holding.quantity);
            const value = quantity * asset.price;
            const cost = quantity * Number(holding.averageCost || 0);
            return { ...holding, asset, quantity, value, cost, profit: value - cost };
        });
    return {
        positions,
        value: positions.reduce((sum, position) => sum + position.value, 0),
    };
}

export async function buyMarketAsset(client, guildId, userId, symbol, quantity) {
    const validGuildId = validateDiscordId(guildId, 'guildId');
    const validUserId = validateDiscordId(userId, 'userId');
    const units = validAmount(quantity, 'quantity');
    const normalizedSymbol = String(symbol).toUpperCase();

    return Mutex.runExclusive(`orbit-bank:ledger:${validGuildId}`, async () => {
        const [assets, account, existing] = await Promise.all([
            getMarketAssets(client, validGuildId),
            getEconomyData(client, validGuildId, validUserId),
            client.db.get(holdingKey(validGuildId, validUserId), {}),
        ]);
        const asset = assets.find(item => item.symbol === normalizedSymbol);
        if (!asset) {
            throw createError('Asset not found', ErrorTypes.VALIDATION, 'This asset is not available in the market.');
        }

        const total = asset.price * units;
        if (account.bank < total) {
            throw createError('Insufficient bank funds', ErrorTypes.VALIDATION, 'Investments must be purchased from your bank balance.');
        }

        const holdings = existing && typeof existing === 'object' ? existing : {};
        const current = holdings[normalizedSymbol] || { symbol: normalizedSymbol, quantity: 0, averageCost: 0 };
        const newQuantity = current.quantity + units;
        holdings[normalizedSymbol] = {
            symbol: normalizedSymbol,
            quantity: newQuantity,
            averageCost: Math.round(((current.quantity * current.averageCost) + total) / newQuantity),
            updatedAt: Date.now(),
        };

        account.bank -= total;
        const transaction = {
            id: randomUUID(),
            guildId: validGuildId,
            type: 'MARKET_PURCHASE',
            amount: total,
            users: [validUserId],
            metadata: { symbol: normalizedSymbol, quantity: units, price: asset.price },
            createdAt: Date.now(),
            status: 'completed',
        };
        await Promise.all([
            setEconomyData(client, validGuildId, validUserId, account),
            client.db.set(holdingKey(validGuildId, validUserId), holdings),
            client.db.set(transactionsKey(validGuildId, transaction.id), transaction),
        ]);
        return { asset, quantity: units, total, bank: account.bank, transaction };
    });
}

export async function sellMarketAsset(client, guildId, userId, symbol, quantity) {
    const validGuildId = validateDiscordId(guildId, 'guildId');
    const validUserId = validateDiscordId(userId, 'userId');
    const units = validAmount(quantity, 'quantity');
    const normalizedSymbol = String(symbol).toUpperCase();

    return Mutex.runExclusive(`orbit-bank:ledger:${validGuildId}`, async () => {
        const [assets, account, stored] = await Promise.all([
            getMarketAssets(client, validGuildId),
            getEconomyData(client, validGuildId, validUserId),
            client.db.get(holdingKey(validGuildId, validUserId), {}),
        ]);
        const asset = assets.find(item => item.symbol === normalizedSymbol);
        const holdings = stored && typeof stored === 'object' ? stored : {};
        const holding = holdings[normalizedSymbol];
        if (!asset || !holding || holding.quantity < units) {
            throw createError('Insufficient holdings', ErrorTypes.VALIDATION, 'You do not own enough of this asset to sell.');
        }

        const total = asset.price * units;
        const capacity = getMaxBankCapacity(account);
        if (account.bank + total > capacity) {
            throw createError('Bank capacity exceeded', ErrorTypes.VALIDATION, 'Selling this investment would exceed your bank capacity.');
        }

        holding.quantity -= units;
        if (holding.quantity === 0) delete holdings[normalizedSymbol];
        account.bank += total;
        const transaction = {
            id: randomUUID(),
            guildId: validGuildId,
            type: 'MARKET_SALE',
            amount: total,
            users: [validUserId],
            metadata: { symbol: normalizedSymbol, quantity: units, price: asset.price },
            createdAt: Date.now(),
            status: 'completed',
        };
        await Promise.all([
            setEconomyData(client, validGuildId, validUserId, account),
            client.db.set(holdingKey(validGuildId, validUserId), holdings),
            client.db.set(transactionsKey(validGuildId, transaction.id), transaction),
        ]);
        return { asset, quantity: units, total, bank: account.bank, transaction };
    });
}

export async function updateMarketPrices(client, guildId, state = 'STABLE') {
    const validGuildId = validateDiscordId(guildId, 'guildId');
    return Mutex.runExclusive(`orbit-market:${validGuildId}`, async () => {
        const multiplier = state === 'BULL' ? 1.3 : state === 'BEAR' ? 1.3 : state === 'VOLATILE' ? 1.8 : 1;
        const now = Date.now();
        const assets = await getMarketAssets(client, validGuildId);
        const updated = assets.map(asset => {
            const change = (Math.random() * 2 - 1) * asset.volatility * multiplier;
            const price = Math.max(1, Math.round(asset.price * (1 + change)));
            return normalizeAsset({
                ...asset,
                price,
                highPrice: Math.max(asset.highPrice, price),
                lowPrice: Math.min(asset.lowPrice, price),
                history: [...asset.history, { price, at: now }],
                updatedAt: now,
            });
        });
        await saveMarketAssets(client, validGuildId, updated);
        return updated;
    });
}
