Object.defineProperty(exports, '__esModule', {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

var _require = require('atom');

var CompositeDisposable = _require.CompositeDisposable;

var _require2 = require('events');

var EventEmitter = _require2.EventEmitter;

var _require3 = require('./LazyTreeNode');

var LazyTreeNode = _require3.LazyTreeNode;

var _require4 = require('./TreeNodeComponent');

var TreeNodeComponent = _require4.TreeNodeComponent;

var _require5 = require('./tree-node-traversals');

var forEachCachedNode = _require5.forEachCachedNode;

var _require6 = require('react-for-atom');

var React = _require6.React;
var ReactDOM = _require6.ReactDOM;
var PropTypes = React.PropTypes;

/**
 * Toggles the existence of a value in a set. If the value exists, deletes it.
 * If the value does not exist, adds it.
 *
 * @param set The set whose value to toggle.
 * @param value The value to toggle in the set.
 * @param [forceHas] If defined, forces the existence of the value in the set
 *     regardless of its current existence. If truthy, adds `value`, if falsy
 *     deletes `value`.
 * @returns `true` if the value was added to the set, otherwise `false`. If
 *     `forceHas` is defined, the return value will be equal to `forceHas`.
 */
function toggleSetHas(set, value, forceHas) {
  var added = undefined;

  if (forceHas || forceHas === undefined && !set.has(value)) {
    set.add(value);
    added = true;
  } else {
    set['delete'](value);
    added = false;
  }

  return added;
}

var FIRST_SELECTED_DESCENDANT_REF = 'firstSelectedDescendant';

/**
 * Generic tree component that operates on LazyTreeNodes.
 */
var TreeRootComponent = React.createClass({
  displayName: 'TreeRootComponent',

  _allKeys: null,
  _emitter: null,
  _keyToNode: null,
  _rejectDidUpdateListenerPromise: null,
  _subscriptions: null,

  propTypes: {
    initialRoots: PropTypes.arrayOf(PropTypes.instanceOf(LazyTreeNode)).isRequired,
    eventHandlerSelector: PropTypes.string.isRequired,
    // A node can be confirmed if it is a selected non-container node and the user is clicks on it
    // or presses <enter>.
    onConfirmSelection: PropTypes.func.isRequired,
    // A node can be "kept" (opened permanently) by double clicking it. This only has an effect
    // when the `usePreviewTabs` setting is enabled in the "tabs" package.
    onKeepSelection: PropTypes.func.isRequired,
    labelClassNameForNode: PropTypes.func.isRequired,
    rowClassNameForNode: PropTypes.func.isRequired,
    // Render will return this component if there are no root nodes.
    elementToRenderWhenEmpty: PropTypes.element,
    initialExpandedNodeKeys: PropTypes.arrayOf(PropTypes.string),
    initialSelectedNodeKeys: PropTypes.arrayOf(PropTypes.string)
  },

  getDefaultProps: function getDefaultProps() {
    return {
      elementToRenderWhenEmpty: null,
      onConfirmSelection: function onConfirmSelection(node) {},
      rowClassNameForNode: function rowClassNameForNode(node) {
        return '';
      }
    };
  },

  getInitialState: function getInitialState() {
    var rootKeys = this.props.initialRoots.map(function (root) {
      return root.getKey();
    });

    var selectedKeys = undefined;
    if (this.props.initialSelectedNodeKeys) {
      selectedKeys = new Set(this.props.initialSelectedNodeKeys);
    } else {
      selectedKeys = new Set(rootKeys.length === 0 ? [] : [rootKeys[0]]);
    }

    return {
      roots: this.props.initialRoots,
      // This is maintained as a set of strings for two reasons:
      // (1) It is straightforward to serialize.
      // (2) If the LazyFileTreeNode for a path is re-created, this will still work.
      expandedKeys: new Set(this.props.initialExpandedNodeKeys || rootKeys),
      selectedKeys: selectedKeys
    };
  },

  componentDidUpdate: function componentDidUpdate(prevProps, prevState) {
    // If the Set of selected items is new, like when navigating the tree with
    // the arrow keys, scroll the first item into view. This addresses the
    // following scenario:
    // (1) Select a node in the tree
    // (2) Scroll the selected node out of the viewport
    // (3) Press the up or down arrow key to change the selected node
    // (4) The new node should scroll into view
    if (!prevState || this.state.selectedKeys !== prevState.selectedKeys) {
      var firstSelectedDescendant = this.refs[FIRST_SELECTED_DESCENDANT_REF];
      if (firstSelectedDescendant !== undefined) {
        ReactDOM.findDOMNode(firstSelectedDescendant).scrollIntoViewIfNeeded(false);
      }
    }

    if (this._emitter) {
      this._emitter.emit('did-update');
    }
  },

  _deselectDescendants: function _deselectDescendants(root) {
    var selectedKeys = this.state.selectedKeys;

    forEachCachedNode(root, function (node) {
      // `forEachCachedNode` iterates over the root, but it should remain
      // selected. Skip it.
      if (node === root) {
        return;
      }

      selectedKeys['delete'](node.getKey());
    });

    this.setState({ selectedKeys: selectedKeys });
  },

  _isNodeExpanded: function _isNodeExpanded(node) {
    return this.state.expandedKeys.has(node.getKey());
  },

  _isNodeSelected: function _isNodeSelected(node) {
    return this.state.selectedKeys.has(node.getKey());
  },

  _toggleNodeExpanded: function _toggleNodeExpanded(node, forceExpanded) {
    var expandedKeys = this.state.expandedKeys;
    var keyAdded = toggleSetHas(expandedKeys, node.getKey(), forceExpanded);

    // If the node was collapsed, deselect its descendants so only nodes visible
    // in the tree remain selected.
    if (!keyAdded) {
      this._deselectDescendants(node);
    }

    this.setState({ expandedKeys: expandedKeys });
  },

  _toggleNodeSelected: function _toggleNodeSelected(node, forceSelected) {
    var selectedKeys = this.state.selectedKeys;
    toggleSetHas(selectedKeys, node.getKey(), forceSelected);
    this.setState({ selectedKeys: selectedKeys });
  },

  _onClickNode: function _onClickNode(event, node) {
    if (event.metaKey) {
      this._toggleNodeSelected(node);
      return;
    }

    this.setState({
      selectedKeys: new Set([node.getKey()])
    });

    if (!this._isNodeSelected(node) && (node.isContainer() || !atom.config.get('tabs.usePreviewTabs'))) {
      // User clicked on a new directory or the user isn't using the "Preview Tabs" feature of the
      // `tabs` package, so don't toggle the node's state any further yet.
      return;
    }

    this._confirmNode(node);
  },

  _onClickNodeArrow: function _onClickNodeArrow(event, node) {
    this._toggleNodeExpanded(node);
  },

  _onDoubleClickNode: function _onDoubleClickNode(event, node) {
    // Double clicking a non-directory will keep the created tab open.
    if (!node.isContainer()) {
      this.props.onKeepSelection();
    }
  },

  _onMouseDown: function _onMouseDown(event, node) {
    // Select the node on right-click.
    if (event.button === 2 || event.button === 0 && event.ctrlKey === true) {
      if (!this._isNodeSelected(node)) {
        this.setState({ selectedKeys: new Set([node.getKey()]) });
      }
    }
  },

  addContextMenuItemGroup: function addContextMenuItemGroup(menuItemDefinitions) {
    var _this = this;

    var items = menuItemDefinitions.slice();
    items = items.map(function (definition) {
      definition.shouldDisplay = function () {
        if (_this.state.roots.length === 0 && !definition.shouldDisplayIfTreeIsEmpty) {
          return false;
        }
        var shouldDisplayForSelectedNodes = definition.shouldDisplayForSelectedNodes;
        if (shouldDisplayForSelectedNodes) {
          return shouldDisplayForSelectedNodes.call(definition, _this.getSelectedNodes());
        }
        return true;
      };
      return definition;
    });

    // Atom is smart about only displaying a separator when there are items to
    // separate, so there will never be a dangling separator at the end.
    items.push({ type: 'separator' });

    // TODO: Use a computed property when supported by Flow.
    var contextMenuObj = {};
    contextMenuObj[this.props.eventHandlerSelector] = items;
    atom.contextMenu.add(contextMenuObj);
  },

  render: function render() {
    var _this2 = this;

    if (this.state.roots.length === 0) {
      return this.props.elementToRenderWhenEmpty;
    }

    var children = [];
    var expandedKeys = this.state.expandedKeys;
    var foundFirstSelectedDescendant = false;

    var promises = [];
    var allKeys = [];
    var keyToNode = {};

    this.state.roots.forEach(function (root) {
      var stack = [{ node: root, depth: 0 }];

      while (stack.length !== 0) {
        // Pop off the top of the stack and add it to the list of nodes to display.
        var item = stack.pop();
        var node = item.node;

        // Keep a reference the first selected descendant with
        // `this.refs[FIRST_SELECTED_DESCENDANT_REF]`.
        var isNodeSelected = _this2._isNodeSelected(node);
        var ref = null;
        if (!foundFirstSelectedDescendant && isNodeSelected) {
          foundFirstSelectedDescendant = true;
          ref = FIRST_SELECTED_DESCENDANT_REF;
        }

        var child = React.createElement(TreeNodeComponent, _extends({}, item, {
          isContainer: node.isContainer(),
          isExpanded: _this2._isNodeExpanded(node),
          isLoading: !node.isCacheValid(),
          isSelected: isNodeSelected,
          label: node.getLabel(),
          labelClassName: _this2.props.labelClassNameForNode(node),
          rowClassName: _this2.props.rowClassNameForNode(node),
          onClickArrow: _this2._onClickNodeArrow,
          onClick: _this2._onClickNode,
          onDoubleClick: _this2._onDoubleClickNode,
          onMouseDown: _this2._onMouseDown,
          path: node.getKey(),
          key: node.getKey(),
          ref: ref
        }));
        children.push(child);
        allKeys.push(node.getKey());
        keyToNode[node.getKey()] = node;

        // Check whether the node has any children that should be displayed.
        if (!node.isContainer() || !expandedKeys.has(node.getKey())) {
          continue;
        }

        var cachedChildren = node.getCachedChildren();
        if (!cachedChildren || !node.isCacheValid()) {
          promises.push(node.fetchChildren());
        }

        // Prevent flickering by always rendering cached children -- if they're invalid,
        // then the fetch will happen soon.
        if (cachedChildren) {
          (function () {
            var depth = item.depth + 1;
            // Push the node's children on the stack in reverse order so that when
            // they are popped off the stack, they are iterated in the original
            // order.
            cachedChildren.reverse().forEach(function (childNode) {
              stack.push({ node: childNode, depth: depth });
            });
          })();
        }
      }
    });

    if (promises.length) {
      Promise.all(promises).then(function () {
        // The component could have been unmounted by the time the promises are resolved.
        if (_this2.isMounted()) {
          _this2.forceUpdate();
        }
      });
    }

    this._allKeys = allKeys;
    this._keyToNode = keyToNode;
    return React.createElement(
      'div',
      { className: 'nuclide-tree-root' },
      children
    );
  },

  componentWillMount: function componentWillMount() {
    var _this3 = this;

    var allKeys = [];
    var keyToNode = {};

    this.state.roots.forEach(function (root) {
      var rootKey = root.getKey();
      allKeys.push(rootKey);
      keyToNode[rootKey] = root;
    });

    var subscriptions = new CompositeDisposable();
    subscriptions.add(atom.commands.add(this.props.eventHandlerSelector, {
      // Expand and collapse.
      'core:move-right': function coreMoveRight() {
        return _this3._expandSelection();
      },
      'core:move-left': function coreMoveLeft() {
        return _this3._collapseSelection();
      },

      // Move selection up and down.
      'core:move-up': function coreMoveUp() {
        return _this3._moveSelectionUp();
      },
      'core:move-down': function coreMoveDown() {
        return _this3._moveSelectionDown();
      },

      'core:confirm': function coreConfirm() {
        return _this3._confirmSelection();
      }
    }));

    this._allKeys = allKeys;
    this._emitter = new EventEmitter();
    this._keyToNode = keyToNode;
    this._subscriptions = subscriptions;
  },

  componentWillUnmount: function componentWillUnmount() {
    if (this._subscriptions) {
      this._subscriptions.dispose();
    }
    if (this._emitter) {
      this._emitter.removeAllListeners();
    }
  },

  serialize: function serialize() {
    var from = require('../../nuclide-commons').array.from;

    return {
      expandedNodeKeys: from(this.state.expandedKeys),
      selectedNodeKeys: from(this.state.selectedKeys)
    };
  },

  invalidateCachedNodes: function invalidateCachedNodes() {
    this.state.roots.forEach(function (root) {
      forEachCachedNode(root, function (node) {
        node.invalidateCache();
      });
    });
  },

  /**
   * Returns a Promise that's resolved when the roots are rendered.
   */
  setRoots: function setRoots(roots) {
    var _this4 = this;

    this.state.roots.forEach(function (root) {
      _this4.removeStateForSubtree(root);
    });

    var expandedKeys = this.state.expandedKeys;
    roots.forEach(function (root) {
      return expandedKeys.add(root.getKey());
    });

    // We have to create the listener before setting the state so it can pick
    // up the changes from `setState`.
    var promise = this._createDidUpdateListener( /* shouldResolve */function () {
      var rootsReady = _this4.state.roots === roots;
      var childrenReady = _this4.state.roots.every(function (root) {
        return root.isCacheValid();
      });
      return rootsReady && childrenReady;
    });

    this.setState({
      roots: roots,
      expandedKeys: expandedKeys
    });

    return promise;
  },

  _createDidUpdateListener: function _createDidUpdateListener(shouldResolve) {
    var _this5 = this;

    return new Promise(function (resolve, reject) {
      var listener = function listener() {
        if (shouldResolve()) {
          resolve(undefined);

          // Set this to null so this promise can't be rejected anymore.
          _this5._rejectDidUpdateListenerPromise = null;
          if (_this5._emitter) {
            _this5._emitter.removeListener('did-update', listener);
          }
        }
      };

      if (_this5._emitter) {
        _this5._emitter.addListener('did-update', listener);
      }

      // We need to reject the previous promise, so it doesn't get leaked.
      if (_this5._rejectDidUpdateListenerPromise) {
        _this5._rejectDidUpdateListenerPromise();
        _this5._rejectDidUpdateListenerPromise = null;
      }
      _this5._rejectDidUpdateListenerPromise = function () {
        reject(undefined);
        if (_this5._emitter) {
          _this5._emitter.removeListener('did-update', listener);
        }
      };
    });
  },

  removeStateForSubtree: function removeStateForSubtree(root) {
    var expandedKeys = this.state.expandedKeys;
    var selectedKeys = this.state.selectedKeys;

    forEachCachedNode(root, function (node) {
      var cachedKey = node.getKey();
      expandedKeys['delete'](cachedKey);
      selectedKeys['delete'](cachedKey);
    });

    this.setState({
      expandedKeys: expandedKeys,
      selectedKeys: selectedKeys
    });
  },

  getRootNodes: function getRootNodes() {
    return this.state.roots;
  },

  getExpandedNodes: function getExpandedNodes() {
    var _this6 = this;

    var expandedNodes = [];
    this.state.expandedKeys.forEach(function (key) {
      var node = _this6.getNodeForKey(key);
      if (node != null) {
        expandedNodes.push(node);
      }
    });
    return expandedNodes;
  },

  getSelectedNodes: function getSelectedNodes() {
    var _this7 = this;

    var selectedNodes = [];
    this.state.selectedKeys.forEach(function (key) {
      var node = _this7.getNodeForKey(key);
      if (node != null) {
        selectedNodes.push(node);
      }
    });
    return selectedNodes;
  },

  // Return the key for the first node that is selected, or null if there are none.
  _getFirstSelectedKey: function _getFirstSelectedKey() {
    var _this8 = this;

    if (this.state.selectedKeys.size === 0) {
      return null;
    }

    var selectedKey = undefined;
    if (this._allKeys != null) {
      this._allKeys.every(function (key) {
        if (_this8.state.selectedKeys.has(key)) {
          selectedKey = key;
          return false;
        }
        return true;
      });
    }

    return selectedKey;
  },

  _expandSelection: function _expandSelection() {
    var key = this._getFirstSelectedKey();
    if (key) {
      this.expandNodeKey(key);
    }
  },

  /**
   * Selects a node by key if it's in the file tree; otherwise, do nothing.
   */
  selectNodeKey: function selectNodeKey(nodeKey) {
    var _this9 = this;

    if (!this.getNodeForKey(nodeKey)) {
      return Promise.reject();
    }

    // We have to create the listener before setting the state so it can pick
    // up the changes from `setState`.
    var promise = this._createDidUpdateListener( /* shouldResolve */function () {
      return _this9.state.selectedKeys.has(nodeKey);
    });
    this.setState({ selectedKeys: new Set([nodeKey]) });
    return promise;
  },

  getNodeForKey: function getNodeForKey(nodeKey) {
    if (this._keyToNode != null) {
      return this._keyToNode[nodeKey];
    }
  },

  /**
   * If this function is called multiple times in parallel, the later calls will
   * cause the previous promises to reject even if they end up expanding the
   * node key successfully.
   *
   * If we don't reject, then we might leak promises if a node key is expanded
   * and collapsed in succession (the collapse could succeed first, causing
   * the expand to never resolve).
   */
  expandNodeKey: function expandNodeKey(nodeKey) {
    var _this10 = this;

    var node = this.getNodeForKey(nodeKey);

    if (node && node.isContainer()) {
      var promise = this._createDidUpdateListener( /* shouldResolve */function () {
        var isExpanded = _this10.state.expandedKeys.has(nodeKey);
        var nodeNow = _this10.getNodeForKey(nodeKey);
        var isDoneFetching = nodeNow && nodeNow.isContainer() && nodeNow.isCacheValid();
        return isExpanded && isDoneFetching;
      });
      this._toggleNodeExpanded(node, true /* forceExpanded */);
      return promise;
    }

    return Promise.resolve();
  },

  collapseNodeKey: function collapseNodeKey(nodeKey) {
    var _this11 = this;

    var node = this.getNodeForKey(nodeKey);

    if (node && node.isContainer()) {
      var promise = this._createDidUpdateListener(
      /* shouldResolve */function () {
        return !_this11.state.expandedKeys.has(nodeKey);
      });
      this._toggleNodeExpanded(node, false /* forceExpanded */);
      return promise;
    }

    return Promise.resolve();
  },

  isNodeKeyExpanded: function isNodeKeyExpanded(nodeKey) {
    return this.state.expandedKeys.has(nodeKey);
  },

  _collapseSelection: function _collapseSelection() {
    var key = this._getFirstSelectedKey();
    if (!key) {
      return;
    }

    var expandedKeys = this.state.expandedKeys;
    var node = this.getNodeForKey(key);
    if (node != null && (!expandedKeys.has(key) || !node.isContainer())) {
      // If the selection is already collapsed or it's not a container, select its parent.
      var _parent = node.getParent();
      if (_parent) {
        this.selectNodeKey(_parent.getKey());
      }
    }

    this.collapseNodeKey(key);
  },

  _moveSelectionUp: function _moveSelectionUp() {
    var allKeys = this._allKeys;
    if (!allKeys) {
      return;
    }

    var keyIndexToSelect = allKeys.length - 1;
    var key = this._getFirstSelectedKey();
    if (key) {
      keyIndexToSelect = allKeys.indexOf(key);
      if (keyIndexToSelect > 0) {
        --keyIndexToSelect;
      }
    }

    this.setState({ selectedKeys: new Set([allKeys[keyIndexToSelect]]) });
  },

  _moveSelectionDown: function _moveSelectionDown() {
    var allKeys = this._allKeys;
    if (!allKeys) {
      return;
    }

    var keyIndexToSelect = 0;
    var key = this._getFirstSelectedKey();
    if (key) {
      keyIndexToSelect = allKeys.indexOf(key);
      if (keyIndexToSelect !== -1 && keyIndexToSelect < allKeys.length - 1) {
        ++keyIndexToSelect;
      }
    }

    this.setState({ selectedKeys: new Set([allKeys[keyIndexToSelect]]) });
  },

  _confirmSelection: function _confirmSelection() {
    var key = this._getFirstSelectedKey();
    if (key) {
      var node = this.getNodeForKey(key);
      if (node) {
        this._confirmNode(node);
      }
    }
  },

  _confirmNode: function _confirmNode(node) {
    if (node.isContainer()) {
      this._toggleNodeExpanded(node);
    } else {
      this.props.onConfirmSelection(node);
    }
  }
});
exports.TreeRootComponent = TreeRootComponent;

// By default, no context menu item will be displayed if the tree is empty.
// Set this to true to override that behavior.
//# sourceMappingURL=data:application/json;base64,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LENBQUM7R0FDckU7O0FBRUQsbUJBQWlCLEVBQUEsNkJBQVM7QUFDeEIsUUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixFQUFFLENBQUM7QUFDeEMsUUFBSSxHQUFHLEVBQUU7QUFDUCxVQUFNLElBQUksR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3JDLFVBQUksSUFBSSxFQUFFO0FBQ1IsWUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQztPQUN6QjtLQUNGO0dBQ0Y7O0FBRUQsY0FBWSxFQUFBLHNCQUFDLElBQWtCLEVBQVE7QUFDckMsUUFBSSxJQUFJLENBQUMsV0FBVyxFQUFFLEVBQUU7QUFDdEIsVUFBSSxDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQyxDQUFDO0tBQ2hDLE1BQU07QUFDTCxVQUFJLENBQUMsS0FBSyxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxDQUFDO0tBQ3JDO0dBQ0Y7Q0FDRixDQUFDLENBQUMiLCJmaWxlIjoiVHJlZVJvb3RDb21wb25lbnQuanMiLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIGJhYmVsJztcbi8qIEBmbG93ICovXG5cbi8qXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTUtcHJlc2VudCwgRmFjZWJvb2ssIEluYy5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgbGljZW5zZSBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGluXG4gKiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS5cbiAqL1xuXG5jb25zdCB7Q29tcG9zaXRlRGlzcG9zYWJsZX0gPSByZXF1aXJlKCdhdG9tJyk7XG5jb25zdCB7RXZlbnRFbWl0dGVyfSA9IHJlcXVpcmUoJ2V2ZW50cycpO1xuY29uc3Qge0xhenlUcmVlTm9kZX0gPSByZXF1aXJlKCcuL0xhenlUcmVlTm9kZScpO1xuY29uc3Qge1RyZWVOb2RlQ29tcG9uZW50fSA9IHJlcXVpcmUoJy4vVHJlZU5vZGVDb21wb25lbnQnKTtcbmNvbnN0IHtmb3JFYWNoQ2FjaGVkTm9kZX0gPSByZXF1aXJlKCcuL3RyZWUtbm9kZS10cmF2ZXJzYWxzJyk7XG5jb25zdCB7XG4gIFJlYWN0LFxuICBSZWFjdERPTSxcbn0gPSByZXF1aXJlKCdyZWFjdC1mb3ItYXRvbScpO1xuXG5jb25zdCB7UHJvcFR5cGVzfSA9IFJlYWN0O1xuXG50eXBlIFRyZWVNZW51SXRlbURlZmluaXRpb24gPSB7XG4gIGxhYmVsOiBzdHJpbmc7XG4gIGNvbW1hbmQ6IHN0cmluZztcbiAgc3VibWVudTogP0FycmF5PFRyZWVNZW51SXRlbURlZmluaXRpb24+O1xuICBzaG91bGREaXNwbGF5OiA/KCkgPT4gYm9vbGVhbjtcbiAgc2hvdWxkRGlzcGxheUZvclNlbGVjdGVkTm9kZXM6ID8obm9kZXM6IEFycmF5PExhenlUcmVlTm9kZT4pID0+IGJvb2xlYW47XG5cbiAgLy8gQnkgZGVmYXVsdCwgbm8gY29udGV4dCBtZW51IGl0ZW0gd2lsbCBiZSBkaXNwbGF5ZWQgaWYgdGhlIHRyZWUgaXMgZW1wdHkuXG4gIC8vIFNldCB0aGlzIHRvIHRydWUgdG8gb3ZlcnJpZGUgdGhhdCBiZWhhdmlvci5cbiAgc2hvdWxkRGlzcGxheUlmVHJlZUlzRW1wdHk6ID9ib29sZWFuO1xufTtcblxudHlwZSBUcmVlQ29tcG9uZW50U3RhdGUgPSB7XG4gIGV4cGFuZGVkTm9kZUtleXM6IEFycmF5PHN0cmluZz47XG4gIHNlbGVjdGVkTm9kZUtleXM6IEFycmF5PHN0cmluZz47XG59O1xuXG4vKipcbiAqIFRvZ2dsZXMgdGhlIGV4aXN0ZW5jZSBvZiBhIHZhbHVlIGluIGEgc2V0LiBJZiB0aGUgdmFsdWUgZXhpc3RzLCBkZWxldGVzIGl0LlxuICogSWYgdGhlIHZhbHVlIGRvZXMgbm90IGV4aXN0LCBhZGRzIGl0LlxuICpcbiAqIEBwYXJhbSBzZXQgVGhlIHNldCB3aG9zZSB2YWx1ZSB0byB0b2dnbGUuXG4gKiBAcGFyYW0gdmFsdWUgVGhlIHZhbHVlIHRvIHRvZ2dsZSBpbiB0aGUgc2V0LlxuICogQHBhcmFtIFtmb3JjZUhhc10gSWYgZGVmaW5lZCwgZm9yY2VzIHRoZSBleGlzdGVuY2Ugb2YgdGhlIHZhbHVlIGluIHRoZSBzZXRcbiAqICAgICByZWdhcmRsZXNzIG9mIGl0cyBjdXJyZW50IGV4aXN0ZW5jZS4gSWYgdHJ1dGh5LCBhZGRzIGB2YWx1ZWAsIGlmIGZhbHN5XG4gKiAgICAgZGVsZXRlcyBgdmFsdWVgLlxuICogQHJldHVybnMgYHRydWVgIGlmIHRoZSB2YWx1ZSB3YXMgYWRkZWQgdG8gdGhlIHNldCwgb3RoZXJ3aXNlIGBmYWxzZWAuIElmXG4gKiAgICAgYGZvcmNlSGFzYCBpcyBkZWZpbmVkLCB0aGUgcmV0dXJuIHZhbHVlIHdpbGwgYmUgZXF1YWwgdG8gYGZvcmNlSGFzYC5cbiAqL1xuZnVuY3Rpb24gdG9nZ2xlU2V0SGFzKFxuICAgIHNldDogU2V0PHN0cmluZz4sXG4gICAgdmFsdWU6IHN0cmluZyxcbiAgICBmb3JjZUhhcz86ID9ib29sZWFuXG4pOiBib29sZWFuIHtcbiAgbGV0IGFkZGVkO1xuXG4gIGlmIChmb3JjZUhhcyB8fCAoZm9yY2VIYXMgPT09IHVuZGVmaW5lZCAmJiAhc2V0Lmhhcyh2YWx1ZSkpKSB7XG4gICAgc2V0LmFkZCh2YWx1ZSk7XG4gICAgYWRkZWQgPSB0cnVlO1xuICB9IGVsc2Uge1xuICAgIHNldC5kZWxldGUodmFsdWUpO1xuICAgIGFkZGVkID0gZmFsc2U7XG4gIH1cblxuICByZXR1cm4gYWRkZWQ7XG59XG5cbmNvbnN0IEZJUlNUX1NFTEVDVEVEX0RFU0NFTkRBTlRfUkVGOiBzdHJpbmcgPSAnZmlyc3RTZWxlY3RlZERlc2NlbmRhbnQnO1xuXG4vKipcbiAqIEdlbmVyaWMgdHJlZSBjb21wb25lbnQgdGhhdCBvcGVyYXRlcyBvbiBMYXp5VHJlZU5vZGVzLlxuICovXG5leHBvcnQgY29uc3QgVHJlZVJvb3RDb21wb25lbnQgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XG4gIF9hbGxLZXlzOiAobnVsbDogP0FycmF5PHN0cmluZz4pLFxuICBfZW1pdHRlcjogKG51bGw6ID9FdmVudEVtaXR0ZXIpLFxuICBfa2V5VG9Ob2RlOiAobnVsbDogP3tba2V5OiBzdHJpbmddOiBMYXp5VHJlZU5vZGV9KSxcbiAgX3JlamVjdERpZFVwZGF0ZUxpc3RlbmVyUHJvbWlzZTogKG51bGw6ID8oKSA9PiB2b2lkKSxcbiAgX3N1YnNjcmlwdGlvbnM6IChudWxsOiA/Q29tcG9zaXRlRGlzcG9zYWJsZSksXG5cbiAgcHJvcFR5cGVzOiB7XG4gICAgaW5pdGlhbFJvb3RzOiBQcm9wVHlwZXMuYXJyYXlPZihQcm9wVHlwZXMuaW5zdGFuY2VPZihMYXp5VHJlZU5vZGUpKS5pc1JlcXVpcmVkLFxuICAgIGV2ZW50SGFuZGxlclNlbGVjdG9yOiBQcm9wVHlwZXMuc3RyaW5nLmlzUmVxdWlyZWQsXG4gICAgLy8gQSBub2RlIGNhbiBiZSBjb25maXJtZWQgaWYgaXQgaXMgYSBzZWxlY3RlZCBub24tY29udGFpbmVyIG5vZGUgYW5kIHRoZSB1c2VyIGlzIGNsaWNrcyBvbiBpdFxuICAgIC8vIG9yIHByZXNzZXMgPGVudGVyPi5cbiAgICBvbkNvbmZpcm1TZWxlY3Rpb246IFByb3BUeXBlcy5mdW5jLmlzUmVxdWlyZWQsXG4gICAgLy8gQSBub2RlIGNhbiBiZSBcImtlcHRcIiAob3BlbmVkIHBlcm1hbmVudGx5KSBieSBkb3VibGUgY2xpY2tpbmcgaXQuIFRoaXMgb25seSBoYXMgYW4gZWZmZWN0XG4gICAgLy8gd2hlbiB0aGUgYHVzZVByZXZpZXdUYWJzYCBzZXR0aW5nIGlzIGVuYWJsZWQgaW4gdGhlIFwidGFic1wiIHBhY2thZ2UuXG4gICAgb25LZWVwU2VsZWN0aW9uOiBQcm9wVHlwZXMuZnVuYy5pc1JlcXVpcmVkLFxuICAgIGxhYmVsQ2xhc3NOYW1lRm9yTm9kZTogUHJvcFR5cGVzLmZ1bmMuaXNSZXF1aXJlZCxcbiAgICByb3dDbGFzc05hbWVGb3JOb2RlOiBQcm9wVHlwZXMuZnVuYy5pc1JlcXVpcmVkLFxuICAgIC8vIFJlbmRlciB3aWxsIHJldHVybiB0aGlzIGNvbXBvbmVudCBpZiB0aGVyZSBhcmUgbm8gcm9vdCBub2Rlcy5cbiAgICBlbGVtZW50VG9SZW5kZXJXaGVuRW1wdHk6IFByb3BUeXBlcy5lbGVtZW50LFxuICAgIGluaXRpYWxFeHBhbmRlZE5vZGVLZXlzOiBQcm9wVHlwZXMuYXJyYXlPZihQcm9wVHlwZXMuc3RyaW5nKSxcbiAgICBpbml0aWFsU2VsZWN0ZWROb2RlS2V5czogUHJvcFR5cGVzLmFycmF5T2YoUHJvcFR5cGVzLnN0cmluZyksXG4gIH0sXG5cbiAgZ2V0RGVmYXVsdFByb3BzKCk6IGFueSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGVsZW1lbnRUb1JlbmRlcldoZW5FbXB0eTogbnVsbCxcbiAgICAgIG9uQ29uZmlybVNlbGVjdGlvbihub2RlOiBMYXp5VHJlZU5vZGUpIHt9LFxuICAgICAgcm93Q2xhc3NOYW1lRm9yTm9kZShub2RlOiBMYXp5VHJlZU5vZGUpIHsgcmV0dXJuICcnOyB9LFxuICAgIH07XG4gIH0sXG5cbiAgZ2V0SW5pdGlhbFN0YXRlKCk6IGFueSB7XG4gICAgY29uc3Qgcm9vdEtleXMgPSB0aGlzLnByb3BzLmluaXRpYWxSb290cy5tYXAocm9vdCA9PiByb290LmdldEtleSgpKTtcblxuICAgIGxldCBzZWxlY3RlZEtleXM7XG4gICAgaWYgKHRoaXMucHJvcHMuaW5pdGlhbFNlbGVjdGVkTm9kZUtleXMpIHtcbiAgICAgIHNlbGVjdGVkS2V5cyA9IG5ldyBTZXQodGhpcy5wcm9wcy5pbml0aWFsU2VsZWN0ZWROb2RlS2V5cyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHNlbGVjdGVkS2V5cyA9IG5ldyBTZXQocm9vdEtleXMubGVuZ3RoID09PSAwID8gW10gOiBbcm9vdEtleXNbMF1dKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgcm9vdHM6IHRoaXMucHJvcHMuaW5pdGlhbFJvb3RzLFxuICAgICAgLy8gVGhpcyBpcyBtYWludGFpbmVkIGFzIGEgc2V0IG9mIHN0cmluZ3MgZm9yIHR3byByZWFzb25zOlxuICAgICAgLy8gKDEpIEl0IGlzIHN0cmFpZ2h0Zm9yd2FyZCB0byBzZXJpYWxpemUuXG4gICAgICAvLyAoMikgSWYgdGhlIExhenlGaWxlVHJlZU5vZGUgZm9yIGEgcGF0aCBpcyByZS1jcmVhdGVkLCB0aGlzIHdpbGwgc3RpbGwgd29yay5cbiAgICAgIGV4cGFuZGVkS2V5czogbmV3IFNldCh0aGlzLnByb3BzLmluaXRpYWxFeHBhbmRlZE5vZGVLZXlzIHx8IHJvb3RLZXlzKSxcbiAgICAgIHNlbGVjdGVkS2V5cyxcbiAgICB9O1xuICB9LFxuXG4gIGNvbXBvbmVudERpZFVwZGF0ZShwcmV2UHJvcHM6IE9iamVjdCwgcHJldlN0YXRlOiA/T2JqZWN0KTogdm9pZCB7XG4gICAgLy8gSWYgdGhlIFNldCBvZiBzZWxlY3RlZCBpdGVtcyBpcyBuZXcsIGxpa2Ugd2hlbiBuYXZpZ2F0aW5nIHRoZSB0cmVlIHdpdGhcbiAgICAvLyB0aGUgYXJyb3cga2V5cywgc2Nyb2xsIHRoZSBmaXJzdCBpdGVtIGludG8gdmlldy4gVGhpcyBhZGRyZXNzZXMgdGhlXG4gICAgLy8gZm9sbG93aW5nIHNjZW5hcmlvOlxuICAgIC8vICgxKSBTZWxlY3QgYSBub2RlIGluIHRoZSB0cmVlXG4gICAgLy8gKDIpIFNjcm9sbCB0aGUgc2VsZWN0ZWQgbm9kZSBvdXQgb2YgdGhlIHZpZXdwb3J0XG4gICAgLy8gKDMpIFByZXNzIHRoZSB1cCBvciBkb3duIGFycm93IGtleSB0byBjaGFuZ2UgdGhlIHNlbGVjdGVkIG5vZGVcbiAgICAvLyAoNCkgVGhlIG5ldyBub2RlIHNob3VsZCBzY3JvbGwgaW50byB2aWV3XG4gICAgaWYgKCFwcmV2U3RhdGUgfHwgdGhpcy5zdGF0ZS5zZWxlY3RlZEtleXMgIT09IHByZXZTdGF0ZS5zZWxlY3RlZEtleXMpIHtcbiAgICAgIGNvbnN0IGZpcnN0U2VsZWN0ZWREZXNjZW5kYW50ID0gdGhpcy5yZWZzW0ZJUlNUX1NFTEVDVEVEX0RFU0NFTkRBTlRfUkVGXTtcbiAgICAgIGlmIChmaXJzdFNlbGVjdGVkRGVzY2VuZGFudCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIFJlYWN0RE9NLmZpbmRET01Ob2RlKGZpcnN0U2VsZWN0ZWREZXNjZW5kYW50KS5zY3JvbGxJbnRvVmlld0lmTmVlZGVkKGZhbHNlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAodGhpcy5fZW1pdHRlcikge1xuICAgICAgdGhpcy5fZW1pdHRlci5lbWl0KCdkaWQtdXBkYXRlJyk7XG4gICAgfVxuICB9LFxuXG4gIF9kZXNlbGVjdERlc2NlbmRhbnRzKHJvb3Q6IExhenlUcmVlTm9kZSk6IHZvaWQge1xuICAgIGNvbnN0IHNlbGVjdGVkS2V5cyA9IHRoaXMuc3RhdGUuc2VsZWN0ZWRLZXlzO1xuXG4gICAgZm9yRWFjaENhY2hlZE5vZGUocm9vdCwgbm9kZSA9PiB7XG4gICAgICAvLyBgZm9yRWFjaENhY2hlZE5vZGVgIGl0ZXJhdGVzIG92ZXIgdGhlIHJvb3QsIGJ1dCBpdCBzaG91bGQgcmVtYWluXG4gICAgICAvLyBzZWxlY3RlZC4gU2tpcCBpdC5cbiAgICAgIGlmIChub2RlID09PSByb290KSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgc2VsZWN0ZWRLZXlzLmRlbGV0ZShub2RlLmdldEtleSgpKTtcbiAgICB9KTtcblxuICAgIHRoaXMuc2V0U3RhdGUoe3NlbGVjdGVkS2V5c30pO1xuICB9LFxuXG4gIF9pc05vZGVFeHBhbmRlZChub2RlOiBMYXp5VHJlZU5vZGUpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5zdGF0ZS5leHBhbmRlZEtleXMuaGFzKG5vZGUuZ2V0S2V5KCkpO1xuICB9LFxuXG4gIF9pc05vZGVTZWxlY3RlZChub2RlOiBMYXp5VHJlZU5vZGUpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5zdGF0ZS5zZWxlY3RlZEtleXMuaGFzKG5vZGUuZ2V0S2V5KCkpO1xuICB9LFxuXG4gIF90b2dnbGVOb2RlRXhwYW5kZWQobm9kZTogTGF6eVRyZWVOb2RlLCBmb3JjZUV4cGFuZGVkPzogP2Jvb2xlYW4pOiB2b2lkIHtcbiAgICBjb25zdCBleHBhbmRlZEtleXMgPSB0aGlzLnN0YXRlLmV4cGFuZGVkS2V5cztcbiAgICBjb25zdCBrZXlBZGRlZCA9IHRvZ2dsZVNldEhhcyhleHBhbmRlZEtleXMsIG5vZGUuZ2V0S2V5KCksIGZvcmNlRXhwYW5kZWQpO1xuXG4gICAgLy8gSWYgdGhlIG5vZGUgd2FzIGNvbGxhcHNlZCwgZGVzZWxlY3QgaXRzIGRlc2NlbmRhbnRzIHNvIG9ubHkgbm9kZXMgdmlzaWJsZVxuICAgIC8vIGluIHRoZSB0cmVlIHJlbWFpbiBzZWxlY3RlZC5cbiAgICBpZiAoIWtleUFkZGVkKSB7XG4gICAgICB0aGlzLl9kZXNlbGVjdERlc2NlbmRhbnRzKG5vZGUpO1xuICAgIH1cblxuICAgIHRoaXMuc2V0U3RhdGUoe2V4cGFuZGVkS2V5c30pO1xuICB9LFxuXG4gIF90b2dnbGVOb2RlU2VsZWN0ZWQobm9kZTogTGF6eVRyZWVOb2RlLCBmb3JjZVNlbGVjdGVkPzogP2Jvb2xlYW4pOiB2b2lkIHtcbiAgICBjb25zdCBzZWxlY3RlZEtleXMgPSB0aGlzLnN0YXRlLnNlbGVjdGVkS2V5cztcbiAgICB0b2dnbGVTZXRIYXMoc2VsZWN0ZWRLZXlzLCBub2RlLmdldEtleSgpLCBmb3JjZVNlbGVjdGVkKTtcbiAgICB0aGlzLnNldFN0YXRlKHtzZWxlY3RlZEtleXN9KTtcbiAgfSxcblxuICBfb25DbGlja05vZGUoZXZlbnQ6IFN5bnRoZXRpY01vdXNlRXZlbnQsIG5vZGU6IExhenlUcmVlTm9kZSk6IHZvaWQge1xuICAgIGlmIChldmVudC5tZXRhS2V5KSB7XG4gICAgICB0aGlzLl90b2dnbGVOb2RlU2VsZWN0ZWQobm9kZSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5zZXRTdGF0ZSh7XG4gICAgICBzZWxlY3RlZEtleXM6IG5ldyBTZXQoW25vZGUuZ2V0S2V5KCldKSxcbiAgICB9KTtcblxuICAgIGlmICghdGhpcy5faXNOb2RlU2VsZWN0ZWQobm9kZSkgJiZcbiAgICAgICAgKG5vZGUuaXNDb250YWluZXIoKSB8fCAhYXRvbS5jb25maWcuZ2V0KCd0YWJzLnVzZVByZXZpZXdUYWJzJykpKSB7XG4gICAgICAvLyBVc2VyIGNsaWNrZWQgb24gYSBuZXcgZGlyZWN0b3J5IG9yIHRoZSB1c2VyIGlzbid0IHVzaW5nIHRoZSBcIlByZXZpZXcgVGFic1wiIGZlYXR1cmUgb2YgdGhlXG4gICAgICAvLyBgdGFic2AgcGFja2FnZSwgc28gZG9uJ3QgdG9nZ2xlIHRoZSBub2RlJ3Mgc3RhdGUgYW55IGZ1cnRoZXIgeWV0LlxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuX2NvbmZpcm1Ob2RlKG5vZGUpO1xuICB9LFxuXG4gIF9vbkNsaWNrTm9kZUFycm93KGV2ZW50OiBTeW50aGV0aWNFdmVudCwgbm9kZTogTGF6eVRyZWVOb2RlKTogdm9pZCB7XG4gICAgdGhpcy5fdG9nZ2xlTm9kZUV4cGFuZGVkKG5vZGUpO1xuICB9LFxuXG4gIF9vbkRvdWJsZUNsaWNrTm9kZShldmVudDogU3ludGhldGljTW91c2VFdmVudCwgbm9kZTogTGF6eVRyZWVOb2RlKTogdm9pZCB7XG4gICAgLy8gRG91YmxlIGNsaWNraW5nIGEgbm9uLWRpcmVjdG9yeSB3aWxsIGtlZXAgdGhlIGNyZWF0ZWQgdGFiIG9wZW4uXG4gICAgaWYgKCFub2RlLmlzQ29udGFpbmVyKCkpIHtcbiAgICAgIHRoaXMucHJvcHMub25LZWVwU2VsZWN0aW9uKCk7XG4gICAgfVxuICB9LFxuXG4gIF9vbk1vdXNlRG93bihldmVudDogU3ludGhldGljTW91c2VFdmVudCwgbm9kZTogTGF6eVRyZWVOb2RlKTogdm9pZCB7XG4gICAgLy8gU2VsZWN0IHRoZSBub2RlIG9uIHJpZ2h0LWNsaWNrLlxuICAgIGlmIChldmVudC5idXR0b24gPT09IDIgfHwgKGV2ZW50LmJ1dHRvbiA9PT0gMCAmJiBldmVudC5jdHJsS2V5ID09PSB0cnVlKSkge1xuICAgICAgaWYgKCF0aGlzLl9pc05vZGVTZWxlY3RlZChub2RlKSkge1xuICAgICAgICB0aGlzLnNldFN0YXRlKHtzZWxlY3RlZEtleXM6IG5ldyBTZXQoW25vZGUuZ2V0S2V5KCldKX0pO1xuICAgICAgfVxuICAgIH1cbiAgfSxcblxuICBhZGRDb250ZXh0TWVudUl0ZW1Hcm91cChtZW51SXRlbURlZmluaXRpb25zOiBBcnJheTxUcmVlTWVudUl0ZW1EZWZpbml0aW9uPik6IHZvaWQge1xuICAgIGxldCBpdGVtcyA9IG1lbnVJdGVtRGVmaW5pdGlvbnMuc2xpY2UoKTtcbiAgICBpdGVtcyA9IGl0ZW1zLm1hcChkZWZpbml0aW9uID0+IHtcbiAgICAgIGRlZmluaXRpb24uc2hvdWxkRGlzcGxheSA9ICgpID0+IHtcbiAgICAgICAgaWYgKHRoaXMuc3RhdGUucm9vdHMubGVuZ3RoID09PSAwICYmICFkZWZpbml0aW9uLnNob3VsZERpc3BsYXlJZlRyZWVJc0VtcHR5KSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHNob3VsZERpc3BsYXlGb3JTZWxlY3RlZE5vZGVzID0gZGVmaW5pdGlvbi5zaG91bGREaXNwbGF5Rm9yU2VsZWN0ZWROb2RlcztcbiAgICAgICAgaWYgKHNob3VsZERpc3BsYXlGb3JTZWxlY3RlZE5vZGVzKSB7XG4gICAgICAgICAgcmV0dXJuIHNob3VsZERpc3BsYXlGb3JTZWxlY3RlZE5vZGVzLmNhbGwoZGVmaW5pdGlvbiwgdGhpcy5nZXRTZWxlY3RlZE5vZGVzKCkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfTtcbiAgICAgIHJldHVybiBkZWZpbml0aW9uO1xuICAgIH0pO1xuXG4gICAgLy8gQXRvbSBpcyBzbWFydCBhYm91dCBvbmx5IGRpc3BsYXlpbmcgYSBzZXBhcmF0b3Igd2hlbiB0aGVyZSBhcmUgaXRlbXMgdG9cbiAgICAvLyBzZXBhcmF0ZSwgc28gdGhlcmUgd2lsbCBuZXZlciBiZSBhIGRhbmdsaW5nIHNlcGFyYXRvciBhdCB0aGUgZW5kLlxuICAgIGl0ZW1zLnB1c2goe3R5cGU6ICdzZXBhcmF0b3InfSk7XG5cbiAgICAvLyBUT0RPOiBVc2UgYSBjb21wdXRlZCBwcm9wZXJ0eSB3aGVuIHN1cHBvcnRlZCBieSBGbG93LlxuICAgIGNvbnN0IGNvbnRleHRNZW51T2JqID0ge307XG4gICAgY29udGV4dE1lbnVPYmpbdGhpcy5wcm9wcy5ldmVudEhhbmRsZXJTZWxlY3Rvcl0gPSBpdGVtcztcbiAgICBhdG9tLmNvbnRleHRNZW51LmFkZChjb250ZXh0TWVudU9iaik7XG4gIH0sXG5cbiAgcmVuZGVyKCk6ID9SZWFjdEVsZW1lbnQge1xuICAgIGlmICh0aGlzLnN0YXRlLnJvb3RzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIHRoaXMucHJvcHMuZWxlbWVudFRvUmVuZGVyV2hlbkVtcHR5O1xuICAgIH1cblxuICAgIGNvbnN0IGNoaWxkcmVuID0gW107XG4gICAgY29uc3QgZXhwYW5kZWRLZXlzID0gdGhpcy5zdGF0ZS5leHBhbmRlZEtleXM7XG4gICAgbGV0IGZvdW5kRmlyc3RTZWxlY3RlZERlc2NlbmRhbnQ6IGJvb2xlYW4gPSBmYWxzZTtcblxuICAgIGNvbnN0IHByb21pc2VzOiBBcnJheTxQcm9taXNlPiA9IFtdO1xuICAgIGNvbnN0IGFsbEtleXM6IEFycmF5PHN0cmluZz4gPSBbXTtcbiAgICBjb25zdCBrZXlUb05vZGU6IHsgW2tleTpzdHJpbmddOiBMYXp5VHJlZU5vZGV9ID0ge307XG5cbiAgICB0aGlzLnN0YXRlLnJvb3RzLmZvckVhY2gocm9vdCA9PiB7XG4gICAgICBjb25zdCBzdGFjayA9IFt7bm9kZTogcm9vdCwgZGVwdGg6IDB9XTtcblxuICAgICAgd2hpbGUgKHN0YWNrLmxlbmd0aCAhPT0gMCkge1xuICAgICAgICAvLyBQb3Agb2ZmIHRoZSB0b3Agb2YgdGhlIHN0YWNrIGFuZCBhZGQgaXQgdG8gdGhlIGxpc3Qgb2Ygbm9kZXMgdG8gZGlzcGxheS5cbiAgICAgICAgY29uc3QgaXRlbSA9IHN0YWNrLnBvcCgpO1xuICAgICAgICBjb25zdCBub2RlID0gaXRlbS5ub2RlO1xuXG4gICAgICAgIC8vIEtlZXAgYSByZWZlcmVuY2UgdGhlIGZpcnN0IHNlbGVjdGVkIGRlc2NlbmRhbnQgd2l0aFxuICAgICAgICAvLyBgdGhpcy5yZWZzW0ZJUlNUX1NFTEVDVEVEX0RFU0NFTkRBTlRfUkVGXWAuXG4gICAgICAgIGNvbnN0IGlzTm9kZVNlbGVjdGVkOiBib29sZWFuID0gdGhpcy5faXNOb2RlU2VsZWN0ZWQobm9kZSk7XG4gICAgICAgIGxldCByZWY6ID9zdHJpbmcgPSBudWxsO1xuICAgICAgICBpZiAoIWZvdW5kRmlyc3RTZWxlY3RlZERlc2NlbmRhbnQgJiYgaXNOb2RlU2VsZWN0ZWQpIHtcbiAgICAgICAgICBmb3VuZEZpcnN0U2VsZWN0ZWREZXNjZW5kYW50ID0gdHJ1ZTtcbiAgICAgICAgICByZWYgPSBGSVJTVF9TRUxFQ1RFRF9ERVNDRU5EQU5UX1JFRjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGNoaWxkID0gKFxuICAgICAgICAgIDxUcmVlTm9kZUNvbXBvbmVudCB7Li4uaXRlbX1cbiAgICAgICAgICAgIGlzQ29udGFpbmVyPXtub2RlLmlzQ29udGFpbmVyKCl9XG4gICAgICAgICAgICBpc0V4cGFuZGVkPXt0aGlzLl9pc05vZGVFeHBhbmRlZChub2RlKX1cbiAgICAgICAgICAgIGlzTG9hZGluZz17IW5vZGUuaXNDYWNoZVZhbGlkKCl9XG4gICAgICAgICAgICBpc1NlbGVjdGVkPXtpc05vZGVTZWxlY3RlZH1cbiAgICAgICAgICAgIGxhYmVsPXtub2RlLmdldExhYmVsKCl9XG4gICAgICAgICAgICBsYWJlbENsYXNzTmFtZT17dGhpcy5wcm9wcy5sYWJlbENsYXNzTmFtZUZvck5vZGUobm9kZSl9XG4gICAgICAgICAgICByb3dDbGFzc05hbWU9e3RoaXMucHJvcHMucm93Q2xhc3NOYW1lRm9yTm9kZShub2RlKX1cbiAgICAgICAgICAgIG9uQ2xpY2tBcnJvdz17dGhpcy5fb25DbGlja05vZGVBcnJvd31cbiAgICAgICAgICAgIG9uQ2xpY2s9e3RoaXMuX29uQ2xpY2tOb2RlfVxuICAgICAgICAgICAgb25Eb3VibGVDbGljaz17dGhpcy5fb25Eb3VibGVDbGlja05vZGV9XG4gICAgICAgICAgICBvbk1vdXNlRG93bj17dGhpcy5fb25Nb3VzZURvd259XG4gICAgICAgICAgICBwYXRoPXtub2RlLmdldEtleSgpfVxuICAgICAgICAgICAga2V5PXtub2RlLmdldEtleSgpfVxuICAgICAgICAgICAgcmVmPXtyZWZ9XG4gICAgICAgICAgLz5cbiAgICAgICAgKTtcbiAgICAgICAgY2hpbGRyZW4ucHVzaChjaGlsZCk7XG4gICAgICAgIGFsbEtleXMucHVzaChub2RlLmdldEtleSgpKTtcbiAgICAgICAga2V5VG9Ob2RlW25vZGUuZ2V0S2V5KCldID0gbm9kZTtcblxuICAgICAgICAvLyBDaGVjayB3aGV0aGVyIHRoZSBub2RlIGhhcyBhbnkgY2hpbGRyZW4gdGhhdCBzaG91bGQgYmUgZGlzcGxheWVkLlxuICAgICAgICBpZiAoIW5vZGUuaXNDb250YWluZXIoKSB8fCAhZXhwYW5kZWRLZXlzLmhhcyhub2RlLmdldEtleSgpKSkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgY2FjaGVkQ2hpbGRyZW4gPSBub2RlLmdldENhY2hlZENoaWxkcmVuKCk7XG4gICAgICAgIGlmICghY2FjaGVkQ2hpbGRyZW4gfHwgIW5vZGUuaXNDYWNoZVZhbGlkKCkpIHtcbiAgICAgICAgICBwcm9taXNlcy5wdXNoKG5vZGUuZmV0Y2hDaGlsZHJlbigpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFByZXZlbnQgZmxpY2tlcmluZyBieSBhbHdheXMgcmVuZGVyaW5nIGNhY2hlZCBjaGlsZHJlbiAtLSBpZiB0aGV5J3JlIGludmFsaWQsXG4gICAgICAgIC8vIHRoZW4gdGhlIGZldGNoIHdpbGwgaGFwcGVuIHNvb24uXG4gICAgICAgIGlmIChjYWNoZWRDaGlsZHJlbikge1xuICAgICAgICAgIGNvbnN0IGRlcHRoID0gaXRlbS5kZXB0aCArIDE7XG4gICAgICAgICAgLy8gUHVzaCB0aGUgbm9kZSdzIGNoaWxkcmVuIG9uIHRoZSBzdGFjayBpbiByZXZlcnNlIG9yZGVyIHNvIHRoYXQgd2hlblxuICAgICAgICAgIC8vIHRoZXkgYXJlIHBvcHBlZCBvZmYgdGhlIHN0YWNrLCB0aGV5IGFyZSBpdGVyYXRlZCBpbiB0aGUgb3JpZ2luYWxcbiAgICAgICAgICAvLyBvcmRlci5cbiAgICAgICAgICBjYWNoZWRDaGlsZHJlbi5yZXZlcnNlKCkuZm9yRWFjaChjaGlsZE5vZGUgPT4ge1xuICAgICAgICAgICAgc3RhY2sucHVzaCh7bm9kZTogY2hpbGROb2RlLCBkZXB0aH0pO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAocHJvbWlzZXMubGVuZ3RoKSB7XG4gICAgICBQcm9taXNlLmFsbChwcm9taXNlcykudGhlbigoKSA9PiB7XG4gICAgICAgIC8vIFRoZSBjb21wb25lbnQgY291bGQgaGF2ZSBiZWVuIHVubW91bnRlZCBieSB0aGUgdGltZSB0aGUgcHJvbWlzZXMgYXJlIHJlc29sdmVkLlxuICAgICAgICBpZiAodGhpcy5pc01vdW50ZWQoKSkge1xuICAgICAgICAgIHRoaXMuZm9yY2VVcGRhdGUoKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgdGhpcy5fYWxsS2V5cyA9IGFsbEtleXM7XG4gICAgdGhpcy5fa2V5VG9Ob2RlID0ga2V5VG9Ob2RlO1xuICAgIHJldHVybiAoXG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cIm51Y2xpZGUtdHJlZS1yb290XCI+XG4gICAgICAgIHtjaGlsZHJlbn1cbiAgICAgIDwvZGl2PlxuICAgICk7XG4gIH0sXG5cbiAgY29tcG9uZW50V2lsbE1vdW50KCk6IHZvaWQge1xuICAgIGNvbnN0IGFsbEtleXMgPSBbXTtcbiAgICBjb25zdCBrZXlUb05vZGUgPSB7fTtcblxuICAgIHRoaXMuc3RhdGUucm9vdHMuZm9yRWFjaChyb290ID0+IHtcbiAgICAgIGNvbnN0IHJvb3RLZXkgPSByb290LmdldEtleSgpO1xuICAgICAgYWxsS2V5cy5wdXNoKHJvb3RLZXkpO1xuICAgICAga2V5VG9Ob2RlW3Jvb3RLZXldID0gcm9vdDtcbiAgICB9KTtcblxuICAgIGNvbnN0IHN1YnNjcmlwdGlvbnMgPSBuZXcgQ29tcG9zaXRlRGlzcG9zYWJsZSgpO1xuICAgIHN1YnNjcmlwdGlvbnMuYWRkKGF0b20uY29tbWFuZHMuYWRkKFxuICAgICAgdGhpcy5wcm9wcy5ldmVudEhhbmRsZXJTZWxlY3RvcixcbiAgICAgIHtcbiAgICAgICAgLy8gRXhwYW5kIGFuZCBjb2xsYXBzZS5cbiAgICAgICAgJ2NvcmU6bW92ZS1yaWdodCc6ICgpID0+IHRoaXMuX2V4cGFuZFNlbGVjdGlvbigpLFxuICAgICAgICAnY29yZTptb3ZlLWxlZnQnOiAoKSA9PiB0aGlzLl9jb2xsYXBzZVNlbGVjdGlvbigpLFxuXG4gICAgICAgIC8vIE1vdmUgc2VsZWN0aW9uIHVwIGFuZCBkb3duLlxuICAgICAgICAnY29yZTptb3ZlLXVwJzogKCkgPT4gdGhpcy5fbW92ZVNlbGVjdGlvblVwKCksXG4gICAgICAgICdjb3JlOm1vdmUtZG93bic6ICgpID0+IHRoaXMuX21vdmVTZWxlY3Rpb25Eb3duKCksXG5cbiAgICAgICAgJ2NvcmU6Y29uZmlybSc6ICgpID0+IHRoaXMuX2NvbmZpcm1TZWxlY3Rpb24oKSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIHRoaXMuX2FsbEtleXMgPSBhbGxLZXlzO1xuICAgIHRoaXMuX2VtaXR0ZXIgPSBuZXcgRXZlbnRFbWl0dGVyKCk7XG4gICAgdGhpcy5fa2V5VG9Ob2RlID0ga2V5VG9Ob2RlO1xuICAgIHRoaXMuX3N1YnNjcmlwdGlvbnMgPSBzdWJzY3JpcHRpb25zO1xuICB9LFxuXG4gIGNvbXBvbmVudFdpbGxVbm1vdW50KCk6IHZvaWQge1xuICAgIGlmICh0aGlzLl9zdWJzY3JpcHRpb25zKSB7XG4gICAgICB0aGlzLl9zdWJzY3JpcHRpb25zLmRpc3Bvc2UoKTtcbiAgICB9XG4gICAgaWYgKHRoaXMuX2VtaXR0ZXIpIHtcbiAgICAgIHRoaXMuX2VtaXR0ZXIucmVtb3ZlQWxsTGlzdGVuZXJzKCk7XG4gICAgfVxuICB9LFxuXG4gIHNlcmlhbGl6ZSgpOiBUcmVlQ29tcG9uZW50U3RhdGUge1xuICAgIGNvbnN0IHtmcm9tfSA9IHJlcXVpcmUoJy4uLy4uL251Y2xpZGUtY29tbW9ucycpLmFycmF5O1xuICAgIHJldHVybiB7XG4gICAgICBleHBhbmRlZE5vZGVLZXlzOiBmcm9tKHRoaXMuc3RhdGUuZXhwYW5kZWRLZXlzKSxcbiAgICAgIHNlbGVjdGVkTm9kZUtleXM6IGZyb20odGhpcy5zdGF0ZS5zZWxlY3RlZEtleXMpLFxuICAgIH07XG4gIH0sXG5cbiAgaW52YWxpZGF0ZUNhY2hlZE5vZGVzKCk6IHZvaWQge1xuICAgIHRoaXMuc3RhdGUucm9vdHMuZm9yRWFjaChyb290ID0+IHtcbiAgICAgIGZvckVhY2hDYWNoZWROb2RlKHJvb3QsIG5vZGUgPT4ge1xuICAgICAgICBub2RlLmludmFsaWRhdGVDYWNoZSgpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFJldHVybnMgYSBQcm9taXNlIHRoYXQncyByZXNvbHZlZCB3aGVuIHRoZSByb290cyBhcmUgcmVuZGVyZWQuXG4gICAqL1xuICBzZXRSb290cyhyb290czogQXJyYXk8TGF6eVRyZWVOb2RlPik6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuc3RhdGUucm9vdHMuZm9yRWFjaChyb290ID0+IHtcbiAgICAgIHRoaXMucmVtb3ZlU3RhdGVGb3JTdWJ0cmVlKHJvb3QpO1xuICAgIH0pO1xuXG4gICAgY29uc3QgZXhwYW5kZWRLZXlzID0gdGhpcy5zdGF0ZS5leHBhbmRlZEtleXM7XG4gICAgcm9vdHMuZm9yRWFjaChyb290ID0+IGV4cGFuZGVkS2V5cy5hZGQocm9vdC5nZXRLZXkoKSkpO1xuXG4gICAgLy8gV2UgaGF2ZSB0byBjcmVhdGUgdGhlIGxpc3RlbmVyIGJlZm9yZSBzZXR0aW5nIHRoZSBzdGF0ZSBzbyBpdCBjYW4gcGlja1xuICAgIC8vIHVwIHRoZSBjaGFuZ2VzIGZyb20gYHNldFN0YXRlYC5cbiAgICBjb25zdCBwcm9taXNlID0gdGhpcy5fY3JlYXRlRGlkVXBkYXRlTGlzdGVuZXIoLyogc2hvdWxkUmVzb2x2ZSAqLyAoKSA9PiB7XG4gICAgICBjb25zdCByb290c1JlYWR5ID0gKHRoaXMuc3RhdGUucm9vdHMgPT09IHJvb3RzKTtcbiAgICAgIGNvbnN0IGNoaWxkcmVuUmVhZHkgPSB0aGlzLnN0YXRlLnJvb3RzLmV2ZXJ5KHJvb3QgPT4gcm9vdC5pc0NhY2hlVmFsaWQoKSk7XG4gICAgICByZXR1cm4gcm9vdHNSZWFkeSAmJiBjaGlsZHJlblJlYWR5O1xuICAgIH0pO1xuXG4gICAgdGhpcy5zZXRTdGF0ZSh7XG4gICAgICByb290cyxcbiAgICAgIGV4cGFuZGVkS2V5cyxcbiAgICB9KTtcblxuICAgIHJldHVybiBwcm9taXNlO1xuICB9LFxuXG4gIF9jcmVhdGVEaWRVcGRhdGVMaXN0ZW5lcihzaG91bGRSZXNvbHZlOiAoKSA9PiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGNvbnN0IGxpc3RlbmVyID0gKCkgPT4ge1xuICAgICAgICBpZiAoc2hvdWxkUmVzb2x2ZSgpKSB7XG4gICAgICAgICAgcmVzb2x2ZSh1bmRlZmluZWQpO1xuXG4gICAgICAgICAgLy8gU2V0IHRoaXMgdG8gbnVsbCBzbyB0aGlzIHByb21pc2UgY2FuJ3QgYmUgcmVqZWN0ZWQgYW55bW9yZS5cbiAgICAgICAgICB0aGlzLl9yZWplY3REaWRVcGRhdGVMaXN0ZW5lclByb21pc2UgPSBudWxsO1xuICAgICAgICAgIGlmICh0aGlzLl9lbWl0dGVyKSB7XG4gICAgICAgICAgICB0aGlzLl9lbWl0dGVyLnJlbW92ZUxpc3RlbmVyKCdkaWQtdXBkYXRlJywgbGlzdGVuZXIpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgaWYgKHRoaXMuX2VtaXR0ZXIpIHtcbiAgICAgICAgdGhpcy5fZW1pdHRlci5hZGRMaXN0ZW5lcignZGlkLXVwZGF0ZScsIGxpc3RlbmVyKTtcbiAgICAgIH1cblxuICAgICAgLy8gV2UgbmVlZCB0byByZWplY3QgdGhlIHByZXZpb3VzIHByb21pc2UsIHNvIGl0IGRvZXNuJ3QgZ2V0IGxlYWtlZC5cbiAgICAgIGlmICh0aGlzLl9yZWplY3REaWRVcGRhdGVMaXN0ZW5lclByb21pc2UpIHtcbiAgICAgICAgdGhpcy5fcmVqZWN0RGlkVXBkYXRlTGlzdGVuZXJQcm9taXNlKCk7XG4gICAgICAgIHRoaXMuX3JlamVjdERpZFVwZGF0ZUxpc3RlbmVyUHJvbWlzZSA9IG51bGw7XG4gICAgICB9XG4gICAgICB0aGlzLl9yZWplY3REaWRVcGRhdGVMaXN0ZW5lclByb21pc2UgPSAoKSA9PiB7XG4gICAgICAgIHJlamVjdCh1bmRlZmluZWQpO1xuICAgICAgICBpZiAodGhpcy5fZW1pdHRlcikge1xuICAgICAgICAgIHRoaXMuX2VtaXR0ZXIucmVtb3ZlTGlzdGVuZXIoJ2RpZC11cGRhdGUnLCBsaXN0ZW5lcik7XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfSk7XG4gIH0sXG5cbiAgcmVtb3ZlU3RhdGVGb3JTdWJ0cmVlKHJvb3Q6IExhenlUcmVlTm9kZSk6IHZvaWQge1xuICAgIGNvbnN0IGV4cGFuZGVkS2V5cyA9IHRoaXMuc3RhdGUuZXhwYW5kZWRLZXlzO1xuICAgIGNvbnN0IHNlbGVjdGVkS2V5cyA9IHRoaXMuc3RhdGUuc2VsZWN0ZWRLZXlzO1xuXG4gICAgZm9yRWFjaENhY2hlZE5vZGUocm9vdCwgbm9kZSA9PiB7XG4gICAgICBjb25zdCBjYWNoZWRLZXkgPSBub2RlLmdldEtleSgpO1xuICAgICAgZXhwYW5kZWRLZXlzLmRlbGV0ZShjYWNoZWRLZXkpO1xuICAgICAgc2VsZWN0ZWRLZXlzLmRlbGV0ZShjYWNoZWRLZXkpO1xuICAgIH0pO1xuXG4gICAgdGhpcy5zZXRTdGF0ZSh7XG4gICAgICBleHBhbmRlZEtleXMsXG4gICAgICBzZWxlY3RlZEtleXMsXG4gICAgfSk7XG4gIH0sXG5cbiAgZ2V0Um9vdE5vZGVzKCk6IEFycmF5PExhenlUcmVlTm9kZT4ge1xuICAgIHJldHVybiB0aGlzLnN0YXRlLnJvb3RzO1xuICB9LFxuXG4gIGdldEV4cGFuZGVkTm9kZXMoKTogQXJyYXk8TGF6eVRyZWVOb2RlPiB7XG4gICAgY29uc3QgZXhwYW5kZWROb2RlcyA9IFtdO1xuICAgIHRoaXMuc3RhdGUuZXhwYW5kZWRLZXlzLmZvckVhY2goa2V5ID0+IHtcbiAgICAgIGNvbnN0IG5vZGUgPSB0aGlzLmdldE5vZGVGb3JLZXkoa2V5KTtcbiAgICAgIGlmIChub2RlICE9IG51bGwpIHtcbiAgICAgICAgZXhwYW5kZWROb2Rlcy5wdXNoKG5vZGUpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBleHBhbmRlZE5vZGVzO1xuICB9LFxuXG4gIGdldFNlbGVjdGVkTm9kZXMoKTogQXJyYXk8TGF6eVRyZWVOb2RlPiB7XG4gICAgY29uc3Qgc2VsZWN0ZWROb2RlcyA9IFtdO1xuICAgIHRoaXMuc3RhdGUuc2VsZWN0ZWRLZXlzLmZvckVhY2goa2V5ID0+IHtcbiAgICAgIGNvbnN0IG5vZGUgPSB0aGlzLmdldE5vZGVGb3JLZXkoa2V5KTtcbiAgICAgIGlmIChub2RlICE9IG51bGwpIHtcbiAgICAgICAgc2VsZWN0ZWROb2Rlcy5wdXNoKG5vZGUpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBzZWxlY3RlZE5vZGVzO1xuICB9LFxuXG4gIC8vIFJldHVybiB0aGUga2V5IGZvciB0aGUgZmlyc3Qgbm9kZSB0aGF0IGlzIHNlbGVjdGVkLCBvciBudWxsIGlmIHRoZXJlIGFyZSBub25lLlxuICBfZ2V0Rmlyc3RTZWxlY3RlZEtleSgpOiA/c3RyaW5nIHtcbiAgICBpZiAodGhpcy5zdGF0ZS5zZWxlY3RlZEtleXMuc2l6ZSA9PT0gMCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgbGV0IHNlbGVjdGVkS2V5O1xuICAgIGlmICh0aGlzLl9hbGxLZXlzICE9IG51bGwpIHtcbiAgICAgIHRoaXMuX2FsbEtleXMuZXZlcnkoa2V5ID0+IHtcbiAgICAgICAgaWYgKHRoaXMuc3RhdGUuc2VsZWN0ZWRLZXlzLmhhcyhrZXkpKSB7XG4gICAgICAgICAgc2VsZWN0ZWRLZXkgPSBrZXk7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHNlbGVjdGVkS2V5O1xuICB9LFxuXG4gIF9leHBhbmRTZWxlY3Rpb24oKTogdm9pZCB7XG4gICAgY29uc3Qga2V5ID0gdGhpcy5fZ2V0Rmlyc3RTZWxlY3RlZEtleSgpO1xuICAgIGlmIChrZXkpIHtcbiAgICAgIHRoaXMuZXhwYW5kTm9kZUtleShrZXkpO1xuICAgIH1cbiAgfSxcblxuICAvKipcbiAgICogU2VsZWN0cyBhIG5vZGUgYnkga2V5IGlmIGl0J3MgaW4gdGhlIGZpbGUgdHJlZTsgb3RoZXJ3aXNlLCBkbyBub3RoaW5nLlxuICAgKi9cbiAgc2VsZWN0Tm9kZUtleShub2RlS2V5OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBpZiAoIXRoaXMuZ2V0Tm9kZUZvcktleShub2RlS2V5KSkge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KCk7XG4gICAgfVxuXG4gICAgLy8gV2UgaGF2ZSB0byBjcmVhdGUgdGhlIGxpc3RlbmVyIGJlZm9yZSBzZXR0aW5nIHRoZSBzdGF0ZSBzbyBpdCBjYW4gcGlja1xuICAgIC8vIHVwIHRoZSBjaGFuZ2VzIGZyb20gYHNldFN0YXRlYC5cbiAgICBjb25zdCBwcm9taXNlID1cbiAgICAgIHRoaXMuX2NyZWF0ZURpZFVwZGF0ZUxpc3RlbmVyKC8qIHNob3VsZFJlc29sdmUgKi8gKCkgPT4gdGhpcy5zdGF0ZS5zZWxlY3RlZEtleXMuaGFzKG5vZGVLZXkpKTtcbiAgICB0aGlzLnNldFN0YXRlKHtzZWxlY3RlZEtleXM6IG5ldyBTZXQoW25vZGVLZXldKX0pO1xuICAgIHJldHVybiBwcm9taXNlO1xuICB9LFxuXG4gIGdldE5vZGVGb3JLZXkobm9kZUtleTogc3RyaW5nKTogP0xhenlUcmVlTm9kZSB7XG4gICAgaWYgKHRoaXMuX2tleVRvTm9kZSAhPSBudWxsKSB7XG4gICAgICByZXR1cm4gdGhpcy5fa2V5VG9Ob2RlW25vZGVLZXldO1xuICAgIH1cbiAgfSxcblxuICAvKipcbiAgICogSWYgdGhpcyBmdW5jdGlvbiBpcyBjYWxsZWQgbXVsdGlwbGUgdGltZXMgaW4gcGFyYWxsZWwsIHRoZSBsYXRlciBjYWxscyB3aWxsXG4gICAqIGNhdXNlIHRoZSBwcmV2aW91cyBwcm9taXNlcyB0byByZWplY3QgZXZlbiBpZiB0aGV5IGVuZCB1cCBleHBhbmRpbmcgdGhlXG4gICAqIG5vZGUga2V5IHN1Y2Nlc3NmdWxseS5cbiAgICpcbiAgICogSWYgd2UgZG9uJ3QgcmVqZWN0LCB0aGVuIHdlIG1pZ2h0IGxlYWsgcHJvbWlzZXMgaWYgYSBub2RlIGtleSBpcyBleHBhbmRlZFxuICAgKiBhbmQgY29sbGFwc2VkIGluIHN1Y2Nlc3Npb24gKHRoZSBjb2xsYXBzZSBjb3VsZCBzdWNjZWVkIGZpcnN0LCBjYXVzaW5nXG4gICAqIHRoZSBleHBhbmQgdG8gbmV2ZXIgcmVzb2x2ZSkuXG4gICAqL1xuICBleHBhbmROb2RlS2V5KG5vZGVLZXk6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IG5vZGUgPSB0aGlzLmdldE5vZGVGb3JLZXkobm9kZUtleSk7XG5cbiAgICBpZiAobm9kZSAmJiBub2RlLmlzQ29udGFpbmVyKCkpIHtcbiAgICAgIGNvbnN0IHByb21pc2UgPSB0aGlzLl9jcmVhdGVEaWRVcGRhdGVMaXN0ZW5lcigvKiBzaG91bGRSZXNvbHZlICovICgpID0+IHtcbiAgICAgICAgY29uc3QgaXNFeHBhbmRlZCA9IHRoaXMuc3RhdGUuZXhwYW5kZWRLZXlzLmhhcyhub2RlS2V5KTtcbiAgICAgICAgY29uc3Qgbm9kZU5vdyA9IHRoaXMuZ2V0Tm9kZUZvcktleShub2RlS2V5KTtcbiAgICAgICAgY29uc3QgaXNEb25lRmV0Y2hpbmcgPSAobm9kZU5vdyAmJiBub2RlTm93LmlzQ29udGFpbmVyKCkgJiYgbm9kZU5vdy5pc0NhY2hlVmFsaWQoKSk7XG4gICAgICAgIHJldHVybiBpc0V4cGFuZGVkICYmIGlzRG9uZUZldGNoaW5nO1xuICAgICAgfSk7XG4gICAgICB0aGlzLl90b2dnbGVOb2RlRXhwYW5kZWQobm9kZSwgdHJ1ZSAvKiBmb3JjZUV4cGFuZGVkICovKTtcbiAgICAgIHJldHVybiBwcm9taXNlO1xuICAgIH1cblxuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgfSxcblxuICBjb2xsYXBzZU5vZGVLZXkobm9kZUtleTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3Qgbm9kZSA9IHRoaXMuZ2V0Tm9kZUZvcktleShub2RlS2V5KTtcblxuICAgIGlmIChub2RlICYmIG5vZGUuaXNDb250YWluZXIoKSkge1xuICAgICAgY29uc3QgcHJvbWlzZSA9IHRoaXMuX2NyZWF0ZURpZFVwZGF0ZUxpc3RlbmVyKFxuICAgICAgICAvKiBzaG91bGRSZXNvbHZlICovICgpID0+ICF0aGlzLnN0YXRlLmV4cGFuZGVkS2V5cy5oYXMobm9kZUtleSlcbiAgICAgICk7XG4gICAgICB0aGlzLl90b2dnbGVOb2RlRXhwYW5kZWQobm9kZSwgZmFsc2UgLyogZm9yY2VFeHBhbmRlZCAqLyk7XG4gICAgICByZXR1cm4gcHJvbWlzZTtcbiAgICB9XG5cbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gIH0sXG5cbiAgaXNOb2RlS2V5RXhwYW5kZWQobm9kZUtleTogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMuc3RhdGUuZXhwYW5kZWRLZXlzLmhhcyhub2RlS2V5KTtcbiAgfSxcblxuICBfY29sbGFwc2VTZWxlY3Rpb24oKTogdm9pZCB7XG4gICAgY29uc3Qga2V5ID0gdGhpcy5fZ2V0Rmlyc3RTZWxlY3RlZEtleSgpO1xuICAgIGlmICgha2V5KSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgZXhwYW5kZWRLZXlzID0gdGhpcy5zdGF0ZS5leHBhbmRlZEtleXM7XG4gICAgY29uc3Qgbm9kZSA9IHRoaXMuZ2V0Tm9kZUZvcktleShrZXkpO1xuICAgIGlmICgobm9kZSAhPSBudWxsKSAmJiAoIWV4cGFuZGVkS2V5cy5oYXMoa2V5KSB8fCAhbm9kZS5pc0NvbnRhaW5lcigpKSkge1xuICAgICAgLy8gSWYgdGhlIHNlbGVjdGlvbiBpcyBhbHJlYWR5IGNvbGxhcHNlZCBvciBpdCdzIG5vdCBhIGNvbnRhaW5lciwgc2VsZWN0IGl0cyBwYXJlbnQuXG4gICAgICBjb25zdCBwYXJlbnQgPSBub2RlLmdldFBhcmVudCgpO1xuICAgICAgaWYgKHBhcmVudCkge1xuICAgICAgICB0aGlzLnNlbGVjdE5vZGVLZXkocGFyZW50LmdldEtleSgpKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLmNvbGxhcHNlTm9kZUtleShrZXkpO1xuICB9LFxuXG4gIF9tb3ZlU2VsZWN0aW9uVXAoKTogdm9pZCB7XG4gICAgY29uc3QgYWxsS2V5cyA9IHRoaXMuX2FsbEtleXM7XG4gICAgaWYgKCFhbGxLZXlzKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgbGV0IGtleUluZGV4VG9TZWxlY3QgPSBhbGxLZXlzLmxlbmd0aCAtIDE7XG4gICAgY29uc3Qga2V5ID0gdGhpcy5fZ2V0Rmlyc3RTZWxlY3RlZEtleSgpO1xuICAgIGlmIChrZXkpIHtcbiAgICAgIGtleUluZGV4VG9TZWxlY3QgPSBhbGxLZXlzLmluZGV4T2Yoa2V5KTtcbiAgICAgIGlmIChrZXlJbmRleFRvU2VsZWN0ID4gMCkge1xuICAgICAgICAtLWtleUluZGV4VG9TZWxlY3Q7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5zZXRTdGF0ZSh7c2VsZWN0ZWRLZXlzOiBuZXcgU2V0KFthbGxLZXlzW2tleUluZGV4VG9TZWxlY3RdXSl9KTtcbiAgfSxcblxuICBfbW92ZVNlbGVjdGlvbkRvd24oKTogdm9pZCB7XG4gICAgY29uc3QgYWxsS2V5cyA9IHRoaXMuX2FsbEtleXM7XG4gICAgaWYgKCFhbGxLZXlzKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgbGV0IGtleUluZGV4VG9TZWxlY3QgPSAwO1xuICAgIGNvbnN0IGtleSA9IHRoaXMuX2dldEZpcnN0U2VsZWN0ZWRLZXkoKTtcbiAgICBpZiAoa2V5KSB7XG4gICAgICBrZXlJbmRleFRvU2VsZWN0ID0gYWxsS2V5cy5pbmRleE9mKGtleSk7XG4gICAgICBpZiAoa2V5SW5kZXhUb1NlbGVjdCAhPT0gLTEgJiYga2V5SW5kZXhUb1NlbGVjdCA8IGFsbEtleXMubGVuZ3RoIC0gMSkge1xuICAgICAgICArK2tleUluZGV4VG9TZWxlY3Q7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5zZXRTdGF0ZSh7c2VsZWN0ZWRLZXlzOiBuZXcgU2V0KFthbGxLZXlzW2tleUluZGV4VG9TZWxlY3RdXSl9KTtcbiAgfSxcblxuICBfY29uZmlybVNlbGVjdGlvbigpOiB2b2lkIHtcbiAgICBjb25zdCBrZXkgPSB0aGlzLl9nZXRGaXJzdFNlbGVjdGVkS2V5KCk7XG4gICAgaWYgKGtleSkge1xuICAgICAgY29uc3Qgbm9kZSA9IHRoaXMuZ2V0Tm9kZUZvcktleShrZXkpO1xuICAgICAgaWYgKG5vZGUpIHtcbiAgICAgICAgdGhpcy5fY29uZmlybU5vZGUobm9kZSk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuXG4gIF9jb25maXJtTm9kZShub2RlOiBMYXp5VHJlZU5vZGUpOiB2b2lkIHtcbiAgICBpZiAobm9kZS5pc0NvbnRhaW5lcigpKSB7XG4gICAgICB0aGlzLl90b2dnbGVOb2RlRXhwYW5kZWQobm9kZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMucHJvcHMub25Db25maXJtU2VsZWN0aW9uKG5vZGUpO1xuICAgIH1cbiAgfSxcbn0pO1xuIl19