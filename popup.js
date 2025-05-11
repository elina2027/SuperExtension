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
  
  // Reset match counter
  document.getElementById('matches').textContent = 'Searching...';
  
  try {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    
    if (!tab || !tab.id) {
      throw new Error('Could not find active tab');
    }

    // Ensure scripts are injected
    await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: 'ENSURE_INJECTION', tabId: tab.id },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (!response.success) {
            reject(new Error(response.error || 'Failed to inject scripts'));
          } else {
            resolve();
          }
        }
      );
    });

    // Small delay to ensure scripts are fully initialized
    await new Promise(resolve => setTimeout(resolve, 100));

    // Try to send message to content script
    try {
      const response = await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tab.id, {word1, gap, word2}, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });

      if (response && response.error) {
        throw new Error(response.error);
      }

      if (response && typeof response.matchCount === 'number') {
        document.getElementById('matches').textContent = 
          `Matches found: ${response.matchCount}` + 
          (response.highlightCount !== undefined ? 
            ` (${response.highlightCount} highlighted)` : '');
      }
    } catch (error) {
      console.error('Message error:', error);
      
      if (error.message.includes('receiving end does not exist')) {
        // Try refreshing the page
        await chrome.tabs.reload(tab.id);
        alert('Please try again after the page reloads.');
      } else if (error.message.includes('cannot be scripted')) {
        alert('This extension cannot run on this page due to Chrome security restrictions.');
      } else {
        const errorMsg = error.message || 'Unknown error occurred';
        if (errorMsg.includes('WASM') || errorMsg.includes('matcher.js')) {
          alert('Error loading extension components. Please reload the extension.');
        } else {
          alert(`Error: ${errorMsg}`);
        }
      }
      document.getElementById('matches').textContent = 'Error occurred';
    }
  } catch (error) {
    console.error('Extension error:', error);
    document.getElementById('matches').textContent = 'Error occurred';
    alert('An error occurred. Please try again or reload the extension.');
  }
}; 