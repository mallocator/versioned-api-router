# express-version-router
[![npm version](https://badge.fury.io/js/express-version-router.svg)](http://badge.fury.io/js/express-version-router)
[![Build Status](https://travis-ci.org/mallocator/express-version-router.svg?branch=master)](https://travis-ci.org/mallocator/express-version-router)
[![Coverage Status](https://coveralls.io/repos/mallocator/express-version-router/badge.svg?branch=master&service=github)](https://coveralls.io/github/mallocator/express-version-router?branch=master)
[![Dependency Status](https://david-dm.org/mallocator/express-version-router.svg)](https://david-dm.org/mallocator/express-version-router) 

A router for express that manages api versioning and parameter handling.


## Features

* Parse version from param, path, header, cookie or your own implementation
* Match version using numbers, regular expression or [semver](https://github.com/npm/node-semver) format 
* Configure your own parameters or headers
* Respond to requests with the matched version in a custom header 
* Checks if all required parameters are set on an endpoint
* Automatically sets default values for missing parameters
* Generates a json map of all endpoints for documentation 
* Supports nested documents for json POST bodies,
* Customizable error handler per router and for each endpoint


## Installation
```npm install --save express-version-router```


## Examples for Version handling

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


## Examples for API handling

```
var Router = require('express-rest-api-router);

var router = Router();

router.get('/endpoint', {
    description: 'An example endpoint',
    params: {
        name: 'string'
    }
}, (req, res) => {
    res.end('hello ' + req.args.name); 
});

app.use(Router);
```

With the default configuration this is the output of the different requests to the server:

http://myhost/endpoint => 
```
Status Code 422
```

http://myhost/endpoint (developer mode) => 
```
Status Code 422 
{ 
    "error": "Required parameters are missing",
    "params": {
        "name": {
            "type": "string",
            "error": "not set"
        }
    }
}
```

http://myhost/endpoint?name=bob => ```hello bob```

http://myhost/ => 
```
Status Code 200
{
    "/endpoint": {
        "GET": {
            "description": "An example endpoint",
            "params": {
                "name": {
                    "type": "string",
                    "required": true,
                    "default": undefined
                }
            }            
        }
    }
}
```



## API

### Router
```
var versionRouter = require('express-version-router');
var router = versionRouter({
    param: 'v',
    header: 'X-ApiVersion',
    responseHeader: 'X-ApiVersion',
    passVersion: false,
    prefix: '/path'                                     
    error: (value, req, res, next) => {},                
    success: (value, req, res, next) => {},             
    validate: (value, req, res, next) => {},            
    paramMap: 'arguments',                               
    paramOrder: ['params', 'query', 'cookie', 'body', 'header'],
    routerFunction: express.Router
});
```

The router extends the standard express router and allows for all setting the the standard router has to be used.
In addition the router has options specifically for the version mapping:

* param: the parameter name that is used in query and parameter mapping
* header: the header used to look for a requested version
* paramOrder: the order in which parameters are parsed from the client object for all endpoints, the default order is 'params', 'query', 'cookie', 'body', 'header' which map to express properties.
* responseHeader: the name of the header in the response that has information about the matched version. (will be turned off if this is set to falsy)
* passVersion: whether to pass the version on via the request object. this will add two new properties to the request object: incomingVersion and acceptedVersion.
* prefix: A prefix for the api map that will be prepended when printing it via `router.api` or `router.endpoints`.
* error: A global error handler that overrides the default behavior for api errors (not version mismatches).
* success: A success handler that overrides the default behavior for api successes (not version mismatches).
* validate: A global validator the overrides the default behavior for api parameters (not version mismatches).
* paramMap: The property on the request object on which to find parsed parameters.
* paramOrder: The order in which request properties are searched for incoming parameters. Once a parameter has been found it's not going to be overwritten by other properties.
* routerFunction: The router function used to generate Routers


### Router.all / Router.METHOD
```
router.all(path, [version], [api], [callback, ...] callback)
router.METHOD(path, [version], [api], [callback, ...] callback)
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

The api configuration is complex enough that is has its own section below label **Api Configuration**

Callbacks can be any handlers that are compatible with standard express handlers and as usual you can set multiple
handlers that will process a request in order. Handlers will receive a req object that now has two additional fields:  
req.incomingVersion - The version that came in on the request
req.acceptedVersion - The version that the handler has been configured to accept


### Router.api(req, res);

A standard request handler implementation that will respond with the currently configured api for this router. Can be used to make
it easier for developers to work with your API.

```
app.get('/', router.api);
// => responds via res.jsonp() and prints current endpoint configuration
```

The api handler supports multiple formats that can be specified either through a get or path paramter named format:
 
```
app.get('/api/:format', router.api);
// => can respond to e.g. /api/tree or /api?format=tree (which doesn't require the path variable).
```

The supported formats are ```json``` (default), ```tree```, ```table```, ```csv```, ```xml```


### Router.endpoints;

A map with the configuration of all the endpoints on this Router. Use this to build your own custom api handlers or to do more advanced
configuration.

```
console.log(router.endpoints)
// => { "path": { "method": { "description": "endpoint description", "params": {}}}}
```


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


## API Configuration

The configuration is where most of the work needs to be done to get the router working the way you want:

#### Router.description

A simple string field that allows to set a description of the endpoint.

```
{
    description: 'A description of the endpoint that is printed in the json map'
}
```

#### Router.params

An object that describes the expected parameters for this endpoint. Each parameter is defined as a property of the params object. The parameter definition
supports either a simple string definition in the format of ```type(default)``` or ```type(default)```:
```
{
    params: {
        aReqioredNumber: 'number',
        anOptionalString: 'string(bob)',
        aRequiredArray: 'string[]',
        anOptionalArray: 'bool[](true, false, false)
    }
}
```

or a more complex format as an object with more options:
```
{
    params: {
        name: {
            type: 'string',
            default: 'bob',
            required: false,
            description: 'The users name'       
            min: 3,                                         // min characters for string, min value for number, ignored for boolean
            max: 10,                                        // max characters for string, min value for number, ignored for boolean
            validate: (value, cb) => { cb(err, value); }    // Function to override validation behavior
            error: (error, req, res, next) => {}            // Function to override error behavior
            success: (null, req, res, next) => {}           // Function to trigger on success, does not override request handler
        }
    }
}
```

Valid types that can be used are: ```bool```, ```number```, ```string```. 
Arrays of each type can also be used: ```bool[]```, ```number[]```, ```string[]```.

Support for complex objects is only possible in body requests and is tbd. (no support in this plugin so far)

For more examples check out [api-router.test.js](test/api-router.test.js) and [version.test.js](test/version-router.test.js) the test directory

