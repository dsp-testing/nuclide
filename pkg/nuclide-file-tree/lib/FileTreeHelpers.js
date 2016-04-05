function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

var _atom = require('atom');

var _nuclideRemoteConnection = require('../../nuclide-remote-connection');

var _nuclideRemoteUri = require('../../nuclide-remote-uri');

var _nuclideRemoteUri2 = _interopRequireDefault(_nuclideRemoteUri);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _url = require('url');

var _url2 = _interopRequireDefault(_url);

var _crypto = require('crypto');

var _crypto2 = _interopRequireDefault(_crypto);

/*
 * Returns a string with backslashes replaced by two backslashes for use with strings passed to the
 * `RegExp` constructor.
 */
function escapeBackslash(str) {
  return str.replace('\\', '\\\\');
}

function dirPathToKey(path) {
  return path.replace(new RegExp(escapeBackslash(_path2['default'].sep) + '+$'), '') + _path2['default'].sep;
}

function isDirKey(key) {
  return key.slice(-1) === _path2['default'].sep;
}

function keyToName(key) {
  var path = keyToPath(key);
  var index = path.lastIndexOf(_path2['default'].sep);
  return index === -1 ? path : path.slice(index + 1);
}

function keyToPath(key) {
  return key.replace(new RegExp(escapeBackslash(_path2['default'].sep) + '+$'), '');
}

function getParentKey(key) {
  var path = keyToPath(key);
  var parsed = _nuclideRemoteUri2['default'].parse(path);
  parsed.pathname = _path2['default'].join(parsed.pathname, '..');
  var parentPath = _url2['default'].format(parsed);
  return dirPathToKey(parentPath);
}

// The array this resolves to contains the `nodeKey` of each child
function fetchChildren(nodeKey) {
  var directory = getDirectoryByKey(nodeKey);

  return new Promise(function (resolve, reject) {
    if (directory == null) {
      reject('Directory "' + nodeKey + '" not found or is inaccessible.');
      return;
    }

    // $FlowIssue https://github.com/facebook/flow/issues/582
    directory.getEntries(function (error, entries) {
      // Resolve to an empty array if the directory deson't exist.
      // TODO: should we reject promise?
      if (error && error.code !== 'ENOENT') {
        reject(error);
        return;
      }
      entries = entries || [];
      var keys = entries.map(function (entry) {
        var path = entry.getPath();
        return entry.isDirectory() ? dirPathToKey(path) : path;
      });
      resolve(keys);
    });
  });
}

function getDirectoryByKey(key) {
  var path = keyToPath(key);
  if (!isDirKey(key)) {
    return null;
  } else if (_nuclideRemoteUri2['default'].isRemote(path)) {
    var connection = _nuclideRemoteConnection.RemoteConnection.getForUri(path);
    if (connection == null) {
      return null;
    }
    return new _nuclideRemoteConnection.RemoteDirectory(connection, path);
  } else {
    return new _atom.Directory(path);
  }
}

function getFileByKey(key) {
  var path = keyToPath(key);
  if (isDirKey(key)) {
    return null;
  } else if (_nuclideRemoteUri2['default'].isRemote(path)) {
    var connection = _nuclideRemoteConnection.RemoteConnection.getForUri(path);
    if (connection == null) {
      return;
    }

    return new _nuclideRemoteConnection.RemoteFile(connection, path);
  } else {
    return new _atom.File(path);
  }
}

function getEntryByKey(key) {
  return getFileByKey(key) || getDirectoryByKey(key);
}

function getDisplayTitle(key) {
  var path = keyToPath(key);

  if (_nuclideRemoteUri2['default'].isRemote(path)) {
    var connection = _nuclideRemoteConnection.RemoteConnection.getForUri(path);

    if (connection != null) {
      return connection.getDisplayTitle();
    }
  }
}

// Sometimes remote directories are instantiated as local directories but with invalid paths.
function isValidDirectory(directory) {
  return !isLocalEntry(directory) || _path2['default'].isAbsolute(directory.getPath());
}

function isLocalEntry(entry) {
  // TODO: implement `RemoteDirectory.isRemoteDirectory()`
  return !('getLocalPath' in entry);
}

function isContextClick(event) {
  return event.button === 2 || event.button === 0 && event.ctrlKey === true && process.platform === 'darwin';
}

function buildHashKey(nodeKey) {
  return _crypto2['default'].createHash('MD5').update(nodeKey).digest('base64');
}

module.exports = {
  dirPathToKey: dirPathToKey,
  isDirKey: isDirKey,
  keyToName: keyToName,
  keyToPath: keyToPath,
  getParentKey: getParentKey,
  fetchChildren: fetchChildren,
  getDirectoryByKey: getDirectoryByKey,
  getEntryByKey: getEntryByKey,
  getFileByKey: getFileByKey,
  getDisplayTitle: getDisplayTitle,
  isValidDirectory: isValidDirectory,
  isLocalEntry: isLocalEntry,
  isContextClick: isContextClick,
  buildHashKey: buildHashKey
};
//# sourceMappingURL=data:application/json;base64,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QUFZLEVBQVosWUFBWTtBQUNaLGVBQWEsRUFBYixhQUFhO0FBQ2IsbUJBQWlCLEVBQWpCLGlCQUFpQjtBQUNqQixlQUFhLEVBQWIsYUFBYTtBQUNiLGNBQVksRUFBWixZQUFZO0FBQ1osaUJBQWUsRUFBZixlQUFlO0FBQ2Ysa0JBQWdCLEVBQWhCLGdCQUFnQjtBQUNoQixjQUFZLEVBQVosWUFBWTtBQUNaLGdCQUFjLEVBQWQsY0FBYztBQUNkLGNBQVksRUFBWixZQUFZO0NBQ2IsQ0FBQyIsImZpbGUiOiJGaWxlVHJlZUhlbHBlcnMuanMiLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIGJhYmVsJztcbi8qIEBmbG93ICovXG5cbi8qXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTUtcHJlc2VudCwgRmFjZWJvb2ssIEluYy5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgbGljZW5zZSBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGluXG4gKiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS5cbiAqL1xuXG5pbXBvcnQge0RpcmVjdG9yeSBhcyBMb2NhbERpcmVjdG9yeX0gZnJvbSAnYXRvbSc7XG5pbXBvcnQge0ZpbGUgYXMgTG9jYWxGaWxlfSBmcm9tICdhdG9tJztcbmltcG9ydCB7XG4gIFJlbW90ZUNvbm5lY3Rpb24sXG4gIFJlbW90ZURpcmVjdG9yeSxcbiAgUmVtb3RlRmlsZSxcbn0gZnJvbSAnLi4vLi4vbnVjbGlkZS1yZW1vdGUtY29ubmVjdGlvbic7XG5pbXBvcnQgUmVtb3RlVXJpIGZyb20gJy4uLy4uL251Y2xpZGUtcmVtb3RlLXVyaSc7XG5cbmltcG9ydCBwYXRoTW9kdWxlIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHVybCBmcm9tICd1cmwnO1xuaW1wb3J0IGNyeXB0byBmcm9tICdjcnlwdG8nO1xuXG50eXBlIERpcmVjdG9yeSA9IExvY2FsRGlyZWN0b3J5IHwgUmVtb3RlRGlyZWN0b3J5O1xudHlwZSBGaWxlID0gTG9jYWxGaWxlIHwgUmVtb3RlRmlsZTtcbnR5cGUgRW50cnkgPSBMb2NhbERpcmVjdG9yeSB8IFJlbW90ZURpcmVjdG9yeSB8IExvY2FsRmlsZSB8IFJlbW90ZUZpbGU7XG5cbi8qXG4gKiBSZXR1cm5zIGEgc3RyaW5nIHdpdGggYmFja3NsYXNoZXMgcmVwbGFjZWQgYnkgdHdvIGJhY2tzbGFzaGVzIGZvciB1c2Ugd2l0aCBzdHJpbmdzIHBhc3NlZCB0byB0aGVcbiAqIGBSZWdFeHBgIGNvbnN0cnVjdG9yLlxuICovXG5mdW5jdGlvbiBlc2NhcGVCYWNrc2xhc2goc3RyOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gc3RyLnJlcGxhY2UoJ1xcXFwnLCAnXFxcXFxcXFwnKTtcbn1cblxuZnVuY3Rpb24gZGlyUGF0aFRvS2V5KHBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBwYXRoLnJlcGxhY2UobmV3IFJlZ0V4cChgJHtlc2NhcGVCYWNrc2xhc2gocGF0aE1vZHVsZS5zZXApfSskYCksICcnKSArIHBhdGhNb2R1bGUuc2VwO1xufVxuXG5mdW5jdGlvbiBpc0RpcktleShrZXk6IHN0cmluZyk6IGJvb2xlYW4ge1xuICByZXR1cm4gKGtleS5zbGljZSgtMSkgPT09IHBhdGhNb2R1bGUuc2VwKTtcbn1cblxuZnVuY3Rpb24ga2V5VG9OYW1lKGtleTogc3RyaW5nKTogc3RyaW5nIHtcbiAgY29uc3QgcGF0aCA9IGtleVRvUGF0aChrZXkpO1xuICBjb25zdCBpbmRleCA9IHBhdGgubGFzdEluZGV4T2YocGF0aE1vZHVsZS5zZXApO1xuICByZXR1cm4gKGluZGV4ID09PSAtMSkgPyBwYXRoIDogcGF0aC5zbGljZShpbmRleCArIDEpO1xufVxuXG5mdW5jdGlvbiBrZXlUb1BhdGgoa2V5OiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4ga2V5LnJlcGxhY2UobmV3IFJlZ0V4cChgJHtlc2NhcGVCYWNrc2xhc2gocGF0aE1vZHVsZS5zZXApfSskYCksICcnKTtcbn1cblxuZnVuY3Rpb24gZ2V0UGFyZW50S2V5KGtleTogc3RyaW5nKTogc3RyaW5nIHtcbiAgY29uc3QgcGF0aCA9IGtleVRvUGF0aChrZXkpO1xuICBjb25zdCBwYXJzZWQgPSBSZW1vdGVVcmkucGFyc2UocGF0aCk7XG4gIHBhcnNlZC5wYXRobmFtZSA9IHBhdGhNb2R1bGUuam9pbihwYXJzZWQucGF0aG5hbWUsICcuLicpO1xuICBjb25zdCBwYXJlbnRQYXRoID0gdXJsLmZvcm1hdCgocGFyc2VkOiBhbnkpKTtcbiAgcmV0dXJuIGRpclBhdGhUb0tleShwYXJlbnRQYXRoKTtcbn1cblxuLy8gVGhlIGFycmF5IHRoaXMgcmVzb2x2ZXMgdG8gY29udGFpbnMgdGhlIGBub2RlS2V5YCBvZiBlYWNoIGNoaWxkXG5mdW5jdGlvbiBmZXRjaENoaWxkcmVuKG5vZGVLZXk6IHN0cmluZyk6IFByb21pc2U8QXJyYXk8c3RyaW5nPj4ge1xuICBjb25zdCBkaXJlY3RvcnkgPSBnZXREaXJlY3RvcnlCeUtleShub2RlS2V5KTtcblxuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgIGlmIChkaXJlY3RvcnkgPT0gbnVsbCkge1xuICAgICAgcmVqZWN0KGBEaXJlY3RvcnkgXCIke25vZGVLZXl9XCIgbm90IGZvdW5kIG9yIGlzIGluYWNjZXNzaWJsZS5gKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyAkRmxvd0lzc3VlIGh0dHBzOi8vZ2l0aHViLmNvbS9mYWNlYm9vay9mbG93L2lzc3Vlcy81ODJcbiAgICBkaXJlY3RvcnkuZ2V0RW50cmllcygoZXJyb3IsIGVudHJpZXMpID0+IHtcbiAgICAgIC8vIFJlc29sdmUgdG8gYW4gZW1wdHkgYXJyYXkgaWYgdGhlIGRpcmVjdG9yeSBkZXNvbid0IGV4aXN0LlxuICAgICAgLy8gVE9ETzogc2hvdWxkIHdlIHJlamVjdCBwcm9taXNlP1xuICAgICAgaWYgKGVycm9yICYmIGVycm9yLmNvZGUgIT09ICdFTk9FTlQnKSB7XG4gICAgICAgIHJlamVjdChlcnJvcik7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGVudHJpZXMgPSBlbnRyaWVzIHx8IFtdO1xuICAgICAgY29uc3Qga2V5cyA9IGVudHJpZXMubWFwKGVudHJ5ID0+IHtcbiAgICAgICAgY29uc3QgcGF0aCA9IGVudHJ5LmdldFBhdGgoKTtcbiAgICAgICAgcmV0dXJuIGVudHJ5LmlzRGlyZWN0b3J5KCkgPyBkaXJQYXRoVG9LZXkocGF0aCkgOiBwYXRoO1xuICAgICAgfSk7XG4gICAgICByZXNvbHZlKGtleXMpO1xuICAgIH0pO1xuICB9KTtcbn1cblxuZnVuY3Rpb24gZ2V0RGlyZWN0b3J5QnlLZXkoa2V5OiBzdHJpbmcpOiA/RGlyZWN0b3J5IHtcbiAgY29uc3QgcGF0aCA9IGtleVRvUGF0aChrZXkpO1xuICBpZiAoIWlzRGlyS2V5KGtleSkpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfSBlbHNlIGlmIChSZW1vdGVVcmkuaXNSZW1vdGUocGF0aCkpIHtcbiAgICBjb25zdCBjb25uZWN0aW9uID0gUmVtb3RlQ29ubmVjdGlvbi5nZXRGb3JVcmkocGF0aCk7XG4gICAgaWYgKGNvbm5lY3Rpb24gPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIHJldHVybiBuZXcgUmVtb3RlRGlyZWN0b3J5KGNvbm5lY3Rpb24sIHBhdGgpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBuZXcgTG9jYWxEaXJlY3RvcnkocGF0aCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0RmlsZUJ5S2V5KGtleTogc3RyaW5nKTogP0ZpbGUge1xuICBjb25zdCBwYXRoID0ga2V5VG9QYXRoKGtleSk7XG4gIGlmIChpc0RpcktleShrZXkpKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH0gZWxzZSBpZiAoUmVtb3RlVXJpLmlzUmVtb3RlKHBhdGgpKSB7XG4gICAgY29uc3QgY29ubmVjdGlvbiA9IFJlbW90ZUNvbm5lY3Rpb24uZ2V0Rm9yVXJpKHBhdGgpO1xuICAgIGlmIChjb25uZWN0aW9uID09IG51bGwpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IFJlbW90ZUZpbGUoY29ubmVjdGlvbiwgcGF0aCk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG5ldyBMb2NhbEZpbGUocGF0aCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0RW50cnlCeUtleShrZXk6IHN0cmluZyk6ID9FbnRyeSB7XG4gIHJldHVybiBnZXRGaWxlQnlLZXkoa2V5KSB8fCBnZXREaXJlY3RvcnlCeUtleShrZXkpO1xufVxuXG5mdW5jdGlvbiBnZXREaXNwbGF5VGl0bGUoa2V5OiBzdHJpbmcpOiA/c3RyaW5nIHtcbiAgY29uc3QgcGF0aCA9IGtleVRvUGF0aChrZXkpO1xuXG4gIGlmIChSZW1vdGVVcmkuaXNSZW1vdGUocGF0aCkpIHtcbiAgICBjb25zdCBjb25uZWN0aW9uID0gUmVtb3RlQ29ubmVjdGlvbi5nZXRGb3JVcmkocGF0aCk7XG5cbiAgICBpZiAoY29ubmVjdGlvbiAhPSBudWxsKSB7XG4gICAgICByZXR1cm4gY29ubmVjdGlvbi5nZXREaXNwbGF5VGl0bGUoKTtcbiAgICB9XG4gIH1cbn1cblxuLy8gU29tZXRpbWVzIHJlbW90ZSBkaXJlY3RvcmllcyBhcmUgaW5zdGFudGlhdGVkIGFzIGxvY2FsIGRpcmVjdG9yaWVzIGJ1dCB3aXRoIGludmFsaWQgcGF0aHMuXG5mdW5jdGlvbiBpc1ZhbGlkRGlyZWN0b3J5KGRpcmVjdG9yeTogRGlyZWN0b3J5KTogYm9vbGVhbiB7XG4gIHJldHVybiAoXG4gICAgIWlzTG9jYWxFbnRyeSgoZGlyZWN0b3J5OiBhbnkpKSB8fFxuICAgIHBhdGhNb2R1bGUuaXNBYnNvbHV0ZShkaXJlY3RvcnkuZ2V0UGF0aCgpKVxuICApO1xufVxuXG5mdW5jdGlvbiBpc0xvY2FsRW50cnkoZW50cnk6IEVudHJ5KTogYm9vbGVhbiB7XG4gIC8vIFRPRE86IGltcGxlbWVudCBgUmVtb3RlRGlyZWN0b3J5LmlzUmVtb3RlRGlyZWN0b3J5KClgXG4gIHJldHVybiAhKCdnZXRMb2NhbFBhdGgnIGluIGVudHJ5KTtcbn1cblxuZnVuY3Rpb24gaXNDb250ZXh0Q2xpY2soZXZlbnQ6IFN5bnRoZXRpY01vdXNlRXZlbnQpOiBib29sZWFuIHtcbiAgcmV0dXJuIChcbiAgICBldmVudC5idXR0b24gPT09IDIgfHxcbiAgICAoZXZlbnQuYnV0dG9uID09PSAwICYmIGV2ZW50LmN0cmxLZXkgPT09IHRydWUgJiYgcHJvY2Vzcy5wbGF0Zm9ybSA9PT0gJ2RhcndpbicpXG4gICk7XG59XG5cbmZ1bmN0aW9uIGJ1aWxkSGFzaEtleShub2RlS2V5OiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gY3J5cHRvLmNyZWF0ZUhhc2goJ01ENScpLnVwZGF0ZShub2RlS2V5KS5kaWdlc3QoJ2Jhc2U2NCcpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgZGlyUGF0aFRvS2V5LFxuICBpc0RpcktleSxcbiAga2V5VG9OYW1lLFxuICBrZXlUb1BhdGgsXG4gIGdldFBhcmVudEtleSxcbiAgZmV0Y2hDaGlsZHJlbixcbiAgZ2V0RGlyZWN0b3J5QnlLZXksXG4gIGdldEVudHJ5QnlLZXksXG4gIGdldEZpbGVCeUtleSxcbiAgZ2V0RGlzcGxheVRpdGxlLFxuICBpc1ZhbGlkRGlyZWN0b3J5LFxuICBpc0xvY2FsRW50cnksXG4gIGlzQ29udGV4dENsaWNrLFxuICBidWlsZEhhc2hLZXksXG59O1xuIl19