let adBlockingEnabled = false;

// Function to update UI based on ad blocking status
function updateUI(adBlockingEnabled) {
  const toggleButton = document.getElementById('toggleButton');
  const status = document.getElementById('status');
  const adsBlockedCount = document.getElementById('adsBlockedCount');

  if (adBlockingEnabled) {
    toggleButton.textContent = 'Turn off SunBlock';
    toggleButton.classList.remove('disabled');
    toggleButton.classList.add('enabled');
    status.textContent = 'SunBlock is ';
    status.innerHTML += '<span class="enabled-text">enabled</span>';
  } else {
    toggleButton.textContent = 'Turn on SunBlock';
    toggleButton.classList.remove('enabled');
    toggleButton.classList.add('disabled');
    status.textContent = 'SunBlock is ';
    status.innerHTML += '<span class="disabled-text">disabled</span>';
  }

  // Update ads blocked count
  chrome.storage.local.get('adsBlockedCount', function(result) {
    let count = result.adsBlockedCount || 0;
    adsBlockedCount.textContent = `Total Ads SunBlock Blocked: ${count}`;
  });
}

// Function to toggle ad blocking status
function toggleAdBlocking() {
  chrome.runtime.sendMessage({ action: 'toggleAdBlocking' }, function(response) {
    adBlockingEnabled = response.adBlockingEnabled;
    updateUI(adBlockingEnabled);

    // Reload the current tab
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs.length > 0) {
        chrome.tabs.reload(tabs[0].id);
      }
    });

  });
}

// Event listener for button click
document.addEventListener('DOMContentLoaded', function () {
  const toggleButton = document.getElementById('toggleButton');
  toggleButton.addEventListener('click', toggleAdBlocking);

  // Fetch initial ad blocking status from background script
  chrome.runtime.sendMessage({ action: 'getAdBlockingStatus' }, function(response) {
    adBlockingEnabled = response.adBlockingEnabled;
    updateUI(adBlockingEnabled);
  });
});
