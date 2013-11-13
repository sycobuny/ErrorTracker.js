/**
 * @namespace ErrorTracker
 * @desc Passively track errors that are not otherwise trapped by the calling
 *       code (ie, that cause crashes in your client-side code). It provides
 *       options to display the fact that some JS errors have been found to
 *       the user, as well as to send them to a server-side endpoint so that
 *       they can be tracked remotely.
 * @summary Track client-side scripting errors
 * @version 0.1.0
 * @copyright Stephen Belcher 2013
 * @license MIT
 * @example <caption>Setting up ErrorTracker</caption>
 * // assuming we have jQuery available...
 * $(function() {
 *     $.getScript('/js/ErrorTracker.js', function() {
 *         // this is all the configuration specific to ErrorTracker that we
 *         // need; honest.
 *         ErrorTracker.configure({
 *             endpoint:       '/api/report-js-errors',
 *             autoSendErrors: true
 *         })
 *     })
 * })
 */
(function(undefined) {
    /**
     * @constant ErrorTracker.PACKAGE
     * @summary Contain's the global variable name for programmatic reference
     */
    this.PACKAGE        = 'ErrorTracker'

    /**
     * @constant ErrorTracker.DESCRIPTION
     * @summary A brief description of what this package does
     */
    this.DESCRIPTION    = 'Keep a log of untrapped errors in your application'

    /**
     * @constant ErrorTracker.VERSION
     * @summary The version of this package
     */
    this.VERSION        = '0.1.0'

    /**
     * @constant ErrorTracker.AUTHOR
     * @summary The primary author of this package
     */
    this.AUTHOR         = 'Stephen Belcher'

    /**
     * @constant ErrorTracker.LICENSE
     * @summary The software license for this package
     */
    this.LICENSE        = 'MIT'

    /**
     * @constant ErrorTracker.REPORT_VERSION
     * @summary The version of reports that this tracker will send to the
     *          endpoint (useful in case we decide to alter the layout later;
     *          endpoints could have to support older and newer versions
     *          side-by-side)
     */
    this.REPORT_VERSION = 1

    /* we don't really need to declare dispatch beforehand because of JS's...
     * interesting scoping rules - but we do it here for clarity anyway (as
     * it's used in newf()) - we also won't bother documenting it here.
     */
    var dispatch

    /**
     * @method ErrorTracker~runhook
     * @summary Run a hook in a safe manner.
     * @desc Execute a hook in the appropriate scope, with proper error
     *       handling. Any errors that go untrapped by the hook function
     *       itself will be saved to the tracked errors list. Note that this
     *       method is not constructed via {@link ErrorTracker~newf} for
     *       structural reasons and thus cannot be, itself, hooked.
     * @arg {function} hook - The hook to run
     * @arg {object} hookAttributes - A series of settings for the hook to use
     *      for introspection about the method it's attached to
     * @returns nothing
     * @example <caption>Manually running a hook for dispatch()</caption>
     * var hook = function() {
     *     console.log('Hook is running')
     * }
     * var hookAttributes = {
     *     func:  ErrorTracker.__INTERNALS__.dispatch,
     *     args:  ['saveError', [Error('test')]],
     *     hooks: [],
     *     hook:  'before'
     * }
     * ErrorTracker.__INTERNALS__.runhook(hook, hookAttributes)
     */
    var runhook = (function(myself) {
        return function(hook, hookAttributes) {
            try { hook.apply(myself, [hookAttributes]) }
            catch(e) { dispatch('saveError', [e]) }
        }
    })(this)

    /**
     * @method ErrorTracker~each
     * @summary Iterate over an Object or Array with a callback
     * @desc This function takes a structure that can be iterated over, and
     *       provides a mechanism for doing that which is consistent
     *       regardless of the given structure. For each item, it sends two
     *       arguments to the callback: the current value, and then the key to
     *       used to access that value. Note that, due to its low-level
     *       nature, it is not built with {@link ErrorTracker~newf} and cannot
     *       have hooks attached to it through ErrorTracker's mechanisms.
     * @arg {(object|Array)} list - The list to be iterated through
     * @arg {function} callback - The callback to execute for each item in the
     *      list. To be useful, it should receive at least one parameter,
     *      though two are passed to it.
     * @returns nothing
     * @example <caption>Using each() with an object</caption>
     * var obj = {
     *     key1: 'value 1',
     *     key2: 'value 2',
     *     key3: 'value 3'
     * }
     * ErrorTracker.__INTERNALS__.each(obj, function(val, key) {
     *     console.log("Key is " + key + ", val is " + val)
     * })
     * // => "Key is key1, val is value 1"
     * // => "Key is key2, val is value 2"
     * // => "Key is key3, val is value 3"
     * @example <caption>Using each() with an Array</caption>
     * var ary = ['element 1', 'element 2', 'element 3']
     * ErrorTracker.__INTERNALS__.each(ary, function(val, index) {
     *     console.log("Index is " + index + ", val is " + val)
     * })
     * // => "Index is 0, val is element 1"
     * // => "Index is 1, val is element 2"
     * // => "Index is 2, val is element 3"
     */
    var each = (function(myself) {
        return function(list, callback) {
            var index

            if (list instanceof Array) {
                for (index = 0; index < list.length; index++) {
                    callback.apply(myself, [list[index], index])
                }
            }
            else if (typeof list == 'object') {
                for (index in list) {
                    callback.apply(myself, [list[index], index])
                }
            }
        }
    })(this)

    /**
     * @method ErrorTracker~newf
     * @summary Construct functions with wrappers to enable hooks
     * @desc This function returns a new function wrapped around an existing
     *       function (the one it is given), designed to both enable hooks on
     *       the function, as well as for the function to be executed with the
     *       `this` variable set to `ErrorTracker`. As this obfuscates away
     *       the internal function, it also adds a property onto the wrapper
     *       function which points back to the original. This property should
     *       be considered read-only; you can modify it, but it won't alter
     *       the behavior of the function as it is not referenced during
     *       execution.
     * @arg {function} fn - The function to wrap
     * @returns {function} The newly-created wrapper function
     * @example <caption>Accessing `this` inside of the function</caption>
     * var fn = ErrorTracker.__INTERNALS__.newf(function() {
     *     console.log(this.PACKAGE)
     * })
     * fn()
     * // => "ErrorTracker"
     * @example <caption>Attaching hooks to functions</caption>
     * var fn = ErrorTracker.__INTERNALS__.newf(function() {
     *     console.log("I am the function!")
     * })
     * ErrorTracker.before(fn, function() {
     *     console.log("I am happening before the function!")
     * })
     * fn()
     * // => "I am happening before the function!"
     * // => "I am the function!"
     * @example <caption>Accessing the internal function</caption>
     * var fn = ErrorTracker.__INTERNALS__.newf(function() {
     *     console.log('Hello, world!')
     * })
     * console.log(fn.__FN__)
     * fn.__FN__()
     * // => function() {
     * //        console.log('Hello, world!')
     * //    }
     * // => "Hello, world!"
     */
    var newf = (function(myself) {
        return function(fn) {
            var f = function() {
                var before = f.__BEFORE__
                var after  = f.__AFTER__
                var hookAttributes = {
                    func:  fn,
                    args:  arguments,
                    hooks: before,
                    hook:  'before'
                }
                var retValue

                each(before, function(hook) { runhook(hook, hookAttributes) })

                try { retValue = fn.apply(myself, arguments) }
                catch(e) { dispatch('saveError', [e]) }

                hookAttributes.hooks = after
                hookAttributes.hook  = 'after'
                each(after, function(hook) { runhook(hook, hookAttributes) })

                return retValue
            }

            f.__FN__     = fn
            f.__BEFORE__ = []
            f.__AFTER__  = []

            return f
        }
    })(this)

    /**
     * @method ErrorTracker~dispatch
     * @summary Call methods in ErrorTracker, safely
     * @desc This method exists to easily wrap function calls made by the
     *       library in a try/catch block which then logs the errors should
     *       any occur. This way, we can safely call public methods internally
     *       without worrying that they may have been overridden or otherwise
     *       damaged in a way that would cause them to error out.
     * @arg {string} name    - The public ErrorTracker method to call
     * @arg {Array}  arglist - The arguments to pass to the method
     * @example <caption>Saving an error manually</caption>
     * try {
     *     throw Error('This will always happen')
     * }
     * catch (e) {
     *     ErrorTracker.__INTERNALS__.dispatch('saveError', [e])
     * }
     */
    dispatch = newf(function(name, arglist) {
        try { this[name].apply(this, arglist) }
        catch (e) {
            if (name == 'saveError') throw e
            dispatch('saveError' [e])
        }
    })

    /**
     * @method ErrorTracker~ajax
     * @summary Perform asynchronous calls back to a server
     * @desc Perform a POST call in the background to a server endpoint. This
     *       is a fairly basic implementation and does not do robust
     *       error-checking, as it is only intended to provide the most basic
     *       functionality required to submit reports to a server endpoint. If
     *       you want more thorough AJAX support, see
     *       {@link http://jquery.com/} or another full-featured library.
     * @arg {object} data - The object that will be sent to the server
     * @arg {string} url - The server endpoint
     * @arg {function} callback - The function to be called when the endpoint
     *      returns a result
     * @returns nothing
     * @example <caption>Calling ajax() manually</caption>
     * var data = {
     *     errorTrackerVersion: ErrorTracker.VERSION,
     *     errorReportVersion:  ErrorTracker.REPORT_VERSION,
     *     errorReportID:       ErrorTracker.nextReportID(),
     *     errorsTracked:       {}
     * }
     * var url = '/api/log-js-errors'
     * var callback = function(data) {
     *     console.log(data)
     * }
     * ErrorTracker.__INTERNALS__.ajax(data, url, callback)
     */
    var ajax = newf(function(data, url, callback) {
        try {
            var xhr = new XMLHttpRequest()

            xhr.open('POST', url)
            xhr.setRequestHeader('Content-type', 'application/json')
            xhr.onload = function() {
                if (xhr.readyState == 4 && xhr.status == 200) {
                    try {
                        callback(JSON.parse(xhr.responseText))
                    }
                    catch (e) {
                        callback({
                            state:        'failure',
                            reason:       'failed to parse response as JSON',
                            originalText: xhr.responseText
                        })
                    }
                }
                else {
                    callback({state: 'failure', reason: 'server error'})
                }
            }
            xhr.onerror = function() {
                callback({state: 'failure', reason: 'server error'})
            }

            console.log(data)
            console.log(JSON.stringify(data))

            xhr.send(JSON.stringify(data))
        }
        catch (e) { dispatch('saveError', [e]) }
    })

    /**
     * @member ErrorTracker~initialize
     * @summary Initialization scripts for the ErrorTracker library
     * @desc Contains references to functions used to initialize various
     *       components in the library, so as to make it possible to easily
     *       re-initialize them later.
     * @property {function} configuration - Initialize configuration settings
     * @property {function} trackedErrors - Initialize the error list
     * @property {function} receiver      - Register the error receiver
     * @property {function} all           - Run all initializations
     * @example <caption>Initializing the configuration</caption>
     * ErrorTracker.__INTERNALS__.initialize.configuration()
     * @example <caption>Initializing the error list</caption>
     * ErrorTracker.__INTERNALS__.initialize.trackedErrors()
     * @example <caption>Initializing the error receiver</caption>
     * ErrorTracker.__INTERNALS__.initialize.receiver()
     * @example <caption>Running all initializations</caption>
     * ErrorTracker.__INTERNALS__.initialize.all()
     */
    var initialize = {
        configuration: newf(function() {
            this.__INTERNALS__.configuration = {}
            for (var key in CONFIG_DEFAULTS) {
                this.__INTERNALS__.configuration[key] = CONFIG_DEFAULTS[key]
            }
        }),

        trackedErrors: newf(function() {
            this.__INTERNALS__.trackedErrors = []
        }),

        receiver: newf(function() {
            this.registerReceiver()
        }),

        all: newf(function() {
            initialize.configuration()
            initialize.trackedErrors()
            initialize.receiver()
        })
    }

    /**
     * @method ErrorTracker~css
     * @summary Compile a JS object into a CSS string
     * @desc Take an object and compile it into a string of CSS suitable for
     *       attaching to an HTML tag's "style" attribute. Note that no
     *       type-checking is done on the keys or values; it is purely
     *       syntactic sugar that assumes you know what you're doing.
     * @arg {object} attributes - The CSS attributes as an anonymous JS object
     * @returns {string} The "compiled" CSS
     * @example <caption>Compiling CSS from a JS object with css()</caption>
     * var style = css({
     *     'position': 'absolute',
     *     'top':      '20px',
     *     'left':     '20px'
     * })
     * console.log(style)
     * // => "position:absolute;top:20px;left:20px;"
     */
    var css = newf(function (attributes) {
        var attributesArray = []
        for (var attribute in attributes) {
            attributesArray.push(attribute + ':' + attributes[attribute])
        }
        return attributesArray.join(';')
    })

    /**
     * @constant {object} ErrorTracker~CONFIG_DEFAULTS
     * @summary The base configuration of the error tracker
     * @desc Default configuration settings for the application. When the
     *       application is initialized, or re-initialized, these settings are
     *       copied into the runtime configuration.
     */
    var CONFIG_DEFAULTS = {
        endpoint:          undefined,
        autoSendErrors:    false,
        autoDisplayWindow: false,
        errorTitleText:    'A scripting error occurred',
        errorBoxStyle:     css({
            'position':       'absolute',
            'left':           '20px',
            'top':            '20px',
            'min-width':      '200px',
            'max-width':      '225px',
            'min-height':     '100px',
            'max-height':     '125px',
            'padding':        '3px',
            'background':     '#cc0000',
            'color':          'white',
            'font-size':      '12px',
            'border-radius':  '5px'
        }),
        errorTitleStyle:   css({
            'font-weight':    'bold',
            'text-align':     'center',
            'border-bottom':  '1px solid #cccccc'
        }),
        errorMessageStyle: css({
            'padding-top':    '3px',
            'padding-bottom': '3px',
            'border-bottom':  '1px solid #cccccc'
        }),
        errorTrayStyle:    css({
            'padding-top':    '3px',
            'margin-left':    'auto',
            'margin-right':   'auto',
            'text-align':     'center'
        }),
        errorSendStyle:    css({
            'display':        'inline-block',
            'cursor':         'pointer',
            'padding':        '5px',
            'background':     '#dd0000',
            'font-weight':    'bold',
            'border-radius':  '5px',
            'margin-right':   '10px'
        }),
        errorCloseStyle:   css({
            'display':        'inline-block',
            'cursor':         'pointer',
            'padding':        '5px',
            'background':     '#dd0000',
            'font-weight':    'bold',
            'border-radius':  '5px'
        })
    }

    /**
     * @method ErrorTracker.configure
     * @summary Set up configuration in one bulk method
     * @desc Rather than use {@link ErrorTracker.setConfigurationValue}
     *       multiple times, you can pass an object containing configuration
     *       settings to this method. This will remove all current settings,
     *       pre-set the defaults from {@link ErrorTracker~CONFIG_DEFAULTS},
     *       and then use whatever settings are provided. Note that all the
     *       normal caveats about types in the configuration must be observed.
     *       If setting any value fails, the entire configuration will fail
     *       and roll back to whatever the previous settings were. The error
     *       that caused the settings to fail will wind up in the tracked
     *       errors list.
     * @arg {object} newConfiguration - The new settings to apply
     * @returns {boolean} True if the settings were successfully applied,
     *          false otherwise
     * @example <caption>Setting options in bulk</caption>
     * ErrorTracker.setConfigurationValue('autoSendErrors', true)
     *
     * // note that `autoSendErrors` will now be reset to default (false)
     * ErrorTracker.configure({
     *     endpoint:          '/api/report-js-errors',
     *     autoDisplayWindow: true
     * })
     *
     * console.log(ErrorTracker.getConfigurationValue('autoSendErrors'))
     * console.log(ErrorTracker.getConfigurationValue('endpoint'))
     * // => false
     * // => "/api/report-js-errors"
     * @example <caption>Errors roll back configuration</caption>
     * ErrorTracker.setConfigurationValue('autoSendErrors', true)
     * ErrorTracker.setConfigurationValue('endpoint', '/api/report-js-errors')
     *
     * // the autoDisplayWindow must be a boolean, so this fails
     * ErrorTracker.configure({
     *     endpoint:          '/api/report-js-errors/v2',
     *     autoDisplayWindow: 'yes',
     * })
     *
     * // no new settings were saved
     * console.log(ErrorTracker.getConfigurationValue('autoSendErrors'))
     * console.log(ErrorTracker.getConfigurationValue('endpoint'))
     * console.log(ErrorTracker.getConfigurationValue('autoDisplayWindow'))
     * // => true
     * // => "/api/report-js-errors"
     * // => false
     */
    this.configure = newf(function(newConfiguration) {
        var configurationBackup = {}
        var key

        for (key in this.__INTERNALS__.configuration) {
            configurationBackup[key] = this.__INTERNALS__.configuration[key]
        }

        try {
            initialize.configuration()
            for (key in newConfiguration) {
                if (!this.setConfigurationValue(key, newConfiguration[key])) {
                    var e = Error('Could not set configuration value ' + key +
                                  ' to "' + newConfiguration[key] + '"')
                    e.configurationKey   = key
                    e.configurationValue = newConfiguration[key]
                    throw e
                }
            }
            return true
        }
        catch (e) {
            dispatch('saveError', [e])
            this.__INTERNALS__.configuration = configurationBackup
            return false
        }
    })

    /**
     * @method ErrorTracker.setConfigurationValue
     * @summary Set a single parameter in ErrorTracker's configuration
     * @desc Provide a setting name and any value to put it into the
     *       ErrorTracker configuration. The setting name does not have to be
     *       one that ErrorTracker already understands (so you can configure
     *       extensions using this method as well). However, `autoSendErrors`
     *       and `autoDisplayWindow` must be boolean values. If you try to set
     *       them to anything else, the method will return false and nothing
     *       will be affected.
     * @arg {string} setting - The name of the setting to configure
     * @arg {*}      value   - The value to set the setting to
     * @returns {boolean} Whether or not the call to set the value succeeded
     * @example <caption>Modifying the endpoint</caption>
     * ErrorTracker.setConfigurationValue('endpoint', '/api/report-js-errors')
     * console.log(ErrorTracker.getConfigurationValue('endpoint'))
     * // => "/api/report/js-errors"
     * @example <caption>Setting an invalid value changes nothing</caption>
     * ErrorTracker.setConfigurationValue('autoSendErrors', 'yes')
     * console.log(ErrorTracker.getConfigurationValue('autoSendErrors'))
     * // => false
     */
    this.setConfigurationValue = newf(function(setting, value) {
        // certain configuration settings have explicit constraints. not
        // enough that we need to make a more extensible type-checking system,
        // yet, but enough to warrant a sanity check here.
        if ((setting == 'autoDisplayWindow' || setting == 'autoSendErrors') &&
            typeof value != 'boolean') {
            return false
        }

        this.__INTERNALS__.configuration[setting] = value
        return true
    })

    /**
     * @method ErrorTracker.getConfigurationValue
     * @summary Fetch a configuration setting by name
     * @desc Pull a value from the current configuration settings. Note that
     *       if the setting does not exist, then `undefined` will be returned.
     *       This is no different than if the setting exists, but is set
     *       specifically to `undefined`. To differentiate between the two,
     *       use {@link ErrorTracker.checkConfigurationValue}.
     * @arg {string} setting - The setting to pull
     * @returns {*} The current setting in the configuration
     * @example <caption>Getting the default error title text</caption>
     * console.log(ErrorTracker.getConfigurationValue('errorTitleText'))
     * // => "A scripting error occurred"
     * @example <caption>Getting a value set to undefined</caption>
     * console.log(ErrorTracker.getConfigurationValue('endpoint'))
     * // => undefined
     * @example <caption>Getting a non-existent setting</caption>
     * console.log(ErrorTracker.getConfigurationValue('doesNotExist'))
     * // => undefined
     */
    this.getConfigurationValue = newf(function(setting) {
        return this.__INTERNALS__.configuration[setting]
    })

    /**
     * @method ErrorTracker.checkConfigurationValue
     * @summary Validate that a setting has been provided
     * @desc As {@link ErrorTracker.getConfigurationValue} cannot
     *       differentiate between a setting that has been set to `undefined`
     *       and a setting that has not yet been set, you can use this method
     *       to tell the difference.
     * @arg {string} setting - The setting to validate
     * @returns {boolean} Whether the setting exists in the configuration or
     *          not
     * @example <caption>Check a value that exists and is undefined</caption>
     * console.log(ErrorTracker.checkConfigurationValue('endpoint'))
     * // => true
     * @example <caption>Check a value that has not been set</caption>
     * console.log(ErrorTracker.checkConfigurationValue('doesNotExist'))
     * // => false
     */
    this.checkConfigurationValue = newf(function(setting) {
        return (setting in this.__INTERINALS__.config)
    })

    /**
     * @method ErrorTracker~c
     * @summary Syntactic sugar for a common method
     * @desc Syntactic sugar alias for {@link
     *       ErrorTracker.getConfigurationValue}
     * @arg {string} setting - The configuration value to retrieve
     * @returns {*} The current configuration setting, or `undefined` if no
     *          such setting exists
     * @example <caption>Using c() externally</caption>
     * console.log(ErrorTracker.__INTERNALS__.c('autoSendErrors'))
     * // => false
     */
    var c = this.getConfigurationValue

    /**
     * @constant {object} ErrorTracker.__INTERNALS__
     * @summary Access otherwise-private members of ErrorTracker
     * @desc These are the private methods and configurations used internally
     *       by ErrorTracker. Modifying them can have unpredictable results
     *       and is not advised; however, if you'd like to extend the
     *       functionality of ErrorTracker in your own code beyond what is
     *       currently available via public methods, these members and methods
     *       should help.
     * @example <caption>Add a new function to ErrorTracker</caption>
     * ErrorTracker.printErrors = ErrorTracker.__INTERNALS__.newf(
     *     function() {
     *         this.__INTERNALS__.each(this.trackedErrors(), function(e) {
     *             console.log(e.message)
     *         })
     *     }
     * )
     * ErrorTracker.saveError(Error('Here is a sample error'))
     * ErrorTracker.saveError(Error('Here is a second sample error'))
     * ErrorTracker.printErrors()
     * // => "Here is a sample error"
     * // => "Here is a second sample error"
     * @property {function} dispatch        - SEE:
     *           {@link ErrorTracker~dispatch}
     * @property {function} runhook         - SEE:
     *           {@link ErrorTracker~runhook}
     * @property {function} each            - SEE: {@link ErrorTracker~each}
     * @property {function} newf            - SEE: {@link ErrorTracker~newf}
     * @property {function} ajax            - SEE: {@link ErrorTracker~ajax}
     * @property {function} initialize      - SEE:
     *           {@link ErrorTracker~initialize}
     * @property {function} css             - SEE: {@link ErrorTracker~css}
     * @property {object}   CONFIG_DEFAULTS - SEE:
     *           {@link ErrorTracker~CONFIG_DEFAULTS}
     * @property {function} c               - SEE: {@link ErrorTracker~c}
     */
    this.__INTERNALS__ = {
        dispatch:        dispatch,
        runhook:         runhook,
        each:            each,
        newf:            newf,
        ajax:            ajax,
        initialize:      initialize,
        css:             css,
        CONFIG_DEFAULTS: CONFIG_DEFAULTS,
        c:               c
    }

    /**
     * @method ErrorTracker.before
     * @summary Run code before a function executes
     * @desc Attach a hook to a function to be run before that function
     *       executes. Generally speaking, this requires that the function be
     *       instantiated via {@link ErrorTracker~newf} in order to work.
     *       Multiple hooks can be added; they are run in the order in which
     *       they're added.
     * @arg {string|function} name - If given a function, it will operate
     *      directly on that function (meaning all methods of ErrorTracker,
     *      aside from {@link ErrorTracker~runhook},
     *      {@link ErrorTracker~each}, and {@link ErrorTracker~newf} can be
     *      hooked against). If given a string, it will search for a public
     *      method by that name.
     * @arg {function} callback - The code to run before the method is called
     * @returns {boolean} True if attaching the hook succeeded, false if it
     *          failed. Any errors thrown internally are logged to the tracked
     *          errors list.
     * @example <caption>Hooking a public function</caption>
     * ErrorTracker.before('saveError', function() {
     *     console.log('Saving a new error!')
     * })
     * ErrorTracker.saveError(Error('Something bad happened!'))
     * // => "Saving a new error!"
     * @example <caption>Hooking a private function</caption>
     * ErrorTracker.before(ErrorTracker.__INTERNALS__.ajax, function() {
     *     console.log('Sending the errors to the server!')
     * })
     * ErrorTracker.sendErrors()
     * // => "Sending the errors to the server!"
     */
    /**
     * @method ErrorTracker.after
     * @summary Like {@link ErrorTracker.before}, but running code after a
     *          function. See that function for full documentation.
     */
    each(['before', 'after'], function(hook) {
        var hookList = '__' + hook.toUpperCase() + '__'
        this[hook] = newf(function(name, callback) {
            var fn

            if (typeof name == 'string' || name instanceof String) {
                fn = this[name]
            }
            else {
                fn = name
            }

            if (typeof fn != 'function') return false

            try { fn[hookList].push(callback) }
            catch(e) {
                this.dispatch('saveError', [e])
                return false
            }

            return true
        })
    })

    /**
     * @method ErrorTracker.receiveError
     * @summary Catch untrapped errors and deal with them
     * @desc While this method is public, it is not necessarily designed to be
     *       called externally. It can be, if you would prefer to behave as
     *       though a script failed completely without actually allowing this
     *       to happen; it is more common, however, to directly use {@link
     *       ErrorTracker.saveError}.
     * @arg {Error} e - The error that needs to be acted on
     * @returns nothing
     * @example <caption>Calling receiverError() directly</caption>
     * ErrorTracker.receiveError(Error('A new problem has occurred'))
     */
    this.receiveError = newf(function(e) {
        dispatch('saveError', [e])

        if (c('autoSendErrors'))    dispatch('sendErrors')
        if (c('autoDisplayWindow')) dispatch('displayWindow')
    })

    /**
     * @method ErrorTracker.saveError
     * @summary Push a new error onto the stack of tracked methods
     * @desc Primarily this method will be used internally; however, you can
     *       also use it to track your own errors, if you want to acknowledge
     *       that an error happened while not crashing your system completely.
     *       However, it becomes a little hairy to differentiate when a known
     *       error occurred vs. an unexpected one, so use that method
     *       sparingly unless you're very confident. (If you're so confident,
     *       why are you using this library?) Note that this method
     *       understands three current special cases: `ErrorEvent`,
     *       `TypeError`, and `Error`. If you pass any of these to the
     *       function, it will take only a subset of their functionality, as
     *       they are deep and/or recursive data structures and can't be
     *       submitted directly to a server.
     * @arg {Error} e - The error to push onto the stack
     * @returns nothing
     * @todo Parse `TypeError` and `Error`'s stacktrace to pull out more
     *       relevant line information as object parameters, and to make the
     *       resulting error objects more consistent
     * @example <caption>Save an error onto the stack</caption>
     * ErrorTracker.saveError(Error('User clicked on the wrong button'))
     */
    this.saveError = newf(function(e) {
        var pageInfo = {
            protocol:    window.location.protocol,
            host:        window.location.hostname,
            port:        window.location.port,
            route:       window.location.pathname,
            queryString: window.location.search
        }

        // ErrorEvent is a recursive data structure, so we have to pare it
        // down so it can easily be submitted to a server-side logger
        if (e instanceof ErrorEvent) {
            e = {
                pageInfo:   pageInfo,
                message:    e.message,
                filename:   e.filename,
                lineno:     e.lineno,
                timeStamp:  e.timeStamp,
                type:       e.type
            }
        }
        // TypeError (and general Error) have some additional magic of their
        // own that we need to pull apart.
        // TODO: parse the stack message to fill out filename/line number/etc.
        else if (e instanceof TypeError || e instanceof Error) {
            e = {
                pageInfo:  pageInfo,
                message:   e.message,
                stack:     e.stack,
                timeStamp: new Date().getTime()
            }
        }

        // add the error (or our broken-down version) to the list
        this.__INTERNALS__.trackedErrors.push(e)
    })

    /**
     * @method ErrorTracker.sendErrors
     * @summary Submit currently-tracked errors to the server
     * @desc This method launches a background AJAX request to submit the
     *       errors that have been tracked so far. What happens at that point
     *       is out of the hands of this library; the server could take no
     *       action, or even worse the route could be a bad route. If the
     *       endpoint is not configured prior to calling this method, it will
     *       exit prematurely and log an additional error.
     * @arg {?function} fn - A callback to use in place of {@link
     *      ErrorTracker.receiveResponse} - this is not advised.
     * @returns nothing
     * @example <caption>Submitting the current errors periodically</caption>
     * // send tracked errors to the server every 5 seconds
     * setInterval(function() {
     *     ErrorTracker.sendErrors()
     *     ErrorTracker.clearErrors()
     * }, 5000)
     */
    this.sendErrors = newf(function(fn) {
        var ep   = c('endpoint')
        var errs = {
            errorTrackerVersion: this.VERSION,
            errorReportVersion:  this.REPORT_VERSION,
            errorsTracked:       this.__INTERNALS__.trackedErrors
        }

        if (fn === undefined) {
            fn = function(data) { dispatch('receiveResponse', [data]) }
        }

        try {
            if (!ep) throw Error('Server API endpoint is required')
            ajax(errs, ep, fn)
        }
        catch (e) { dispatch('saveError', [e]) }
    })

    /**
     * @method ErrorTracker.receiveResponse
     * @summary Parses the response from the server's API endpoint
     * @desc This method will be called automatically by the {@link
     *       ErrorTracker~ajax} method when it returns. You should not need to
     *       call it directly. It handles verification that response was
     *       valid, and, if requested, clears the error objects that were
     *       reported (to avoid duplicates)
     * @arg {object} data - The server's response
     * @returns {bool}
     * @todo Actually do the things the description says it does. Currently
     *       it's a wonderful dream.
     */
    this.receiveResponse = newf(function(data) { })

    /**
     * @method ErrorTracker.displayWindow
     * @summary Show a window indicating that untrapped errors have occurred.
     * @desc Show a dialog box to the user indicating that untrapped errors
     *       have occured. The user can then take an action to deal with them;
     *       either they can ignore the errors, or submit them to the server.
     *       The dialog box has basic styling `which` can be overridden (see
     *       the {@link ErrorTracker.configure} method).
     * @returns nothing
     * @todo Do not display "submit" button unless `endpoint` has been
     *       configured - the users can't submit to a non-existent endpoint
     * @example <caption>Create the dialog window</caption>
     * ErrorTracker.displayWindow()
     */
    this.displayWindow = newf(function() {
        // make sure there's at least one <body> element - if not, there's
        // nothing for us to do
        var bodies = document.getElementsByTagName('body')
        if (!bodies || bodies.length === 0) return
        var send, dismiss

        var getID = newf(function(prefix) {
            var id = c(prefix + 'ID')
            if (!id) id = this.PACKAGE + '_' + prefix
            return id
        })

        // if the window already exists on the page, then we don't need to do
        // anything
        if (document.getElementById(getID('errorBox'))) return

        var newElem = function(prefix, elem, contents, attributes) {
            var domClass = c(prefix + 'Class')
            var style    = c(prefix + 'Style')
            var element  = document.createElement(elem)

            element.setAttribute('id', getID(prefix))
            if (domClass) element.setAttribute('class', domClass)
            if (style)    element.setAttribute('style', style)

            if (attributes) {
                for (var attribute in attributes) {
                    element.setAttribute(attribute, attributes[attribute])
                }
            }

            if (contents instanceof Array) {
                for (var index = 0; index < contents.length; index++) {
                    element.appendChild(contents[index])
                }
            }
            else if (contents instanceof HTMLElement) {
                element.appendChild(contents)
            }
            else if (typeof contents === 'string' ||
                     contents instanceof String) {
                element.innerText = contents
            }

            return element
        }

        bodies[0].appendChild(
            newElem('errorBox', 'div', [
                // title bar
                newElem('errorTitle', 'div', c('errorTitleText')),

                // error message
                newElem('errorMessage', 'div',
                        'This website has encountered scripting errors, ' +
                        'would you like to report them to the ' +
                        'administrators?'),

                // action buttons
                newElem('errorTray', 'div', [
                    newElem('errorSend',  'div', 'Submit Errors'),
                    newElem('errorClose', 'div', 'Dismiss')
                ]),

                // option for the user to dismiss the alert boxes permanently
                newElem('errorNoMoreCheckLabel', 'label',
                        'Ignore future errors', {
                            'for': getID('errorNoMoreCheck')
                        }),
                newElem('errorNoMoreCheck', 'input', undefined,
                        {type: 'checkbox'})
            ])
        )

        send    = document.getElementById(getID('errorSend'))
        dismiss = document.getElementById(getID('errorClose'))

        send.addEventListener('click', newf(function() {
            var check = document.getElementById(getID('errorNoMoreCheck'))
            if (check.checked) {
                dispatch('setConfigurationValue',
                         ['autoDisplayWindow', false])
            }

            dispatch('sendErrors')
            dispatch('dismissWindow')
        }))

        dismiss.addEventListener('click', newf(function() {
            var check = document.getElementById(getID('errorNoMoreCheck'))
            if (check.checked) {
                dispatch('setConfigurationValue',
                         ['autoDisplayWindow', false])
            }

            dispatch('dismissWindow')
        }))
    })

    /**
     * @method ErrorTracker.dismissWindow
     * @summary Dismiss the window displayed to the user
     * @desc There is no additional magic associated with this method; it
     *       not, itself, send errors to the user or modify the seconds. These
     *       are entirely built into the events that happen when the user
     *       clicks on buttons. Calling this method merely closes the window
     *       if it's open. If it is not open, then nothing happens. It is not
     *       considered an error to call this method repeatedly.
     * @returns nothing
     * @example <caption>Closing the user alert window</caption>
     * ErrorTracker.dismissWindow()
     */
    this.dismissWindow = newf(function() {
        var id = c('errorBoxID')
        if (!id) id = this.PACKAGE + '_errorBox'

        var errorBox = document.getElementById(id)
        if (!errorBox) return

        errorBox.parentNode.removeChild(errorBox)
    })

    /**
     * @method ErrorTracker.registerReceiver
     * @summary Register the function that catches untrapped errors
     * @desc After calling this method, ErrorTracker will be logging any
     *       otherwise-untrapped errors that occur in your script. To disable
     *       it again, call {@link ErrorTracker.unregisterReceiver}.
     * @returns nothing
     * @example <caption>Enable error tracking</caption>
     * ErrorTracker.registerReceiver()
     */
    this.registerReceiver = newf(function() {
        window.addEventListener('error', this.receiveError, false)
    })

    /**
     * @method ErrorTracker.unregisterReceiver
     * @summary Unregister the function that catches untrapped errors
     * @desc After calling this method, ErrorTracker will no longer log any
     *       otherwise-untrapped errors that occur in your script. To enable
     *       it again, call {@link ErrorTracker.registerReceiver}.
     * @returns nothing
     * @example <caption>Disable error tracking</caption>
     * ErrorTracker.unregisterReceiver()
     */
    this.unregisterReceiver = newf(function() {
        window.removeEventListener('error', this.receiveError, false)
    })

    /**
     * @method ErrorTracker.hasErrors
     * @summary Check if any errors have been tracked
     * @desc This method does not check whether any errors have ever been
     *       tracked, only whether a current list of errors exists and has
     *       items. This means, for instance, that calling this method
     *       immediately after calling {@link ErrorTracker.clearErrors} will
     *       almost always return `false`.
     * @returns {boolean} Whether any errors are currently tracked
     * @example <caption>Checking whether a method was successful</caption>
     * ErrorTracker.configure({
     *     endpoint: '/api/report-js-errors',
     *     autoSendErrors: true
     * })
     * if (!ErrorTracker.hasErrors()) {
     *     console.log('ErrorTracker configuration was successful!')
     * }
     * // => "ErrorTracker configuration was successful!"
     */
    this.hasErrors = newf(function() {
        return this.__INTERNALS__.trackedErrors.length > 0
    })

    /**
     * @method ErrorTracker.trackedErrors
     * @summary Get the current list of tracked errors
     * @desc You can use this method to iterate through the current list of
     *       tracked errors. Note that you cannot use this method (or any
     *       other built-in method) to find errors that have been tracked but
     *       later removed with {@link ErrorTracker.clearErrors}. You can
     *       safely modify the list returned from this method, as it is just a
     *       copy. However, it is not a deep copy; modifying the individual
     *       elements will modify them globally.
     * @returns {Array} The list of current errors
     * @example <caption>Printing out all tracked errors</caption>
     * ErrorTracker.saveError(Error('Here is an error'))
     * ErrorTracker.saveError(Error('Here is another error'))
     * var errors = ErrorTracker.trackedErrors()
     * while (errors.length) console.log(errors.shift().message)
     * // => "Here is an error"
     * // => "Here is another error"
     */
    this.trackedErrors = newf(function() {
        var trackedErrors = []
        each(this.__INTERNALS__.trackedErrors, function(e, index) {
            trackedErrors[index] = e
        })
        return trackedErrors
    })

    /**
     * @method ErrorTracker.clearErrors
     * @summary Remove all currently tracked errors
     * @desc This method destroys the list of currently tracked errors,
     *       irrevocably. It doesn't move them into a queue of all errors
     *       tracked forever; they're just gone.
     * @returns nothing
     * @example <caption>Clear out all errors</caption>
     * ErrorTracker.saveError(Error('Here is an error that will vanish'))
     * ErrorTracker.clearErrors()
     * console.log(ErrorTracker.trackedErrors())
     * // => []
     */
    this.clearErrors = newf(function() {
        initialize.trackedErrors()
    })

    /**
     * @method ErrorTracker.resetConfiguration
     * @summary Clear any custom configuration settings
     * @desc Removes all custom configuration and restores it to the default
     *       configuration specified by {@link ErrorTracker~CONFIG_DEFAULTS}.
     * @returns nothing
     * @example <caption>Clear all configuration settings</caption>
     * ErrorTracker.configure({
     *     endpoint:       '/api/report-js-errors',
     *     autoSendErrors: true
     * })
     * ErrorTracker.resetConfiguration()
     * console.log(ErrorTracker.getConfigurationValue('endpoint'))
     * console.log(ErrorTracker.getConfigurationValue('autoSendErrors'))
     * // => undefined
     * // => false
     */
    this.resetConfiguration = newf(function() {
        dispatch('configure', [{}])
    })

    // initialize the ErrorTracker for use.
    initialize.all()
}).apply(ErrorTracker = {})
