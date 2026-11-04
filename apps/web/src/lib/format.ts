const TR = 'tr-TR';

/** "AYŞECAN" -> "Ayşecan", respecting Turkish dotted/dotless i. */
export function toTitleCaseTr(value: string): string {
    return value
        .toLocaleLowerCase(TR)
        .replace(/(^|[\s(/-])(\p{L})/gu, (_match, separator, letter) => {
            return separator + letter.toLocaleUpperCase(TR);
        });
}

export function pharmacyDisplayName(name: string): string {
    return `${toTitleCaseTr(name)} Eczanesi`;
}

export function formatDistance(km: number): string {
    if (km < 1) return `${Math.round(km * 100) * 10} m`;
    if (km < 10) return `${km.toFixed(1).replace('.', ',')} km`;
    return `${Math.round(km)} km`;
}

/** "0 (539) 635 80 55" style for display; links keep the raw digits. */
export function formatPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 11) return phone;
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9)}`;
}

const dateFormatter = new Intl.DateTimeFormat(TR, {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
    timeZone: 'UTC',
});

/** "2026-11-04" -> "4 Kasım Çarşamba" */
export function formatDutyDate(isoDate: string): string {
    return dateFormatter.format(new Date(`${isoDate}T00:00:00Z`));
}

/** Case- and diacritic-insensitive key for Turkish search. */
export function searchKey(value: string): string {
    return value
        .toLocaleLowerCase(TR)
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/ı/g, 'i');
}
