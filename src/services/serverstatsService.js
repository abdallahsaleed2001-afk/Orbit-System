// Legacy compatibility shim.
// Server Stats was removed from the bot. These no-op exports remain only for
// old event modules that may still exist in deployments during migration.
export async function getServerCounters() {
  return [];
}

export async function saveServerCounters() {
  return true;
}

export async function updateCounter() {
  return true;
}
