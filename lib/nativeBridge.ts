/**
 * Android Native Bridge Interface & Polyfills
 * Primary: window.AndroidSMSBridge (as provided in MainActivity.kt)
 * Secondary: window.AndroidBridge, window.Android
 */

export interface NativeSmsRecord {
  id: string;
  address: string;
  body: string;
  date: number; // Unix timestamp in ms
  type: 'inbox' | 'sent';
  read: boolean;
}

export interface NativeContactRecord {
  id: string;
  name: string;
  phone: string;
}

export interface AndroidSMSBridgeInterface {
  isDefaultSmsApp: () => boolean;
  requestDefaultSmsApp: () => void;
  requestPermissions: () => void;
  hasPermissions: () => boolean;
  getAllSms: (limit: number) => string; // JSON string of NativeSmsRecord[]
  sendSms: (address: string, body: string) => boolean;
  playSystemNotificationSound: () => void;
  triggerSystemVibration: () => void;
  getAllContacts: () => string; // JSON string of NativeContactRecord[]
}

declare global {
  interface Window {
    AndroidSMSBridge?: AndroidSMSBridgeInterface;
    AndroidBridge?: any;
    Android?: any;
    onNativeSmsReceived?: (rawJson: string | object) => void;
    onDefaultSmsGranted?: () => void;
    onPermissionsGranted?: () => void;
  }
}

class NativeBridgeHelper {
  public isAvailable(): boolean {
    if (typeof window === 'undefined') return false;
    return !!(window.AndroidSMSBridge || window.AndroidBridge || window.Android);
  }

  public isDefaultSmsApp(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      if (window.AndroidSMSBridge?.isDefaultSmsApp) {
        return window.AndroidSMSBridge.isDefaultSmsApp();
      }
      if (window.AndroidBridge?.isDefaultSmsHandler) {
        return window.AndroidBridge.isDefaultSmsHandler();
      }
      if (window.Android?.isDefaultSmsApp) {
        return window.Android.isDefaultSmsApp();
      }
    } catch (err) {
      console.warn('NativeBridge.isDefaultSmsApp error:', err);
    }
    return false;
  }

  public requestDefaultSmsApp(): void {
    if (typeof window === 'undefined') return;
    try {
      if (window.AndroidSMSBridge?.requestDefaultSmsApp) {
        window.AndroidSMSBridge.requestDefaultSmsApp();
        return;
      }
      if (window.AndroidBridge?.requestSmsPermissions) {
        window.AndroidBridge.requestSmsPermissions();
        return;
      }
      if (window.Android?.requestDefaultSmsApp) {
        window.Android.requestDefaultSmsApp();
      }
    } catch (err) {
      console.warn('NativeBridge.requestDefaultSmsApp error:', err);
    }
  }

  public requestPermissions(): void {
    if (typeof window === 'undefined') return;
    try {
      if (window.AndroidSMSBridge?.requestPermissions) {
        window.AndroidSMSBridge.requestPermissions();
        return;
      }
      if (window.Android?.requestPermissions) {
        window.Android.requestPermissions();
      }
    } catch (err) {
      console.warn('NativeBridge.requestPermissions error:', err);
    }
  }

  public hasPermissions(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      if (window.AndroidSMSBridge?.hasPermissions) {
        return window.AndroidSMSBridge.hasPermissions();
      }
    } catch {}
    return false;
  }

  public getAllSms(limit: number = 200): NativeSmsRecord[] {
    if (typeof window === 'undefined') return [];
    try {
      let rawJson = '';
      if (window.AndroidSMSBridge?.getAllSms) {
        rawJson = window.AndroidSMSBridge.getAllSms(limit);
      } else if (window.AndroidBridge?.readSmsList) {
        rawJson = window.AndroidBridge.readSmsList();
      } else if (window.Android?.getAllSms) {
        rawJson = window.Android.getAllSms(limit);
      }
      if (rawJson) {
        const parsed = JSON.parse(rawJson);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (err) {
      console.warn('NativeBridge.getAllSms error:', err);
    }
    return [];
  }

  public sendSms(address: string, body: string): boolean {
    if (typeof window === 'undefined') return false;
    try {
      if (window.AndroidSMSBridge?.sendSms) {
        return window.AndroidSMSBridge.sendSms(address, body);
      }
      if (window.Android?.sendSms) {
        return window.Android.sendSms(address, body);
      }
    } catch (err) {
      console.warn('NativeBridge.sendSms error:', err);
    }
    return false;
  }

  public getAllContacts(): NativeContactRecord[] {
    if (typeof window === 'undefined') return [];
    try {
      let rawJson = '';
      if (window.AndroidSMSBridge?.getAllContacts) {
        rawJson = window.AndroidSMSBridge.getAllContacts();
      } else if (window.Android?.getAllContacts) {
        rawJson = window.Android.getAllContacts();
      }
      if (rawJson) {
        const parsed = JSON.parse(rawJson);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (err) {
      console.warn('NativeBridge.getAllContacts error:', err);
    }
    return [];
  }

  public playSystemNotificationSound(): void {
    if (typeof window === 'undefined') return;
    try {
      if (window.AndroidSMSBridge?.playSystemNotificationSound) {
        window.AndroidSMSBridge.playSystemNotificationSound();
        return;
      }
    } catch {}
  }

  public triggerSystemVibration(): void {
    if (typeof window === 'undefined') return;
    try {
      if (window.AndroidSMSBridge?.triggerSystemVibration) {
        window.AndroidSMSBridge.triggerSystemVibration();
        return;
      }
      if (navigator.vibrate) {
        navigator.vibrate([0, 180, 80, 240]);
      }
    } catch {}
  }

  public getDeviceId(): string {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('samsung_device_id');
        if (stored) return stored;
      } catch {}
    }
    return 'dev_galaxy_a12';
  }
}

export const nativeBridge = new NativeBridgeHelper();
