// Copyright (c) 2015 Sean Kelleher. All rights reserved.
// Use of this source code is governed by a GPL
// license that can be found in the LICENSE file.
//
// There are three session types, "unsaved", "active" and "saved". "Session" in
// the context of Wince simply refers to a window. All windows start off as
// "unsaved". A window that is saved becomes "active" in the local browser
// instance and becomes "saved" in all other instances. A "saved" window that is
// opened also becomes "active", and an "active" window that is closed becomes
// "saved" locally. All "active" windows are closed (and become "saved") at the
// end of a browser session.

function newSessionUl(session) {
    var tabsUl = document.createElement('ul');

    session.tabs.forEach(function(tab) {
        var favIcon = document.createElement('img');
        favIcon.src = tab.favIconUrl;
        favIcon.class = 'favicon';
        favIcon.width = '16';
        favIcon.height = '16';

        // TODO Take state parameter, add "remove" button if unsaved.

        var a = document.createElement('a');
        a.appendChild(document.createTextNode(tab.title));
        a.title = tab.url;
        a.href = tab.url;

        var tabLi = document.createElement('li');
        tabLi.appendChild(favIcon);
        tabLi.appendChild(a);

        tabsUl.appendChild(tabLi);
    });

    return tabsUl;
}

function initSaved(ul, session) {
    var li = document.createElement('li');

    // TODO Add "open" button. On open, move the tab to "active" `ul` and remove
    // open/delete buttons.

    var remove = document.createElement('a');
    remove.appendChild(document.createTextNode('delete'));
    remove.href = '#';
    remove.onclick = function() {
        ul.removeChild(li);

        getSessions(function (sessions) {
            chrome.storage.sync.remove(
                session.name,
                function() {
                    if (chrome.runtime.lastError) {
                        alert(chrome.runtime.lastError.message);
                    }
                }
            );
        });
    };
    li.appendChild(remove);

    li.appendChild(document.createTextNode(' '));

    li.appendChild(document.createTextNode(session.name));

    var sessionUl = newSessionUl(session);
    li.appendChild(sessionUl);

    ul.appendChild(li);

    chrome.storage.onChanged.addListener(function (changes, areaName) {
        var newSession = changes[session.name];
        if (areaName == 'sync' && newSession && newSession.newValue) {
            var sessionUl_ = newSessionUl(newSession.newValue);
            li.replaceChild(sessionUl_, sessionUl);
            sessionUl = sessionUl_;
        }
    });
}

function setSessions(sessions) {
    chrome.storage.sync.set(
        sessions,
        function() {
            if (chrome.runtime.lastError) {
                alert(chrome.runtime.lastError.message);
            }
        }
    );
}

function getSessions(callback) {
    chrome.storage.sync.get(null, function(result) {
        if (chrome.runtime.lastError) {
            alert(chrome.runtime.lastError.message);
            return;
        }

        callback(result);
    });
}

function initUnsaved(ul, activeUl, session, winId) {
    var li = document.createElement('li');

    var a = document.createElement('a');
    a.appendChild(document.createTextNode('save'));
    a.href = '#';
    a.onclick = function() {
        var name = prompt("Please enter session name:", "");

        if (!name) {
            return;
        }

        getSessions(function(sessions) {
            if (sessions[name]) {
                alert("'" + name + "' already exists");
                return;
            }

            session.name = name;
            sessions[name] = session;

            setSessions(sessions);

            // TODO Change state to "active".
            // TODO Remove from `ul`.
            initSaved(activeUl, session);
        });
    };
    li.appendChild(a);

    var sessionUl = newSessionUl(session);
    li.appendChild(sessionUl);

    ul.appendChild(li);

    // TODO Update `li` on window change.
}

// TODO close all active windows at end of browser session

function init() {
    getSessions(function (sessions) {
        for (var name in sessions) {
            initSaved(document.getElementById('saved'), sessions[name]);
        }
    });

    chrome.windows.getAll(
        {'populate': true},
        function(wins) {
            wins.forEach(function (win) {
                var session = {tabs: []};

                win.tabs.forEach(function (tab) {
                    session.tabs.push({
                        favIconUrl: tab.favIconUrl,
                        title: tab.title,
                        url: tab.url
                    });
                });

                initUnsaved(
                    document.getElementById('unsaved'),
                    document.getElementById('active'),
                    session,
                    win.id
                );
            });
        }
    );
}

document.addEventListener('DOMContentLoaded', function() {
    init();
});
