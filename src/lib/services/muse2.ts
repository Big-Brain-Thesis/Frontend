import type { EEGConnectionStatus, EEGSample, EEGStream } from '$lib/types/eeg';

const MUSE_SERVICE_UUID = '273e0001-4c4d-454d-96be-f03bac821358';
const MUSE_EEG_CHAR_UUID = '273e0003-4c4d-454d-96be-f03bac821358';

function isWebBluetoothAvailable(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof (navigator as any).bluetooth !== 'undefined' &&
    typeof (navigator as any).bluetooth.requestDevice === 'function'
  );
}

function parse24BitSigned(view: DataView, offset: number): number {
  const byte0 = view.getUint8(offset);
  const byte1 = view.getUint8(offset + 1);
  const byte2 = view.getUint8(offset + 2);
  let value = (byte2 << 16) | (byte1 << 8) | byte0;

  if (value & 0x800000) {
    value = value | 0xff000000;
  }

  return value;
}

function normalizeMuseValue(raw: number): number {
  const normalized = Math.abs(raw) / 100000;
  return Number(Math.max(0, Math.min(1, normalized)).toFixed(4));
}

function parseMuseNotification(value: DataView): number[] {
  const length = value.byteLength;

  if (length >= 12 && length % 12 === 0) {
    const chunkStart = length - 12;
    const channelValues: number[] = [];

    for (let i = 0; i < 4; i += 1) {
      channelValues.push(parse24BitSigned(value, chunkStart + i * 3));
    }

    return channelValues;
  }

  if (length >= 16 && length % 16 === 0) {
    const chunkStart = length - 16;
    return [
      value.getInt32(chunkStart, true),
      value.getInt32(chunkStart + 4, true),
      value.getInt32(chunkStart + 8, true),
      value.getInt32(chunkStart + 12, true)
    ];
  }

  if (length >= 8) {
    return [
      value.getInt16(0, true),
      value.getInt16(2, true),
      value.getInt16(4, true),
      value.getInt16(6, true)
    ];
  }

  return [0, 0, 0, 0];
}

export class Muse2EEGStream implements EEGStream {
  private device: any = null;
  private characteristic: any = null;
  private listeners = new Set<(sample: EEGSample) => void>();
  private statusListeners = new Set<(status: EEGConnectionStatus) => void>();
  private currentStatus: EEGConnectionStatus = 'disconnected';
  private onCharacteristicValueChanged: ((event: Event) => void) | null = null;

  async connect(): Promise<void> {
    if (!isWebBluetoothAvailable()) {
      throw new Error('Web Bluetooth is not available in this browser. Use Chrome or Edge with https.');
    }

    this.setStatus('connecting');

    this.device = await (navigator as any).bluetooth.requestDevice({
      filters: [{ namePrefix: 'Muse' }],
      optionalServices: [MUSE_SERVICE_UUID]
    });

    if (!this.device.gatt) {
      throw new Error('Unable to access GATT server on Muse device.');
    }

    this.device.addEventListener('gattserverdisconnected', () => {
      this.setStatus('disconnected');
    });

    const server = await this.device.gatt.connect();
    const service = await server.getPrimaryService(MUSE_SERVICE_UUID);
    const characteristic = await service.getCharacteristic(MUSE_EEG_CHAR_UUID);
    this.characteristic = characteristic;

    this.onCharacteristicValueChanged = (event: Event) => {
      const target = event.target as any;
      const dataView = target.value;
      if (!dataView) return;

      const rawChannels = parseMuseNotification(dataView);
      const sample: EEGSample = {
        timestamp: Date.now(),
        channels: {
          AF7: normalizeMuseValue(rawChannels[0]),
          AF8: normalizeMuseValue(rawChannels[1]),
          TP9: normalizeMuseValue(rawChannels[2]),
          TP10: normalizeMuseValue(rawChannels[3])
        },
        focusScore: Number(
          (
            (normalizeMuseValue(rawChannels[0]) +
              normalizeMuseValue(rawChannels[1]) +
              normalizeMuseValue(rawChannels[2]) +
              normalizeMuseValue(rawChannels[3])) /
            4
          ).toFixed(4)
        )
      };

      this.listeners.forEach((listener) => listener(sample));
    };

    await characteristic.startNotifications();
    characteristic.addEventListener('characteristicvaluechanged', this.onCharacteristicValueChanged);
    this.setStatus('connected');
  }

  disconnect(): void {
    if (this.characteristic && this.onCharacteristicValueChanged) {
      this.characteristic.removeEventListener('characteristicvaluechanged', this.onCharacteristicValueChanged);
      this.onCharacteristicValueChanged = null;
    }

    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect();
    }

    this.characteristic = null;
    this.device = null;
    this.setStatus('disconnected');
  }

  onSample(callback: (sample: EEGSample) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  onStatusChange(callback: (status: EEGConnectionStatus) => void): () => void {
    this.statusListeners.add(callback);
    callback(this.currentStatus);
    return () => this.statusListeners.delete(callback);
  }

  private setStatus(status: EEGConnectionStatus): void {
    this.currentStatus = status;
    this.statusListeners.forEach((listener) => listener(status));
  }
}

export const muse2EEGStream = new Muse2EEGStream();
export const muse2Supported = isWebBluetoothAvailable();
