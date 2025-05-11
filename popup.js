document.getElementById('highlight').onclick = async () => {
  const word1 = document.getElementById('word1').value;
  const gap = parseInt(document.getElementById('gap').value, 10);
  const word2 = document.getElementById('word2').value;
  
  // Reset match counter
  document.getElementById('matches').textContent = 'Matches found: 0';
  
  try {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    
    if (!tab || !tab.id) {
      throw new Error('Could not find active tab');
    }

    // Try to send message first
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

      if (response && typeof response.matchCount === 'number') {
        document.getElementById('matches').textContent = `Matches found: ${response.matchCount}`;
      }
    } catch (error) {
      // If message fails, try reloading the page
      if (error.message.includes('receiving end does not exist')) {
        alert('Please refresh the page to activate the extension on this tab.');
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error:', error);
    if (error.message.includes('cannot be scripted')) {
      alert('This extension cannot run on this page due to Chrome security restrictions.');
    } else {
      alert('An error occurred. Please try again or reload the extension.');
    }
  }
}; 