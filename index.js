var express = require('express');
var semver = require('semver');
var versionHandler = require('./lib/version');


/**
 * @typedef {Object} RouterConfig
 * @property {boolean} [passVersion=true]           A flag that sets whether to have the version be available on the request object
 * @property {versionCb} [validate]                 A validator the overrides the default behavior for checking the version
 * @property {string} [param=v]                     The parameter name used for determining the version
 * @property {string} [header=X-ApiVersion]         The header name to look for the requested version
 * @property {string[]} [paramOrder]                The order in which parameters are parsed from the client object for all endpoints
 *                                                  The default order is 'params', 'query', 'cookie', 'body' which map to express
 *                                                  properties. Note that if a header is set it is used instead of any of these.
 * @property {string} [responseHeader=X-ApiVersion] The header name to return the resolved version (is a regex|number|string
 *                                                  depending on what was configured on the endpoint). Will not be used
 *                                                  if the headers have already been sent before the router gets a chance.
 * @property {boolean} [caseSensitive=false]        Express router option to handle paths respecting case
 * @property {boolean} [mergeParams=false]          Express router option to preserve req.params from parent router
 * @property {boolean} [strict=false]               Express router option to not ignore trailing slashes on endpoints
 */

/**
 * @typedef {Object} RouterMapping
 * @property {Object<string, string[]>} paths   All the paths that have been mapped to this router so far for each method
 * @property {Router} instance                  The router instance that handles the actual requests
 */

/**
 * @typedef {object} EndpointConfig
 * @private
 * @property {function} original                    The original router function to be called
 * @property {string} method                        The name of the original function
 * @property {string|RegExp} path                   The path configuration for the router
 * @property {Array.<string|number|RegExp>} version An array with allowed versions
 * @property {Array.<function>} handlers            A list of request handlers to be called by the router
 */


/**
 * All supported methods by the express router that need to be proxied.
 * @type {string[]} The method names                       npm
 */
var methods = [
    'all', 'param', 'get', 'post', 'put', 'head', 'delete', 'options', 'trace', 'copy', 'lock', 'mkcol', 'move',
    'purge', 'propfind', 'proppatch', 'unlock', 'report', 'mkactivity', 'checkout', 'merge', 'm-search', 'notify',
    'subscribe', 'unsubscribe', 'patch', 'search', 'connect'
];

const defaultConfig = {
    paramOrder: ['params', 'query', 'cookie', 'body', 'header'],
    param: 'v',
    header: 'X-ApiVersion',
    responseHeader: 'X-ApiVersion',
    passVersion: true
};

// TODO support use, param and route?

/**
 * The router function that create a new router and proxies all requests so that verification can be done for each path.
 * @param {RouterConfig} [configuration]    An options object that will be passed on to the express router and this router for config
 * @returns {*} The middleware function that can be used by app.use()
 */
function Router(configuration = {}) {
    configuration = Object.assign({}, defaultConfig, configuration);
    let router = express.Router(configuration);
    let getRouter = generateRouter.bind({routers: [], configuration});
    for (let method of methods) {
        let original = router[method];
        router[method] = (path, ...args) => {
            if (typeof path != 'string' && !(path instanceof RegExp)) {
                throw new Error('First parameter needs to be a path (string or RegExp)')
            }
            let epc = parseParams(original, method, path, args);
            if (epc.path.toString().startsWith('/v:'+ configuration.param)) {
                throw new Error('Versioned paths will be generated automatically, please avoid prefixing paths');
            }
            let methodRouter = getRouter(epc.path, epc.method);
            if (!(epc.path instanceof RegExp)) {
                methodRouter[epc.method]('/v:' + configuration.param + epc.path, ...epc.handlers);
                epc.original.call(router, '/v:' + configuration.param + epc.path, versionHandler.parseVersion.bind({
                    configuration,
                    acceptVersion: epc.version,
                    router: methodRouter
                }));
            }
            methodRouter[method](path, ...epc.handlers);
            original.call(router, epc.path, versionHandler.parseVersion.bind({
                configuration,
                acceptVersion: epc.version,
                router: methodRouter
            }));
        }
    }
    return router;
}

/**
 * Parses incoming parameters into an object that is easy to pass around.
 * @param {function} original
 * @param {string} method
 * @param {string|RegExp} path
 * @param {Array} args
 * @param {EndpointConfig} [config]
 * @returns {EndpointConfig}
 */
function parseParams(original, method, path, args, config = {original, method, path, version: [], handlers: []}) {
    for (let arg of args) {
        if (arg instanceof Array) {
            parseParams(original, method, path, arg, config);
            continue;
        }
        switch (typeof arg) {
            case 'object':
                if (arg instanceof RegExp) {
                    config.version.push(arg);
                }
                break;
            case 'number':
            case 'string':
                config.version.push(arg);
                break;
            case 'function':
                config.handlers.push(arg);
                break;
            default:
                throw new Error('Unsupported router parameter: ' + arg);
        }
    }
    return config;
}

/**
 * Returns a router based on the endpoint given. The function will try to minimize the number of routers required to
 * support versions. It does that by looking in an array of routers whether there is one that doesn't have the given
 * router assigned already and returns that one. If all routers are already using the given route, a new router is
 * returned.
 * @param {string|RegExp} endpoint  The endpoint for which we want a router
 * @param {string} method           The http method we want to use
 * @property {RouterMapping[]} routers      The list of existing routers
 * @property {RouterConfig} configuration   The router configuration for all generated routers.
 * @returns {Router}
 */
function generateRouter(endpoint, method) {
    for (let router of this.routers) {
        if (!router.paths[method]) {
            router.paths[method] = [];
        }
        if (router.paths[method].indexOf(endpoint) == -1) {
            router.paths[method].push(endpoint);
            return router.instance;
        }
    }
    let router = express.Router(this.configuration);
    this.routers.push({
        paths: { [method]: [ endpoint ] },
        instance: router
    });
    return router;
}

module.exports = Router;
