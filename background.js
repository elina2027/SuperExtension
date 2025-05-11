// Keep track of tabs where scripts are injected
const injectedTabs = new Set();

// Inject content scripts when extension is installed
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
  // Clear the injected tabs set on installation
  injectedTabs.clear();
});

// Inject scripts when tab is updated
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && 
      !tab.url.startsWith('chrome://') && 
      !tab.url.startsWith('chrome-extension://')) {
    
    // Check if scripts are already injected
    if (injectedTabs.has(tabId)) {
      console.log('Scripts already injected in tab:', tabId);
      return;
    }
    
    console.log('Injecting scripts into tab:', tab.url);
    
    try {
      // First inject the matcher.js
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['cpp/matcher.js']
      });
      
      // Then inject the content script
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js']
      });
      
      // Mark this tab as injected
      injectedTabs.add(tabId);
      console.log('Scripts injected successfully');
    } catch (error) {
      console.error('Error injecting scripts:', error);
    }
  }
});

// Clean up when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  injectedTabs.delete(tabId);
});

// Listen for errors
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ERROR') {
    console.error('Content script error:', message.error);
  }
  return true;
}); 