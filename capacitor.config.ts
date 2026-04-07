import type { CapacitorConfig } from '@capacitor/core';

const config: CapacitorConfig = {
  appId: 'br.edu.ifrn.h5pmobilereader',
  appName: 'H5P MobileReader',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    Filesystem: {
      androidDirectory: 'files',
    },
  },
};

export default config;
