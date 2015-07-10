Wince
=====

About
-----

Wince is a Chrome extension that synchronises window sessions.

There are three session types, "unsaved", "active" and "saved". "Session" in the
context of Wince simply refers to a window. All windows start off as "unsaved".
A window that is saved becomes "active" in the local browser instance and
becomes "saved" in all other instances. A "saved" window that is opened also
becomes "active", and an "active" window that is closed becomes "saved" locally.
All "active" windows are closed (and become "saved") at the end of a browser
session.
