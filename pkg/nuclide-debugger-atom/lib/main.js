Object.defineProperty(exports, '__esModule', {
  value: true
});

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

var _createDecoratedClass = (function () { function defineProperties(target, descriptors, initializers) { for (var i = 0; i < descriptors.length; i++) { var descriptor = descriptors[i]; var decorators = descriptor.decorators; var key = descriptor.key; delete descriptor.key; delete descriptor.decorators; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor || descriptor.initializer) descriptor.writable = true; if (decorators) { for (var f = 0; f < decorators.length; f++) { var decorator = decorators[f]; if (typeof decorator === 'function') { descriptor = decorator(target, key, descriptor) || descriptor; } else { throw new TypeError('The decorator for method ' + descriptor.key + ' is of the invalid type ' + typeof decorator); } } if (descriptor.initializer !== undefined) { initializers[key] = descriptor; continue; } } Object.defineProperty(target, key, descriptor); } } return function (Constructor, protoProps, staticProps, protoInitializers, staticInitializers) { if (protoProps) defineProperties(Constructor.prototype, protoProps, protoInitializers); if (staticProps) defineProperties(Constructor, staticProps, staticInitializers); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _assert = require('assert');

var _assert2 = _interopRequireDefault(_assert);

var _atom = require('atom');

var _nuclideAnalytics = require('../../nuclide-analytics');

var _RemoteControlService = require('./RemoteControlService');

var _RemoteControlService2 = _interopRequireDefault(_RemoteControlService);

var _DebuggerModel = require('./DebuggerModel');

var _DebuggerModel2 = _interopRequireDefault(_DebuggerModel);

var _DebuggerDatatip = require('./DebuggerDatatip');

var _reactForAtom = require('react-for-atom');

var _DebuggerLaunchAttachUI = require('./DebuggerLaunchAttachUI');

var _nuclideRemoteUri = require('../../nuclide-remote-uri');

var _nuclideRemoteUri2 = _interopRequireDefault(_nuclideRemoteUri);

var _nuclideRemoteConnection = require('../../nuclide-remote-connection');

var DATATIP_PACKAGE_NAME = 'nuclide-debugger-datatip';

function createDebuggerView(model) {
  var DebuggerControllerView = require('./DebuggerControllerView');
  var elem = document.createElement('div');
  elem.className = 'nuclide-debugger-root';
  _reactForAtom.ReactDOM.render(_reactForAtom.React.createElement(DebuggerControllerView, {
    store: model.getStore(),
    bridge: model.getBridge(),
    actions: model.getActions(),
    breakpointStore: model.getBreakpointStore()
  }), elem);
  return elem;
}

var Activation = (function () {
  function Activation(state) {
    var _this = this;

    _classCallCheck(this, Activation);

    this._model = new _DebuggerModel2['default'](state);
    this._panel = null;
    this._launchAttachDialog = null;
    this._disposables = new _atom.CompositeDisposable(this._model, atom.views.addViewProvider(_DebuggerModel2['default'], createDebuggerView),

    // Listen for removed connections and kill the debugger if it is using that connection.
    _nuclideRemoteConnection.ServerConnection.onDidCloseServerConnection(function (connection) {
      var debuggerProcess = _this._model.getStore().getDebuggerProcess();
      if (debuggerProcess == null) {
        return; // Nothing to do if we're not debugging.
      }
      var debuggeeTargetUri = debuggerProcess.getTargetUri();
      if (_nuclideRemoteUri2['default'].isLocal(debuggeeTargetUri)) {
        return; // Nothing to do if our debug session is local.
      }
      if (_nuclideRemoteUri2['default'].getHostname(debuggeeTargetUri) === connection.getRemoteHostname() && _nuclideRemoteUri2['default'].getPort(debuggeeTargetUri) === connection.getPort()) {
        _this._model.getActions().killDebugger();
      }
    }),

    // Commands.
    atom.commands.add('atom-workspace', {
      'nuclide-debugger:toggle': this._toggle.bind(this)
    }), atom.commands.add('atom-workspace', {
      'nuclide-debugger:show': this._show.bind(this)
    }), atom.commands.add('atom-workspace', {
      'nuclide-debugger:continue-debugging': this._continue.bind(this)
    }), atom.commands.add('atom-workspace', {
      'nuclide-debugger:stop-debugging': this._stop.bind(this)
    }), atom.commands.add('atom-workspace', {
      'nuclide-debugger:step-over': this._stepOver.bind(this)
    }), atom.commands.add('atom-workspace', {
      'nuclide-debugger:step-into': this._stepInto.bind(this)
    }), atom.commands.add('atom-workspace', {
      'nuclide-debugger:step-out': this._stepOut.bind(this)
    }), atom.commands.add('atom-workspace', {
      'nuclide-debugger:toggle-breakpoint': this._toggleBreakpoint.bind(this)
    }), atom.commands.add('atom-workspace', {
      'nuclide-debugger:toggle-launch-attach': this._toggleLaunchAttachDialog.bind(this)
    }),

    // Context Menu Items.
    atom.contextMenu.add({
      'atom-text-editor': [{ type: 'separator' }, {
        label: 'Debugger',
        submenu: [{
          label: 'Toggle Breakpoint',
          command: 'nuclide-debugger:toggle-breakpoint'
        }]
      }, { type: 'separator' }]
    }));
    this._hideLaunchAttachDialog = this._hideLaunchAttachDialog.bind(this);
  }

  _createDecoratedClass(Activation, [{
    key: 'serialize',
    value: function serialize() {
      var state = {
        breakpoints: this.getModel().getBreakpointStore().getSerializedBreakpoints()
      };
      return state;
    }
  }, {
    key: 'dispose',
    value: function dispose() {
      this._disposables.dispose();
      if (this._panel) {
        this._panel.destroy();
      }
    }
  }, {
    key: 'getModel',
    value: function getModel() {
      return this._model;
    }
  }, {
    key: '_toggle',
    value: function _toggle() {
      var panel = this._getPanel();
      if (panel.isVisible()) {
        panel.hide();
      } else {
        panel.show();
      }
    }
  }, {
    key: '_show',
    value: function _show() {
      this._getPanel().show();
    }
  }, {
    key: '_continue',
    value: function _continue() {
      // TODO(jeffreytan): when we figured out the launch lifecycle story
      // we may bind this to start-debugging too.
      this._model.getBridge()['continue']();
    }
  }, {
    key: '_stop',
    value: function _stop() {
      this._model.getActions().killDebugger();
    }
  }, {
    key: '_stepOver',
    value: function _stepOver() {
      this._model.getBridge().stepOver();
    }
  }, {
    key: '_stepInto',
    value: function _stepInto() {
      this._model.getBridge().stepInto();
    }
  }, {
    key: '_stepOut',
    value: function _stepOut() {
      this._model.getBridge().stepOut();
    }
  }, {
    key: '_toggleBreakpoint',
    decorators: [(0, _nuclideAnalytics.trackTiming)('nuclide-debugger-atom:toggleBreakpoint')],
    value: function _toggleBreakpoint() {
      var editor = atom.workspace.getActiveTextEditor();
      if (editor && editor.getPath()) {
        var filePath = editor.getPath();
        if (filePath) {
          var line = editor.getLastCursor().getBufferRow();
          this.getModel().getBreakpointStore().toggleBreakpoint(filePath, line);
        }
      }
    }
  }, {
    key: '_toggleLaunchAttachDialog',
    value: function _toggleLaunchAttachDialog() {
      var dialog = this._getLaunchAttachDialog();
      if (dialog.isVisible()) {
        dialog.hide();
      } else {
        dialog.show();
      }
    }
  }, {
    key: '_hideLaunchAttachDialog',
    value: function _hideLaunchAttachDialog() {
      var dialog = this._getLaunchAttachDialog();
      if (dialog.isVisible()) {
        dialog.hide();
      }
    }
  }, {
    key: '_getLaunchAttachDialog',
    value: function _getLaunchAttachDialog() {
      var _this2 = this;

      if (!this._launchAttachDialog) {
        var component = _reactForAtom.React.createElement(_DebuggerLaunchAttachUI.DebuggerLaunchAttachUI, {
          store: this._model.getDebuggerProviderStore(),
          debuggerActions: this._model.getActions()
        });
        var host = document.createElement('div');
        _reactForAtom.ReactDOM.render(component, host);
        this._launchAttachDialog = atom.workspace.addModalPanel({
          item: host,
          visible: false });

        // Hide first so that caller can toggle it visible.
        this._disposables.add(new _atom.Disposable(function () {
          if (_this2._launchAttachDialog != null) {
            _this2._launchAttachDialog.destroy();
            _this2._launchAttachDialog = null;
          }
        }), atom.commands.add('atom-workspace', 'core:cancel', this._hideLaunchAttachDialog));
      }
      (0, _assert2['default'])(this._launchAttachDialog);
      return this._launchAttachDialog;
    }

    /**
     * Lazy panel creation.
     */
  }, {
    key: '_getPanel',
    value: function _getPanel() {
      if (!this._panel) {
        var panel = atom.workspace.addRightPanel({
          item: this._model,
          visible: false
        });
        // Flow doesn't track non-null when assigning into nullable directly.
        this._panel = panel;
        return panel;
      } else {
        return this._panel;
      }
    }
  }]);

  return Activation;
})();

var activation = null;
var toolBar = null;

module.exports = {
  activate: function activate(state) {
    if (!activation) {
      activation = new Activation(state);
    }
  },

  serialize: function serialize() {
    if (activation) {
      return activation.serialize();
    } else {
      return {
        breakpoints: null
      };
    }
  },

  deactivate: function deactivate() {
    if (activation) {
      activation.dispose();
      activation = null;
    }
    if (toolBar) {
      toolBar.removeItems();
    }
  },

  consumeNuclideDebugger: function consumeNuclideDebugger(service) {
    if (activation) {
      activation.getModel().getActions().addService(service);
    }
    return new _atom.Disposable(function () {
      if (activation) {
        activation.getModel().getActions().removeService(service);
      }
    });
  },

  consumeDebuggerProvider: function consumeDebuggerProvider(provider) {
    if (activation) {
      activation.getModel().getActions().addDebuggerProvider(provider);
    }
    return new _atom.Disposable(function () {
      if (activation) {
        activation.getModel().getActions().removeDebuggerProvider(provider);
      }
    });
  },

  consumeEvaluationExpressionProvider: function consumeEvaluationExpressionProvider(provider) {
    if (activation) {
      activation.getModel().getActions().addEvaluationExpressionProvider(provider);
    }
    return new _atom.Disposable(function () {
      if (activation) {
        activation.getModel().getActions().removeEvaluationExpressionProvider(provider);
      }
    });
  },

  DebuggerProcessInfo: require('./DebuggerProcessInfo'),
  DebuggerInstance: require('./DebuggerInstance'),
  DebuggerLaunchAttachProvider: require('./DebuggerLaunchAttachProvider'),

  consumeToolBar: function consumeToolBar(getToolBar) {
    toolBar = getToolBar('nuclide-debugger');
    toolBar.addButton({
      icon: 'plug',
      callback: 'nuclide-debugger:toggle',
      tooltip: 'Toggle Debugger',
      priority: 100
    });
  },

  provideRemoteControlService: function provideRemoteControlService() {
    return new _RemoteControlService2['default'](function () {
      return activation ? activation.getModel() : null;
    });
  },

  createDatatipProvider: function createDatatipProvider() {
    return {
      // Eligibility is determined online, based on registered EvaluationExpression providers.
      validForScope: function validForScope(scope) {
        return true;
      },
      providerName: DATATIP_PACKAGE_NAME,
      inclusionPriority: 1,
      datatip: function datatip(editor, position) {
        if (activation == null) {
          return null;
        }
        var model = activation.getModel();
        return (0, _DebuggerDatatip.debuggerDatatip)(model, editor, position);
      }
    };
  }
};
//# sourceMappingURL=data:application/json;base64,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eUI7QUFDbEQsV0FBTyxzQ0FBeUI7YUFBTSxVQUFVLEdBQUcsVUFBVSxDQUFDLFFBQVEsRUFBRSxHQUFHLElBQUk7S0FBQSxDQUFDLENBQUM7R0FDbEY7O0FBRUQsdUJBQXFCLEVBQUEsaUNBQVc7QUFDOUIsV0FBTzs7QUFFTCxtQkFBYSxFQUFFLHVCQUFDLEtBQUs7ZUFBYSxJQUFJO09BQUE7QUFDdEMsa0JBQVksRUFBRSxvQkFBb0I7QUFDbEMsdUJBQWlCLEVBQUUsQ0FBQztBQUNwQixhQUFPLEVBQUUsaUJBQUMsTUFBTSxFQUFjLFFBQVEsRUFBaUI7QUFDckQsWUFBSSxVQUFVLElBQUksSUFBSSxFQUFFO0FBQ3RCLGlCQUFPLElBQUksQ0FBQztTQUNiO0FBQ0QsWUFBTSxLQUFLLEdBQUcsVUFBVSxDQUFDLFFBQVEsRUFBRSxDQUFDO0FBQ3BDLGVBQU8sc0NBQWdCLEtBQUssRUFBRSxNQUFNLEVBQUUsUUFBUSxDQUFDLENBQUM7T0FDakQ7S0FDRixDQUFDO0dBQ0g7Q0FDRixDQUFDIiwiZmlsZSI6Im1haW4uanMiLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIGJhYmVsJztcbi8qIEBmbG93ICovXG5cbi8qXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTUtcHJlc2VudCwgRmFjZWJvb2ssIEluYy5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgbGljZW5zZSBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGluXG4gKiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS5cbiAqL1xuXG5pbXBvcnQgdHlwZSB7XG4gICBudWNsaWRlX2RlYnVnZ2VyJFNlcnZpY2UsXG4gICBOdWNsaWRlRGVidWdnZXJQcm92aWRlcixcbiAgIE51Y2xpZGVFdmFsdWF0aW9uRXhwcmVzc2lvblByb3ZpZGVyLFxufSBmcm9tICcuLi8uLi9udWNsaWRlLWRlYnVnZ2VyLWludGVyZmFjZXMvc2VydmljZSc7XG5pbXBvcnQgdHlwZSB7U2VyaWFsaXplZEJyZWFrcG9pbnR9IGZyb20gJy4vQnJlYWtwb2ludFN0b3JlJztcblxuaW1wb3J0IGludmFyaWFudCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHtDb21wb3NpdGVEaXNwb3NhYmxlLCBEaXNwb3NhYmxlfSBmcm9tICdhdG9tJztcbmltcG9ydCB7dHJhY2tUaW1pbmd9IGZyb20gJy4uLy4uL251Y2xpZGUtYW5hbHl0aWNzJztcbmltcG9ydCBSZW1vdGVDb250cm9sU2VydmljZSBmcm9tICcuL1JlbW90ZUNvbnRyb2xTZXJ2aWNlJztcbmltcG9ydCBEZWJ1Z2dlck1vZGVsIGZyb20gJy4vRGVidWdnZXJNb2RlbCc7XG5pbXBvcnQge2RlYnVnZ2VyRGF0YXRpcH0gZnJvbSAnLi9EZWJ1Z2dlckRhdGF0aXAnO1xuaW1wb3J0IHtcbiAgUmVhY3QsXG4gIFJlYWN0RE9NLFxufSBmcm9tICdyZWFjdC1mb3ItYXRvbSc7XG5pbXBvcnQge0RlYnVnZ2VyTGF1bmNoQXR0YWNoVUl9IGZyb20gJy4vRGVidWdnZXJMYXVuY2hBdHRhY2hVSSc7XG5pbXBvcnQgcmVtb3RlVXJpIGZyb20gJy4uLy4uL251Y2xpZGUtcmVtb3RlLXVyaSc7XG5pbXBvcnQge1NlcnZlckNvbm5lY3Rpb259IGZyb20gJy4uLy4uL251Y2xpZGUtcmVtb3RlLWNvbm5lY3Rpb24nO1xuXG5leHBvcnQgdHlwZSBTZXJpYWxpemVkU3RhdGUgPSB7XG4gIGJyZWFrcG9pbnRzOiA/QXJyYXk8U2VyaWFsaXplZEJyZWFrcG9pbnQ+O1xufTtcblxuY29uc3QgREFUQVRJUF9QQUNLQUdFX05BTUUgPSAnbnVjbGlkZS1kZWJ1Z2dlci1kYXRhdGlwJztcblxuZnVuY3Rpb24gY3JlYXRlRGVidWdnZXJWaWV3KG1vZGVsOiBEZWJ1Z2dlck1vZGVsKTogSFRNTEVsZW1lbnQge1xuICBjb25zdCBEZWJ1Z2dlckNvbnRyb2xsZXJWaWV3ID0gcmVxdWlyZSgnLi9EZWJ1Z2dlckNvbnRyb2xsZXJWaWV3Jyk7XG4gIGNvbnN0IGVsZW0gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgZWxlbS5jbGFzc05hbWUgPSAnbnVjbGlkZS1kZWJ1Z2dlci1yb290JztcbiAgUmVhY3RET00ucmVuZGVyKFxuICAgIDxEZWJ1Z2dlckNvbnRyb2xsZXJWaWV3XG4gICAgICBzdG9yZT17bW9kZWwuZ2V0U3RvcmUoKX1cbiAgICAgIGJyaWRnZSA9IHttb2RlbC5nZXRCcmlkZ2UoKX1cbiAgICAgIGFjdGlvbnM9e21vZGVsLmdldEFjdGlvbnMoKX1cbiAgICAgIGJyZWFrcG9pbnRTdG9yZT17bW9kZWwuZ2V0QnJlYWtwb2ludFN0b3JlKCl9XG4gICAgLz4sXG4gICAgZWxlbSk7XG4gIHJldHVybiBlbGVtO1xufVxuXG5jbGFzcyBBY3RpdmF0aW9uIHtcbiAgX2Rpc3Bvc2FibGVzOiBDb21wb3NpdGVEaXNwb3NhYmxlO1xuICBfbW9kZWw6IERlYnVnZ2VyTW9kZWw7XG4gIF9wYW5lbDogP09iamVjdDtcbiAgX2xhdW5jaEF0dGFjaERpYWxvZzogP2F0b20kUGFuZWw7XG5cbiAgY29uc3RydWN0b3Ioc3RhdGU6ID9TZXJpYWxpemVkU3RhdGUpIHtcbiAgICB0aGlzLl9tb2RlbCA9IG5ldyBEZWJ1Z2dlck1vZGVsKHN0YXRlKTtcbiAgICB0aGlzLl9wYW5lbCA9IG51bGw7XG4gICAgdGhpcy5fbGF1bmNoQXR0YWNoRGlhbG9nID0gbnVsbDtcbiAgICB0aGlzLl9kaXNwb3NhYmxlcyA9IG5ldyBDb21wb3NpdGVEaXNwb3NhYmxlKFxuICAgICAgdGhpcy5fbW9kZWwsXG4gICAgICBhdG9tLnZpZXdzLmFkZFZpZXdQcm92aWRlcihEZWJ1Z2dlck1vZGVsLCBjcmVhdGVEZWJ1Z2dlclZpZXcpLFxuXG4gICAgICAvLyBMaXN0ZW4gZm9yIHJlbW92ZWQgY29ubmVjdGlvbnMgYW5kIGtpbGwgdGhlIGRlYnVnZ2VyIGlmIGl0IGlzIHVzaW5nIHRoYXQgY29ubmVjdGlvbi5cbiAgICAgIFNlcnZlckNvbm5lY3Rpb24ub25EaWRDbG9zZVNlcnZlckNvbm5lY3Rpb24oY29ubmVjdGlvbiA9PiB7XG4gICAgICAgIGNvbnN0IGRlYnVnZ2VyUHJvY2VzcyA9IHRoaXMuX21vZGVsLmdldFN0b3JlKCkuZ2V0RGVidWdnZXJQcm9jZXNzKCk7XG4gICAgICAgIGlmIChkZWJ1Z2dlclByb2Nlc3MgPT0gbnVsbCkge1xuICAgICAgICAgIHJldHVybjsgLy8gTm90aGluZyB0byBkbyBpZiB3ZSdyZSBub3QgZGVidWdnaW5nLlxuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGRlYnVnZ2VlVGFyZ2V0VXJpID0gZGVidWdnZXJQcm9jZXNzLmdldFRhcmdldFVyaSgpO1xuICAgICAgICBpZiAocmVtb3RlVXJpLmlzTG9jYWwoZGVidWdnZWVUYXJnZXRVcmkpKSB7XG4gICAgICAgICAgcmV0dXJuOyAvLyBOb3RoaW5nIHRvIGRvIGlmIG91ciBkZWJ1ZyBzZXNzaW9uIGlzIGxvY2FsLlxuICAgICAgICB9XG4gICAgICAgIGlmIChyZW1vdGVVcmkuZ2V0SG9zdG5hbWUoZGVidWdnZWVUYXJnZXRVcmkpID09PSBjb25uZWN0aW9uLmdldFJlbW90ZUhvc3RuYW1lKClcbiAgICAgICAgICAgICYmIHJlbW90ZVVyaS5nZXRQb3J0KGRlYnVnZ2VlVGFyZ2V0VXJpKSA9PT0gY29ubmVjdGlvbi5nZXRQb3J0KCkpIHtcbiAgICAgICAgICB0aGlzLl9tb2RlbC5nZXRBY3Rpb25zKCkua2lsbERlYnVnZ2VyKCk7XG4gICAgICAgIH1cbiAgICAgIH0pLFxuXG4gICAgICAvLyBDb21tYW5kcy5cbiAgICAgIGF0b20uY29tbWFuZHMuYWRkKCdhdG9tLXdvcmtzcGFjZScsIHtcbiAgICAgICAgJ251Y2xpZGUtZGVidWdnZXI6dG9nZ2xlJzogdGhpcy5fdG9nZ2xlLmJpbmQodGhpcyksXG4gICAgICB9KSxcbiAgICAgIGF0b20uY29tbWFuZHMuYWRkKCdhdG9tLXdvcmtzcGFjZScsIHtcbiAgICAgICAgJ251Y2xpZGUtZGVidWdnZXI6c2hvdyc6IHRoaXMuX3Nob3cuYmluZCh0aGlzKSxcbiAgICAgIH0pLFxuICAgICAgYXRvbS5jb21tYW5kcy5hZGQoJ2F0b20td29ya3NwYWNlJywge1xuICAgICAgICAnbnVjbGlkZS1kZWJ1Z2dlcjpjb250aW51ZS1kZWJ1Z2dpbmcnOiB0aGlzLl9jb250aW51ZS5iaW5kKHRoaXMpLFxuICAgICAgfSksXG4gICAgICBhdG9tLmNvbW1hbmRzLmFkZCgnYXRvbS13b3Jrc3BhY2UnLCB7XG4gICAgICAgICdudWNsaWRlLWRlYnVnZ2VyOnN0b3AtZGVidWdnaW5nJzogdGhpcy5fc3RvcC5iaW5kKHRoaXMpLFxuICAgICAgfSksXG4gICAgICBhdG9tLmNvbW1hbmRzLmFkZCgnYXRvbS13b3Jrc3BhY2UnLCB7XG4gICAgICAgICdudWNsaWRlLWRlYnVnZ2VyOnN0ZXAtb3Zlcic6IHRoaXMuX3N0ZXBPdmVyLmJpbmQodGhpcyksXG4gICAgICB9KSxcbiAgICAgIGF0b20uY29tbWFuZHMuYWRkKCdhdG9tLXdvcmtzcGFjZScsIHtcbiAgICAgICAgJ251Y2xpZGUtZGVidWdnZXI6c3RlcC1pbnRvJzogdGhpcy5fc3RlcEludG8uYmluZCh0aGlzKSxcbiAgICAgIH0pLFxuICAgICAgYXRvbS5jb21tYW5kcy5hZGQoJ2F0b20td29ya3NwYWNlJywge1xuICAgICAgICAnbnVjbGlkZS1kZWJ1Z2dlcjpzdGVwLW91dCc6IHRoaXMuX3N0ZXBPdXQuYmluZCh0aGlzKSxcbiAgICAgIH0pLFxuICAgICAgYXRvbS5jb21tYW5kcy5hZGQoJ2F0b20td29ya3NwYWNlJywge1xuICAgICAgICAnbnVjbGlkZS1kZWJ1Z2dlcjp0b2dnbGUtYnJlYWtwb2ludCc6IHRoaXMuX3RvZ2dsZUJyZWFrcG9pbnQuYmluZCh0aGlzKSxcbiAgICAgIH0pLFxuICAgICAgYXRvbS5jb21tYW5kcy5hZGQoJ2F0b20td29ya3NwYWNlJywge1xuICAgICAgICAnbnVjbGlkZS1kZWJ1Z2dlcjp0b2dnbGUtbGF1bmNoLWF0dGFjaCc6IHRoaXMuX3RvZ2dsZUxhdW5jaEF0dGFjaERpYWxvZy5iaW5kKHRoaXMpLFxuICAgICAgfSksXG5cbiAgICAgIC8vIENvbnRleHQgTWVudSBJdGVtcy5cbiAgICAgIGF0b20uY29udGV4dE1lbnUuYWRkKHtcbiAgICAgICAgJ2F0b20tdGV4dC1lZGl0b3InOiBbXG4gICAgICAgICAge3R5cGU6ICdzZXBhcmF0b3InfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBsYWJlbDogJ0RlYnVnZ2VyJyxcbiAgICAgICAgICAgIHN1Ym1lbnU6IFtcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGxhYmVsOiAnVG9nZ2xlIEJyZWFrcG9pbnQnLFxuICAgICAgICAgICAgICAgIGNvbW1hbmQ6ICdudWNsaWRlLWRlYnVnZ2VyOnRvZ2dsZS1icmVha3BvaW50JyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7dHlwZTogJ3NlcGFyYXRvcid9LFxuICAgICAgICBdLFxuICAgICAgfSksXG4gICAgKTtcbiAgICAodGhpczogYW55KS5faGlkZUxhdW5jaEF0dGFjaERpYWxvZyA9IHRoaXMuX2hpZGVMYXVuY2hBdHRhY2hEaWFsb2cuYmluZCh0aGlzKTtcbiAgfVxuXG4gIHNlcmlhbGl6ZSgpOiBTZXJpYWxpemVkU3RhdGUge1xuICAgIGNvbnN0IHN0YXRlID0ge1xuICAgICAgYnJlYWtwb2ludHM6IHRoaXMuZ2V0TW9kZWwoKS5nZXRCcmVha3BvaW50U3RvcmUoKS5nZXRTZXJpYWxpemVkQnJlYWtwb2ludHMoKSxcbiAgICB9O1xuICAgIHJldHVybiBzdGF0ZTtcbiAgfVxuXG4gIGRpc3Bvc2UoKSB7XG4gICAgdGhpcy5fZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuICAgIGlmICh0aGlzLl9wYW5lbCkge1xuICAgICAgdGhpcy5fcGFuZWwuZGVzdHJveSgpO1xuICAgIH1cbiAgfVxuXG4gIGdldE1vZGVsKCk6IERlYnVnZ2VyTW9kZWwge1xuICAgIHJldHVybiB0aGlzLl9tb2RlbDtcbiAgfVxuXG4gIF90b2dnbGUoKSB7XG4gICAgY29uc3QgcGFuZWwgPSB0aGlzLl9nZXRQYW5lbCgpO1xuICAgIGlmIChwYW5lbC5pc1Zpc2libGUoKSkge1xuICAgICAgcGFuZWwuaGlkZSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBwYW5lbC5zaG93KCk7XG4gICAgfVxuICB9XG5cbiAgX3Nob3coKSB7XG4gICAgdGhpcy5fZ2V0UGFuZWwoKS5zaG93KCk7XG4gIH1cblxuICBfY29udGludWUoKSB7XG4gICAgLy8gVE9ETyhqZWZmcmV5dGFuKTogd2hlbiB3ZSBmaWd1cmVkIG91dCB0aGUgbGF1bmNoIGxpZmVjeWNsZSBzdG9yeVxuICAgIC8vIHdlIG1heSBiaW5kIHRoaXMgdG8gc3RhcnQtZGVidWdnaW5nIHRvby5cbiAgICB0aGlzLl9tb2RlbC5nZXRCcmlkZ2UoKS5jb250aW51ZSgpO1xuICB9XG5cbiAgX3N0b3AoKSB7XG4gICAgdGhpcy5fbW9kZWwuZ2V0QWN0aW9ucygpLmtpbGxEZWJ1Z2dlcigpO1xuICB9XG5cbiAgX3N0ZXBPdmVyKCkge1xuICAgIHRoaXMuX21vZGVsLmdldEJyaWRnZSgpLnN0ZXBPdmVyKCk7XG4gIH1cblxuICBfc3RlcEludG8oKSB7XG4gICAgdGhpcy5fbW9kZWwuZ2V0QnJpZGdlKCkuc3RlcEludG8oKTtcbiAgfVxuXG4gIF9zdGVwT3V0KCkge1xuICAgIHRoaXMuX21vZGVsLmdldEJyaWRnZSgpLnN0ZXBPdXQoKTtcbiAgfVxuXG4gIEB0cmFja1RpbWluZygnbnVjbGlkZS1kZWJ1Z2dlci1hdG9tOnRvZ2dsZUJyZWFrcG9pbnQnKVxuICBfdG9nZ2xlQnJlYWtwb2ludCgpIHtcbiAgICBjb25zdCBlZGl0b3IgPSBhdG9tLndvcmtzcGFjZS5nZXRBY3RpdmVUZXh0RWRpdG9yKCk7XG4gICAgaWYgKGVkaXRvciAmJiBlZGl0b3IuZ2V0UGF0aCgpKSB7XG4gICAgICBjb25zdCBmaWxlUGF0aCA9IGVkaXRvci5nZXRQYXRoKCk7XG4gICAgICBpZiAoZmlsZVBhdGgpIHtcbiAgICAgICAgY29uc3QgbGluZSA9IGVkaXRvci5nZXRMYXN0Q3Vyc29yKCkuZ2V0QnVmZmVyUm93KCk7XG4gICAgICAgIHRoaXMuZ2V0TW9kZWwoKS5nZXRCcmVha3BvaW50U3RvcmUoKS50b2dnbGVCcmVha3BvaW50KGZpbGVQYXRoLCBsaW5lKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuXG4gIF90b2dnbGVMYXVuY2hBdHRhY2hEaWFsb2coKTogdm9pZCB7XG4gICAgY29uc3QgZGlhbG9nID0gdGhpcy5fZ2V0TGF1bmNoQXR0YWNoRGlhbG9nKCk7XG4gICAgaWYgKGRpYWxvZy5pc1Zpc2libGUoKSkge1xuICAgICAgZGlhbG9nLmhpZGUoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZGlhbG9nLnNob3coKTtcbiAgICB9XG4gIH1cblxuICBfaGlkZUxhdW5jaEF0dGFjaERpYWxvZygpOiB2b2lkIHtcbiAgICBjb25zdCBkaWFsb2cgPSB0aGlzLl9nZXRMYXVuY2hBdHRhY2hEaWFsb2coKTtcbiAgICBpZiAoZGlhbG9nLmlzVmlzaWJsZSgpKSB7XG4gICAgICBkaWFsb2cuaGlkZSgpO1xuICAgIH1cbiAgfVxuXG4gIF9nZXRMYXVuY2hBdHRhY2hEaWFsb2coKTogYXRvbSRQYW5lbCB7XG4gICAgaWYgKCF0aGlzLl9sYXVuY2hBdHRhY2hEaWFsb2cpIHtcbiAgICAgIGNvbnN0IGNvbXBvbmVudCA9IChcbiAgICAgICAgPERlYnVnZ2VyTGF1bmNoQXR0YWNoVUlcbiAgICAgICAgICBzdG9yZT17dGhpcy5fbW9kZWwuZ2V0RGVidWdnZXJQcm92aWRlclN0b3JlKCl9XG4gICAgICAgICAgZGVidWdnZXJBY3Rpb25zPXt0aGlzLl9tb2RlbC5nZXRBY3Rpb25zKCl9XG4gICAgICAgIC8+XG4gICAgICApO1xuICAgICAgY29uc3QgaG9zdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgUmVhY3RET00ucmVuZGVyKGNvbXBvbmVudCwgaG9zdCk7XG4gICAgICB0aGlzLl9sYXVuY2hBdHRhY2hEaWFsb2cgPSBhdG9tLndvcmtzcGFjZS5hZGRNb2RhbFBhbmVsKHtcbiAgICAgICAgaXRlbTogaG9zdCxcbiAgICAgICAgdmlzaWJsZTogZmFsc2UsIC8vIEhpZGUgZmlyc3Qgc28gdGhhdCBjYWxsZXIgY2FuIHRvZ2dsZSBpdCB2aXNpYmxlLlxuICAgICAgfSk7XG5cbiAgICAgIHRoaXMuX2Rpc3Bvc2FibGVzLmFkZChcbiAgICAgICAgbmV3IERpc3Bvc2FibGUoKCkgPT4ge1xuICAgICAgICAgIGlmICh0aGlzLl9sYXVuY2hBdHRhY2hEaWFsb2cgIT0gbnVsbCkge1xuICAgICAgICAgICAgdGhpcy5fbGF1bmNoQXR0YWNoRGlhbG9nLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIHRoaXMuX2xhdW5jaEF0dGFjaERpYWxvZyA9IG51bGw7XG4gICAgICAgICAgfVxuICAgICAgICB9KSxcbiAgICAgICAgYXRvbS5jb21tYW5kcy5hZGQoXG4gICAgICAgICAgJ2F0b20td29ya3NwYWNlJyxcbiAgICAgICAgICAnY29yZTpjYW5jZWwnLFxuICAgICAgICAgIHRoaXMuX2hpZGVMYXVuY2hBdHRhY2hEaWFsb2csXG4gICAgICAgICksXG4gICAgICApO1xuICAgIH1cbiAgICBpbnZhcmlhbnQodGhpcy5fbGF1bmNoQXR0YWNoRGlhbG9nKTtcbiAgICByZXR1cm4gdGhpcy5fbGF1bmNoQXR0YWNoRGlhbG9nO1xuICB9XG5cbiAgLyoqXG4gICAqIExhenkgcGFuZWwgY3JlYXRpb24uXG4gICAqL1xuICBfZ2V0UGFuZWwoKTogT2JqZWN0IHtcbiAgICBpZiAoIXRoaXMuX3BhbmVsKSB7XG4gICAgICBjb25zdCBwYW5lbCA9IGF0b20ud29ya3NwYWNlLmFkZFJpZ2h0UGFuZWwoe1xuICAgICAgICBpdGVtOiB0aGlzLl9tb2RlbCxcbiAgICAgICAgdmlzaWJsZTogZmFsc2UsXG4gICAgICB9KTtcbiAgICAgIC8vIEZsb3cgZG9lc24ndCB0cmFjayBub24tbnVsbCB3aGVuIGFzc2lnbmluZyBpbnRvIG51bGxhYmxlIGRpcmVjdGx5LlxuICAgICAgdGhpcy5fcGFuZWwgPSBwYW5lbDtcbiAgICAgIHJldHVybiBwYW5lbDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRoaXMuX3BhbmVsO1xuICAgIH1cbiAgfVxufVxuXG5sZXQgYWN0aXZhdGlvbiA9IG51bGw7XG5sZXQgdG9vbEJhcjogP2FueSA9IG51bGw7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBhY3RpdmF0ZShzdGF0ZTogP1NlcmlhbGl6ZWRTdGF0ZSkge1xuICAgIGlmICghYWN0aXZhdGlvbikge1xuICAgICAgYWN0aXZhdGlvbiA9IG5ldyBBY3RpdmF0aW9uKHN0YXRlKTtcbiAgICB9XG4gIH0sXG5cbiAgc2VyaWFsaXplKCk6IFNlcmlhbGl6ZWRTdGF0ZSB7XG4gICAgaWYgKGFjdGl2YXRpb24pIHtcbiAgICAgIHJldHVybiBhY3RpdmF0aW9uLnNlcmlhbGl6ZSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBicmVha3BvaW50czogbnVsbCxcbiAgICAgIH07XG4gICAgfVxuICB9LFxuXG4gIGRlYWN0aXZhdGUoKSB7XG4gICAgaWYgKGFjdGl2YXRpb24pIHtcbiAgICAgIGFjdGl2YXRpb24uZGlzcG9zZSgpO1xuICAgICAgYWN0aXZhdGlvbiA9IG51bGw7XG4gICAgfVxuICAgIGlmICh0b29sQmFyKSB7XG4gICAgICB0b29sQmFyLnJlbW92ZUl0ZW1zKCk7XG4gICAgfVxuICB9LFxuXG4gIGNvbnN1bWVOdWNsaWRlRGVidWdnZXIoc2VydmljZTogbnVjbGlkZV9kZWJ1Z2dlciRTZXJ2aWNlKTogRGlzcG9zYWJsZSB7XG4gICAgaWYgKGFjdGl2YXRpb24pIHtcbiAgICAgIGFjdGl2YXRpb24uZ2V0TW9kZWwoKS5nZXRBY3Rpb25zKCkuYWRkU2VydmljZShzZXJ2aWNlKTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBEaXNwb3NhYmxlKCgpID0+IHtcbiAgICAgIGlmIChhY3RpdmF0aW9uKSB7XG4gICAgICAgIGFjdGl2YXRpb24uZ2V0TW9kZWwoKS5nZXRBY3Rpb25zKCkucmVtb3ZlU2VydmljZShzZXJ2aWNlKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSxcblxuICBjb25zdW1lRGVidWdnZXJQcm92aWRlcihcbiAgICBwcm92aWRlcjogTnVjbGlkZURlYnVnZ2VyUHJvdmlkZXJcbiAgKTogSURpc3Bvc2FibGUge1xuICAgIGlmIChhY3RpdmF0aW9uKSB7XG4gICAgICBhY3RpdmF0aW9uLmdldE1vZGVsKCkuZ2V0QWN0aW9ucygpLmFkZERlYnVnZ2VyUHJvdmlkZXIocHJvdmlkZXIpO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IERpc3Bvc2FibGUoKCkgPT4ge1xuICAgICAgaWYgKGFjdGl2YXRpb24pIHtcbiAgICAgICAgYWN0aXZhdGlvbi5nZXRNb2RlbCgpLmdldEFjdGlvbnMoKS5yZW1vdmVEZWJ1Z2dlclByb3ZpZGVyKHByb3ZpZGVyKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSxcblxuICBjb25zdW1lRXZhbHVhdGlvbkV4cHJlc3Npb25Qcm92aWRlcihcbiAgICBwcm92aWRlcjogTnVjbGlkZUV2YWx1YXRpb25FeHByZXNzaW9uUHJvdmlkZXJcbiAgKTogSURpc3Bvc2FibGUge1xuICAgIGlmIChhY3RpdmF0aW9uKSB7XG4gICAgICBhY3RpdmF0aW9uLmdldE1vZGVsKCkuZ2V0QWN0aW9ucygpLmFkZEV2YWx1YXRpb25FeHByZXNzaW9uUHJvdmlkZXIocHJvdmlkZXIpO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IERpc3Bvc2FibGUoKCkgPT4ge1xuICAgICAgaWYgKGFjdGl2YXRpb24pIHtcbiAgICAgICAgYWN0aXZhdGlvbi5nZXRNb2RlbCgpLmdldEFjdGlvbnMoKS5yZW1vdmVFdmFsdWF0aW9uRXhwcmVzc2lvblByb3ZpZGVyKHByb3ZpZGVyKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSxcblxuICBEZWJ1Z2dlclByb2Nlc3NJbmZvOiByZXF1aXJlKCcuL0RlYnVnZ2VyUHJvY2Vzc0luZm8nKSxcbiAgRGVidWdnZXJJbnN0YW5jZTogcmVxdWlyZSgnLi9EZWJ1Z2dlckluc3RhbmNlJyksXG4gIERlYnVnZ2VyTGF1bmNoQXR0YWNoUHJvdmlkZXI6IHJlcXVpcmUoJy4vRGVidWdnZXJMYXVuY2hBdHRhY2hQcm92aWRlcicpLFxuXG4gIGNvbnN1bWVUb29sQmFyKGdldFRvb2xCYXI6IChncm91cDogc3RyaW5nKSA9PiBPYmplY3QpOiB2b2lkIHtcbiAgICB0b29sQmFyID0gZ2V0VG9vbEJhcignbnVjbGlkZS1kZWJ1Z2dlcicpO1xuICAgIHRvb2xCYXIuYWRkQnV0dG9uKHtcbiAgICAgIGljb246ICdwbHVnJyxcbiAgICAgIGNhbGxiYWNrOiAnbnVjbGlkZS1kZWJ1Z2dlcjp0b2dnbGUnLFxuICAgICAgdG9vbHRpcDogJ1RvZ2dsZSBEZWJ1Z2dlcicsXG4gICAgICBwcmlvcml0eTogMTAwLFxuICAgIH0pO1xuICB9LFxuXG4gIHByb3ZpZGVSZW1vdGVDb250cm9sU2VydmljZSgpOiBSZW1vdGVDb250cm9sU2VydmljZSB7XG4gICAgcmV0dXJuIG5ldyBSZW1vdGVDb250cm9sU2VydmljZSgoKSA9PiBhY3RpdmF0aW9uID8gYWN0aXZhdGlvbi5nZXRNb2RlbCgpIDogbnVsbCk7XG4gIH0sXG5cbiAgY3JlYXRlRGF0YXRpcFByb3ZpZGVyKCk6IE9iamVjdCB7XG4gICAgcmV0dXJuIHtcbiAgICAgIC8vIEVsaWdpYmlsaXR5IGlzIGRldGVybWluZWQgb25saW5lLCBiYXNlZCBvbiByZWdpc3RlcmVkIEV2YWx1YXRpb25FeHByZXNzaW9uIHByb3ZpZGVycy5cbiAgICAgIHZhbGlkRm9yU2NvcGU6IChzY29wZTogc3RyaW5nKSA9PiB0cnVlLFxuICAgICAgcHJvdmlkZXJOYW1lOiBEQVRBVElQX1BBQ0tBR0VfTkFNRSxcbiAgICAgIGluY2x1c2lvblByaW9yaXR5OiAxLFxuICAgICAgZGF0YXRpcDogKGVkaXRvcjogVGV4dEVkaXRvciwgcG9zaXRpb246IGF0b20kUG9pbnQpID0+IHtcbiAgICAgICAgaWYgKGFjdGl2YXRpb24gPT0gbnVsbCkge1xuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IG1vZGVsID0gYWN0aXZhdGlvbi5nZXRNb2RlbCgpO1xuICAgICAgICByZXR1cm4gZGVidWdnZXJEYXRhdGlwKG1vZGVsLCBlZGl0b3IsIHBvc2l0aW9uKTtcbiAgICAgIH0sXG4gICAgfTtcbiAgfSxcbn07XG4iXX0=