/**
 * Android Native Bridge Interface & Polyfills
 * Supports window.AndroidBridge and window.Android for WebView integration
 */

export interface AndroidBridgeInterface {
  isAndroidBridgeAvailable: () => boolean;
  getDeviceId: () => string;
  readSmsList?: () => string;
  sendSms?: (data: string) => void;
  requestSmsPermissions?: () => void;
  isDefaultSmsHandler?: () => boolean;
  vibrate?: (ms: number) => void;
  showToast?: (msg: string) => void;
  downloadApk?: (url: string) => void;
}

declare global {
  interface Window {
    AndroidBridge?: AndroidBridgeInterface;
    Android?: any;
  }
}

export const nativeBridge: AndroidBridgeInterface = {
  isAndroidBridgeAvailable: () => {
    if (typeof window === 'undefined') return false;
    return !!(window.AndroidBridge || window.Android);
  },

  getDeviceId: () => {
    if (typeof window !== 'undefined') {
      try {
        if (window.AndroidBridge?.getDeviceId) {
          return window.AndroidBridge.getDeviceId();
        }
        if (window.Android?.getDeviceId) {
          return window.Android.getDeviceId();
        }
        const stored = localStorage.getItem('samsung_device_id');
        if (stored) return stored;
      } catch {}
    }
    return 'dev_galaxy_a12';
  },

  readSmsList: () => {
    if (typeof window !== 'undefined') {
      try {
        if (window.AndroidBridge?.readSmsList) {
          return window.AndroidBridge.readSmsList();
        }
        if (window.Android?.readSmsList) {
          return window.Android.readSmsList();
        }
      } catch {}
    }
    return '[]';
  },

  sendSms: (data: string) => {
    if (typeof window !== 'undefined') {
      try {
        if (window.AndroidBridge?.sendSms) {
          window.AndroidBridge.sendSms(data);
          return;
        }
        if (window.Android?.sendSms) {
          window.Android.sendSms(data);
          return;
        }
      } catch {}
    }
  },

  requestSmsPermissions: () => {
    if (typeof window !== 'undefined') {
      try {
        if (window.AndroidBridge?.requestSmsPermissions) {
          window.AndroidBridge.requestSmsPermissions();
          return;
        }
        if (window.Android?.requestSmsPermissions) {
          window.Android.requestSmsPermissions();
          return;
        }
      } catch {}
    }
  },

  isDefaultSmsHandler: () => {
    if (typeof window !== 'undefined') {
      try {
        if (window.AndroidBridge?.isDefaultSmsHandler) {
          return window.AndroidBridge.isDefaultSmsHandler();
        }
        if (window.Android?.isDefaultSmsHandler) {
          return window.Android.isDefaultSmsHandler();
        }
      } catch {}
    }
    return true;
  },

  vibrate: (ms: number = 40) => {
    if (typeof window !== 'undefined') {
      try {
        if (window.Android?.vibrate) {
          window.Android.vibrate(ms);
          return;
        }
        if (navigator.vibrate) {
          navigator.vibrate(ms);
        }
      } catch {}
    }
  },

  showToast: (msg: string) => {
    if (typeof window !== 'undefined') {
      try {
        if (window.Android?.showToast) {
          window.Android.showToast(msg);
          return;
        }
      } catch {}
    }
  },

  downloadApk: (url: string) => {
    if (typeof window !== 'undefined') {
      try {
        if (window.Android?.downloadApk) {
          window.Android.downloadApk(url);
          return;
        }
      } catch {}
      window.location.href = url;
    }
  },
};
