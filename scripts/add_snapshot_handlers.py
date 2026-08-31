import re

path = '/home/z/my-project/PlayArab-System-V2/src/handlers/securityDashboardCore.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add security_panel_snapshot2 to panelHandlers map
old_panel_map = "security_panel_nuke: 'nuke', security_panel_raid: 'raid', security_panel_massRole: 'massRole', security_panel_snapshot: 'snapshot',"
new_panel_map = "security_panel_nuke: 'nuke', security_panel_raid: 'raid', security_panel_massRole: 'massRole', security_panel_snapshot2: 'snapshot', security_panel_snapshot: 'snapshot',"
content = content.replace(old_panel_map, new_panel_map)

# 2. Add non-2 snapshot handlers before the closing ];
# Find the last handler (snapshot_view2) and add after it
old_last = "  { name: 'snapshot_view2', execute: async (i, c) => { if (!ok(i)) return deny(i); const report = await generateSnapshotReport(i.guild, c); return i.update({ embeds: [embed(report.title, report.description, i.guild, report.color).addFields(report.fields)], components: [row(button(\`security_panel_snapshot:\${i.user.id}\`, '\u2190 Back'), button(\`snapshot_run2:\${i.user.id}\`, '\U0001f50d Run Now', ButtonStyle.Primary))] }); } },"
new_last = old_last + "\n" + "  { name: 'security_snapshot_run', execute: async (i, c) => { if (!ok(i)) return deny(i); await i.deferUpdate(); const result = await runSnapshotCycle(i.guild, c); if (result) { const n = result.changes?.length || 0; await i.followUp({ content: n > 0 ? '\U0001f6a8 Detected ' + n + ' change(s), logged.' : '\u2705 No dangerous changes.', ephemeral: true }); } else { await i.followUp({ content: '\u274c Snapshot failed.', ephemeral: true }); } return panel(i, c, 'snapshot'); } },\n" + "  { name: 'security_snapshot_view', execute: async (i, c) => { if (!ok(i)) return deny(i); const report = await generateSnapshotReport(i.guild, c); return i.update({ embeds: [embed(report.title, report.description, i.guild, report.color).addFields(report.fields)], components: [row(button(\`security_panel_snapshot:\${i.user.id}\`, '\u2190 Back'), button(\`snapshot_run2:\${i.user.id}\`, '\U0001f50d Run Now', ButtonStyle.Primary))] }); } },"
content = content.replace(old_last, new_last)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Done - added snapshot handlers')