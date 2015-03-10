/**
 * jQuery Typeahead
 * Copyright (C) 2015 RunningCoder.org
 * Licensed under the MIT license
 *
 * @author Tom Bertrand
 * @version 2.0 (2015-xx-xx)
 * @link http://www.runningcoder.org/jquerytypeahead/
 *
 * @note
 * Remove debug code: //\s?\{debug\}[\s\S]*?\{/debug\}
 */
;
(function (window, document, $, undefined) {

    window.Typeahead = {};

    "use strict";

    /**
     * @private
     * Default options
     *
     * @link http://www.runningcoder.org/jquerytypeahead/documentation/
     */
    var _options = {
        input: null,
        minLength: 2,
        maxItem: 8,
        dynamic: false,
        delay: 300,
        order: null,
        offset: false,
        hint: false,
        accent: false,
        highlight: true,
        list: false,
        group: false,
        maxItemPerGroup: null,  // -> Renamed option
        dropdownFilter: false,  // -> Renamed option
        dynamicFilter: null,    // -> New feature, filter the typeahead results based on dynamic value, Ex: Players based on TeamID
        backdrop: false,
        cache: false,
        ttl: 3600000,
        compression: false,
        suggestion: false,      // -> New feature, save last searches and display suggestion on matched characters
        updates: null,          // -> New feature, results are sent to a specific ID, Ex: Search inside table filters the rows
        selector: {
            container: "typeahead-container",
            group: "typeahead-group",
            result: "typeahead-result",
            list: "typeahead-list",
            display: "typeahead-display",
            query: "typeahead-query",
            filter: "typeahead-filter",
            filterButton: "typeahead-filter-button",
            filterValue: "typeahead-filter-value",
            dropdown: "typeahead-dropdown",
            button: "typeahead-button",
            backdrop: "typeahead-backdrop",
            hint: "typeahead-hint"
        },
        display: "display",     // -> New feature, allows search in multiple item keys ["display1", "display2"]
        template: null,
        source: null,           // -> Modified feature, source.ignore is now a regex; item.group is a reserved word; Ajax callbacks: onDone, onFail, onComplete
        callback: {
            onInit: null,
            onSearch: null,     // -> New callback, when data is being fetched & analyzed to give search results
            onResult: null,
            onNavigate: null,   // -> New callback, when a key is pressed to navigate the results
            onMouseEnter: null,
            onMouseLeave: null,
            onClick: null,
            onSubmit: null
        },
        debug: false
    };

    /**
     * @private
     * Event namespace
     */
    var _namespace = ".typeahead.input";

    /**
     * @private
     * Accent equivalents
     */
    var _accent = {
        from: "ãàáäâẽèéëêìíïîõòóöôùúüûñç",
        to: "aaaaaeeeeeiiiiooooouuuunc"
    };


    // delegateTypeahead
    // search
    // buildHtml
    // move
    // reset
    // generate
    // delegateDropdown
    // populate
    // _populateSource
    // _populateStorage
    // _request
    // _increment
    // _validateHtml
    // _typeWatch
    // _jsonp


    /**
     * @constructor
     * Typeahead Class
     *
     * @param {object} node jQuery input object
     * @param {object} options User defined options
     */
    var Typeahead = function (node, options) {

        //var scope = this;

        this.query = '';                // Input query
        this.source = {};               // The generated source kept in memory
        this.isGenerated = null;        // Generated results -> null: not generated, false: generating, true generated
        this.generatedGroupCount = 0;   // Number of groups generated, if limit reached the search can be done
        this.groupCount = 0;            // Number of groups generated, if limit reached the search can be done
        this.result = [];               // Results based on Source-query match (only contains the displayed elements)
        this.resultCount = 0;           // Total results based on Source-query match
        this.options = options;         // Typeahead options (Merged default & user defined)
        this.node = node;               // jQuery object of the Typeahead <input>
        this.container = null;          // Typeahead container, usually right after <form>
        this.item = null;               // The selected item
        this.dropdownFilter = null;     // The selected dropdown filter (if any)
        this.xhr = {};                  // Ajax request(s) stack

        // When a search is requested, a timestamp is unshift into the stack.
        // When the search is completed, only the results from the latest request will be displayed.
//        this.ressourceStack = [];
        //this.ressourceId = null;

        this.__construct();

    };

    Typeahead.prototype = {

        extendOptions: function () {

            // If the Typeahead is dynamic, force no cache & no compression
            if (this.options.dynamic) {
                this.options.cache = false;
                this.options.compression = false;
            }

            // Ensure Localstorage is available
            if (this.options.cache) {
                this.options.cache = (function () {
                    var supported = typeof window.localStorage !== "undefined";
                    if (supported) {
                        try {
                            window.localStorage.setItem("typeahead", "typeahead");
                            window.localStorage.removeItem("typeahead");
                        } catch (e) {
                            supported = false;
                        }
                    }
                    return supported;
                })();
            }

            if (!/^\d+$/.test(this.options.maxItemPerGroup)) {
                this.options.maxItemPerGroup = null;
            }

            this.options = $.extend(
                true,
                {},
                _options,
                this.options
            );

            if (!(this.options.display instanceof Array)) {
                this.options.display = [this.options.display];
            }

        },

        unifySourceFormat: function () {

            if (this.options.source instanceof Array) {
                this.options.source = {
                    group: {
                        data: this.options.source
                    }
                };

                this.groupCount += 1;
                return true;
            }

            if (typeof this.options.source.data !== 'undefined' || typeof this.options.source.url !== 'undefined') {
                this.options.source = {
                    group: this.options.source
                };

                this.groupCount += 1;
                return true;
            }

            for (var group in this.options.source) {
                if (!this.options.source.hasOwnProperty(group)) continue;

                if (!this.options.source[group].data && !this.options.source[group].url) {

                    // {debug}
                    _debug.log({
                        'node': this.node.selector,
                        'function': 'unifySourceFormat()',
                        'arguments': JSON.stringify(this.options.source),
                        'message': 'Undefined "options.source.' + group + '.[data|url]" is Missing - Typeahead dropped'
                    });

                    _debug.print();
                    // {/debug}

                    return false;
                }

                if (this.options.source[group].display) {
                    if (!(this.options.source[group].display instanceof Array)) {
                        this.options.source[group].display = [this.options.source[group].display];
                    }
                }

                if (this.options.source[group].ignore) {
                    if (!(this.options.source[group].ignore instanceof RegExp)) {

                        // {debug}
                        _debug.log({
                            'node': this.node.selector,
                            'function': 'unifySourceFormat()',
                            'arguments': JSON.stringify(this.options.source[group].ignore),
                            'message': 'Invalid ignore RegExp.'
                        });

                        _debug.print();
                        // {/debug}

                        delete this.options.source[group].ignore;
                    }
                }

                this.groupCount += 1;
            }

            return true;
        },

        init: function () {

            this.helper.executeCallback(this.options.callback.onInit, [this.node]);

            this.container = this.node.closest('.' + this.options.selector.container);

            // {debug}
            _debug.log({
                'node': this.node.selector,
                'function': 'init()',
                'arguments': JSON.stringify(this.options),
                'message': 'OK - Typeahead activated on ' + this.node.selector
            });

            _debug.print();
            // {/debug}

        },

        delegateEvents: function () {

            var scope = this,
                events = [
                    'focus' + _namespace,
                    'input' + _namespace,
                    'propertychange' + _namespace,
                    'keydown' + _namespace,
                    'dynamic' + _namespace
                ];

            $('html').on("click" + _namespace, function () {
                this.resetLayout();
            });

            this.container.on("click" + _namespace, function (e) {
                e.stopPropagation();
            });

            this.node.closest('form').on("submit", function (e) {

                scope.resetLayout();

                if (scope.helper.executeCallback(scope.options.callback.onSubmit, [scope.node, scope, scope.item, e])) {
                    return false;
                }
            });

            this.node.off(_namespace).on(events.join(' '), function (e) {

                switch (e.type) {
                    case "focus":
                        if (scope.isGenerated === null && !scope.options.dynamic) {
                            scope.generateSource();
                        }
                        break;
                    case "keydown":
                        if (scope.isGenerated && scope.result.length) {
                            if (e.keyCode && ~[9, 13, 27, 38, 39, 40].indexOf(e.keyCode)) {
                                this.navigate(e);
                            }
                        }
                        console.log('event -> keydown')
                        break;
                    case "propertychange":
                    case "input":

                        console.log('event -> propertychange:input')

                        scope.query = scope.node[0].value.trim();

                        if (/*!scope.isGenerated && */scope.options.dynamic) {
                            scope.isGenerated = null;
                            scope.helper.typeWatch(function () {
                                if (scope.query.length >= scope.options.minLength && scope.query !== "") {
                                    scope.generateSource();
                                }
                            }, scope.options.delay);
                            return;
                        }

                    case "dynamic":

                        console.log('dynamic triggered?? :D')

                        scope.resetLayout();
                        if (scope.query.length < scope.options.minLength || scope.query === "") {
                            break;
                        }

                        scope.searchResult();
                        scope.buildLayout();

                        //if (scope.options.dynamic) {
                        //if (scope.query.length >= scope.options.minLength && scope.query !== "") {
                        //    scope.generateSource();
                        //}
                        //} else {
                        //}

                        break;
                    default:
                        break;
                }

            });

        },

        generateSource: function () {

            console.log('-> generate source')

            if (this.isGenerated && !this.options.dynamic) {
                return;
            }

            this.generatedGroupCount = 0;
            this.isGenerated = false;

            // Clear previous request(s)
            if (!this.helper.isEmpty(this.xhr)) {
                for (var i in this.xhr) {
                    this.xhr[i].abort();
                }
                this.xhr = {};
            }

            //this.source = {};


            var group,
                dataInLocalstorage;

            for (group in this.options.source) {
                if (!this.options.source.hasOwnProperty(group)) continue;

                // Get group source from Localstorage
                if (this.options.cache) {
                    dataInLocalstorage = window.localStorage.getItem(this.node.selector + ":" + group);
                    if (dataInLocalstorage) {
                        if (this.options.compression) {
                            dataInLocalstorage = this.helper.lzw_decode(dataInLocalstorage);
                        }
                        // Regenerate on expired storage
                        if (dataInLocalstorage.data && dataInLocalstorage.ttl > new Date().getTime()) {

                            this.populateSource(dataInLocalstorage.data, group)
                            continue;
                        }
                    }
                }

                // Get group source from data
                if (this.options.source[group].data && !this.options.source[group].url) {

                    this.populateSource(this.options.source[group].data, group);
                    continue;
                }

                // Get group source from Ajax
                if (this.options.source[group].url) {

                    var settingsTpl = {
                            url: null,
                            path: null,
                            dataType: 'json',
                            group: group,
                            scope: this,
                            callback: {
                                onDone: null,
                                onFail: null,
                                onComplete: null
                            }
                        },
                        settings = $.extend(true, {}, settingsTpl);

                    // Settings compatibility
                    if (this.options.source[group].url instanceof Array) {
                        if (this.options.source[group].url[0] instanceof Object) {
                            settings = $.extend(true, settings, this.options.source[group].url[0]);
                        } else if (typeof this.options.source[group].url[0] === "string") {
                            settings.url = this.options.source[group].url[0];
                        }
                        if (this.options.source[group].url[1]) {
                            settings.path = this.options.source[group].url[1];
                        }
                    } else if (this.options.source[group].url instanceof Object) {
                        settings = $.extend(true, settings, this.options.source[group].url);
                    } else if (typeof this.options.source[group].url === "string") {
                        settings.url = this.options.source[group].url;
                    }

                    if (settings.data) {
                        for (var i in settings.data) {
                            if (!settings.data.hasOwnProperty(i)) continue;
                            if (~settings.data[i].indexOf('{{query}}')) {
                                settings.data[i] = settings.data[i].replace('{{query}}', this.query);
                            }
                        }
                    }

                    this.xhr[group] = $.ajax(settings).done(function (data) {

                        this.callback.onDone instanceof Function && this.callback.onDone(data);

                        this.scope.populateSource(data, this.group, this.path);

                    }).fail(function () {

                        this.callback.onFail instanceof Function && this.callback.onFail();

                        // {debug}
                        _debug.log({
                            'node': this.scope.node.selector,
                            'function': 'generateSource()',
                            //'arguments': JSON.stringify(this.options.source),
                            'message': 'Ajax request failed.'
                        });

                        _debug.print();
                        // {/debug}

                    }).complete(function () {

                        this.callback.onComplete instanceof Function && this.callback.onComplete();

                    });

                }

                // Get group source from Jsonp

            }

            // Validate the item.display (key)
            // _display = storage[group][i].display.toString(); -> in case its a number (addresses)

        },

        /**
         * Build the source groups to be cycled for matched results
         *
         * @param {Array} data Array of Strings or Array of Objects
         * @param {String} group
         * @param {String} [path]
         */
        populateSource: function (data, group, path) {

            var isValid = true;

            if (typeof path === "string") {
                var exploded = path.split('.'),
                    splitIndex = 0;

                while (splitIndex < exploded.length) {
                    if (typeof data !== 'undefined') {
                        data = data[exploded[splitIndex++]];
                    } else {
                        isValid = false;
                        break;
                    }
                }
            }

            if (!(data instanceof Array)) {
                // {debug}
                _debug.log({
                    'node': this.node.selector,
                    'function': 'populateSource()',
                    'arguments': JSON.stringify({group: group}),
                    'message': 'Invalid data type, must be Array type.'
                });

                _debug.print();
                // {/debug}

                return false;
            }

            if (isValid) {

                if (this.options.source[group].data && this.options.source[group].url) {
                    data = data.concat(this.options.source[group].data);
                }

                if (typeof data[0] === "string") {
                    var tmpObj;
                    for (var i = 0; i < data.length; i++) {
                        tmpObj = {};
                        tmpObj[this.options.source[group].display && this.options.source[group].display[0] || this.options.display[0]] = data[i];
                        data[i] = tmpObj;
                    }
                }

                this.source[group] = data;

                if (this.options.cache) {
                    var storage = {
                        data: JSON.stringify(data),
                        ttl: new Date().getTime() + this.options.ttl
                    };

                    if (this.options.compression) {
                        storage.data = this.lzw_encode(storage.data);
                    }

                    localStorage.setItem(
                        this.node.selector + ":" + group,
                        storage
                    );
                }

                this.incrementGeneratedGroup();

            } else {
                // {debug}
                _debug.log({
                    'node': this.node.selector,
                    'function': 'populateSource()',
                    'arguments': JSON.stringify(path),
                    'message': 'Invalid path.'
                });

                _debug.print();
                // {/debug}
            }

        },

        incrementGeneratedGroup: function () {

            this.generatedGroupCount += 1;

            console.log('==================================')
            console.log('group count: ' + this.groupCount)
            console.log('generated count: ' + this.generatedGroupCount)
            console.log('==================================')

            if (this.groupCount !== this.generatedGroupCount) {
                return;
            }

            this.isGenerated = true;

            console.log('-> Generated! ready to search !!')
            console.log('-> this.source')
            console.log(this.query)
            console.log(this.source)


            if (this.options.dynamic) {
                this.node.trigger('dynamic.typeahead.input');
//                this.generatedGroupCount = 0;
            }


        },

        /**
         * Key Navigation
         * Up 38: select previous item, skip "group" item
         * Down 40: select next item, skip "group" item
         * Right 39: change charAt, if last char fill hint (if options is true)
         * Tab 9: select item
         * Esc 27: resetLayout
         * Enter 13: submit search
         *
         * @param {Object} e Event object
         * @returns {boolean}
         */
        navigate: function (e) {

            this.helper.executeCallback(this.options.callback.onNavigate, [this.node, this.query, e]);

            // navigate options
            console.log('Navigate ->')

        },

        // @TODO implement dropdownFilter
        // @TODO implement dynamicFilter
        searchResult: function () {

            console.log('SearchResult ->')
            // Make sure the search is made for the latest query
//            if (this.query !== this.ressourceStack[0]) {
//                return;
//            }

            this.helper.executeCallback(this.options.callback.onSearch, [this.node, this.query]);

            this.result = [];
            this.resultCount = 0;
            this.item = null;

            var scope = this,
                group,
                item,
                match,
                comparedDisplay,
                comparedQuery = this.query,
                itemPerGroupCount = 0,
                displayKey,
                missingDisplayKey = {};

            if (this.options.accent) {
                comparedQuery = this.helper.removeAccent(comparedQuery);
            }

            for (group in this.source) {
                if (!this.source.hasOwnProperty(group)) continue;

                if (this.dropdownFilter && group !== this.dropdownFilter) continue;

                itemPerGroupCount = 0;

                for (item in this.source[group]) {
                    if (!this.source[group].hasOwnProperty(item)) continue;
                    if (this.result.length >= this.options.maxItem) break;
                    if (this.options.maxItemPerGroup && itemPerGroupCount >= this.options.maxItemPerGroup) break;

                    displayKey = this.options.source[group].display || this.options.display;

                    for (var i = 0; i < displayKey.length; i++) {

                        comparedDisplay = this.source[group][item][displayKey[i]];

                        if (!comparedDisplay) {
                            missingDisplayKey[i] = {
                                display: displayKey[i],
                                data: this.source[group][item]
                            };
                            continue;
                        }

                        comparedDisplay = comparedDisplay.toString();

                        if (this.options.accent) {
                            comparedDisplay = this.helper.removeAccent(comparedDisplay);
                        }

                        match = comparedDisplay.toLowerCase().indexOf(comparedQuery.toLowerCase()) + 1;

                        if (!match) continue;
                        if (match && this.options.offset && match !== 1) continue;
                        if (this.options.source[group].ignore && this.options.source[group].ignore.test(comparedDisplay)) continue;

                        this.resultCount += 1;

                        this.source[group][item].group = group;
                        this.result.push(this.source[group][item]);

                        itemPerGroupCount += 1;

                        break;
                    }
                }
            }

            // {debug}
            if (!this.helper.isEmpty(missingDisplayKey)) {
                _debug.log({
                    'node': this.node.selector,
                    'function': 'searchResult()',
                    'arguments': JSON.stringify(missingDisplayKey),
                    'message': 'Missing keys for display.'
                });

                _debug.print();
            }
            // {/debug}


            // @TODO Modify the hardcoded 'project' key
            if (this.options.order) {
                this.result.sort(
                    scope.helper.sort(
                        scope.options.display.concat(['project']),
                        scope.options.order === "asc",
                        function (a) {
                            return a.toString().toUpperCase()
                        }
                    )
                );
            }

            if (this.options.group) {
                // Reorder the items by group
                var reorderResult = [];
                for (group in this.source) {
                    for (item in this.result) {
                        if (this.result[item].group === group) {
                            reorderResult.push(this.result[item]);
                        }
                    }
                }
                this.result = reorderResult;
            }

            this.helper.executeCallback(this.options.callback.onResult, [this.node, this.query, this.result, this.resultCount]);

            console.log('-> Results')
            console.log(this.result)

        },

//        buildResultLayout: function () {
//
//            console.log('BuildResultLayout ->')
//
//        },
//
//        resetResultLayout: function () {
//
//            console.log('ResetResultLayout ->')
//
//        },

        buildLayout: function () {

            // Only build the result for the latest search
//            if (this.ressourceId !== this.ressourceStack[0]) {
//                return;
//            }
//            this.ressourceStack = [];
//            this.ressourceId = null;

            console.log('BuildLayout ->')

        },

        resetLayout: function () {

            //this.resetResultLayout();

            console.log('ResetLayout ->')

        },

        __construct: function () {
            this.extendOptions();

            if (!this.unifySourceFormat()) {
                return false;
            }

            this.init();
            this.delegateEvents();
        },

        helper: {

            isEmpty: function (obj) {
                for (var prop in obj) {
                    if (obj.hasOwnProperty(prop))
                        return false;
                }

                return true;
            },

            /**
             * Remove every accent(s) from a string
             *
             * @param {String} string
             * @returns {*}
             */
            removeAccent: function (string) {

                if (!string || typeof string !== "string") {
                    return;
                }

                string = string.toLowerCase();

                for (var i = 0, l = _accent.from.length; i < l; i++) {
                    string = string.replace(new RegExp(_accent.from.charAt(i), 'g'), _accent.to.charAt(i));
                }

                return string;
            },

            /**
             * Sort list of object by key
             *
             * @param {String|Array} field
             * @param {Boolean} reverse
             * @param {Function} primer
             * @returns {Function}
             */
            sort: function (field, reverse, primer) {

                if (!(field instanceof Array)) {
                    field = [field];
                }

                var key = primer ?
                    function (x) {
                        for (var i = 0; i < field.length; i++) {
                            if (typeof x[field[i]] !== 'undefined') {
                                return primer(x[field[i]])
                            }
                        }
                    } :
                    function (x) {
                        for (var i = 0; i < field.length; i++) {
                            if (typeof x[field[i]] !== 'undefined') {
                                return x[field[i]]
                            }
                        }
                    };

                reverse = [-1, 1][+!!reverse];

                return function (a, b) {
                    return a = key(a), b = key(b), reverse * ((a > b) - (b > a));
                }
            },

            /**
             * Replace a string from-to index
             *
             * @param {String} string The complete string to replace into
             * @param {Number} offset The cursor position to start replacing from
             * @param {Number} length The length of the replacing string
             * @param {String} replace The replacing string
             * @returns {String}
             */
            replaceAt: function (string, offset, length, replace) {
                return string.substring(0, offset) + replace + string.substring(offset + length);
            },

            /**
             * Adds <strong> html around a matched string
             *
             * @param {String} string The complete string to match from
             * @param {String} key
             * @returns {*}
             */
            highlight: function (string, key) {
                var offset = string.toLowerCase().indexOf(key.toLowerCase());

                if (offset === -1) {
                    return string;
                }

                return this.helper.replaceAt(
                    string,
                    offset,
                    key.length,
                    "<strong>" + string.substr(offset, key.length) + "</strong>"
                );
            },

            /**
             * Executes an anonymous function or a string reached from the window scope.
             *
             * @example
             * Note: These examples works with every configuration callbacks
             *
             * // An anonymous function inside the "onInit" option
             * onInit: function() { console.log(':D'); };
             *
             * // myFunction() located on window.coucou scope
             * onInit: 'window.coucou.myFunction'
             *
             * // myFunction(a,b) located on window.coucou scope passing 2 parameters
             * onInit: ['window.coucou.myFunction', [':D', ':)']];
             *
             * // Anonymous function to execute a local function
             * onInit: function () { myFunction(':D'); }
             *
             * @param {String|Array} callback The function to be called
             * @param {Array} [extraParams] In some cases the function can be called with Extra parameters (onError)
             * @returns {Boolean}
             */
            executeCallback: function (callback, extraParams) {

                if (!callback) {
                    return false;
                }

                var _callback,
                    _node = extraParams[0];

                if (typeof callback === "function") {

                    _callback = callback;

                } else if (typeof callback === "string" || callback instanceof Array) {

                    _callback = window;

                    if (typeof callback === "string") {
                        callback = [callback, []];
                    }

                    var _exploded = callback[0].split('.'),
                        _params = callback[1],
                        _isValid = true,
                        _splitIndex = 0;

                    while (_splitIndex < _exploded.length) {
                        if (typeof _callback !== 'undefined') {
                            _callback = _callback[_exploded[_splitIndex++]];
                        } else {
                            _isValid = false;
                            break;
                        }
                    }

                    if (!_isValid || typeof _callback !== "function") {

                        // {debug}
                        _debug.log({
                            'node': _node.selector,
                            'function': 'executeCallback()',
                            'arguments': JSON.stringify(callback),
                            'message': 'WARNING - Invalid callback function"'
                        });

                        _debug.print();
                        // {/debug}

                        return false;
                    }

                }

                _callback.apply(this, $.merge(_params || [], (extraParams) ? extraParams : []));
                return true;

            },

            /**
             * Gzip encode string
             *
             * @param {String} s
             * @returns {String}
             */
            lzw_encode: function (s) {
                var dict = {},
                    data = (s + "").split(""),
                    out = [],
                    currChar,
                    phrase = data[0],
                    code = 256;
                for (var i = 1; i < data.length; i++) {
                    currChar = data[i];
                    if (dict[phrase + currChar] != null) {
                        phrase += currChar;
                    }
                    else {
                        out.push(phrase.length > 1 ? dict[phrase] : phrase.charCodeAt(0));
                        dict[phrase + currChar] = code;
                        code++;
                        phrase = currChar;
                    }
                }
                out.push(phrase.length > 1 ? dict[phrase] : phrase.charCodeAt(0));
                for (var i = 0; i < out.length; i++) {
                    out[i] = String.fromCharCode(out[i]);
                }
                return out.join("");
            },

            /**
             * Gzip decode string
             *
             * @param {String} s
             * @returns {String}
             */
            lzw_decode: function (s) {
                var dict = {},
                    data = (s + "").split(""),
                    currChar = data[0],
                    oldPhrase = currChar,
                    out = [currChar],
                    code = 256,
                    phrase;
                for (var i = 1; i < data.length; i++) {
                    var currCode = data[i].charCodeAt(0);
                    if (currCode < 256) {
                        phrase = data[i];
                    }
                    else {
                        phrase = dict[currCode] ? dict[currCode] : (oldPhrase + currChar);
                    }
                    out.push(phrase);
                    currChar = phrase.charAt(0);
                    dict[code] = oldPhrase + currChar;
                    code++;
                    oldPhrase = phrase;
                }
                return out.join("");
            },

            typeWatch: (function () {
                var timer = 0;
                return function (callback, ms) {
                    clearTimeout(timer);
                    timer = setTimeout(callback, ms);
                }
            })()

        }
    };

    //Typeahead.prototype.constructor = Typeahead;

    /**
     * @public
     * Implement Typeahead on the selected input node.
     *
     * @param {Object} options
     * @return {Object} Modified DOM element
     */
    $.fn.typeahead = $.typeahead = function (options) {
        return _api.typeahead(this, options);
    };

    /**
     * @private
     * API to handles Typeahead methods via jQuery.
     */
    var _api = {

        /**
         * Enable Typeahead
         *
         * @param {Object} node
         * @param {Object} options
         * @returns {*}
         */
        typeahead: function (node, options) {

            if (!options || !options.source || typeof options.source !== 'object') {

                // {debug}
                _debug.log({
                    'node': node.selector || options && options.input,
                    'function': '$.typeahead()',
                    'arguments': JSON.stringify(options && options.source || ''),
                    'message': 'Undefined "options" or "options.source" or invalid source type - Typeahead dropped'
                });

                _debug.print();
                // {/debug}

                return;
            }

            if (typeof node === "function") {
                if (!options.input) {

                    // {debug}
                    _debug.log({
                        'node': node.selector,
                        'function': '$.typeahead()',
                        'arguments': JSON.stringify(options),
                        'message': 'Undefined "options.input" - Typeahead dropped'
                    });

                    _debug.print();
                    // {/debug}

                    return;
                }

                node = $(options.input);
            }

            if (node.length !== 1) {

                // {debug}
                _debug.log({
                    'node': node.selector,
                    'function': '$.typeahead()',
                    'arguments': JSON.stringify(options.input),
                    'message': 'Unable to find jQuery input element OR more than 1 input is found - Typeahead dropped'
                });

                _debug.print();
                // {/debug}

                return;
            }

            return window.Typeahead[node.selector] = new Typeahead(node, options);

        }

    };

    // {debug}
    var _debug = {

        table: {},
        log: function (debugObject) {

            if (!debugObject.message || typeof debugObject.message !== "string") {
                return;
            }

            this.table[debugObject.message] = $.extend({
                'node': '',
                'function': '',
                'arguments': ''
            }, debugObject)

        },
        print: function () {

            if (Typeahead.prototype.helper.isEmpty(this.table) || !console || !console.table) {
                return;
            }

            if (console.group !== undefined || console.table !== undefined) {
                console.groupCollapsed('--- jQuery Typeahead Debug ---');
                console.table(this.table);
                console.groupEnd();
            }

            this.table = {};

        }

    };
    // {/debug}

    // IE8 Shims
    // @Link: https://gist.github.com/dhm116/1790197
    if (!('trim' in String.prototype)) {
        String.prototype.trim = function () {
            return this.replace(/^\s+/, '').replace(/\s+$/, '');
        };
    }
    if (!('indexOf' in Array.prototype)) {
        Array.prototype.indexOf = function (find, i /*opt*/) {
            if (i === undefined) i = 0;
            if (i < 0) i += this.length;
            if (i < 0) i = 0;
            for (var n = this.length; i < n; i++)
                if (i in this && this[i] === find)
                    return i;
            return -1;
        };
    }

}(window, document, window.jQuery));
