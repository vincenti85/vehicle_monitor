// Vehicle key-tag QR codes: each tag encodes an app deep link (?unit=NN) that
// preselects that vehicle in the employee app when scanned with a phone camera.
import qrcode from 'qrcode-generator';

export const UNIT_QUERY_PARAM = 'unit';
const MIN_FLEET_NUMBER = 1;
const MAX_FLEET_NUMBER = 30;

export function resolveAppBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  const base =
    configured && configured.trim().length > 0
      ? configured.trim()
      : typeof window !== 'undefined'
        ? window.location.origin
        : '';
  return base.replace(/\/+$/, '');
}

export function buildVehicleDeepLink(baseUrl: string, fleetNumber: number): string {
  const unit = fleetNumber.toString().padStart(2, '0');
  return `${baseUrl}/?${UNIT_QUERY_PARAM}=${unit}`;
}

// Returns the fleet number from a query string, or null when absent/invalid.
export function parseUnitParam(search: string): number | null {
  const raw = new URLSearchParams(search).get(UNIT_QUERY_PARAM);
  if (raw === null || !/^\d{1,2}$/.test(raw.trim())) return null;
  const unit = Number(raw.trim());
  return unit >= MIN_FLEET_NUMBER && unit <= MAX_FLEET_NUMBER ? unit : null;
}

export function hasUnitParam(search: string): boolean {
  return new URLSearchParams(search).has(UNIT_QUERY_PARAM);
}

export function createQrSvg(data: string): string {
  const qr = qrcode(0, 'M');
  qr.addData(data);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
}
