function insert(x, xs, keyF) {
    var i = 0;
    while (i < xs.length && keyF(x) > keyF(xs[i])) {
        i++;
    }

    if (i < xs.length && keyF(x) == keyF(xs[i])) {
        return false;
    }

    xs.splice(i, 0, x);

    return true;
}

function sessionName(session) {
    return session.name;
}

function saveSession(tabs) {
    var session = {tabs: tabs};
    session.name = prompt("Please enter session name:", "");

    if (!session.name) {
        return;
    }

    getSessions(function(sessions) {
        if (!insert(session, sessions, sessionName)) {
            alert("'" + session.name + "' already exists");
            return;
        }

        setSessions(sessions);
    });
}

function newTabLi(tab) {
    var favIcon = document.createElement('img');
    favIcon.src = tab.favIconUrl;
    favIcon.class = 'favicon';
    favIcon.width = '16';
    favIcon.height = '16';

    var a = document.createElement('a');
    a.appendChild(document.createTextNode(tab.title));
    a.title = tab.url;
    a.href = tab.url;

    var tabLi = document.createElement('li');
    tabLi.appendChild(favIcon);
    tabLi.appendChild(a);

    return tabLi;
}

function currentTabs() {
    chrome.windows.getAll(
        {'populate': true},
        function(wins) {
            var winsUl = document.getElementById('windows');

            wins.forEach(function(win) {
                var tabsUl = document.createElement('ul');

                var tabs = [];

                win.tabs.forEach(function(tab) {
                    var tab = {
                        favIconUrl: tab.favIconUrl,
                        title: tab.title,
                        url: tab.url
                    };

                    tabsUl.appendChild(newTabLi(tab));
                    tabs.push(tab);
                });

                var save = document.createElement('a');
                save.appendChild(document.createTextNode('Save Session'));
                save.href = '#';
                save.onclick = saveSession.bind(this, tabs);

                var winLi = document.createElement('li');
                winLi.appendChild(save);
                winLi.appendChild(tabsUl);

                winsUl.appendChild(winLi);
            });
        }
    );
}

function setSessions(sessions) {
    chrome.storage.sync.set(
        {sessions: sessions},
        function() {
            if (chrome.runtime.lastError) {
                alert(chrome.runtime.lastError.message);
            }
        }
    );
}

function getSessions(callback) {
    chrome.storage.sync.get({sessions: []}, function(result) {
        if (chrome.runtime.lastError) {
            alert(chrome.runtime.lastError.message);
            return;
        }

        callback(result.sessions);
    });
}

function indexOf(x, xs, keyF) {
        var i = 0;
        while (i < xs.length && keyF(x) > keyF(xs[i])) {
            i++;
        }

        if (i < xs.length && keyF(x) == keyF(xs[i])) {
            return i;
        }
        return -1;
}

function remove(x, xs, keyF) {
    var i = indexOf(x, xs, keyF);

    if (i == -1) {
        return;
    }

    xs.splice(i, 1);
}

function newSessionLi(session) {
    var tabsUl = document.createElement('ul');

    session.tabs.forEach(function(tab) {
        tabsUl.appendChild(newTabLi(tab));
    });

    var openA = document.createElement('a');
    openA.appendChild(document.createTextNode('open'));
    openA.title = 'open';
    openA.href = '#';
    openA.onclick = function() {
        var urls = [];
        session.tabs.forEach(function(tab) {
            urls.push(tab.url);
        });
        chrome.windows.create({url: urls});
    }

    var removeA = document.createElement('a');
    removeA.appendChild(document.createTextNode('delete'));
    removeA.title = 'delete';
    removeA.href = '#';
    removeA.onclick = function() {
        getSessions(function(sessions) {
            remove(session, sessions, sessionName);
            setSessions(sessions);
        });
    }

    var li = document.createElement('li');
    li.appendChild(openA);
    li.appendChild(document.createTextNode(' '));
    li.appendChild(removeA);
    li.appendChild(document.createTextNode(' '));
    li.appendChild(document.createTextNode(session.name));
    li.appendChild(tabsUl);

    return li;
}

function loadSessions(sessions) {
    var sessionsUl = document.getElementById('sessions');
    var nodes = sessionsUl.childNodes;

    var i, j;
    i = j = 0;

    while (i < sessions.length) {
        var session = sessions[i];
        var node = nodes[j];
        if (j >= nodes.length || session.name < node.lastChild.data) {
            var li = newSessionLi(session);

            if (j >= nodes.length) {
                sessionsUl.appendChild(li);
            } else {
                sessionsUl.insertBefore(li, node);
            }

            i++;
            j++;
        } else if (session.name > node.lastChild.data) {
            sessionsUl.removeChild(node);
        } else {
            i++;
            j++;
        }
    }

    while (j < nodes.length) {
        sessionsUl.removeChild(nodes[j]);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    currentTabs();

    chrome.storage.sync.get({sessions: []}, function(result) {
        if (chrome.runtime.lastError) {
            alert(chrome.runtime.lastError.message);
            return;
        }

        loadSessions(result.sessions);
    });

    chrome.storage.onChanged.addListener(function(changes, areaName) {
        if (chrome.runtime.lastError) {
            alert(chrome.runtime.lastError.message);
            return;
        }

        loadSessions(changes.sessions.newValue);
    });
});
