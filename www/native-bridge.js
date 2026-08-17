(function () {
  'use strict';

  // ============ 1. 屏蔽 Coze / APM 外部请求 ============
  const originalFetch = window.fetch;
  window.fetch = function (url, options) {
    const urlStr = typeof url === 'string' ? url : (url && url.url) || '';
    if (urlStr.includes('code.coze.cn') ||
        urlStr.includes('apm.volccdn.com') ||
        urlStr.includes('coze.site/api/')) {
      return Promise.resolve(new Response('{}', { status: 200 }));
    }
    return originalFetch.apply(this, arguments);
  };

  if (navigator.sendBeacon) {
    const originalBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function (url, data) {
      if (typeof url === 'string' &&
          (url.includes('code.coze.cn') || url.includes('apm.volccdn.com'))) {
        return true;
      }
      return originalBeacon(url, data);
    };
  }

  function removeCozeBadge() {
    const badge = document.getElementById('coze-coding-badge');
    if (badge) badge.remove();
  }

  // ============ 2. Capacitor 环境检测 ============
  let isCapacitor = false;
  let FilesystemPlugin = null;

  function detectCapacitor() {
    isCapacitor = !!(window.Capacitor && window.Capacitor.isNativePlatform &&
                     window.Capacitor.isNativePlatform());
    if (isCapacitor && window.Capacitor.Plugins) {
      FilesystemPlugin = window.Capacitor.Plugins.Filesystem || null;
    }
  }

  // 等待 Capacitor 就绪
  function waitForCapacitor(cb) {
    detectCapacitor();
    if (isCapacitor) {
      cb();
    } else {
      document.addEventListener('deviceready', function () {
        detectCapacitor();
        cb();
      }, { once: true });
      setTimeout(function () {
        detectCapacitor();
        cb();
      }, 1000);
    }
  }

  // ============ 3. 导出功能适配 ============
  async function saveFileNative(filename, content, mimeType) {
    if (!FilesystemPlugin) {
      return await shareFile(filename, content, mimeType);
    }

    try {
      const base64Content = btoa(unescape(encodeURIComponent(content)));

      await FilesystemPlugin.writeFile({
        path: 'Download/' + filename,
        data: base64Content,
        directory: 'ExternalStorage',
        encoding: 'UTF8',
        recursive: true,
      });

      showToast('已保存到下载文件夹：' + filename);
      return true;
    } catch (e) {
      console.warn('[心流日记] Filesystem 写入失败，尝试分享:', e);
      return await shareFile(filename, content, mimeType);
    }
  }

  async function shareFile(filename, content, mimeType) {
    try {
      if (navigator.share && navigator.canShare) {
        const file = new File([content], filename, { type: mimeType });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: '心流日记导出',
          });
          return true;
        }
      }
    } catch (e) {
      if (e.name === 'AbortError') return true;
    }
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    return false;
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = [
      'position:fixed', 'top:50%', 'left:50%',
      'transform:translate(-50%,-50%)',
      'background:rgba(0,0,0,0.85)', 'color:#fff',
      'padding:16px 24px', 'border-radius:12px',
      'font-size:14px', 'z-index:99999',
      'max-width:80%', 'text-align:center',
      'box-shadow:0 4px 12px rgba(0,0,0,0.3)',
    ].join(';');
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  // ============ 4. 拦截 a.download 点击 ============
  document.addEventListener('click', function (e) {
    const link = e.target.closest('a[download]');
    if (!link || !isCapacitor) return;

    e.preventDefault();
    e.stopPropagation();

    const filename = link.download || 'export.txt';
    const href = link.href;

    if (href.startsWith('blob:')) {
      fetch(href)
        .then(function (r) { return r.text(); })
        .then(function (content) {
          const mimeType = link.type || 'text/plain';
          saveFileNative(filename, content, mimeType);
        })
        .catch(function () {
          window.location.href = href;
        });
    } else if (href.startsWith('data:')) {
      const mimeType = href.split(',')[0].split(';')[0].replace('data:', '');
      const isBase64 = href.includes(';base64,');
      const rawData = href.split(',')[1] || '';
      const content = isBase64 ? decodeURIComponent(escape(atob(rawData))) : decodeURIComponent(rawData);
      saveFileNative(filename, content, mimeType || 'text/plain');
    }
  }, true);

  // ============ 5. 监听 DOM 变化，移除 Coze 浮标 ============
  const observer = new MutationObserver(function () {
    removeCozeBadge();
  });

  // ============ 6. 初始化 ============
  function init() {
    removeCozeBadge();
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
    console.log('[心流日记] 原生桥接已加载，Coze 依赖已屏蔽');
  }

  waitForCapacitor(function () {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  });
})();
