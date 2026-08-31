import re

path = '/home/z/my-project/PlayArab-System-V2/src/commands/Security/security.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add snapshot to PANEL_META (after settings)
old_meta = "  settings: ['\u2699\ufe0f Settings', 'Global protection and security behavior.'],"
new_meta = "  settings: ['\u2699\ufe0f Settings', 'Global protection and security behavior.'],\n  snapshot: ['\U0001f4f8 Snapshot', 'Periodic role and permission comparison to detect slow changes.'],"
content = content.replace(old_meta, new_meta)

# 2. Add snapshot button to MAIN_BUTTONS (before the last entry)
old_btns = "  ['security_panel_appeals', '\U0001f4e8 Appeals', ButtonStyle.Primary],"
new_btns = "  ['security_panel_snapshot', '\U0001f4f8 Snapshot', ButtonStyle.Primary],\n  ['security_panel_appeals', '\U0001f4e8 Appeals', ButtonStyle.Primary],"
content = content.replace(old_btns, new_btns)

# 3. Add snapshot case in buildSecurityControls - the third row has appeals + refresh
# Current: button(`security_panel_appeals:${userId}`, '📨 Appeals', ButtonStyle.Primary), button(`security_refresh:${userId}`, '🔄 Refresh', ButtonStyle.Success)
old_row3 = "    new ActionRowBuilder().addComponents(button(`security_panel_appeals:${userId}`, '\U0001f4e8 Appeals', ButtonStyle.Primary), button(`security_refresh:${userId}`, '\U0001f504 Refresh', ButtonStyle.Success)),"
new_row3 = "    new ActionRowBuilder().addComponents(button(`security_panel_snapshot:${userId}`, '\U0001f4f8 Snapshot', ButtonStyle.Primary), button(`security_panel_appeals:${userId}`, '\U0001f4e8 Appeals', ButtonStyle.Primary), button(`security_refresh:${userId}`, '\U0001f504 Refresh', ButtonStyle.Success)),"
content = content.replace(old_row3, new_row3)

# 4. Add snapshot to buildSecurityPanel
class Pattern:
    pass

# Add snapshot panel data after settings
old_settings_panel = "  else data = [`**Global protection:** ${status(config.enabled)}`"
new_snapshot_panel = """  else if (panel === 'snapshot') data = [
    `**Timer:** ${config.snapshot?.timerActive ? '\U0001f7e2 Active' : '\U0001f534 Inactive'}`,
    `**Last run:** ${config.snapshot?.lastRun ? '<t:' + Math.floor(config.snapshot.lastRun / 1000) + ':R>' : 'Never'}`,
    `**Last changes:** ${config.snapshot?.lastChanges ?? 'N/A'}`,
    '', 'Periodically captures server roles, channels and permission overwrites, then compares them to detect slow, gradual unauthorized changes (e.g. someone slowly adding dangerous permissions to a role over multiple edits).',
  ];
  else data = [`**Global protection:** ${status(config.enabled)}`"""
content = content.replace(old_settings_panel, new_snapshot_panel)

# 5. Add snapshot color in buildSecurityPanel
old_color = "panel === 'nuke' ? 0xed4245 : panel === 'raid' ? 0xf47b67 : panel === 'massRole' ? 0xe67e22 : panel === 'automod' ? 0x5865f2 : panel === 'strikes' ? 0xfee75c : 0x57f287"
new_color = "panel === 'nuke' ? 0xed4245 : panel === 'raid' ? 0xf47b67 : panel === 'massRole' ? 0xe67e22 : panel === 'automod' ? 0x5865f2 : panel === 'strikes' ? 0xfee75c : panel === 'snapshot' ? 0x9b59b6 : 0x57f287"
content = content.replace(old_color, new_color)

# 6. Add snapshot controls in buildSecurityPanelControls
old_else_controls = "  else rows.push(new ActionRowBuilder().addComponents(button(id('security_back'), '\u2190 Back'), button(id('security_settings_toggle'), config.enabled ? '\U0001f7e2 Disable Protection' : '\U0001f534 Enable Protection', config.enabled ? ButtonStyle.Danger : ButtonStyle.Success), button(id('security_settings_refresh'), '\U0001f504 Refresh')));"
new_controls = """  else if (panel === 'snapshot') rows.push(new ActionRowBuilder().addComponents(button(id('security_back'), '\u2190 Back'), button(id('security_snapshot_run'), '\U0001f50d Run Now', ButtonStyle.Primary), button(id('security_snapshot_view'), '\U0001f4ca View Report', ButtonStyle.Success)));
  else rows.push(new ActionRowBuilder().addComponents(button(id('security_back'), '\u2190 Back'), button(id('security_settings_toggle'), config.enabled ? '\U0001f7e2 Disable Protection' : '\U0001f534 Enable Protection', config.enabled ? ButtonStyle.Danger : ButtonStyle.Success), button(id('security_settings_refresh'), '\U0001f504 Refresh')));"""
content = content.replace(old_else_controls, new_controls)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Done - snapshot button added to MAIN_BUTTONS and all related sections')
