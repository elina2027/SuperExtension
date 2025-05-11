// Keep track of injected tabs
const INJECTED_TABS = new Set();

// Function to inject scripts into a tab
async function injectScripts(tabId, url) {
  if (INJECTED_TABS.has(tabId)) {
    console.log('Scripts already injected in tab:', tabId);
    return;
  }

  if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
    console.log('Skipping injection for restricted page:', url);
    return;
  }

  console.log('Injecting scripts into tab:', tabId, url);

  try {
    // First inject matcher.js
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['cpp/matcher.js']
    });

    // Then inject content script
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });

    INJECTED_TABS.add(tabId);
    console.log('Scripts successfully injected into tab:', tabId);
  } catch (error) {
    console.error('Error injecting scripts:', error);
  }
}

// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
  INJECTED_TABS.clear();
});

// Listen for tab updates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    await injectScripts(tabId, tab.url);
  }
});

// Listen for tab removal
chrome.tabs.onRemoved.addListener((tabId) => {
  INJECTED_TABS.delete(tabId);
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ENSURE_INJECTION') {
    const { tabId } = message;
    chrome.tabs.get(tabId, async (tab) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
        return;
      }
      await injectScripts(tabId, tab.url);
      sendResponse({ success: true });
    });
    return true; // Will respond asynchronously
  }
});

// Listen for errors
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ERROR') {
    console.error('Content script error:', message.error);
  }
  return true;
}); 