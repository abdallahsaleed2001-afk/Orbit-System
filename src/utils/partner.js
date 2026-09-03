import { getFromDb, setInDb } from './database.js';

const PARTNER_KEY = 'partner:data';
const LEGACY_KEYS = ['partnership:data', 'partnership:settings'];

const DEFAULTS = {
  minMembers: 100,
  applicationsChannelId: null,
  logsChannelId: null,
  panelChannelId: null,
  panelMessageId: null,
};

function normalize(data) {
  const storedMin = Number(data?.requirements?.minMembers ?? data?.minMembers);
  const minMembers = !Number.isFinite(storedMin) || storedMin === 500 ? 100 : Math.max(100, storedMin);

  return {
    ...DEFAULTS,
    ...data,
    minMembers,
    requirements: {
      ...(data?.requirements || {}),
      minMembers,
    },
  };
}

export async function getPartnerData() {
  let data = await getFromDb(PARTNER_KEY, null);

  if (!data) {
    for (const key of LEGACY_KEYS) {
      data = await getFromDb(key, null);
      if (data) break;
    }
  }

  const normalized = normalize(data || {});

  if (!data || Number(data?.requirements?.minMembers ?? data?.minMembers) < 100 || Number(data?.requirements?.minMembers ?? data?.minMembers) === 500) {
    await setInDb(PARTNER_KEY, normalized);
  }

  return normalized;
}

export async function updatePartnerData(patch = {}) {
  const current = await getPartnerData();
  const merged = normalize({ ...current, ...patch });
  await setInDb(PARTNER_KEY, merged);
  return merged;
}

export function buildPartnerPanel(data) {
  return {
    title: 'الشراكة',
    description: 'حاب تسوي شراكة مع سيرفرنا؟ اضغط **تقديم طلب شراكة** وأرسل بيانات سيرفرك.\n\n[🤝](https://discord.com/assets/5f20af75bca0b153.svg)・**__شروط الشراكة__**\n\n• 100+ عضو\n• سيرفر نشط وتفاعل حقيقي\n• بدون مخالفات أو محتوى مخالف\n• إعلان متبادل بين السيرفرين\n• احترام الطرف الآخر\n• مخالفة الشروط = إنهاء الشراكة',
  };
}

export default {
  getPartnerData,
  updatePartnerData,
  buildPartnerPanel,
};
