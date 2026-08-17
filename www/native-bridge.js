/**
 * 心流日记 - 原生桥接脚本
 * 在 WebView 加载时注入，解决三个问题：
 * 1. 拦截导出功能，改用 Capacitor Filesystem 写入文件
 * 2. 屏蔽 Coze Analytics/Branding 上报（省积分）
 * 3. 本地化 Google Fonts（离线可用）
 */
(function () {
  'use strict';

  // ============ 1. 屏蔽 Coze / APM 外部请求 ============
  // 拦截 fetch 上报到 code.coze.cn 和 apm.volccdn.com
  const originalFetch = window.fetch;
  window.fetch = function (url, options) {
    const urlStr = typeof url === 'string' ? url : (url && url.url) || '';
    if (urlStr.includes('code.coze.cn') ||
        urlStr.includes('apm.volccdn.com') ||
        urlStr.includes('coze.site/api/')) {
      // 静默吞掉上报请求，返回空成功
      return Promise.resolve(new Response('{}', { status: 200 }));
    }
    return originalFetch.apply(this, arguments);
  };

  // 拦截 sendBeacon（APM 可能用这个上报）
  if (navigator.sendBeacon) {
    const originalBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function (url, data) {
      if (typeof url === 'string' &&
          (url.includes('code.coze.cn') || url.includes('apm.volccdn.com'))) {
        return true; // 假装成功
      }
      return originalBeacon(url, data);
    };
  }

  // 移除 Coze 右下角"扣子"浮标
  function removeCozeBadge() {
    const badge = document.getElementById('coze-coding-badge');
    if (badge) badge.remove();
  }

  // ============ 2. 导出功能适配（Capacitor Filesystem） ============
  // 检测是否在 Capacitor 环境中
  const isCapacitor = typeof window.Capacitor !== 'undefined' &&
                      window.Capacitor.isNativePlatform &&
                      window.Capacitor.isNativePlatform();

  /**
   * 将导出的文件内容写入设备存储
   * @param {string} filename - 文件名
   * @param {string} content - 文件内容
   * @param {string} mimeType - MIME 类型
   */
  async function saveFileNative(filename, content, mimeType) {
    if (!isCapacitor) {
      // 非 App 环境（浏览器调试），退回原下载逻辑
      return false;
    }

    try {
      // 动态加载 Capacitor Filesystem 插件
      const { Filesystem, Directory, Encoding } = await import(
        'https://cdn.jsdelivr.net/npm/@capacitor/filesystem@6.0.0/dist/esm/index.js'
      ).catch(() => null) || {};

      // 如果 ESM 加载失败，尝试从全局变量获取
      let fs = Filesystem;
      if (!fs && window.CapacitorFilesystem) {
        fs = window.CapacitorFilesystem;
      }

      if (!fs) {
        // 插件不可用，退回 share API
        return await shareFile(filename, content, mimeType);
      }

      // 写入 Downloads 目录
      const result = await fs.writeFile({
        path: 'Download/' + filename,
        data: btoa(unescape(encodeURIComponent(content))),
        directory: Directory.ExternalStorage,
        encoding: Encoding.UTF8,
        recursive: true,
      });

      // 显示成功提示
      showToast('已保存到下载文件夹：' + filename);
      return true;
    } catch (e) {
      // 写入失败，尝试用 Share API 分享
      return await shareFile(filename, content, mimeType);
    }
  }

  /**
   * 使用 Web Share API 分享文件（备选方案）
   */
  async function shareFile(filename, content, mimeType) {
    try {
      if (navigator.share && navigator.canShare) {
        const file = new File([content], filename, { type: mimeType });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: '心流日记导出',
            text: filename,
          });
          return true;
        }
      }
    } catch (e) {
      // 用户取消分享不算错误
      if (e.name === 'AbortError') return true;
    }
    // 都失败了，尝试在新窗口打开（最后兜底）
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    return false;
  }

  /**
   * 显示 Toast 提示
   */
  function showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = [
      'position: fixed',
      'top: 50%',
      'left: 50%',
      'transform: translate(-50%, -50%)',
      'background: rgba(0, 0, 0, 0.85)',
      'color: #fff',
      'padding: 16px 24px',
      'border-radius: 12px',
      'font-size: 14px',
      'z-index: 99999',
      'max-width: 80%',
      'text-align: center',
      'box-shadow: 0 4px 12px rgba(0,0,0,0.3)',
    ].join('; ');
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  // ============ 3. 拦截 a.download 点击，改用原生保存 ============
  // 监听全局点击事件，捕获动态生成的下载链接
  document.addEventListener('click', function (e) {
    const link = e.target.closest('a[download]');
    if (!link || !isCapacitor) return;

    // 拦截原始下载行为
    e.preventDefault();
    e.stopPropagation();

    const filename = link.download;
    const href = link.href;

    // 如果是 blob: URL，读取内容后用原生方式保存
    if (href.startsWith('blob:')) {
      fetch(href)
        .then(r => r.text())
        .then(content => {
          const mimeType = link.type || 'text/plain';
          saveFileNative(filename, content, mimeType);
        })
        .catch(() => {
          // 读取失败，允许原始行为
          window.location.href = href;
        });
    }
  }, true); // 使用捕获阶段，确保先于应用的事件处理

  // ============ 4. 监听应用内导出函数 ============
  // 应用的导出逻辑会创建 Blob URL 并触发点击，上面已拦截
  // 额外监听 DOM 变化，移除 Coze 浮标
  const observer = new MutationObserver(function () {
    removeCozeBadge();
  });

  // ============ 5. 初始化 ============
  function init() {
    removeCozeBadge();
    observer.observe(document.body, { childList: true, subtree: true });

    console.log('[心流日记] 原生桥接已加载，Coze 依赖已屏蔽');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
