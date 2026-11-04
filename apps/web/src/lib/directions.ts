// Canonical URLs: Google's `google.com/maps` and Apple's legacy `?daddr=` both
// redirect first, and the extra hop can stop Android/iOS from handing the link
// to the native Maps app.

export function googleMapsDirectionsUrl(lat: number, lng: number): string {
    const params = new URLSearchParams({
        api: '1',
        destination: `${lat},${lng}`,
    });
    return `https://www.google.com/maps/dir/?${params}`;
}

export function appleMapsDirectionsUrl(lat: number, lng: number): string {
    const params = new URLSearchParams({ destination: `${lat},${lng}` });
    return `https://maps.apple.com/directions?${params}`;
}
