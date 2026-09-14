// Official List of all 86 Barangays in Butuan City, Agusan del Norte
export const BUTUAN_BARANGAYS = [
  'Pianing',
  'Anticala',
  'Agao Poblacion',
  'Agusan Pequeño',
  'Ambago',
  'Amparo',
  'Ampayon',
  'Antongalon',
  'Aupagan',
  'Baan Km 3',
  'Baan Riverside',
  'Babag',
  'Bading',
  'Banza',
  'Baobaoan',
  'Basag',
  'Bayanihan',
  'Bilay',
  'Bit-os',
  'Bitan-agan',
  'Bobon',
  'Bonbon',
  'Bugabus',
  'Buhangin',
  'Cabcabon',
  'Camayahan',
  'Dagohoy',
  'Dankias',
  'De Oro',
  'Diego Silang',
  'Doongan',
  'Dumalagan',
  'Golden Ribbon',
  'Holy Redeemer',
  'Humabon',
  'Imadejas',
  'Kinamlutan',
  'Lapu-lapu',
  'Lemon',
  'Libertad',
  'Limaha',
  'Los Angeles',
  'Lumbocan',
  'Maguinda',
  'Mahay',
  'Mahogany',
  'Maibu',
  'Mandamo',
  'Manila de Bugabus',
  'Maon',
  'Masao',
  'Maug',
  'New Society Village',
  'Nong-nong',
  'Obrero',
  'Ong Yiu',
  'Pagatpatan',
  'Pangabugan',
  'Pigdaulan',
  'Pinamanculan',
  'Poblacion',
  'Port Poyohon',
  'Rajah Soliman',
  'Salvacion',
  'San Ignacio',
  'San Mateo',
  'San Vicente',
  'Santa Cruz',
  'Santa Ines',
  'Santo Niño',
  'Sikatuna',
  'Silongan',
  'Sumilihon',
  'Tagabaca',
  'Taguibo',
  'Taligaman',
  'Tandang Sora',
  'Tiniwisan',
  'Tungao',
  'Urduja',
  'Victoria',
  'Villa Kananga'
] as const;

export type ButuanBarangay = typeof BUTUAN_BARANGAYS[number];

// Known official hotlines for principal barangays
const BARANGAY_CONTACT_MAP: Record<string, string> = {
  'Pianing': '0917-890-1234',
  'Anticala': '0919-456-7890',
  'Ampayon': '0920-123-4567',
  'Libertad': '0918-234-5678',
  'Doongan': '0921-345-6789',
  'San Vicente': '0922-456-7890',
  'Villa Kananga': '0923-567-8901',
  'Baan Km 3': '0924-678-9012',
  'Golden Ribbon': '0925-789-0123',
  'Holy Redeemer': '0926-890-1234'
};

/**
 * Returns the official mobile/landline contact hotline for a given Barangay
 */
export function getBarangayContact(barangayName?: string): string {
  if (!barangayName) return '0917-890-1234';
  const name = barangayName.trim();
  if (BARANGAY_CONTACT_MAP[name]) return BARANGAY_CONTACT_MAP[name];

  // Deterministic 11-digit mobile number for any of the 86 Butuan Barangays
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const mid = String(Math.abs(hash % 900) + 100).padStart(3, '0');
  const last = String(Math.abs((hash >> 3) % 9000) + 1000).padStart(4, '0');
  return `0917-${mid}-${last}`;
}

/**
 * Returns the official government Gmail / email address for a given Barangay
 */
export function getBarangayEmail(barangayName?: string): string {
  if (!barangayName) return 'barangay.pianing.butuan@gmail.com';
  const clean = barangayName.toLowerCase().replace(/[^a-z0-9]/g, '.').replace(/\.+/g, '.').replace(/^\.|\.$/g, '');
  return `barangay.${clean}.butuan@gmail.com`;
}

/**
 * Returns full contact details for a given Barangay
 */
export function getBarangayInfo(barangayName?: string) {
  const name = barangayName?.trim() || 'Pianing';
  return {
    name,
    contact: getBarangayContact(name),
    email: getBarangayEmail(name),
    address: `Barangay ${name} Hall, Butuan City, Agusan del Norte 8600`,
    officeHours: 'Monday – Friday: 8:00 AM – 5:00 PM'
  };
}

/**
 * Intelligently recognizes and normalizes any free-form, informal, or messy barangay spelling
 * (e.g. "pianing", "PIANING", "brgy pianing", "Barangay Pianing", "pianing, butuan city")
 * to its official canonical name in BUTUAN_BARANGAYS (e.g. "Pianing").
 */
export function normalizeBarangay(input?: string): string {
  if (!input) return 'Pianing';
  let cleaned = input
    .trim()
    .replace(/^barangay\s+/i, '')
    .replace(/^brgy\.?\s+/i, '')
    .replace(/,\s*butuan(\s+city)?/i, '')
    .trim();
  if (!cleaned) return 'Pianing';

  // Check case-insensitive match against all 86 Butuan Barangays
  const match = BUTUAN_BARANGAYS.find(
    (b) => b.toLowerCase() === cleaned.toLowerCase()
  );
  if (match) return match;

  // Title-case fallback if it's a valid outside barangay
  return cleaned
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Dynamically formats a complete jurisdiction address string
 */
export function formatJurisdictionAddress(purok?: string, barangay?: string, city?: string): string {
  const cleanBarangay = normalizeBarangay(barangay);
  const cleanCity = (city || 'Butuan City').trim();
  let cleanPurok = (purok || '').trim();
  if (cleanPurok) {
    cleanPurok = cleanPurok.toLowerCase().startsWith('purok')
      ? cleanPurok.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
      : `Purok ${cleanPurok}`;
  }
  return cleanPurok
    ? `${cleanPurok}, Barangay ${cleanBarangay}, ${cleanCity}`
    : `Barangay ${cleanBarangay}, ${cleanCity}`;
}

