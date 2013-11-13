ErrorTracker.js
===============

Easily report your client-side JS errors back to the server

Setting Up
==========

```html
<!-- preamble leading into your <head>... -->

    <head>
        <!-- title, <meta> tags, etc. -->

        <script src='/js/ErrorTracker.js'></script>
        <script>
            ErrorTracker.configure({
                endpoint:       '/api/report-js-errors',
                autoSendErrors: true
            })
        </script>

        <!-- other scripts... -->
    </head>

<!-- rest of your document -->
```

Add a route, or page, in your application to receive a `POST` at whatever you
specify as your `endpoint` (here we've specified it as
`/api/report-js-errors`), and you're good to go! All errors that occur on your
client's machine will be sent back to you!

Why Would I Want This?
======================

Debugging user-space errors is hard. Quite often you have to ask non-technical
people to provide you with technical details and you may have to spend a lot
of time just trying to track down where exactly your code stopped behaving as
it should have. This script is designed to mitigate that problem by telling
you when exceptional situations that have not been handled are occurring.

Maybe you didn't test your code thoroughly enough? Maybe the user has thought
of the one way to use your site that you didn't think of, and it just happens
to bring the whole set of scripts running your beautiful reactive Web 2.0 site
crashing down in flames. Maybe they have local scripts and extensions that
conflict and you need to tell them to disable extensions for your site (or be
**very** polite and code around their existence).

Whatever the case may be, this library should help take away some of the pain
of asking users [who, where, and with what][Clue].

Extending
=========

This library can be fairly easily extended. Almost all of the functions that
are written in the library can be modified by attaching hooks either before or
after they are called, allowing you to attach your own monitors or modify
certain functionality. For example, to call a parsing function in your own
code after every error is saved, it's as simple as:

```javascript
function parseErrors(hookAttributes) {
    var error = hookAttributes.args[0]
    /* magic happens */
}

ErrorTracker.after('saveError', parseErrors)
```

All of the functions that are used in the script are available, including
private methods via the `ErrorTracker.__INTERNALS__` member. This allows you
to extend the functionality with all the power that `ErrorTracker` itself has
at its disposal, without rewriting any methods.

Where Are Your Tests?
=====================

I would love to have tests! It's my next big thing to add to this library, and
if you'd like to help, I'd welcome contributions!

Compatibility
=============

This has only been tested on a modern version of Chrome (29.0.1547.65),
unfortunately. There's no reason to assume that it won't work on other
browsers (particularly Safari), but until I've seen it with my own eyes, I
won't assume it works. Reports on this front are welcome, any bugs found or,
even better, patches to fix any holes with other browsers are very much
appreciated!

Author
======

Stephen Belcher (@sycobuny on [Twitter][]/[GitHub][])

License
=======

MIT - See `LICENSE.md`

[Clue]: http://www.amazon.com/Hasbro-0045-S5-Clue/dp/B00000IWCY
[Twitter]: https://twitter.com/sycobuny
[GitHub]: https://github.com/sycobuny
