/*
 * Service worker. The UI lives in the page, so this only relays two things: a
 * toolbar-icon click into a panel toggle, and the panel's "Rules" link into the
 * options page, which a content script cannot open itself.
 */
export default defineBackground(() => {
  /*
   * Read the built content-script paths out of our own manifest rather than
   * hardcoding them: WXT decides the output filenames, and they change if an
   * entrypoint is renamed.
   */
  function contentScriptFiles() {
    const groups = chrome.runtime.getManifest().content_scripts || [];
    return groups.flatMap((group) => group.js || []);
  }

  function togglePanel(tabId) {
    chrome.tabs.sendMessage(tabId, { type: 'TOGGLE_PANEL' }, () => {
      /* No receiver means the content script is not in this tab yet, which
       * happens on the tab that was already open when we were installed. */
      if (!chrome.runtime.lastError) return;

      chrome.scripting.executeScript(
        { target: { tabId }, files: contentScriptFiles() },
        () => {
          if (chrome.runtime.lastError) return;
          chrome.tabs.sendMessage(tabId, { type: 'TOGGLE_PANEL' }, () => {
            void chrome.runtime.lastError;
          });
        },
      );
    });
  }

  chrome.action.onClicked.addListener((tab) => {
    if (tab && tab.id) togglePanel(tab.id);
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message && message.type === 'OPEN_OPTIONS') chrome.runtime.openOptionsPage();
  });
});
