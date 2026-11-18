import type { CapacitorConfig } from '@capacitor/cli';

// The shell serves the built Encore web app inside a native WebView, so
// Kane's mobile runs exercise exactly the same app, markup and planted
// barriers as the web lanes. CI copies apps/encore/dist into ./www before
// `cap add android`.
const config: CapacitorConfig = {
  appId: 'com.blindrun.encore',
  appName: 'Encore',
  webDir: 'www',
  android: {
    webContentsDebuggingEnabled: true,
  },
};

export default config;
