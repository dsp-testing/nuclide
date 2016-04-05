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

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

exports.provideNuclideSideBar = provideNuclideSideBar;
exports.activate = activate;
exports.deactivate = deactivate;
exports.serialize = serialize;

var _require = require('atom');

var CompositeDisposable = _require.CompositeDisposable;

var _require2 = require('../../nuclide-logging');

var getLogger = _require2.getLogger;

var _require3 = require('../../nuclide-commons');

var object = _require3.object;

var _require4 = require('../../nuclide-ui/lib/PanelComponent');

var PanelComponent = _require4.PanelComponent;

var _require5 = require('react-for-atom');

var React = _require5.React;
var ReactDOM = _require5.ReactDOM;

/**
 * Type consumed by the side bar service's `registerView` function.
 *
 * - `toggleCommand`: `string` - Atom command name for which the side bar will listen on the
 *   `atom-workspace` element. To show and hide the registered view inside the side bar, dispatch
 *   the named event via `atom.commands.dispatch(atom.views.get(atom.workspace), 'command-name')`.
 *   By default the command will toggle the view's visibility. Pass a detail object to the dispatch
 *   command to force hide or show, for example
 *   `atom.commands.dispatch(atom.views.get(atom.workspace), 'command-name', {display: true})` will
 *   show the view. If the view is already visible in the side bar, nothing will happen.
 * - `viewId`: `string` - A unique identifier for the view that can be used to later destroy the
 *   view. If a view with a given ID already exists in the side bar, attempting to register another
 *   view with the same ID has no effect.
 * - `getComponent`: `() => (typeof React.Component)` - When the registered view is shown, a React
 *   element of the type returned from `getComponent` is mounted into the side bar. React lifecycle
 *   methods may be used normally. When another view is shown, the active view's React element is
 *   unmounted.
 */

var disposables = undefined;
var item = undefined;
var logger = undefined;
var panel = undefined;
var panelComponent = undefined;
var state = undefined;

function getDefaultState() {
  return {
    activeViewId: null,
    hidden: false,
    initialLength: 240,
    views: new Map()
  };
}

function getActiveViewInstance(activeState) {
  if (activeState.activeViewId != null) {
    return activeState.views.get(activeState.activeViewId);
  }
}

/**
 * Returns `true` if `element` or one of its descendants has focus. This is used to determine when
 * to toggle focus between the side-bar's views and the active text editor. Views might have
 * `tabindex` attributes on descendants, and so a view's descendants have to be searched for a
 * potential `activeElement`.
 */
function elementHasOrContainsFocus(element) {
  return document.activeElement === element || element.contains(document.activeElement);
}

function blurPanel() {
  var child = ReactDOM.findDOMNode(panelComponent.getChildComponent());
  if (elementHasOrContainsFocus(child)) {
    atom.workspace.getActivePane().activate();
  }
}

function focusPanel() {
  var child = ReactDOM.findDOMNode(panelComponent.getChildComponent());
  if (!elementHasOrContainsFocus(child)) {
    child.focus();
  }
}

function renderPanel(renderState, onDidRender) {
  var activeViewInstance = getActiveViewInstance(renderState);
  panelComponent = ReactDOM.render(React.createElement(
    PanelComponent,
    {
      dock: 'left',
      // Keep the side-bar hidden when there is no active view instance.
      hidden: activeViewInstance == null || renderState.hidden,
      initialLength: renderState.initialLength,
      noScroll: true },
    activeViewInstance == null ? React.createElement('div', null) : React.createElement(activeViewInstance.view.getComponent())
  ), item, onDidRender);
}

function toggleView(viewId, options) {
  // If `display` is specified in the event details, use it as the `hidden` value rather than
  // toggle. This enables consumers to force hide/show without first asking for the visibility
  // state.
  var forceHidden = undefined;
  if (options != null) {
    forceHidden = !options.display;
  }

  var nextState = undefined;
  if (viewId === state.activeViewId) {
    // If this view is already active, just toggle the visibility of the side bar or set it to the
    // desired `display`.
    nextState = _extends({}, state, {
      hidden: forceHidden == null ? !state.hidden : forceHidden
    });
  } else {
    // If this is not already the active view, switch to it and ensure the side bar is visible or is
    // the specified `display` value.
    nextState = _extends({}, state, {
      activeViewId: viewId,
      hidden: forceHidden == null ? false : forceHidden
    });
  }

  // If the side bar became visible or if it was already visible and the active view changed, call
  // the next active view's `onDidShow` so it can respond to becoming visible.
  var didShow = nextState.hidden === false && state.hidden === true || !nextState.hidden && nextState.activeViewId !== state.activeViewId;

  // Store the next state.
  state = nextState;

  if (didShow) {
    (function () {
      var activeViewInstance = getActiveViewInstance(state);
      var onDidShow = undefined;
      if (activeViewInstance != null) {
        onDidShow = function () {
          focusPanel();
          activeViewInstance.view.onDidShow();
        };
      }
      renderPanel(state, onDidShow);
    })();
  } else {
    renderPanel(state);
    blurPanel();
  }
}

var Service = {
  registerView: function registerView(view) {
    if (state.views.has(view.viewId)) {
      logger.warn('A view with ID \'' + view.viewId + '\' is already registered.');
      return;
    }

    // If there's no active view yet, activate this one immediately.
    if (state.activeViewId == null) {
      state = _extends({}, state, {
        activeViewId: view.viewId
      });
    }

    // Listen for the view's toggle command.
    var commandDisposable = atom.commands.add('atom-workspace', view.toggleCommand, function (event) {
      // $FlowIssue Missing `CustomEvent` type in Flow's 'dom.js' library
      toggleView(view.viewId, event.detail);
    });
    disposables.add(commandDisposable);

    // `Map` is not actually immutable, but use the immutable paradigm to keep updating consistent
    // for all values in `state`.
    state.views.set(view.viewId, { commandDisposable: commandDisposable, view: view });
    state = _extends({}, state, {
      views: state.views
    });

    renderPanel(state);
  },
  destroyView: function destroyView(viewId) {
    var viewInstance = state.views.get(viewId);

    if (viewInstance == null) {
      logger.warn('No view with ID \'' + viewId + '\' is registered. Nothing to remove.');
      return;
    }

    // Stop listening for this view's toggle command.
    var commandDisposable = viewInstance.commandDisposable;
    disposables.remove(commandDisposable);
    commandDisposable.dispose();

    // `Map` is not actually immutable, but use the immutable paradigm to keep updating consistent
    // for all values in `state`.
    state.views['delete'](viewId);
    state = _extends({}, state, {
      views: state.views
    });

    // If this was the active view, choose the first remaining view (in insertion order) or, if
    // there are no remaining views, choose nothing (`undefined`).
    if (viewId === state.activeViewId) {
      state = _extends({}, state, {
        activeViewId: state.views.keys().next().value
      });
    }

    renderPanel(state);
  }
};

/**
 * The type provided to service consumers.
 */

function provideNuclideSideBar() {
  return Service;
}

function activate(deserializedState) {
  logger = getLogger('nuclide-side-bar');
  disposables = new CompositeDisposable();

  disposables.add(atom.commands.add('atom-workspace', 'nuclide-side-bar:toggle', function (event) {
    // Pass the already-active view ID to simply toggle the side bar's visibility.
    // $FlowIssue Missing `CustomEvent` type in Flow's 'dom.js' library
    toggleView(state.activeViewId, event.detail);
  }));

  disposables.add(atom.commands.add('atom-workspace', 'nuclide-side-bar:toggle-focus', function () {
    var child = ReactDOM.findDOMNode(panelComponent.getChildComponent());
    if (elementHasOrContainsFocus(child)) {
      atom.workspace.getActivePane().activate();
    } else {
      child.focus();
    }
  }));

  item = document.createElement('div');
  item.style.display = 'flex';
  item.style.height = 'inherit';
  panel = atom.workspace.addLeftPanel({ item: item });
  state = object.assign({}, getDefaultState(), deserializedState);

  // Initializes `panelComponent` so it does not need to be considered nullable.
  renderPanel(state);
}

function deactivate() {
  ReactDOM.unmountComponentAtNode(item);
  // Contains the `commandDisposable` Objects for all currently-registered views.
  disposables.dispose();
  state.views.clear();
  panel.destroy();
}

function serialize() {
  return {
    activeViewId: state.activeViewId,
    hidden: state.hidden,
    initialLength: panelComponent.getLength()
  };
}

// TODO(ssorallen): Should be polymorphic `Class<React.Component>`
//# sourceMappingURL=data:application/json;base64,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QWMsQ0FBQyxTQUFTLEVBQUU7R0FDMUMsQ0FBQztDQUNIIiwiZmlsZSI6Im1haW4uanMiLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIGJhYmVsJztcbi8qIEBmbG93ICovXG5cbi8qXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTUtcHJlc2VudCwgRmFjZWJvb2ssIEluYy5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgbGljZW5zZSBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGluXG4gKiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS5cbiAqL1xuXG5pbXBvcnQgdHlwZSB7TG9nZ2VyfSBmcm9tICcuLi8uLi9udWNsaWRlLWxvZ2dpbmcvbGliL3R5cGVzJztcblxuY29uc3Qge0NvbXBvc2l0ZURpc3Bvc2FibGV9ID0gcmVxdWlyZSgnYXRvbScpO1xuY29uc3Qge2dldExvZ2dlcn0gPSByZXF1aXJlKCcuLi8uLi9udWNsaWRlLWxvZ2dpbmcnKTtcbmNvbnN0IHtvYmplY3R9ID0gcmVxdWlyZSgnLi4vLi4vbnVjbGlkZS1jb21tb25zJyk7XG5jb25zdCB7UGFuZWxDb21wb25lbnR9ID0gcmVxdWlyZSgnLi4vLi4vbnVjbGlkZS11aS9saWIvUGFuZWxDb21wb25lbnQnKTtcbmNvbnN0IHtcbiAgUmVhY3QsXG4gIFJlYWN0RE9NLFxufSA9IHJlcXVpcmUoJ3JlYWN0LWZvci1hdG9tJyk7XG5cbnR5cGUgVmlld0luc3RhbmNlID0ge1xuICBjb21tYW5kRGlzcG9zYWJsZTogSURpc3Bvc2FibGU7XG4gIHZpZXc6IFZpZXc7XG59O1xuXG4vKipcbiAqIFR5cGUgY29uc3VtZWQgYnkgdGhlIHNpZGUgYmFyIHNlcnZpY2UncyBgcmVnaXN0ZXJWaWV3YCBmdW5jdGlvbi5cbiAqXG4gKiAtIGB0b2dnbGVDb21tYW5kYDogYHN0cmluZ2AgLSBBdG9tIGNvbW1hbmQgbmFtZSBmb3Igd2hpY2ggdGhlIHNpZGUgYmFyIHdpbGwgbGlzdGVuIG9uIHRoZVxuICogICBgYXRvbS13b3Jrc3BhY2VgIGVsZW1lbnQuIFRvIHNob3cgYW5kIGhpZGUgdGhlIHJlZ2lzdGVyZWQgdmlldyBpbnNpZGUgdGhlIHNpZGUgYmFyLCBkaXNwYXRjaFxuICogICB0aGUgbmFtZWQgZXZlbnQgdmlhIGBhdG9tLmNvbW1hbmRzLmRpc3BhdGNoKGF0b20udmlld3MuZ2V0KGF0b20ud29ya3NwYWNlKSwgJ2NvbW1hbmQtbmFtZScpYC5cbiAqICAgQnkgZGVmYXVsdCB0aGUgY29tbWFuZCB3aWxsIHRvZ2dsZSB0aGUgdmlldydzIHZpc2liaWxpdHkuIFBhc3MgYSBkZXRhaWwgb2JqZWN0IHRvIHRoZSBkaXNwYXRjaFxuICogICBjb21tYW5kIHRvIGZvcmNlIGhpZGUgb3Igc2hvdywgZm9yIGV4YW1wbGVcbiAqICAgYGF0b20uY29tbWFuZHMuZGlzcGF0Y2goYXRvbS52aWV3cy5nZXQoYXRvbS53b3Jrc3BhY2UpLCAnY29tbWFuZC1uYW1lJywge2Rpc3BsYXk6IHRydWV9KWAgd2lsbFxuICogICBzaG93IHRoZSB2aWV3LiBJZiB0aGUgdmlldyBpcyBhbHJlYWR5IHZpc2libGUgaW4gdGhlIHNpZGUgYmFyLCBub3RoaW5nIHdpbGwgaGFwcGVuLlxuICogLSBgdmlld0lkYDogYHN0cmluZ2AgLSBBIHVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGUgdmlldyB0aGF0IGNhbiBiZSB1c2VkIHRvIGxhdGVyIGRlc3Ryb3kgdGhlXG4gKiAgIHZpZXcuIElmIGEgdmlldyB3aXRoIGEgZ2l2ZW4gSUQgYWxyZWFkeSBleGlzdHMgaW4gdGhlIHNpZGUgYmFyLCBhdHRlbXB0aW5nIHRvIHJlZ2lzdGVyIGFub3RoZXJcbiAqICAgdmlldyB3aXRoIHRoZSBzYW1lIElEIGhhcyBubyBlZmZlY3QuXG4gKiAtIGBnZXRDb21wb25lbnRgOiBgKCkgPT4gKHR5cGVvZiBSZWFjdC5Db21wb25lbnQpYCAtIFdoZW4gdGhlIHJlZ2lzdGVyZWQgdmlldyBpcyBzaG93biwgYSBSZWFjdFxuICogICBlbGVtZW50IG9mIHRoZSB0eXBlIHJldHVybmVkIGZyb20gYGdldENvbXBvbmVudGAgaXMgbW91bnRlZCBpbnRvIHRoZSBzaWRlIGJhci4gUmVhY3QgbGlmZWN5Y2xlXG4gKiAgIG1ldGhvZHMgbWF5IGJlIHVzZWQgbm9ybWFsbHkuIFdoZW4gYW5vdGhlciB2aWV3IGlzIHNob3duLCB0aGUgYWN0aXZlIHZpZXcncyBSZWFjdCBlbGVtZW50IGlzXG4gKiAgIHVubW91bnRlZC5cbiAqL1xudHlwZSBWaWV3ID0ge1xuICB0b2dnbGVDb21tYW5kOiBzdHJpbmc7XG4gIGdldENvbXBvbmVudDogKCkgPT4gQ2xhc3M8YW55PjsgLy8gVE9ETyhzc29yYWxsZW4pOiBTaG91bGQgYmUgcG9seW1vcnBoaWMgYENsYXNzPFJlYWN0LkNvbXBvbmVudD5gXG4gIG9uRGlkU2hvdzogKCkgPT4gbWl4ZWQ7XG4gIHZpZXdJZDogc3RyaW5nO1xufTtcblxudHlwZSBTdGF0ZSA9IHtcbiAgYWN0aXZlVmlld0lkOiA/c3RyaW5nO1xuICBoaWRkZW46IGJvb2xlYW47XG4gIGluaXRpYWxMZW5ndGg6IG51bWJlcjtcbiAgdmlld3M6IE1hcDxzdHJpbmcsIFZpZXdJbnN0YW5jZT47XG59O1xuXG5sZXQgZGlzcG9zYWJsZXM6IENvbXBvc2l0ZURpc3Bvc2FibGU7XG5sZXQgaXRlbTogSFRNTEVsZW1lbnQ7XG5sZXQgbG9nZ2VyOiBMb2dnZXI7XG5sZXQgcGFuZWw6IGF0b20kUGFuZWw7XG5sZXQgcGFuZWxDb21wb25lbnQ6IFBhbmVsQ29tcG9uZW50O1xubGV0IHN0YXRlOiBTdGF0ZTtcblxuZnVuY3Rpb24gZ2V0RGVmYXVsdFN0YXRlKCk6IFN0YXRlIHtcbiAgcmV0dXJuIHtcbiAgICBhY3RpdmVWaWV3SWQ6IG51bGwsXG4gICAgaGlkZGVuOiBmYWxzZSxcbiAgICBpbml0aWFsTGVuZ3RoOiAyNDAsXG4gICAgdmlld3M6IG5ldyBNYXAoKSxcbiAgfTtcbn1cblxuZnVuY3Rpb24gZ2V0QWN0aXZlVmlld0luc3RhbmNlKGFjdGl2ZVN0YXRlOiBTdGF0ZSk6ID9WaWV3SW5zdGFuY2Uge1xuICBpZiAoYWN0aXZlU3RhdGUuYWN0aXZlVmlld0lkICE9IG51bGwpIHtcbiAgICByZXR1cm4gYWN0aXZlU3RhdGUudmlld3MuZ2V0KGFjdGl2ZVN0YXRlLmFjdGl2ZVZpZXdJZCk7XG4gIH1cbn1cblxuLyoqXG4gKiBSZXR1cm5zIGB0cnVlYCBpZiBgZWxlbWVudGAgb3Igb25lIG9mIGl0cyBkZXNjZW5kYW50cyBoYXMgZm9jdXMuIFRoaXMgaXMgdXNlZCB0byBkZXRlcm1pbmUgd2hlblxuICogdG8gdG9nZ2xlIGZvY3VzIGJldHdlZW4gdGhlIHNpZGUtYmFyJ3Mgdmlld3MgYW5kIHRoZSBhY3RpdmUgdGV4dCBlZGl0b3IuIFZpZXdzIG1pZ2h0IGhhdmVcbiAqIGB0YWJpbmRleGAgYXR0cmlidXRlcyBvbiBkZXNjZW5kYW50cywgYW5kIHNvIGEgdmlldydzIGRlc2NlbmRhbnRzIGhhdmUgdG8gYmUgc2VhcmNoZWQgZm9yIGFcbiAqIHBvdGVudGlhbCBgYWN0aXZlRWxlbWVudGAuXG4gKi9cbmZ1bmN0aW9uIGVsZW1lbnRIYXNPckNvbnRhaW5zRm9jdXMoZWxlbWVudDogSFRNTEVsZW1lbnQpOiBib29sZWFuIHtcbiAgcmV0dXJuIGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQgPT09IGVsZW1lbnQgfHwgZWxlbWVudC5jb250YWlucyhkb2N1bWVudC5hY3RpdmVFbGVtZW50KTtcbn1cblxuZnVuY3Rpb24gYmx1clBhbmVsKCk6IHZvaWQge1xuICBjb25zdCBjaGlsZCA9IFJlYWN0RE9NLmZpbmRET01Ob2RlKHBhbmVsQ29tcG9uZW50LmdldENoaWxkQ29tcG9uZW50KCkpO1xuICBpZiAoZWxlbWVudEhhc09yQ29udGFpbnNGb2N1cyhjaGlsZCkpIHtcbiAgICBhdG9tLndvcmtzcGFjZS5nZXRBY3RpdmVQYW5lKCkuYWN0aXZhdGUoKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBmb2N1c1BhbmVsKCk6IHZvaWQge1xuICBjb25zdCBjaGlsZCA9IFJlYWN0RE9NLmZpbmRET01Ob2RlKHBhbmVsQ29tcG9uZW50LmdldENoaWxkQ29tcG9uZW50KCkpO1xuICBpZiAoIWVsZW1lbnRIYXNPckNvbnRhaW5zRm9jdXMoY2hpbGQpKSB7XG4gICAgY2hpbGQuZm9jdXMoKTtcbiAgfVxufVxuXG5mdW5jdGlvbiByZW5kZXJQYW5lbChyZW5kZXJTdGF0ZTogU3RhdGUsIG9uRGlkUmVuZGVyPzogKCkgPT4gbWl4ZWQpOiB2b2lkIHtcbiAgY29uc3QgYWN0aXZlVmlld0luc3RhbmNlID0gZ2V0QWN0aXZlVmlld0luc3RhbmNlKHJlbmRlclN0YXRlKTtcbiAgcGFuZWxDb21wb25lbnQgPSBSZWFjdERPTS5yZW5kZXIoXG4gICAgPFBhbmVsQ29tcG9uZW50XG4gICAgICBkb2NrPVwibGVmdFwiXG4gICAgICAvLyBLZWVwIHRoZSBzaWRlLWJhciBoaWRkZW4gd2hlbiB0aGVyZSBpcyBubyBhY3RpdmUgdmlldyBpbnN0YW5jZS5cbiAgICAgIGhpZGRlbj17KGFjdGl2ZVZpZXdJbnN0YW5jZSA9PSBudWxsKSB8fCByZW5kZXJTdGF0ZS5oaWRkZW59XG4gICAgICBpbml0aWFsTGVuZ3RoPXtyZW5kZXJTdGF0ZS5pbml0aWFsTGVuZ3RofVxuICAgICAgbm9TY3JvbGw+XG4gICAgICB7YWN0aXZlVmlld0luc3RhbmNlID09IG51bGxcbiAgICAgICAgPyA8ZGl2IC8+XG4gICAgICAgIDogUmVhY3QuY3JlYXRlRWxlbWVudChhY3RpdmVWaWV3SW5zdGFuY2Uudmlldy5nZXRDb21wb25lbnQoKSl9XG4gICAgPC9QYW5lbENvbXBvbmVudD4sXG4gICAgaXRlbSxcbiAgICBvbkRpZFJlbmRlclxuICApO1xufVxuXG5mdW5jdGlvbiB0b2dnbGVWaWV3KHZpZXdJZDogP3N0cmluZywgb3B0aW9ucz86IHtkaXNwbGF5OiBib29sZWFufSkge1xuICAvLyBJZiBgZGlzcGxheWAgaXMgc3BlY2lmaWVkIGluIHRoZSBldmVudCBkZXRhaWxzLCB1c2UgaXQgYXMgdGhlIGBoaWRkZW5gIHZhbHVlIHJhdGhlciB0aGFuXG4gIC8vIHRvZ2dsZS4gVGhpcyBlbmFibGVzIGNvbnN1bWVycyB0byBmb3JjZSBoaWRlL3Nob3cgd2l0aG91dCBmaXJzdCBhc2tpbmcgZm9yIHRoZSB2aXNpYmlsaXR5XG4gIC8vIHN0YXRlLlxuICBsZXQgZm9yY2VIaWRkZW47XG4gIGlmIChvcHRpb25zICE9IG51bGwpIHtcbiAgICBmb3JjZUhpZGRlbiA9ICFvcHRpb25zLmRpc3BsYXk7XG4gIH1cblxuICBsZXQgbmV4dFN0YXRlO1xuICBpZiAodmlld0lkID09PSBzdGF0ZS5hY3RpdmVWaWV3SWQpIHtcbiAgICAvLyBJZiB0aGlzIHZpZXcgaXMgYWxyZWFkeSBhY3RpdmUsIGp1c3QgdG9nZ2xlIHRoZSB2aXNpYmlsaXR5IG9mIHRoZSBzaWRlIGJhciBvciBzZXQgaXQgdG8gdGhlXG4gICAgLy8gZGVzaXJlZCBgZGlzcGxheWAuXG4gICAgbmV4dFN0YXRlID0ge1xuICAgICAgLi4uc3RhdGUsXG4gICAgICBoaWRkZW46IChmb3JjZUhpZGRlbiA9PSBudWxsKSA/ICFzdGF0ZS5oaWRkZW4gOiBmb3JjZUhpZGRlbixcbiAgICB9O1xuICB9IGVsc2Uge1xuICAgIC8vIElmIHRoaXMgaXMgbm90IGFscmVhZHkgdGhlIGFjdGl2ZSB2aWV3LCBzd2l0Y2ggdG8gaXQgYW5kIGVuc3VyZSB0aGUgc2lkZSBiYXIgaXMgdmlzaWJsZSBvciBpc1xuICAgIC8vIHRoZSBzcGVjaWZpZWQgYGRpc3BsYXlgIHZhbHVlLlxuICAgIG5leHRTdGF0ZSA9IHtcbiAgICAgIC4uLnN0YXRlLFxuICAgICAgYWN0aXZlVmlld0lkOiB2aWV3SWQsXG4gICAgICBoaWRkZW46IChmb3JjZUhpZGRlbiA9PSBudWxsKSA/IGZhbHNlIDogZm9yY2VIaWRkZW4sXG4gICAgfTtcbiAgfVxuXG4gIC8vIElmIHRoZSBzaWRlIGJhciBiZWNhbWUgdmlzaWJsZSBvciBpZiBpdCB3YXMgYWxyZWFkeSB2aXNpYmxlIGFuZCB0aGUgYWN0aXZlIHZpZXcgY2hhbmdlZCwgY2FsbFxuICAvLyB0aGUgbmV4dCBhY3RpdmUgdmlldydzIGBvbkRpZFNob3dgIHNvIGl0IGNhbiByZXNwb25kIHRvIGJlY29taW5nIHZpc2libGUuXG4gIGNvbnN0IGRpZFNob3cgPSAobmV4dFN0YXRlLmhpZGRlbiA9PT0gZmFsc2UgJiYgc3RhdGUuaGlkZGVuID09PSB0cnVlKVxuICAgIHx8ICghbmV4dFN0YXRlLmhpZGRlbiAmJiAobmV4dFN0YXRlLmFjdGl2ZVZpZXdJZCAhPT0gc3RhdGUuYWN0aXZlVmlld0lkKSk7XG5cbiAgLy8gU3RvcmUgdGhlIG5leHQgc3RhdGUuXG4gIHN0YXRlID0gbmV4dFN0YXRlO1xuXG4gIGlmIChkaWRTaG93KSB7XG4gICAgY29uc3QgYWN0aXZlVmlld0luc3RhbmNlID0gZ2V0QWN0aXZlVmlld0luc3RhbmNlKHN0YXRlKTtcbiAgICBsZXQgb25EaWRTaG93O1xuICAgIGlmIChhY3RpdmVWaWV3SW5zdGFuY2UgIT0gbnVsbCkge1xuICAgICAgb25EaWRTaG93ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGZvY3VzUGFuZWwoKTtcbiAgICAgICAgYWN0aXZlVmlld0luc3RhbmNlLnZpZXcub25EaWRTaG93KCk7XG4gICAgICB9O1xuICAgIH1cbiAgICByZW5kZXJQYW5lbChzdGF0ZSwgb25EaWRTaG93KTtcbiAgfSBlbHNlIHtcbiAgICByZW5kZXJQYW5lbChzdGF0ZSk7XG4gICAgYmx1clBhbmVsKCk7XG4gIH1cbn1cblxuY29uc3QgU2VydmljZSA9IHtcbiAgcmVnaXN0ZXJWaWV3KHZpZXc6IFZpZXcpOiB2b2lkIHtcbiAgICBpZiAoc3RhdGUudmlld3MuaGFzKHZpZXcudmlld0lkKSkge1xuICAgICAgbG9nZ2VyLndhcm4oYEEgdmlldyB3aXRoIElEICcke3ZpZXcudmlld0lkfScgaXMgYWxyZWFkeSByZWdpc3RlcmVkLmApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIElmIHRoZXJlJ3Mgbm8gYWN0aXZlIHZpZXcgeWV0LCBhY3RpdmF0ZSB0aGlzIG9uZSBpbW1lZGlhdGVseS5cbiAgICBpZiAoc3RhdGUuYWN0aXZlVmlld0lkID09IG51bGwpIHtcbiAgICAgIHN0YXRlID0ge1xuICAgICAgICAuLi5zdGF0ZSxcbiAgICAgICAgYWN0aXZlVmlld0lkOiB2aWV3LnZpZXdJZCxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gTGlzdGVuIGZvciB0aGUgdmlldydzIHRvZ2dsZSBjb21tYW5kLlxuICAgIGNvbnN0IGNvbW1hbmREaXNwb3NhYmxlID0gYXRvbS5jb21tYW5kcy5hZGQoJ2F0b20td29ya3NwYWNlJywgdmlldy50b2dnbGVDb21tYW5kLCBldmVudCA9PiB7XG4gICAgICAvLyAkRmxvd0lzc3VlIE1pc3NpbmcgYEN1c3RvbUV2ZW50YCB0eXBlIGluIEZsb3cncyAnZG9tLmpzJyBsaWJyYXJ5XG4gICAgICB0b2dnbGVWaWV3KHZpZXcudmlld0lkLCBldmVudC5kZXRhaWwpO1xuICAgIH0pO1xuICAgIGRpc3Bvc2FibGVzLmFkZChjb21tYW5kRGlzcG9zYWJsZSk7XG5cbiAgICAvLyBgTWFwYCBpcyBub3QgYWN0dWFsbHkgaW1tdXRhYmxlLCBidXQgdXNlIHRoZSBpbW11dGFibGUgcGFyYWRpZ20gdG8ga2VlcCB1cGRhdGluZyBjb25zaXN0ZW50XG4gICAgLy8gZm9yIGFsbCB2YWx1ZXMgaW4gYHN0YXRlYC5cbiAgICBzdGF0ZS52aWV3cy5zZXQodmlldy52aWV3SWQsIHtjb21tYW5kRGlzcG9zYWJsZSwgdmlld30pO1xuICAgIHN0YXRlID0ge1xuICAgICAgLi4uc3RhdGUsXG4gICAgICB2aWV3czogc3RhdGUudmlld3MsXG4gICAgfTtcblxuICAgIHJlbmRlclBhbmVsKHN0YXRlKTtcbiAgfSxcbiAgZGVzdHJveVZpZXcodmlld0lkOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBjb25zdCB2aWV3SW5zdGFuY2UgPSBzdGF0ZS52aWV3cy5nZXQodmlld0lkKTtcblxuICAgIGlmICh2aWV3SW5zdGFuY2UgPT0gbnVsbCkge1xuICAgICAgbG9nZ2VyLndhcm4oYE5vIHZpZXcgd2l0aCBJRCAnJHt2aWV3SWR9JyBpcyByZWdpc3RlcmVkLiBOb3RoaW5nIHRvIHJlbW92ZS5gKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBTdG9wIGxpc3RlbmluZyBmb3IgdGhpcyB2aWV3J3MgdG9nZ2xlIGNvbW1hbmQuXG4gICAgY29uc3QgY29tbWFuZERpc3Bvc2FibGUgPSB2aWV3SW5zdGFuY2UuY29tbWFuZERpc3Bvc2FibGU7XG4gICAgZGlzcG9zYWJsZXMucmVtb3ZlKGNvbW1hbmREaXNwb3NhYmxlKTtcbiAgICBjb21tYW5kRGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cbiAgICAvLyBgTWFwYCBpcyBub3QgYWN0dWFsbHkgaW1tdXRhYmxlLCBidXQgdXNlIHRoZSBpbW11dGFibGUgcGFyYWRpZ20gdG8ga2VlcCB1cGRhdGluZyBjb25zaXN0ZW50XG4gICAgLy8gZm9yIGFsbCB2YWx1ZXMgaW4gYHN0YXRlYC5cbiAgICBzdGF0ZS52aWV3cy5kZWxldGUodmlld0lkKTtcbiAgICBzdGF0ZSA9IHtcbiAgICAgIC4uLnN0YXRlLFxuICAgICAgdmlld3M6IHN0YXRlLnZpZXdzLFxuICAgIH07XG5cbiAgICAvLyBJZiB0aGlzIHdhcyB0aGUgYWN0aXZlIHZpZXcsIGNob29zZSB0aGUgZmlyc3QgcmVtYWluaW5nIHZpZXcgKGluIGluc2VydGlvbiBvcmRlcikgb3IsIGlmXG4gICAgLy8gdGhlcmUgYXJlIG5vIHJlbWFpbmluZyB2aWV3cywgY2hvb3NlIG5vdGhpbmcgKGB1bmRlZmluZWRgKS5cbiAgICBpZiAodmlld0lkID09PSBzdGF0ZS5hY3RpdmVWaWV3SWQpIHtcbiAgICAgIHN0YXRlID0ge1xuICAgICAgICAuLi5zdGF0ZSxcbiAgICAgICAgYWN0aXZlVmlld0lkOiBzdGF0ZS52aWV3cy5rZXlzKCkubmV4dCgpLnZhbHVlLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICByZW5kZXJQYW5lbChzdGF0ZSk7XG4gIH0sXG59O1xuXG4vKipcbiAqIFRoZSB0eXBlIHByb3ZpZGVkIHRvIHNlcnZpY2UgY29uc3VtZXJzLlxuICovXG5leHBvcnQgdHlwZSBOdWNsaWRlU2lkZUJhclNlcnZpY2UgPSB0eXBlb2YgU2VydmljZTtcblxuZXhwb3J0IGZ1bmN0aW9uIHByb3ZpZGVOdWNsaWRlU2lkZUJhcigpOiBOdWNsaWRlU2lkZUJhclNlcnZpY2Uge1xuICByZXR1cm4gU2VydmljZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFjdGl2YXRlKGRlc2VyaWFsaXplZFN0YXRlOiA/T2JqZWN0KSB7XG4gIGxvZ2dlciA9IGdldExvZ2dlcignbnVjbGlkZS1zaWRlLWJhcicpO1xuICBkaXNwb3NhYmxlcyA9IG5ldyBDb21wb3NpdGVEaXNwb3NhYmxlKCk7XG5cbiAgZGlzcG9zYWJsZXMuYWRkKGF0b20uY29tbWFuZHMuYWRkKCdhdG9tLXdvcmtzcGFjZScsICdudWNsaWRlLXNpZGUtYmFyOnRvZ2dsZScsIGV2ZW50ID0+IHtcbiAgICAvLyBQYXNzIHRoZSBhbHJlYWR5LWFjdGl2ZSB2aWV3IElEIHRvIHNpbXBseSB0b2dnbGUgdGhlIHNpZGUgYmFyJ3MgdmlzaWJpbGl0eS5cbiAgICAvLyAkRmxvd0lzc3VlIE1pc3NpbmcgYEN1c3RvbUV2ZW50YCB0eXBlIGluIEZsb3cncyAnZG9tLmpzJyBsaWJyYXJ5XG4gICAgdG9nZ2xlVmlldyhzdGF0ZS5hY3RpdmVWaWV3SWQsIGV2ZW50LmRldGFpbCk7XG4gIH0pKTtcblxuICBkaXNwb3NhYmxlcy5hZGQoYXRvbS5jb21tYW5kcy5hZGQoJ2F0b20td29ya3NwYWNlJywgJ251Y2xpZGUtc2lkZS1iYXI6dG9nZ2xlLWZvY3VzJywgKCkgPT4ge1xuICAgIGNvbnN0IGNoaWxkID0gUmVhY3RET00uZmluZERPTU5vZGUocGFuZWxDb21wb25lbnQuZ2V0Q2hpbGRDb21wb25lbnQoKSk7XG4gICAgaWYgKGVsZW1lbnRIYXNPckNvbnRhaW5zRm9jdXMoY2hpbGQpKSB7XG4gICAgICBhdG9tLndvcmtzcGFjZS5nZXRBY3RpdmVQYW5lKCkuYWN0aXZhdGUoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY2hpbGQuZm9jdXMoKTtcbiAgICB9XG4gIH0pKTtcblxuICBpdGVtID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIGl0ZW0uc3R5bGUuZGlzcGxheSA9ICdmbGV4JztcbiAgaXRlbS5zdHlsZS5oZWlnaHQgPSAnaW5oZXJpdCc7XG4gIHBhbmVsID0gYXRvbS53b3Jrc3BhY2UuYWRkTGVmdFBhbmVsKHtpdGVtfSk7XG4gIHN0YXRlID0gb2JqZWN0LmFzc2lnbih7fSwgZ2V0RGVmYXVsdFN0YXRlKCksIGRlc2VyaWFsaXplZFN0YXRlKTtcblxuICAvLyBJbml0aWFsaXplcyBgcGFuZWxDb21wb25lbnRgIHNvIGl0IGRvZXMgbm90IG5lZWQgdG8gYmUgY29uc2lkZXJlZCBudWxsYWJsZS5cbiAgcmVuZGVyUGFuZWwoc3RhdGUpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVhY3RpdmF0ZSgpIHtcbiAgUmVhY3RET00udW5tb3VudENvbXBvbmVudEF0Tm9kZShpdGVtKTtcbiAgLy8gQ29udGFpbnMgdGhlIGBjb21tYW5kRGlzcG9zYWJsZWAgT2JqZWN0cyBmb3IgYWxsIGN1cnJlbnRseS1yZWdpc3RlcmVkIHZpZXdzLlxuICBkaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG4gIHN0YXRlLnZpZXdzLmNsZWFyKCk7XG4gIHBhbmVsLmRlc3Ryb3koKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNlcmlhbGl6ZSgpOiBPYmplY3Qge1xuICByZXR1cm4ge1xuICAgIGFjdGl2ZVZpZXdJZDogc3RhdGUuYWN0aXZlVmlld0lkLFxuICAgIGhpZGRlbjogc3RhdGUuaGlkZGVuLFxuICAgIGluaXRpYWxMZW5ndGg6IHBhbmVsQ29tcG9uZW50LmdldExlbmd0aCgpLFxuICB9O1xufVxuIl19