var express = require('express');


/**
 * @typedef {Object} RouterConfig
 * @property {versionCb} [error]                  An error handler that overrides the default behavior
 * @property {versionCb} [validate]            A validator the overrides the default behavior for checking the version
 * @property {string[]} [paramOrder]            The order in which parameters are parsed from the client object for all endpoints
 *                                              The default order is 'body', 'query', 'params', 'cookie' which map to express properties
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
    'get', 'post', 'put', 'head', 'delete', 'options', 'trace', 'copy', 'lock', 'mkcol', 'move', 'purge',
    'propfind', 'proppatch', 'unlock', 'report', 'mkactivity', 'checkout', 'merge', 'm-search', 'notify',
    'subscribe', 'unsubscribe', 'patch', 'search', 'connect'
];

/**
 * The router function that create a new router and proxies all requests so that verification can be done for each path.
 * @param {RouterConfig} [configuration]    An options object that will be passed on to the express router and this router for config
 * @returns {*} The middleware function that can be used by app.use()
 */
function Router(configuration = {}) {
    let router = express.Router(configuration);
    for (let method of methods) {
        let original = router[method];
        router[method] = (endpoint, version, ...handlers) => {
            let methodRouter = express.Router(configuration);
            if (typeof version == 'function') {
                handlers.unshift(version);
                version = null;
            }
            methodRouter[method](/.*/, ...handlers);
            original.call(router, '/v:v' + endpoint, parseVersion.bind({
                acceptVersion: version,
                router: methodRouter
            }));
            original.call(router, endpoint, parseVersion.bind({
                acceptVersion: version,
                router: methodRouter
            }));
        }
    }
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
    let version = req.query['v'] || req.params['v'] || req.get('X-ProtocolVersion');
    let acceptRequest = false;
    switch (typeof this.acceptVersion) {
        case 'RegExp':
            acceptRequest = this.acceptVersion.test(version);
            break;
        case 'string':
            acceptRequest = version.match(this.acceptVersion);
            break;
        case 'number':
            acceptRequest = this.acceptVersion == version;
            break;
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
