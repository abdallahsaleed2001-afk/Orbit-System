import re

# 1. Add 'كراسي' to commandAliases
path1 = '/home/z/my-project/PlayArab-System-V2/src/config/commands/commandAliases.js'
with open(path1, 'r', encoding='utf-8') as f:
    content = f.read()
old = "    'روليت': 'roulette',"
new = "    'روليت': 'roulette', 'كراسي': 'chairs',"
content = content.replace(old, new)
with open(path1, 'w', encoding='utf-8') as f:
    f.write(content)
print('1. Added alias: كراسي -> chairs')

# 2. Add chairs to GAME_INFO in games.js
path2 = '/home/z/my-project/PlayArab-System-V2/src/commands/Fun/games.js'
with open(path2, 'r', encoding='utf-8') as f:
    content = f.read()
old_import = "import { getRoulette } from '../../services/games/rouletteService.js';"
new_import = """import { getRoulette } from '../../services/games/rouletteService.js';
import { hasActiveChairs } from '../../services/games/chairsService.js';"""
content = content.replace(old_import, new_import)

old_game_info = "  x: { label: 'إكس أو', description: 'تنافس في إكس أو وحاول تكوين ثلاثة متتالية.' },\n};"
new_game_info = """  x: { label: 'إكس أو', description: 'تنافس في إكس أو وحاول تكوين ثلاثة متتالية.' },
  chairs: { label: 'كراسي', description: 'سباق للجلوس على الكراسي - آخر واحد يخرج.' },
};"""
content = content.replace(old_game_info, new_game_info)

old_has_active = "    || getRoulette(guildId, channelId)"
new_has_active = "    || getRoulette(guildId, channelId)\n    || hasActiveChairs(guildId, channelId)"
content = content.replace(old_has_active, new_has_active)

with open(path2, 'w', encoding='utf-8') as f:
    f.write(content)
print('2. Added chairs to games menu and active check')

# 3. Add 'chairs' to GAME_NAMES in gameStatsService.js
path3 = '/home/z/my-project/PlayArab-System-V2/src/services/games/gameStatsService.js'
with open(path3, 'r', encoding='utf-8') as f:
    content = f.read()
old_names = "    xo: 'إكس أو',"
new_names = "    xo: 'إكس أو',\n    chairs: 'كراسي',"
content = content.replace(old_names, new_names)
with open(path3, 'w', encoding='utf-8') as f:
    f.write(content)
print('3. Added chairs to game stats')

print('All registrations done!')
