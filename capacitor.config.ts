import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cocoon.app',
  appName: 'Cocoon',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
