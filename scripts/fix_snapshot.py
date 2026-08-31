import re

# Fix 1: Add snapshot to SECURITY_DEFAULTS
path1 = '/home/z/my-project/PlayArab-System-V2/src/services/security/securityService.js'
with open(path1, 'r', encoding='utf-8') as f:
    content = f.read()

old_defaults_end = "  whitelist: { users: [], roles: [], bots: [] },\n  ignoredChannels: [], logChannelId: null,\n};"
new_defaults_end = "  whitelist: { users: [], roles: [], bots: [] },\n  ignoredChannels: [], logChannelId: null,\n  snapshot: { enabled: true },\n};"
content = content.replace(old_defaults_end, new_defaults_end)

with open(path1, 'w', encoding='utf-8') as f:
    f.write(content)
print('Fixed SECURITY_DEFAULTS - added snapshot')

# Fix 2: Add force parameter to runSnapshotCycle
path2 = '/home/z/my-project/PlayArab-System-V2/src/services/security/snapshotService.js'
with open(path2, 'r', encoding='utf-8') as f:
    content = f.read()

# Change function signature to accept force option
old_sig = 'export async function runSnapshotCycle(guild, client) {'
new_sig = 'export async function runSnapshotCycle(guild, client, { force = false } = {}) {'
content = content.replace(old_sig, new_sig)

# Change the guard to respect force
old_guard = '  if (!config.snapshot?.enabled && !config._manualSnapshot) return;'
new_guard = '  if (!force && !config.snapshot?.enabled && !config._manualSnapshot) return;'
content = content.replace(old_guard, new_guard)

with open(path2, 'w', encoding='utf-8') as f:
    f.write(content)
print('Fixed runSnapshotCycle - added force parameter')

# Fix 3: Update handlers to pass force: true for manual run
path3 = '/home/z/my-project/PlayArab-System-V2/src/handlers/securityDashboardCore.js'
with open(path3, 'r', encoding='utf-8') as f:
    content = f.read()

old_run = 'const result = await runSnapshotCycle(i.guild, c);'
new_run = 'const result = await runSnapshotCycle(i.guild, c, { force: true });'
content = content.replace(old_run, new_run)

with open(path3, 'w', encoding='utf-8') as f:
    f.write(content)
print('Fixed handler - passes force: true')

print('All fixes applied!')