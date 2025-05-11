// Function to inject scripts into the current tab
async function injectScripts(tabId) {
  try {
    console.log('Injecting matcher.js...');
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['cpp/matcher.js']
    });
    
    console.log('Injecting content.js...');
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
    
    // Wait a moment for scripts to initialize
    await new Promise(resolve => setTimeout(resolve, 200));
    return true;
  } catch (error) {
    console.error('Script injection error:', error);
    return false;
  }
}

// Function to try sending a message with retries
async function sendMessageWithRetry(tabId, message, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`Retry attempt ${attempt}...`);
        await injectScripts(tabId);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      return await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, message, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
    } catch (error) {
      console.log(`Attempt ${attempt + 1} failed:`, error);
      if (attempt === maxRetries) throw error;
    }
  }
}

let timerInterval = null;

document.getElementById('highlight').onclick = async () => {
  const word1 = document.getElementById('word1').value.trim();
  const gap = parseInt(document.getElementById('gap').value, 10);
  const word2 = document.getElementById('word2').value.trim();
  
  // Input validation
  if (!word1 || !word2) {
    alert('Please enter both words');
    return;
  }

  if (isNaN(gap) || gap < 0) {
    alert('Please enter a valid gap number (0 or greater)');
    return;
  }
  
  // Reset match counter and show loading state
  const matchesElement = document.getElementById('matches');
  const timingElement = document.getElementById('timing');
  matchesElement.textContent = 'Searching...';
  
  // Clear any existing timer
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  
  // Start timing
  const startTime = performance.now();
  timerInterval = setInterval(() => {
    const currentTime = performance.now();
    const elapsedSeconds = ((currentTime - startTime) / 1000).toFixed(2);
    timingElement.textContent = `Time: ${elapsedSeconds}s`;
  }, 10); // Update every 10ms for smooth display
  
  try {
    // Get current tab
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    
    if (!tab || !tab.id) {
      throw new Error('Could not find active tab');
    }

    // Check if we can inject scripts
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      throw new Error('RESTRICTED_PAGE');
    }

    console.log('Attempting to send message to tab:', tab.id);
    
    // Try to send message with automatic retries
    const response = await sendMessageWithRetry(tab.id, {word1, gap, word2});
    
    // Stop the timer
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    
    // Calculate final time
    const endTime = performance.now();
    const finalTime = ((endTime - startTime) / 1000).toFixed(2);
    timingElement.textContent = `Time: ${finalTime}s`;
    
    if (response && response.error) {
      throw new Error(response.error);
    }

    if (response && typeof response.matchCount === 'number') {
      matchesElement.textContent = 
        `Matches found: ${response.matchCount}` + 
        (response.highlightCount !== undefined ? 
          ` (${response.highlightCount} highlighted)` : '');
    } else {
      matchesElement.textContent = 'No matches found';
    }
  } catch (error) {
    // Stop the timer on error
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    
    console.error('Error:', error);
    matchesElement.textContent = 'Error occurred';
    timingElement.textContent = 'Time: 0.00s';

    if (error.message === 'RESTRICTED_PAGE') {
      alert('This extension cannot run on Chrome system pages. Please try on a regular webpage.');
    } else if (error.message.includes('cannot be scripted')) {
      alert('This page cannot be accessed by the extension due to Chrome security restrictions.');
    } else {
      // Try reloading the page
      try {
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        if (tab && tab.id) {
          await chrome.tabs.reload(tab.id);
          alert('Please wait for the page to reload and try again.');
        } else {
          alert('Please refresh the page and try again.');
        }
      } catch (reloadError) {
        alert('Please refresh the page and try again.');
      }
    }
  }
};

document.getElementById('clean').onclick = async () => {
  try {
    // Clear any existing timer
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    
    // Get current tab
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    
    if (!tab || !tab.id) {
      throw new Error('Could not find active tab');
    }

    // Check if we can inject scripts
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      throw new Error('RESTRICTED_PAGE');
    }

    // Send clean message to content script
    await sendMessageWithRetry(tab.id, { action: 'clean' });
    
    // Reset the input fields and match counter
    document.getElementById('word1').value = '';
    document.getElementById('word2').value = '';
    document.getElementById('gap').value = '20';
    document.getElementById('matches').textContent = 'Matches found: 0';
    document.getElementById('timing').textContent = 'Time: 0.00s';
  } catch (error) {
    console.error('Error during cleanup:', error);
    if (error.message === 'RESTRICTED_PAGE') {
      alert('This extension cannot run on Chrome system pages.');
    } else {
      alert('Please refresh the page and try again.');
    }
  }
}; 