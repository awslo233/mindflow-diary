import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mindflow.diary',
  appName: '心流日记',
  webDir: 'www',
  // 本地打包模式：加载 www/ 下的静态文件，不再依赖 Coze 服务器
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#1e1e32',
  },
};

export default config;
