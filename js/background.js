const WL_MATCH = 'youtube.com/playlist?list=WL';
const BADGE_COLOR = '#e85d4c';

function setBadge(tabId, text) {
  chrome.action.setBadgeText({ tabId, text });
  chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE_COLOR });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;

  if (tab.url.includes(WL_MATCH)) {
    chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE_COLOR });
    return;
  }

  setBadge(tabId, '');
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type !== 'badge' || !sender.tab?.id) return;
  setBadge(sender.tab.id, message.data.text);
});
