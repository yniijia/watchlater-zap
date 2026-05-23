(function () {
  if (window.__watchLaterZapLoaded) return;
  window.__watchLaterZapLoaded = true;

  const CONFIG = {
    MENU_CLICK_DELAY: 300,
    REMOVE_CLICK_DELAY: 500,
    MAX_RETRIES: 5
  };

  const WL_MATCH = 'youtube.com/playlist?list=WL';

  let isDeleting = false;
  let shouldCancel = false;

  function isWatchLaterPage() {
    return window.location.href.includes(WL_MATCH);
  }

  function getVideoElements() {
    return document.querySelectorAll('ytd-playlist-video-renderer');
  }

  function getVideoCount() {
    return getVideoElements().length;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function updateBadge(count) {
    const text = count > 0 ? (count > 999 ? '999+' : String(count)) : '';
    chrome.runtime.sendMessage({ type: 'badge', data: { text } });
  }

  function sendMessage(type, data) {
    chrome.runtime.sendMessage({ type, data });
  }

  async function scrollDown() {
    window.scrollBy(0, 500);
    await sleep(1000);
  }

  async function removeVideo(videoElement) {
    for (let retry = 0; retry < CONFIG.MAX_RETRIES; retry++) {
      if (shouldCancel) return false;

      try {
        const menuButton = videoElement.querySelector('button[aria-label="Action menu"]');
        if (!menuButton) {
          await sleep(300);
          continue;
        }

        menuButton.click();
        await sleep(CONFIG.MENU_CLICK_DELAY);

        const menuItems = document.querySelectorAll('tp-yt-paper-listbox ytd-menu-service-item-renderer');
        const removeButton = Array.from(menuItems).find(item => {
          const text = item.textContent.trim().toLowerCase();
          return text.includes('remove from') && text.includes('watch later');
        });

        if (!removeButton) {
          document.body.click();
          await sleep(300);
          continue;
        }

        removeButton.click();
        await sleep(CONFIG.REMOVE_CLICK_DELAY);
        return true;
      } catch (error) {
        console.error('WatchLater Zap:', error);
        await sleep(500);
      }
    }

    return false;
  }

  async function startWatchLaterDeletion() {
    if (isDeleting) return;

    isDeleting = true;
    shouldCancel = false;

    try {
      if (!isWatchLaterPage()) {
        sendMessage('error', { message: 'This does not appear to be a Watch Later playlist.' });
        return;
      }

      let totalVideos = getVideoCount();
      let removedCount = 0;

      sendMessage('progress', { current: removedCount, total: totalVideos });

      while (!shouldCancel) {
        const videoElements = getVideoElements();
        if (videoElements.length === 0) break;

        if (videoElements.length > totalVideos - removedCount) {
          totalVideos = videoElements.length + removedCount;
        }

        const success = await removeVideo(videoElements[0]);
        if (shouldCancel) break;

        if (success) {
          removedCount++;
          sendMessage('progress', { current: removedCount, total: totalVideos });
          updateBadge(Math.max(0, totalVideos - removedCount));
        } else {
          await scrollDown();
          const newCount = getVideoElements().length;
          if (newCount === 0 || newCount === videoElements.length) break;
        }

        await sleep(100);
      }

      sendMessage('complete', { removed: removedCount, cancelled: shouldCancel });
      updateBadge(getVideoCount());
    } catch (error) {
      console.error('WatchLater Zap:', error);
      sendMessage('error', { message: `An error occurred: ${error.message}` });
    } finally {
      isDeleting = false;
      shouldCancel = false;
    }
  }

  function initPage() {
    if (!isWatchLaterPage()) return;

    updateBadge(getVideoCount());

    const observer = new MutationObserver(() => {
      if (!isDeleting) updateBadge(getVideoCount());
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    switch (message.type) {
      case 'getCount':
        sendResponse({ count: isWatchLaterPage() ? getVideoCount() : 0 });
        break;
      case 'startDeletion':
        startWatchLaterDeletion();
        sendResponse({ started: true });
        break;
      case 'cancelDeletion':
        shouldCancel = true;
        sendResponse({ cancelled: true });
        break;
    }

    return true;
  });

  initPage();
})();
