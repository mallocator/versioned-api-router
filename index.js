const apiVerifier = require('./lib/apiVerifier');
const express = require('express');
const Endpoints = require('./lib/endpoints');
const path = require('path');
const responder = require('./lib/responder');
const versionVerifier = require('./lib/versionVerifier');


/**
 * @typedef {Object} RouterConfig
 * @property {boolean} [passVersion=true]               A flag that sets whether to have the version be available on the request object
 * @property {versionCb} [validate]                     A validator the overrides the default behavior for checking the version
 * @property {string} [param=v]                         The parameter name used for determining the version
 * @property {string} [header=X-ApiVersion]             The header name to look for the requested version
 * @property {string} [prefix]                          An optional prefix that will be used when generating the api map
 * @property {parseCb} [error]                          An error handler that overrides the default behavior for all params on this endpoint
 * @property {validateCb} [validate]                    A validator the overrides the default behavior for all params on this endpoint
 * @property {parseCb} [success]                        A success handler that overrides the default behavior for all params on this endpoint
 * @property {string} [paramMap=arguments]              The name of the request property where parsed parameters can be found for all endpoints
 * @property {string[]} [paramOrder]                    The order in which parameters are parsed from the client object for all endpoints
 *                                                      The default order is 'params', 'query', 'cookie', 'body' which map to express
 *                                                      properties. Note that if a header is set it is used instead of any of these.
 * @property {string} [responseHeader=X-ApiVersion]     The header name to return the resolved version (is a regex|number|string
 *                                                      depending on what was configured on the endpoint). Will not be used
 *                                                      if the headers have already been sent before the router gets a chance.
 * @property {function} [routerFunction=express.Router] The router function used to generate Routers
 * @property {boolean} [caseSensitive=false]            Express router option to handle paths respecting case
 * @property {boolean} [mergeParams=false]              Express router option to preserve req.params from parent router
 * @property {boolean} [strict=false]                   Express router option to not ignore trailing slashes on endpoints
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
 * @typedef {Object} Context
 * @private
 * @property {function} [router]                            The router that takes care of the actually routing
 * @property {RouterConfig} configuration                   The router global configuration
 * @property {Object.<string, EndpointConfig>} endpoints    A map of endpoints to store configurations in
 * @property {number|string|RegExp} [acceptVersion]         The version that this endpoint is going to accept
 */

/**
 * @typedef {Object} ParseResult
 * @property {boolean} error    True if this callback is the result of a processing error
 */

/**
 * @callback parseCb
 * @param {ParseResult} error   An error callback that has information such as endpoints or missing parameters
 * @param {ClientRequest} req   The http request object
 * @param {ServerResponse} res  The http response object
 * @param {function} next       The chaining function that allows other handlers to be executed after this one
 */


/**
 * All supported methods by the express router that need to be proxied.
 * @type {string[]} The method names                       npm
 */
const methods = [
    'all', 'get', 'post', 'put', 'head', 'delete', 'options', 'trace', 'copy', 'lock', 'mkcol', 'move',
    'purge', 'propfind', 'proppatch', 'unlock', 'report', 'mkactivity', 'checkout', 'merge', 'm-search', 'notify',
    'subscribe', 'unsubscribe', 'patch', 'search', 'connect'
];

const defaultConfig = {
    paramOrder: ['params', 'query', 'cookie', 'body', 'header'],
    param: 'v',
    header: 'ApiVersion',
    responseHeader: 'ApiVersion',
    passVersion: true,
    routerFunction: express.Router
};

// TODO support use, param and route?
// TODO return api for specific version with parameter given
// TODO write tests for mix between version and api configs

/**
 * The router function that create a new router and proxies all requests so that verification can be done for each path.
 * @param {RouterConfig} [configuration]                An options object that will be passed on to the express router and this router for config
 * @returns {*} The middleware function that can be used by app.use()
 */
function Router(configuration = {}) {
    configuration = Object.assign({}, defaultConfig, configuration);
    configuration.prefix = normalizePrefix(configuration.prefix);
    let router = configuration.routerFunction(configuration);
    let getRouter = generateRouter.bind({routers: [], configuration});
    let endpoints = new Endpoints(configuration);
    for (let method of methods) {
        let original = router[method];
        router[method] = (path, ...args) => {
            let epc = parseParams.call(configuration, original, method, path, args);
            let methodRouter = getRouter(epc.path, epc.method);
            let apiHandler = apiVerifier.configure({
                endpoints,
                configuration,
                router: methodRouter
            }, epc);
            let versionHandler = versionVerifier.parseVersion.bind({
                configuration,
                acceptVersion: epc.version,
                router: methodRouter
            });
            if (!(epc.path instanceof RegExp)) {
                epc.original.call(router, epc.versionedPath, versionHandler);
                methodRouter[epc.method](epc.versionedPath, apiHandler, ...epc.handlers);
            }
            original.call(router, epc.path, versionHandler);
            methodRouter[method](epc.path, apiHandler, ...epc.handlers);
        }
    }
    router.__defineGetter__('endpoints', prefixEndpoints.bind({ configuration, endpoints }));
    router.api = api.bind({ configuration, endpoints });
    return router;
}

/**
 * Parses parameters from a route configuration into an object that is easy to pass around.
 * @param {function} original
 * @param {string} method
 * @param {string|RegExp} path
 * @param {Array} args
 * @param {EndpointConfig} [config]
 * @returns {EndpointConfig}
 * @this {RouterConfig}
 */
function parseParams(original, method, path, args, config) {
    if (typeof path != 'string' && !(path instanceof RegExp)) {
        throw new Error('First parameter needs to be a path (string or RegExp)')
    }
    if (path.toString().startsWith('/v:' + this.param)) {
        throw new Error('Versioned paths will be generated automatically, please avoid prefixing paths');
    }
    config = config || {
        original,
        method,
        path,
        versionedPath: '/v:' + this.param + path,
        version: [], // TODO rename to versionS
        handlers: []
    };
    for (let arg of args) {
        if (arg instanceof Array) {
            parseParams(original, method, path, arg, config);
            continue;
        }
        arg = isNaN(arg) ? arg : parseFloat(arg);
        switch (typeof arg) {
            case 'object':
                if (arg instanceof RegExp) {
                    config.version.push(arg);
                    break;
                }
                config.api = arg;
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
    let router = this.configuration.routerFunction(this.configuration);
    this.routers.push({
        paths: { [method]: [ endpoint ] },
        instance: router
    });
    return router;
}

/**
 * Returns either an empty string or a normalized path of the prefix
 * @param {string} prefix
 * @returns {string}
 */
function normalizePrefix(prefix) {
    if (!prefix || typeof prefix !== 'string' || !prefix.trim().length) {
        return '';
    }
    return path.normalize(prefix);
}

/**
 * Getter implementation that will return the currently configured enpoints.
 * @returns {Object.<string, Object.<string, EndpointConfig>>} Api map with endpoint config nested in path and method.
 * @this Context
 */
function prefixEndpoints(prefix) {
    return this.endpoints.list(prefix);
}

/**
 * A standard request handler implementation that will respond with the currently configured api for this router. Can be used to make
 * it easier for developers to work with your API.
 * @param {ClientRequest} req   An express client request object
 * @param {ServerResponse} res  An express server response object
 * @this Context
 */
function api(req, res) {
    let url = req.originalUrl;
    let prefix = url.substr(0, url.lastIndexOf(req.route.path));
    prefix = prefix.substr(0, prefix.lastIndexOf(this.configuration.prefix));
    responder.respond(req, res, prefixEndpoints.call(this, prefix.length ? prefix : this.configuration.prefix));
}

module.exports = Router;
