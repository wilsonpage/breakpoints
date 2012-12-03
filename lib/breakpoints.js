
(function() {
    'use strict';

    // Create a namespace and attach it to the root/window object.
    var root = this;
    var Breakpoints = root['Breakpoints'] = {};

    // Current Version
    Breakpoints.VERSION = '0.0.1';

    /**
     * UTILITIES
     *
     * Some private utils.
     *
     * @api {private}
     * @type {Object}
     */

    var util = {

        debounce: function(ms, func) {
            var timer;
            return function() {
                clearTimeout(timer);
                timer = setTimeout(func, ms);
            };
        },

        extend: function(original) {

            // Loop over every argument after the first.
            slice.call(arguments, 1).forEach(function(source) {
                for (var prop in source) {
                    original[prop] = source[prop];
                }
            });

            return original;
        },

        includes: function(array, item) {
            return array.indexOf(item) > -1;
        }
    };

    /**
     * SETTINGS
     *
     * You can override these if you widh.
     *
     * @api {public}
     */

    var SETTINGS = Breakpoints.SETTINGS = {
        debounce: 50
    };

    // Create short local references to some native methods.
    var slice = Array.prototype.slice;
    var splice = Array.prototype.splice;

    /**
     * A space splitter use by the events library.
     *
     * @type {RegExp}
     */

    var eventSplitter = /\s+/;

    /**
     * EVENTS
     *
     * The trustworthy, lightweight event library 'borrowed' from Backbone :)
     *
     * @type {Object}
     */

    var Events = {

        // Bind one or more space separated events, `events`, to a `callback`
        // function. Passing `"all"` will bind the callback to all events fired.
        on: function(events, callback, context) {

            var calls, event, node, tail, list;
            if (!callback) return this;
            events = events.split(eventSplitter);
            calls = this._callbacks || (this._callbacks = {});

            // Create an immutable callback list, allowing traversal during
            // modification.  The tail is an empty object that will always be used
            // as the next node.
            while (event = events.shift()) {
                list = calls[event];
                node = list ? list.tail : {};
                node.next = tail = {};
                node.context = context;
                node.callback = callback;
                calls[event] = {tail: tail, next: list ? list.next : node};
            }

            return this;
        },

        // Remove one or many callbacks. If `context` is null, removes all callbacks
        // with that function. If `callback` is null, removes all callbacks for the
        // event. If `events` is null, removes all bound callbacks for all events.
        off: function(events, callback, context) {
            var event, calls, node, tail, cb, ctx;

            // No events, or removing *all* events.
            if (!(calls = this._callbacks)) return;
            if (!(events || callback || context)) {
                delete this._callbacks;
                return this;
            }

            // Loop through the listed events and contexts, splicing them out of the
            // linked list of callbacks if appropriate.
            events = events ? events.split(eventSplitter) : Object.keys(calls);
            while (event = events.shift()) {
                node = calls[event];
                delete calls[event];
                if (!node || !(callback || context)) continue;
                // Create a new list, omitting the indicated callbacks.
                tail = node.tail;
                while ((node = node.next) !== tail) {
                    cb = node.callback;
                    ctx = node.context;
                    if ((callback && cb !== callback) || (context && ctx !== context)) {
                        this.on(event, cb, ctx);
                    }
                }
            }

            return this;
        },

        // Trigger one or many events, firing all bound callbacks. Callbacks are
        // passed the same arguments as `trigger` is, apart from the event name
        // (unless you're listening on `"all"`, which will cause your callback to
        // receive the true name of the event as the first argument).
        trigger: function(events) {
            var event, node, calls, tail, args, all, rest;
            if (!(calls = this._callbacks)) return this;
            all = calls.all;
            events = events.split(eventSplitter);
            rest = slice.call(arguments, 1);

            // For each event, walk through the linked list of callbacks twice,
            // first to trigger the event, then to trigger any `"all"` callbacks.
            while (event = events.shift()) {
                if (node = calls[event]) {
                    tail = node.tail;
                    while ((node = node.next) !== tail) {
                        node.callback.apply(node.context || this, rest);
                    }
                }
                if (node = all) {
                    tail = node.tail;
                    args = [event].concat(rest);
                    while ((node = node.next) !== tail) {
                        node.callback.apply(node.context || this, args);
                    }
                }
            }

            return this;
        }
    };

    /**
     * Listener
     *
     * Creates a new breakpoint listener that fires a 'change' event
     * when the breakpoint changes.
     *
     * NOTE:
     * The breakpoints passed must be in *accending* order.
     *
     * EXAMPLE:
     *   var breakpoints = {
     *       smallscreen: 400,
     *       mediumscreen: 800,
     *       largescreen: 1024,
     *       gutterview: 9999
     *   };
     *
     *   var listener = new Breakpoints.Listener(breakpoints);
     *
     *   listener.on('change', function(breakpoint) {
     *       // Do stuff
     *   });
     *
     * @constructor
     * @param {Object} breakpoints
     */

    var Listener = Breakpoints.Listener = function(breakpoints) {
        var self = this;

        // Store the breakpoints object on the instance.
        this.breakpoints = breakpoints;

        // Get the current breakpoint that we're in.
        this.current = this.getBreakpoint(window.innerWidth);

        // Create a debounced version of the onWindoResize method, ensuring that the context
        // is preserved without having to use poorly supported Function.prototype.bind().
        this.onWindowResizeDebounced = util.debounce(SETTINGS.debounce, function() {
            self.onWindowResize();
        });

        // Bind to the window resize event with our debounced function
        window.addEventListener('resize', this.onWindowResizeDebounced);

        // A handy shortcut to the Relay constructor.
        this.Relay = function(config) { return new Relay(self, config); };
    };

    // Merge the events manager into the breakpoint prototype
    // along with our protoype methods.
    util.extend(Listener.prototype, Events, {

        /**
         * Returns the first breakpoint in the breakpoints
         * object that is less than the width passed.
         *
         * @param  {Number} width
         * @return {String}
         */

        getBreakpoint: function(width) {
            for (var name in this.breakpoints) {
                if (width < this.breakpoints[name]) {
                    return name;
                }
            }
        },

        /**
         * Fires a change event passing the current and previous breakpoints
         * when a new breakpoint is entered.
         *
         * We gets the first breakpoint that is less than the window width. If
         * this breakpoint is not the current breakpoint then it must have changed.
         *
         * @param  {Event} event
         * @return void
         *
         */

        onWindowResize: function(event) {
            var breakpoint = this.getBreakpoint(window.innerWidth);

            if (breakpoint !== this.current) {
                this.previous = this.current;
                this.current = breakpoint;
                this.trigger('change', this.current, this.previous);
            }
        },

        /**
         * Removes event listeners and unsets variables.
         *
         * @return void
         */

        destroy: function() {
            window.removeEventListener('resize', this.onWindowResizeDebounced);
            this.current = null;
            this.previous = null;
        }
    });

    /**
     * RELAY
     *
     * A relay can be created from a Listener instance to fire callbacks
     * when sepcific breakpoint regions are entered and left.
     *
     * Note:
     * A callback can either be a function or an object with an 'enter'
     * and 'leave' callback function.
     *
     * Example:
     *   var relay = new listener.Relay({
     *     'small': {
     *        enter: function() { ... },
     *        leave: function() { ... }
     *     },
     *     'medium': function() { ... },
     *     'large': function() { ... }
     *   });
     *
     * @constructor
     * @param {Breakpoint.Listener} listener
     * @param {Object} config   { 'small medium': callback, ... }
     */

    var Relay = Breakpoints.Relay = function(listener, config) {
        this.listener = listener;
        this.list = this._createList(config);
        this.listener.on('change', this._onBreakpointChange, this);
    };

    // Extend the prototype
    util.extend(Relay.prototype, {

        /**
         * Sets up a list we can use from the breakpoints passed in.
         *
         * This normalised callback syntax and splits breakpoint names
         * into an array.
         *
         * @api {private}
         * @param  {Object} config
         * @return {Object}
         */

        _createList: function(config) {
            var list = [], callbacks;

            for (var breakpoints in config) {
                callbacks = config[breakpoints];
                callbacks = (typeof callbacks === 'function') ? { enter: callbacks } : callbacks;

                list.push({
                    breakpoints: breakpoints.split(' '),
                    callbacks: callbacks
                });
            }

            return list;
        },

        /**
         * Runs when a the Listener's 'change' event fires. It checks
         * if we have entered/left a breakpoint region and fires callbacks
         * accordingly.
         *
         * @api {private}
         * @param  {String} current  [description]
         * @param  {String} previous [description]
         * @return void
         */

        _onBreakpointChange: function(current, previous) {

            // Loop over each of the breakpoint regions.
            this.list.forEach(function(item) {
                var breakpoints = item.breakpoints;

                // If the current breakpoint name is in the list but the previous one isn't
                // we can assume a new region has been entered, so let's fire the callback.
                if (util.includes(breakpoints, current) && !util.includes(breakpoints, previous)) {
                    item.callbacks.enter();
                }

                if (!util.includes(breakpoints, current) && util.includes(breakpoints, previous)) {
                    if (item.callbacks.leave) item.callbacks.leave();
                }
            });
        },

        /**
         * Unbinds event listeners and unsets variables.
         *
         * @api {public}
         * @return void
         */

        destroy: function() {
            this.listener.off('change', this._onBreakpointChange, this);
            this.listener = null;
            this.list = null;
        }
    });
}).call(this);