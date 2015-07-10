// Copyright (c) 2015 Sean Kelleher. All rights reserved.
// Use of this source code is governed by a GPL
// license that can be found in the LICENSE file.
//
// An "unsaved" session only has a window ID. An "active" session has a session
// name and a window ID. A "saved" session only has a session name.

function renderTabs(tabs, winId) {
    var ul = document.createElement('ul');

    tabs.forEach(function(tab) {
        var favIcon = document.createElement('img');
        favIcon.src = tab.favIconUrl;
        favIcon.class = 'favicon';
        favIcon.width = '16';
        favIcon.height = '16';

        // TODO Link to tabId if present.
        var link = document.createElement('a');
        link.appendChild(document.createTextNode(tab.title));
        link.title = tab.url;
        link.href = tab.url;

        var li = document.createElement('li');
        li.appendChild(favIcon);
        li.appendChild(link);

        ul.appendChild(li);
    });

    return ul;
}

function initSession(ulId, winId, render, close) {
    var ul = document.getElementById(ulId);

    var li = document.createElement('li');
    ul.appendChild(li);

    me = {};

    me.render = function(tabs) {
        var newLi = document.createElement('li');
        render(me, newLi, tabs);
        newLi.appendChild(renderTabs(tabs, winId));
        ul.replaceChild(newLi, li);
        li = newLi;
    };

    me.close = function() {
        ul.removeChild(li);
        close();
    }

    return me;
}

var renderers = {
    local: {},
    sync: {},
};

function initSavedSession(name) {
    renderers.sync[name] = initSession(
        'saved',
        null,
        function (me, li, tabs) {

            var open = document.createElement('a');
            open.appendChild(document.createTextNode('open'));
            open.href = '#';
            open.onclick = function() {
                var urls = [];
                for (var i in tabs) {
                    urls.push(tabs[i].url);
                }
                chrome.windows.create(
                    {url: urls},
                    function (win) {
                        // Must call `close` before `initActiveSession` because
                        // otherwise it will remove the renderer.
                        me.close();

                        initActiveSession(name, '' + win.id);
                    }
                );
            };

            var remove = document.createElement('a');
            remove.appendChild(document.createTextNode('delete'));
            remove.href = '#';
            remove.onclick = function() {
                me.close();
                chrome.storage.sync.remove(name);
            };

            li.appendChild(open);
            li.appendChild(document.createTextNode(' '));
            li.appendChild(remove);
            li.appendChild(document.createTextNode(' '));
            li.appendChild(document.createTextNode(name));
        },
        function () {
            delete renderers.sync[name];
        }
    );
}

function initActiveSession(name, winId) {
    chrome.runtime.getBackgroundPage(function (bgPage) {
        bgPage.activateSession(name, winId);
    });

    renderers.sync[name] = initSession(
        'active',
        winId,
        function (me, li, tabs) {
            // FIXME This is a debugging tool to work around the fact that
            // closed windows aren't always handled properly and should be
            // removed as soon as feasible.
            var close = document.createElement('a');
            close.appendChild(document.createTextNode('close'));
            close.href = '#';
            close.onclick = me.close;
            li.appendChild(close);

            li.appendChild(document.createTextNode(' '));
            li.appendChild(document.createTextNode(name));
        },
        function () {
            chrome.runtime.getBackgroundPage(function (bgPage) {
                bgPage.deactivateSession(name, winId);
            });

            chrome.storage.sync.get(null, function (result) {
                initSavedSession(name);
                renderers.sync[name].render(result[name]);
            });
        }
    );
}

function initUnsavedSession(winId) {
    renderers.local[winId] = initSession(
        'unsaved',
        winId,
        function (me, li, tabs) {
            var save = document.createElement('a');
            save.appendChild(document.createTextNode('save'));
            save.href = '#';
            save.onclick = function () {
                var name = prompt("Please enter session name:", "");

                if (!name) {
                    return;
                }

                chrome.storage.sync.get(null, function (result) {
                    if (result[name]) {
                        alert("'" + name + "' already exists");
                        return;
                    }

                    me.close();
                    chrome.storage.local.remove(winId);

                    initActiveSession(name, winId);
                    var toSet = {};
                    toSet[name] = tabs;
                    chrome.storage.sync.set(toSet);

                });
            };
            li.appendChild(save);
        },
        function () {
            delete renderers.local[winId];
        }
    );
}

function initAndRenderUnsavedSession(winId) {
    // We convert the `winId` to a string so it can be used as a key for Chrome
    // storage.
    initUnsavedSession('' + winId);

    chrome.windows.get(
        winId,
        {populate: true},
        function (win) {
            // We strip extraneous attributes from the tabs because this is the
            // information that will get synchronised.
            var tabs = [];
            win.tabs.forEach(function (tab) {
                tabs.push({
                    favIconUrl: tab.favIconUrl,
                    title: tab.title,
                    url: tab.url
                });
            });
            renderers.local['' + winId].render(tabs);
        }
    );
}

// TODO close all active windows at end of browser session

document.addEventListener('DOMContentLoaded', function() {
    var bgPage;
    chrome.runtime.getBackgroundPage(function (bgPage_) {
        bgPage = bgPage_;
    });

    chrome.storage.sync.get(null, function(sessionTabs) {
        for (var name in sessionTabs) {
            var winId = bgPage.winIdForSession(name);
            winId
                ? initActiveSession(name, winId)
                : initSavedSession(name);
            renderers.sync[name].render(sessionTabs[name]);
        }
    });

    chrome.windows.getAll(
        {'populate': true},
        function(wins) {
            wins.forEach(function (win) {
                if (bgPage.sessionNameWithWinId('' + win.id)) {
                    return;
                }
                initAndRenderUnsavedSession(win.id);
            });
        }
    );

    chrome.storage.onChanged.addListener(function (changes, areaName) {
        var rs;
        if (areaName == 'sync') {
            rs = renderers.sync;
        } else if (areaName == 'local') {
            rs = renderers.local;
        } else {
            return;
        }

        for (name in changes) {
            var value = changes[name].newValue;
            if (value) {
                rs[name].render(value);
            } else {
                rs[name].close();
            }
        }
    });

    chrome.windows.onCreated.addListener(function (win) {
        initAndRenderUnsavedSession(win.id);
    });

    chrome.windows.onRemoved.addListener(function (winId) {
        var sessionName = bgPage.sessionNameWithWinId('' + winId);
        if (sessionName) {
            renderers.sync[name].close();
        } else {
            renderers.local[name].close();
        }
    });
});
