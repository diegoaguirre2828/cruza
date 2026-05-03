// lib/ticket/qr.ts
import QRCode from 'qrcode';

/**
 * Encodes the Ticket id + content hash into a QR PNG data URL.
 * Officer scans → opens https://cruzar.app/ticket/<id> → public verifier confirms hash + signature.
 */
export async function generateTicketQrDataUrl(ticketId: string, contentHash: string, baseUrl = 'https://cruzar.app'): Promise<string> {
  const verifyUrl = `${baseUrl}/ticket/${ticketId}#h=${contentHash.slice(0, 16)}`;
  return QRCode.toDataURL(verifyUrl, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 240,
  });
}

export async function generateTicketQrPngBuffer(ticketId: string, contentHash: string, baseUrl = 'https://cruzar.app'): Promise<Buffer> {
  const verifyUrl = `${baseUrl}/ticket/${ticketId}#h=${contentHash.slice(0, 16)}`;
  return QRCode.toBuffer(verifyUrl, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 240,
  });
}
