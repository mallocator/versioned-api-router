# express-version-router
[![npm version](https://badge.fury.io/js/express-version-router.svg)](http://badge.fury.io/js/express-version-router)
[![Build Status](https://travis-ci.org/mallocator/express-version-router.svg?branch=master)](https://travis-ci.org/mallocator/express-version-router)
[![Coverage Status](https://coveralls.io/repos/mallocator/express-version-router/badge.svg?branch=master&service=github)](https://coveralls.io/github/mallocator/express-version-router?branch=master)
[![Dependency Status](https://david-dm.org/mallocator/express-version-router.svg)](https://david-dm.org/mallocator/express-version-router) 

A router for express that manages api versioning.


## Features

* Parse version from param, path, header, cookie or your own implementation
* Match version using numbers, regular expression or [semver](https://github.com/npm/node-semver) format 
* Configure your own parameters or headers
* Respond to requests with the matched version in a custom header 


## Installation
```npm install --save express-version-router```


## Examples

Set up express with the router:
```
var express = require('express');
var app = express();

var versionRouter = require('express-version-router');
var router = versionRouter();
var errorHandler = (req, res) => res.status(404).end('not found');
app.use(router, errorHandler);        // will only call the errorHandler if it can't resolve the version
```

Set an endpoint to handle a specific version (version 1 in this case):
```
router.get('/myendpoint', 1, (req, res) => res.end('success'));

// curl http://myserver/v1/test => 200 success
// curl http://myserver/test?v=1 => 200 success
// curl -H "X-ApiVersion: 1" http://myserver/test => 200 success
// curl http://myserver/test => 404 not found
```

Set an endpoint to handle a version based on [semver](https://github.com/npm/node-semver):
```
router.get('/myendpoint', /^2/, (req, res) => res.end('success'));

// curl http://myserver/v2/test => 200 success
// curl http://myserver/v2.1/test => 200 success
// curl http://myserver/v2.1.6/test => 200 success
// curl http://myserver/v3/test => 404 not found
```

Set an endpoint to handle a version based on a regular expression:
```
router.get('/myendpoint', /(3|4)/, (req, res) => res.end('success'));

// curl http://myserver/v3/test => 200 success
// curl http://myserver/v4/test => 200 success
// curl http://myserver/v5/test => 404 not found
```

Set an endpoint to accept multiple version using an array:
```
router.get('/myendpoint', [1, '^2', /(3|4)/], (req, res) => res.end('success'));

// curl http://myserver/v1/test => 200 success
// curl http://myserver/v2/test => 200 success
// curl http://myserver/v3/test => 200 success
// curl http://myserver/v4/test => 200 success
```


## API

### Router
```
var versionRouter = require('express-version-router');
var router = versionRouter({
    param: 'v',
    header: 'X-ApiVersion',
    responseHeader: 'X-ApiVersion',
    passVersion: false
});
```

The router extends the standard express router and allows for all setting the the standard router has to be used.
In addition the router has options specifically for the version mapping:

* param: the parameter name that is used in query and parameter mapping
* header: the header used to look for a requested version
* paramOrder: the order in which parameters are parsed from the client object for all endpoints, the default order is 'params', 'query', 'cookie', 'body', 'header' which map to express properties.
* responseHeader: the name of the header in the response that has information about the matched version. (will be turned off if this is set to falsy)
* passVersion: whether to pass the version on via the request object. this will add two new properties to the request object: incomingVersion and acceptedVersion.


### Router.all / Router.METHOD
```
router.all(path, [version], [callback, ...] callback)
router.METHOD(path, [version], [callback, ...] callback)
```

This method works the same way that the standard express router work, with the addition of an optional version
parameter. Any string, number or regular expression is treated as a version that limits what requests this handler
will respond to.

The path supports all the same options that the standard router does, only caveat is that regular expressions prevent the
use of path parameters which are disabled in that case (parameter and header methods are still supported though). Instead
you can make use of the regular expression subset that express has 
[built in](https://expressjs.com/en/guide/routing.html#route-paths) using strings. 

The version can be either an array or a single instance of either:  
A number - will match that number exactly   
A string - will perform [semver](https://github.com/npm/node-semver) matching   
A regular expression - will match the incoming version against it    

Callbacks can be any handlers that are compatible with standard express handlers and as usual you can set multiple
handlers that will process a request in order. Handlers will receive a req object that now has two additional fields:  
req.incomingVersion - The version that came in on the request
req.acceptedVersion - The version that the handler has been configured to accept


### Router.route
```
router.route(path)
```

This is the same as the original method. Note that versioning is not supported at this time for the route call.


### Router.use 
```
router.use([path], [function, ...] function)
```

This is the same as the original method. Note that versioning is not supported at this time for the use call.
                                                   

### Router.param
```
router.param(name, callback)
```

This is the same as the original method. Note that versioning is not supported at this time for the param call.
