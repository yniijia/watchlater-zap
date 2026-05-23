const WL_MATCH = 'youtube.com/playlist?list=WL';
const BADGE_COLOR = '#e85d4c';
const SECONDS_PER_VIDEO = 2.5;
const RING_CIRCUMFERENCE = 326.73;

const panels = {
  onboarding: document.getElementById('onboarding'),
  wrongPage: document.getElementById('wrong-page'),
  ready: document.getElementById('ready-state'),
  confirm: document.getElementById('confirm-state'),
  progress: document.getElementById('progress-state'),
  complete: document.getElementById('complete-state')
};

const els = {
  videoCount: document.getElementById('video-count'),
  etaEstimate: document.getElementById('eta-estimate'),
  confirmCount: document.getElementById('confirm-count'),
  confirmCheckbox: document.getElementById('confirm-checkbox'),
  confirmDelete: document.getElementById('confirm-delete'),
  progressRing: document.getElementById('progress-ring-fill'),
  progressPercent: document.getElementById('progress-percent'),
  statusTitle: document.getElementById('status-title'),
  statusDetail: document.getElementById('status-detail'),
  statusEta: document.getElementById('status-eta'),
  completeMessage: document.getElementById('complete-message'),
  completeIcon: document.getElementById('complete-icon'),
  error: document.getElementById('error'),
  privacyLink: document.getElementById('privacy-link'),
  dismissOnboarding: document.getElementById('dismiss-onboarding'),
  zapBtn: document.getElementById('zap-btn'),
  refreshCount: document.getElementById('refresh-count'),
  cancelConfirm: document.getElementById('cancel-confirm'),
  cancelBtn: document.getElementById('cancel-btn'),
  doneBtn: document.getElementById('done-btn')
};

let activeTab = null;
let videoCount = 0;
let startTime = null;
let messageListener = null;

document.addEventListener('DOMContentLoaded', init);

async function init() {
  bindEvents();
  els.privacyLink.href = chrome.runtime.getURL('PRIVACY.md');
  await maybeShowOnboarding();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTab = tab;

  if (!tab.url?.includes(WL_MATCH)) {
    showPanel('wrongPage');
    return;
  }

  await loadVideoCount();
  showPanel('ready');
}

function bindEvents() {
  els.dismissOnboarding.addEventListener('click', dismissOnboarding);
  els.zapBtn.addEventListener('click', showConfirm);
  els.refreshCount.addEventListener('click', () => loadVideoCount(true));
  els.cancelConfirm.addEventListener('click', () => showPanel('ready'));
  els.confirmCheckbox.addEventListener('change', (event) => {
    els.confirmDelete.disabled = !event.target.checked;
  });
  els.confirmDelete.addEventListener('click', startDeletion);
  els.cancelBtn.addEventListener('click', cancelDeletion);
  els.doneBtn.addEventListener('click', resetToReady);
}

async function maybeShowOnboarding() {
  const { onboardingSeen } = await chrome.storage.local.get('onboardingSeen');
  if (!onboardingSeen) panels.onboarding.classList.remove('hidden');
}

async function dismissOnboarding() {
  await chrome.storage.local.set({ onboardingSeen: true });
  panels.onboarding.classList.add('hidden');
}

function showPanel(name) {
  Object.entries(panels).forEach(([key, panel]) => {
    if (key === 'onboarding') return;
    panel.classList.toggle('hidden', key !== name);
  });
  hideError();
}

function showConfirm() {
  els.confirmCount.textContent = formatCount(videoCount);
  els.confirmCheckbox.checked = false;
  els.confirmDelete.disabled = true;
  showPanel('confirm');
}

async function loadVideoCount(showLoading = false) {
  if (showLoading) {
    els.videoCount.textContent = '...';
    els.etaEstimate.textContent = '...';
  }

  try {
    videoCount = await queryVideoCount(activeTab.id);
  } catch {
    videoCount = 0;
    showError('Could not read playlist. Try refreshing the YouTube page.');
  }

  els.videoCount.textContent = formatCount(videoCount);
  els.etaEstimate.textContent = formatDuration(videoCount * SECONDS_PER_VIDEO);

  const btnText = els.zapBtn.querySelector('.btn-text');
  if (videoCount === 0) {
    els.zapBtn.disabled = true;
    btnText.textContent = 'Nothing to clear';
  } else {
    els.zapBtn.disabled = false;
    btnText.textContent = 'Clear All Videos';
  }
}

async function queryVideoCount(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: 'getCount' });
    if (response?.count != null) return response.count;
  } catch {
    // Content script may not be ready yet
  }

  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => document.querySelectorAll('ytd-playlist-video-renderer').length
  });

  return result?.result ?? 0;
}

async function startDeletion() {
  showPanel('progress');
  resetProgressUI();
  startTime = Date.now();

  if (messageListener) {
    chrome.runtime.onMessage.removeListener(messageListener);
  }

  messageListener = (message, sender) => {
    if (sender.tab?.id !== activeTab.id) return;
    handleProgressUpdate(message);
  };

  chrome.runtime.onMessage.addListener(messageListener);

  try {
    await chrome.tabs.sendMessage(activeTab.id, { type: 'startDeletion' });
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      files: ['js/content.js']
    });
    await chrome.tabs.sendMessage(activeTab.id, { type: 'startDeletion' });
  }
}

async function cancelDeletion() {
  els.statusTitle.textContent = 'Cancelling...';
  els.cancelBtn.disabled = true;

  try {
    await chrome.tabs.sendMessage(activeTab.id, { type: 'cancelDeletion' });
  } catch {
    // Tab may have closed or navigated away
  }
}

function resetProgressUI() {
  updateRing(0);
  els.progressPercent.textContent = '0%';
  els.statusTitle.textContent = 'Clearing playlist...';
  els.statusDetail.textContent = '0 of 0 removed';
  els.statusEta.textContent = '';
  els.cancelBtn.disabled = false;
}

function handleProgressUpdate(message) {
  const { type, data } = message;

  switch (type) {
    case 'progress':
      updateProgress(data.current, data.total);
      break;
    case 'complete':
      showComplete(data.removed, data.cancelled);
      break;
    case 'error':
      showError(data.message);
      showPanel('ready');
      break;
  }
}

function updateProgress(current, total) {
  const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;

  updateRing(percent);
  els.progressPercent.textContent = `${percent}%`;
  els.statusDetail.textContent = `${current} of ${total} removed`;

  if (current > 0 && startTime) {
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = current / elapsed;
    const remaining = Math.max(0, total - current);
    const etaSeconds = rate > 0 ? remaining / rate : 0;
    els.statusEta.textContent = etaSeconds > 0
      ? `About ${formatDuration(etaSeconds)} remaining`
      : '';
  }
}

function updateRing(percent) {
  const offset = RING_CIRCUMFERENCE - (percent / 100) * RING_CIRCUMFERENCE;
  els.progressRing.style.strokeDashoffset = String(offset);
}

function showComplete(count, cancelled = false) {
  if (messageListener) {
    chrome.runtime.onMessage.removeListener(messageListener);
    messageListener = null;
  }

  els.completeIcon.classList.remove('animate');
  void els.completeIcon.offsetWidth;
  els.completeIcon.classList.add('animate');

  if (cancelled) {
    els.completeMessage.textContent = `Stopped early. Removed ${formatCount(count)} video${count === 1 ? '' : 's'}.`;
  } else {
    els.completeMessage.textContent = `Removed ${formatCount(count)} video${count === 1 ? '' : 's'}. Your playlist is clear.`;
  }

  showPanel('complete');
}

async function resetToReady() {
  await loadVideoCount();
  showPanel('ready');
}

function showError(message) {
  els.error.textContent = message;
  els.error.classList.remove('hidden');
}

function hideError() {
  els.error.classList.add('hidden');
}

function formatCount(value) {
  return value.toLocaleString();
}

function formatDuration(totalSeconds) {
  const seconds = Math.ceil(totalSeconds);
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;

  if (minutes < 60) {
    return remainder > 0 ? `${minutes}m ${remainder}s` : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
