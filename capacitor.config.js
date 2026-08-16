/** @type {import('@capacitor/cli').CapacitorConfig} */
const config = {
  appId: 'com.mindflow.diary',
  appName: '心流日记',
  webDir: 'www',
  server: {
    androidScheme: 'https',
    url: 'https://7zz6z7z6zh.coze.site',
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#1e1e32',
  },
};

module.exports = config;
