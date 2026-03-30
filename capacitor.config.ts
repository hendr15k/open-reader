import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hendr15k.julesreader',
  appName: 'Jules Reader',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;