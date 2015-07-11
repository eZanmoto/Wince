// Copyright (c) 2015 Sean Kelleher. All rights reserved.
// Use of this source code is governed by a GPL
// license that can be found in the LICENSE file.

// Taken from:
//
//     https://developer.chrome.com/extensions/examples/api/cookies/background.js
function focusOrCreateTab(url) {
  chrome.windows.getAll({"populate":true}, function(windows) {
    var existing_tab = null;
    for (var i in windows) {
      var tabs = windows[i].tabs;
      for (var j in tabs) {
        var tab = tabs[j];
        if (tab.url == url) {
          existing_tab = tab;
          break;
        }
      }
    }
    if (existing_tab) {
      chrome.tabs.update(existing_tab.id, {"selected":true});
    } else {
      chrome.tabs.create({"url":url, "selected":true});
    }
  });
}

// Taken largely from:
//
//     https://developer.chrome.com/extensions/examples/api/cookies/background.js
chrome.browserAction.onClicked.addListener(function(tab) {
    focusOrCreateTab(chrome.extension.getURL('wince.html'))
});

var renderers = {};

function addRenderer(winId, renderer) {
    renderers[winId] = renderer;
}

var sessionWins = {};

function activateSession(name, winId) {
    sessionWins[name] = winId;

    var renderer = renderers[winId];
    if (renderer) {
        renderer.close();
    }
}

function winIdForSession(name) {
    return sessionWins[name];
}

function sessionNameWithWinId(winId) {
    for (var name in sessionWins) {
        if (sessionWins[name] == winId) {
            return name;
        }
    }
    return undefined;
}

function winUpdated(winId) {
    chrome.windows.get(
        winId,
        {populate: true},
        function (win) {
            var tabs = [];
            win.tabs.forEach(function (tab) {
                tabs.push({
                    favIconUrl: tab.favIconUrl,
                    title: tab.title,
                    url: tab.url
                });
            });

            var key = winId;
            var storage = chrome.storage.local;
            var sessionName = sessionNameWithWinId(winId);
            if (sessionName) {
                key = sessionName;
                storage = chrome.storage.sync;
            }

            var result = {};
            result[key] = tabs;
            storage.set(result)
        }
    );

    return;
}

chrome.tabs.onCreated.addListener(function (tab) {
    winUpdated(tab.windowId);
});

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    winUpdated(tab.windowId);
});

tabUpdated = function (tabId) {
    chrome.tabs.get(tabId, function (tab) {
        winUpdated(tab.windowId);
    });
};

chrome.tabs.onMoved.addListener(tabUpdated);
chrome.tabs.onDetached.addListener(tabUpdated);
chrome.tabs.onAttached.addListener(tabUpdated);
chrome.tabs.onReplaced.addListener(tabUpdated);

chrome.tabs.onRemoved.addListener(function (tabId, removeInfo) {
    if (removeInfo.isWindowClosing) {
        return;
    }

    winUpdated(removeInfo.windowId);
});

var onWinClose;

chrome.windows.onRemoved.addListener(function (winId) {
    var sessionName = sessionNameWithWinId('' + winId);
    if (onWinClose) {
        onWinClose('' + winId, sessionName);
    }
    delete sessionWins[sessionName];
});
