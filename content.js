// Log that content script has loaded
console.log('Content script loaded on:', window.location.href);

let matcherModule = null;

async function loadWasm() {
  if (!matcherModule) {
    try {
      console.log('Loading WASM module...');
      
      // Create a new script element for matcher.js
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('cpp/matcher.js');
      script.type = 'text/javascript';
      
      // Wait for the script to load
      await new Promise((resolve, reject) => {
        script.onload = () => {
          console.log('matcher.js loaded successfully');
          resolve();
        };
        script.onerror = (error) => {
          console.error('Error loading matcher.js:', error);
          reject(error);
        };
        (document.head || document.documentElement).appendChild(script);
      });

      if (typeof MatcherModule === 'undefined') {
        throw new Error('MatcherModule not found after script load');
      }

      // Initialize the WASM module
      console.log('Initializing WASM module...');
      matcherModule = await MatcherModule({
        locateFile: (path) => {
          const wasmUrl = chrome.runtime.getURL('wasm/' + path);
          console.log('Loading WASM from:', wasmUrl);
          return wasmUrl;
        }
      });
      
      console.log('WASM module loaded successfully');
      
      // Test if the find_matches function exists
      if (typeof matcherModule.find_matches !== 'function') {
        throw new Error('find_matches function not found in WASM module');
      }
    } catch (error) {
      console.error('Detailed WASM loading error:', error);
      chrome.runtime.sendMessage({
        type: 'ERROR',
        error: `Failed to load WASM module: ${error.message || error}`
      });
      throw error;
    }
  }
  return matcherModule;
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('Received message:', msg);
  
  if (!msg.word1 || !msg.word2 || isNaN(msg.gap)) {
    console.log('Invalid input parameters:', { word1: msg.word1, word2: msg.word2, gap: msg.gap });
    sendResponse({matchCount: 0, error: 'Invalid input parameters'});
    return true;
  }

  // Load WASM and process matches
  (async () => {
    try {
      const matcher = await loadWasm();
      if (!matcher) {
        throw new Error('Failed to initialize WASM module');
      }

      const text = document.body.innerText;
      console.log('Processing text length:', text.length, 'words:', msg.word1, msg.word2, 'gap:', msg.gap);
      
      const matches = matcher.find_matches(text, msg.word1, msg.gap, msg.word2);
      console.log('Found matches:', matches ? matches.length : 0);

      // Remove previous highlights
      const highlights = document.querySelectorAll('.word-gap-highlight');
      console.log('Removing previous highlights:', highlights.length);
      highlights.forEach(e => {
        const parent = e.parentNode;
        if (parent) {
          parent.replaceChild(document.createTextNode(e.textContent), e);
          parent.normalize();
        }
      });

      if (!matches || matches.length === 0) {
        console.log('No matches found');
        sendResponse({matchCount: 0});
        return;
      }

      // Process matches
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );

      let node;
      let offset = 0;
      let textNodes = [];

      // Collect text nodes and their offsets
      while (node = walker.nextNode()) {
        textNodes.push({
          node,
          start: offset,
          end: offset + node.textContent.length
        });
        offset += node.textContent.length;
      }

      console.log('Processing', matches.length, 'matches across', textNodes.length, 'text nodes');

      let successfulHighlights = 0;
      // Process each match
      for (const match of matches) {
        try {
          const matchStart = match.start;
          const matchEnd = match.end;

          // Find nodes that contain this match
          const relevantNodes = textNodes.filter(({start, end}) => 
            (start <= matchStart && matchStart < end) ||
            (start < matchEnd && matchEnd <= end) ||
            (matchStart <= start && end <= matchEnd)
          );

          for (const {node, start} of relevantNodes) {
            try {
              const nodeText = node.textContent;
              const localStart = Math.max(0, matchStart - start);
              const localEnd = Math.min(nodeText.length, matchEnd - start);

              if (localStart >= localEnd) continue;

              const range = document.createRange();
              range.setStart(node, localStart);
              range.setEnd(node, localEnd);

              const span = document.createElement('span');
              span.className = 'word-gap-highlight';
              range.surroundContents(span);
              successfulHighlights++;
            } catch (error) {
              console.error('Error highlighting specific node:', error);
            }
          }
        } catch (error) {
          console.error('Error processing match:', error);
        }
      }

      console.log('Highlighting complete. Successfully highlighted:', successfulHighlights);
      sendResponse({
        matchCount: matches.length,
        highlightCount: successfulHighlights
      });
    } catch (error) {
      console.error('Detailed error in content script:', error);
      chrome.runtime.sendMessage({
        type: 'ERROR',
        error: error.toString()
      });
      sendResponse({
        matchCount: 0,
        error: error.message || 'Unknown error occurred'
      });
    }
  })();

  // Return true to indicate we'll send the response asynchronously
  return true;
});

function highlightMatches(matches, text) {
  // Remove previous highlights
  document.querySelectorAll('.word-gap-highlight').forEach(e => {
    e.replaceWith(...e.childNodes);
  });

  if (!matches || matches.length === 0) return;

  // Get all text nodes in the body
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  let nodes = [];
  let node;
  while ((node = walker.nextNode())) {
    nodes.push(node);
  }

  // Build a flat string and map text node positions
  let flat = '';
  let map = [];
  for (let n of nodes) {
    map.push({node: n, start: flat.length, end: flat.length + n.textContent.length});
    flat += n.textContent;
  }

  // For each match, find the text nodes and wrap them
  for (let i = 0; i < matches.length; ++i) {
    const start = matches[i].start;
    const end = matches[i].end;
    let s = start, e = end;
    for (let j = 0; j < map.length && s < e; ++j) {
      const {node, start: ns, end: ne} = map[j];
      if (ne <= s || ns >= e) continue;
      let from = Math.max(s, ns) - ns;
      let to = Math.min(e, ne) - ns;
      const range = document.createRange();
      range.setStart(node, from);
      range.setEnd(node, to);
      const span = document.createElement('span');
      span.className = 'word-gap-highlight';
      range.surroundContents(span);
      // Update map: split node
      map = [];
      flat = '';
      for (let n of document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false)) {
        map.push({node: n, start: flat.length, end: flat.length + n.textContent.length});
        flat += n.textContent;
      }
      // After DOM change, break and reprocess
      break;
    }
  }
}

// highlightMatches will be implemented after wasm is ready 