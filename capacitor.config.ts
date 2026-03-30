import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hendr15k.openreader',
  appName: 'Open Reader',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;