// Legacy compatibility shim. Ticket commands/services were removed from the bot.
// These exports remain only so older database facade imports cannot crash startup.

export async function getTicketData() { return null; }
export async function getOpenTicketCountForUser() { return 0; }
export async function saveTicketData() { return false; }
export async function deleteTicketData() { return false; }
export async function getTicketCounter() { return 0; }
export async function incrementTicketCounter() { return 0; }
export async function getGuildTicketStats() { return { total: 0, open: 0, closed: 0 }; }
