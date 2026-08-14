import { randomUUID } from 'node:crypto';
import { getEconomyData, setEconomyData, getMaxBankCapacity } from '../utils/economy.js';
import { Mutex } from '../utils/mutex.js';
import { validateDiscordId } from '../utils/validation.js';
import { createError, ErrorTypes } from '../utils/errorHandler.js';

const DEFAULT_CARS = Object.freeze([
    { id: 'bmw_m4', name: 'BMW M4 Competition', brand: 'BMW', category: 'Sports', price: 120000, emoji: '🚗' },
    { id: 'tesla_model_s', name: 'Tesla Model S', brand: 'Tesla', category: 'Electric', price: 95000, emoji: '⚡' },
    { id: 'lamborghini_huracan', name: 'Lamborghini Huracan', brand: 'Lamborghini', category: 'Supercar', price: 300000, emoji: '🏎️' },
]);

function catalogKey(guildId) { return `guild:${guildId}:orbit-cars:catalog`; }
function garageKey(guildId, userId) { return `guild:${guildId}:orbit-cars:garage:${userId}`; }
function transactionKey(guildId, id) { return `guild:${guildId}:orbit-bank:transactions:${id}`; }

export async function getCarCatalog(client, guildId) {
    const validGuildId = validateDiscordId(guildId, 'guildId');
    const stored = await client.db.get(catalogKey(validGuildId), null);
    return Array.isArray(stored) && stored.length ? stored : DEFAULT_CARS.map(car => ({ ...car }));
}

export async function getGarage(client, guildId, userId) {
    const validGuildId = validateDiscordId(guildId, 'guildId');
    const validUserId = validateDiscordId(userId, 'userId');
    const stored = await client.db.get(garageKey(validGuildId, validUserId), []);
    return Array.isArray(stored) ? stored : [];
}

export async function buyCar(client, guildId, userId, carId) {
    const validGuildId = validateDiscordId(guildId, 'guildId');
    const validUserId = validateDiscordId(userId, 'userId');
    const id = String(carId).toLowerCase();

    return Mutex.runExclusive(`orbit-bank:ledger:${validGuildId}`, async () => {
        const [catalog, account, garage] = await Promise.all([
            getCarCatalog(client, validGuildId),
            getEconomyData(client, validGuildId, validUserId),
            getGarage(client, validGuildId, validUserId),
        ]);
        const car = catalog.find(item => item.id === id);
        if (!car) throw createError('Car not found', ErrorTypes.VALIDATION, 'This car is not available.');
        if (account.bank < car.price) throw createError('Insufficient bank funds', ErrorTypes.VALIDATION, 'Cars must be bought from your bank balance.');

        const owned = { instanceId: randomUUID(), carId: car.id, name: car.name, brand: car.brand, category: car.category, basePrice: car.price, currentValue: car.price, condition: 100, mileage: 0, level: 1, purchasedAt: Date.now() };
        account.bank -= car.price;
        garage.push(owned);
        const transaction = { id: randomUUID(), guildId: validGuildId, type: 'CAR_PURCHASE', amount: car.price, users: [validUserId], metadata: { instanceId: owned.instanceId, carId: car.id }, createdAt: Date.now(), status: 'completed' };
        await Promise.all([
            setEconomyData(client, validGuildId, validUserId, account),
            client.db.set(garageKey(validGuildId, validUserId), garage),
            client.db.set(transactionKey(validGuildId, transaction.id), transaction),
        ]);
        return { car: owned, bank: account.bank, transaction };
    });
}

export async function sellCar(client, guildId, userId, instanceId) {
    const validGuildId = validateDiscordId(guildId, 'guildId');
    const validUserId = validateDiscordId(userId, 'userId');

    return Mutex.runExclusive(`orbit-bank:ledger:${validGuildId}`, async () => {
        const [account, garage] = await Promise.all([
            getEconomyData(client, validGuildId, validUserId),
            getGarage(client, validGuildId, validUserId),
        ]);
        const index = garage.findIndex(car => car.instanceId === instanceId);
        if (index < 0) throw createError('Car not owned', ErrorTypes.VALIDATION, 'You do not own this car or it is already in an auction.');
        const car = garage[index];
        const saleValue = Math.max(1, Math.floor(car.currentValue * (car.condition / 100) * 0.8));
        if (account.bank + saleValue > getMaxBankCapacity(account)) throw createError('Bank capacity exceeded', ErrorTypes.VALIDATION, 'Selling this car would exceed your bank capacity.');

        garage.splice(index, 1);
        account.bank += saleValue;
        const transaction = { id: randomUUID(), guildId: validGuildId, type: 'CAR_SALE', amount: saleValue, users: [validUserId], metadata: { instanceId: car.instanceId, carId: car.carId }, createdAt: Date.now(), status: 'completed' };
        await Promise.all([
            setEconomyData(client, validGuildId, validUserId, account),
            client.db.set(garageKey(validGuildId, validUserId), garage),
            client.db.set(transactionKey(validGuildId, transaction.id), transaction),
        ]);
        return { car, saleValue, bank: account.bank, transaction };
    });
}
