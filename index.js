var express = require('express');


/**
 * @typedef {Object} RouterConfig
 * @property {versionCb} [error]                An error handler that overrides the default behavior
 * @property {versionCb} [validate]             A validator the overrides the default behavior for checking the version
 * @property {string} [param=v]                 The parameter name used for determinging the version
 * @property {string} [header=X-ApiVersion]
 * @property {boolean} [caseSensitive=false]    Express router option to handle paths respecting case
 * @property {boolean} [mergeParams=false]      Express router option to preserve req.params from parent router
 * @property {boolean} [strict=false]           Express router option to not ignore trailing slashes on endpoints
 */

/**
 * @callback versionCb
 * @param {string|number} value The parsed version form the request
 * @param {ClientRequest} req   The http request object
 * @param {ServerResponse} res  The http response object
 * @param {function} next       The chaining function that allows other handlers to be executed after this one
 */

/**
 * All supported methods by the express router that need to be proxied.
 * @type {string[]} The method names
 */
var methods = [
    'all', 'get', 'post', 'put', 'head', 'delete', 'options', 'trace', 'copy', 'lock', 'mkcol', 'move', 'purge',
    'propfind', 'proppatch', 'unlock', 'report', 'mkactivity', 'checkout', 'merge', 'm-search', 'notify',
    'subscribe', 'unsubscribe', 'patch', 'search', 'connect'
];

// TODO support use, param and route?

/**
 * The router function that create a new router and proxies all requests so that verification can be done for each path.
 * @param {RouterConfig} [configuration]    An options object that will be passed on to the express router and this router for config
 * @returns {*} The middleware function that can be used by app.use()
 */
function Router(configuration = {}) {
    let router = express.Router(configuration);
    let getRouter = generateRouter.bind({routers: [], configuration});
    for (let method of methods) {
        let original = router[method];
        router[method] = (endpoint, version, ...handlers) => {
            if (endpoint.startsWith('/v:v')) {
                throw new Error('Versioned paths will be generated automatically, please avoid prefixing paths');
            }
            let methodRouter = getRouter(endpoint);
            if (typeof version == 'function') {
                handlers.unshift(version);
                version = null;
            }
            methodRouter[method]('/v:v' + endpoint, ...handlers);
            original.call(router, '/v:v' + endpoint, parseVersion.bind({
                acceptVersion: version,
                router: methodRouter
            }));
            methodRouter[method](endpoint, ...handlers);
            original.call(router, endpoint, parseVersion.bind({
                acceptVersion: version,
                router: methodRouter
            }));
        }
    }
    return router;
}

/**
 * Returns a router based on the endpoint given. The function will try to minimize the number of routers required to
 * support versions. It does that by looking in an array of routers whether there is one that doesn't have the given
 * router assigned already and returns that one. If all routers are already using the given route, a new router is
 * returned.
 * @param {string|RegExp} endpoint  The endpoint for which we want a router
 * @property {Router[]} routers             The list of existing routers
 * @property {RouterConfig} configuration   The router configuration for all generated routers.
 * @returns {Router}
 */
function generateRouter(endpoint) {
    for (let router of this.routers) {
        console.log(router.paths, endpoint)
        if (router.paths.indexOf(endpoint) == -1) {
            router.paths.push(endpoint);
            return router.instance;
        }
    }
    let router = express.Router(this.configuration);
    this.routers.push({
        paths: [ endpoint ],
        instance: router
    });
    return router;
}

/**
 *
 * @param {ClientRequest} req
 * @param {ServerResponse} res
 * @param {function} next
 * @property {Object} router
 * @property {string|number|RegExp} acceptVersion
 */
function parseVersion(req, res, next) {
    let version = req.query['v'] || req.params['v'] || req.get('X-ApiVersion');
    let acceptRequest = false;
    switch (typeof this.acceptVersion) {
        case 'string':
            acceptRequest = version.match(this.acceptVersion);
            break;
        case 'number':
            acceptRequest = this.acceptVersion == version;
            break;
        case 'object':
            if (this.acceptVersion instanceof RegExp) {
                acceptRequest = this.acceptVersion.test(version);
                break;
            }
        //noinspection FallThroughInSwitchStatementJS
        default:
            acceptRequest = true;
    }
    if (acceptRequest) {
        return this.router.handle(req, res, next);
    } else {
        next();
    }
}

module.exports = Router;
