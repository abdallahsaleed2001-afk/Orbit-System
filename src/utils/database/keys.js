/**
 * Canonical database key registry.
 * All storage keys should be built through these helpers.
 */

export const getGuildConfigKey = (guildId) => `guild:${guildId}:config`;
export const getGuildBirthdaysKey = (guildId) => `guild:${guildId}:birthdays`;
export const getBirthdayLeftBackupKey = (guildId) => `guild:${guildId}:birthdays:left`;
export const getBirthdayTrackingKey = (guildId) => `guild:${guildId}:birthdays:tracking`;

// Legacy compatibility only. Ticket and server-status features are removed.
export const getTicketKey = (guildId, ticketId) => `guild:${guildId}:ticket:${ticketId}`;
export const getTicketCounterKey = (guildId) => `guild:${guildId}:ticket_counter`;
export const getServerCountersKey = (guildId) => `guild:${guildId}:counters`;

export const getInviteTrackingKey = (guildId) => `guild:${guildId}:invites`;
export const getMemberInvitesKey = (guildId, userId) => `guild:${guildId}:invites:${userId}`;
export const getInviteUsesKey = (guildId, inviteCode) => `guild:${guildId}:invite_uses:${inviteCode}`;
export const getFakeAccountKey = (guildId, userId) => `guild:${guildId}:fake_account:${userId}`;

export const getEconomyKey = (guildId, userId) => `guild:${guildId}:economy:${userId}`;
export const getEconomyPrefix = (guildId) => `guild:${guildId}:economy:`;
export const getAFKKey = (guildId, userId) => `guild:${guildId}:afk:${userId}`;
export const getWelcomeConfigKey = (guildId) => `guild:${guildId}:welcome`;
export const getLevelingKey = (guildId) => `guild:${guildId}:leveling:config`;
export const getUserLevelKey = (guildId, userId) => `guild:${guildId}:leveling:users:${userId}`;
export const getUserLevelPrefix = (guildId) => `guild:${guildId}:leveling:users:`;

export const getApplicationRolesKey = (guildId) => `guild:${guildId}:applications:roles`;
export const getApplicationSettingsKey = (guildId) => `guild:${guildId}:applications:settings`;
export const getUserApplicationsKey = (guildId, userId) => `guild:${guildId}:applications:users:${userId}`;
export const getApplicationKey = (guildId, applicationId) => `guild:${guildId}:applications:${applicationId}`;
export const getApplicationsPrefix = (guildId) => `guild:${guildId}:applications:`;

export const getJoinToCreateConfigKey = (guildId) => `guild:${guildId}:jointocreate`;
export const getJoinToCreateChannelsKey = (guildId) => `guild:${guildId}:jointocreate:channels`;
export const getWarningsKey = (guildId, userId) => `guild:${guildId}:warnings:${userId}`;
export const getWarningsPrefix = (guildId) => `guild:${guildId}:warnings:`;
export const getUserNotesKey = (guildId, userId) => `guild:${guildId}:usernotes:${userId}`;
export const getUserNotesListKey = (guildId) => `guild:${guildId}:usernotes:list`;
export const getReactionRoleKey = (guildId, messageId) => `guild:${guildId}:reaction_roles:${messageId}`;
export const getReactionRolesPrefix = (guildId) => `guild:${guildId}:reaction_roles:`;
export const getGiveawayEntryKey = (userId, giveawayId) => `giveaway:${userId}:${giveawayId}`;
export const getGiveawayLockKey = (messageId) => `giveaway:lock:${messageId}`;

/** Legacy key patterns mapped to canonical builders. */
export const LEGACY_KEY_RESOLVERS = [
    { pattern: /^economy:([^:]+):([^:]+)$/, toCanonical: ([, guildId, userId]) => getEconomyKey(guildId, userId) },
    { pattern: /^birthdays:([^:]+)$/, toCanonical: ([, guildId]) => getGuildBirthdaysKey(guildId) },
    { pattern: /^([^:]+):leveling:users:([^:]+)$/, toCanonical: ([, guildId, userId]) => getUserLevelKey(guildId, userId), skipIf: (guildId) => guildId === 'guild' },
    { pattern: /^moderation:warnings:([^:]+):([^:]+)$/, toCanonical: ([, guildId, userId]) => getWarningsKey(guildId, userId) },
    { pattern: /^moderation_user_notes_([^_]+)_([^_]+)$/, toCanonical: ([, guildId, userId]) => getUserNotesKey(guildId, userId) },
    { pattern: /^moderation_user_notes_list_([^_]+)$/, toCanonical: ([, guildId]) => getUserNotesListKey(guildId) },
    { pattern: /^reaction_roles:([^:]+):([^:]+)$/, toCanonical: ([, guildId, messageId]) => getReactionRoleKey(guildId, messageId) },
    { pattern: /^bday-role-tracking-([^:]+)$/, toCanonical: ([, guildId]) => getBirthdayTrackingKey(guildId) },
];

export function canonicalizeKey(key) {
    if (typeof key !== 'string' || !key) return key;
    for (const { pattern, toCanonical, skipIf } of LEGACY_KEY_RESOLVERS) {
        const match = key.match(pattern);
        if (!match) continue;
        if (skipIf?.(match[1])) continue;
        return toCanonical(match);
    }
    return key;
}

export function getLegacyVariantsForCanonical(canonicalKey) {
    const variants = [];
    for (const { toCanonical } of LEGACY_KEY_RESOLVERS) {
        const sample = canonicalKey;
        const match = sample.match(/^guild:([^:]+):economy:([^:]+)$/);
        if (match && toCanonical(['', match[1], match[2]]) === canonicalKey) { variants.push(`economy:${match[1]}:${match[2]}`); continue; }
        const birthdaysMatch = sample.match(/^guild:([^:]+):birthdays$/);
        if (birthdaysMatch && toCanonical(['', birthdaysMatch[1]]) === canonicalKey) { variants.push(`birthdays:${birthdaysMatch[1]}`); continue; }
        const levelMatch = sample.match(/^guild:([^:]+):leveling:users:([^:]+)$/);
        if (levelMatch && toCanonical(['', levelMatch[1], levelMatch[2]]) === canonicalKey) { variants.push(`${levelMatch[1]}:leveling:users:${levelMatch[2]}`); continue; }
        const warningsMatch = sample.match(/^guild:([^:]+):warnings:([^:]+)$/);
        if (warningsMatch && toCanonical(['', warningsMatch[1], warningsMatch[2]]) === canonicalKey) { variants.push(`moderation:warnings:${warningsMatch[1]}:${warningsMatch[2]}`); continue; }
        const notesMatch = sample.match(/^guild:([^:]+):usernotes:([^:]+)$/);
        if (notesMatch && toCanonical(['', notesMatch[1], notesMatch[2]]) === canonicalKey) { variants.push(`moderation_user_notes_${notesMatch[1]}_${notesMatch[2]}`); continue; }
        const notesListMatch = sample.match(/^guild:([^:]+):usernotes:list$/);
        if (notesListMatch && toCanonical(['', notesListMatch[1]]) === canonicalKey) { variants.push(`moderation_user_notes_list_${notesListMatch[1]}`); continue; }
        const reactionMatch = sample.match(/^guild:([^:]+):reaction_roles:([^:]+)$/);
        if (reactionMatch && toCanonical(['', reactionMatch[1], reactionMatch[2]]) === canonicalKey) { variants.push(`reaction_roles:${reactionMatch[1]}:${reactionMatch[2]}`); continue; }
        const trackingMatch = sample.match(/^guild:([^:]+):birthdays:tracking$/);
        if (trackingMatch && toCanonical(['', trackingMatch[1]]) === canonicalKey) variants.push(`bday-role-tracking-${trackingMatch[1]}`);
    }
    return variants;
}
