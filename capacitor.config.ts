import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mindflow.diary',
  appName: '心流日记',
  webDir: 'www',
  // 加载远程 Coze 站点，WebView 套壳模式
  server: {
    androidScheme: 'https',
    url: 'https://7zz6z7z6zh.coze.site',
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#1e1e32',
  },
};

export default config;
