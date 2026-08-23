import { getGuildConfig, setGuildConfig } from './config/guildConfig.js';

const TRIGGER_ACTIONS = new Set(['lock', 'unlock', 'hide', 'unhide', 'give_role', 'remove_role']);

export async function getTriggers(client, guildId) {
  const config = await getGuildConfig(client, guildId);
  return Array.isArray(config?.triggers) ? config.triggers : [];
}

export async function upsertTrigger(client, guildId, trigger) {
  const config = await getGuildConfig(client, guildId);
  const triggers = Array.isArray(config?.triggers) ? [...config.triggers] : [];
  const normalizedTrigger = String(trigger.trigger ?? '').trim();
  const index = triggers.findIndex((item) => String(item?.trigger ?? '') === normalizedTrigger);

  if (index >= 0) triggers[index] = { ...triggers[index], ...trigger, trigger: normalizedTrigger };
  else triggers.push({ ...trigger, trigger: normalizedTrigger });

  await setGuildConfig(client, guildId, { ...config, triggers });
  return triggers[index >= 0 ? index : triggers.length - 1];
}

export async function removeTrigger(client, guildId, trigger) {
  const config = await getGuildConfig(client, guildId);
  const normalized = String(trigger ?? '').trim();
  const triggers = Array.isArray(config?.triggers) ? config.triggers : [];
  const filtered = triggers.filter((item) => String(item?.trigger ?? '') !== normalized);
  if (filtered.length === triggers.length) return false;
  await setGuildConfig(client, guildId, { ...config, triggers: filtered });
  return true;
}

export function isValidTriggerAction(action) {
  return TRIGGER_ACTIONS.has(action);
}

export function normalizeTriggerContent(content) {
  return String(content ?? '').trim();
}

export { TRIGGER_ACTIONS };
