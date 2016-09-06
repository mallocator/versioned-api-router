var express = require('express');
var semver = require('semver');


/**
 * @typedef {Object} RouterConfig
 * @property {versionCb} [validate]                 A validator the overrides the default behavior for checking the version
 * @property {string} [param=v]                     The parameter name used for determinging the version
 * @property {string} [header=X-ApiVersion]         The header name to look for the requested version
 * @property {string} [responseHeader=X-ApiVersion] The header name to return the resolved version (is a regex|number|string
 *                                                  depending on what was configured on the endpoint). Will not be used
 *                                                  if the headers have already been sent before the router gets a chance.
 * @property {boolean} [caseSensitive=false]        Express router option to handle paths respecting case
 * @property {boolean} [mergeParams=false]          Express router option to preserve req.params from parent router
 * @property {boolean} [strict=false]               Express router option to not ignore trailing slashes on endpoints
 */

/**
 * @typedef {Object} RouterMapping
 * @property {string[]} paths   All the paths that have been mapped to this router so far
 * @property {Router} instance  The router instance that handles the actual requests
 */

/**
 * @callback versionCb
 * @param {string} incomingVersion              The version that has been parsed off of the incoming request
 * @param {string|number|RegExp} acceptVersion  The version that this endpoint is accepting
 * @param {versionResponseCb} cb                A callback that lets the router know whether the version should be
 *                                              handled by this handler or not.
 * @property {ClientRequest} req    The http request object
 * @property {ServerResponse} res   The http response object
 */

/**
 * @callback versionResponseCb
 * @param {boolean} match   Signal whether the version is a match or not.
 */

/**
 * All supported methods by the express router that need to be proxied.
 * @type {string[]} The method names                       npm
 */
var methods = [
    'all', 'get', 'post', 'put', 'head', 'delete', 'options', 'trace', 'copy', 'lock', 'mkcol', 'move', 'purge',
    'propfind', 'proppatch', 'unlock', 'report', 'mkactivity', 'checkout', 'merge', 'm-search', 'notify',
    'subscribe', 'unsubscribe', 'patch', 'search', 'connect'
];

const defaultConfig = {
    param: 'v',
    header: 'X-ApiVersion',
    responseHeader: 'X-ApiVersion'
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
        router[method] = (endpoint, version, ...handlers) => {
            if (endpoint.startsWith('/v:'+ configuration.param)) {
                throw new Error('Versioned paths will be generated automatically, please avoid prefixing paths');
            }
            let methodRouter = getRouter(endpoint);
            if (typeof version == 'function') {
                handlers.unshift(version);
                version = null;
            }
            methodRouter[method]('/v:' + configuration.param + endpoint, ...handlers);
            original.call(router, '/v:' + configuration.param + endpoint, parseVersion.bind({
                configuration,
                acceptVersion: version,
                router: methodRouter
            }));
            methodRouter[method](endpoint, ...handlers);
            original.call(router, endpoint, parseVersion.bind({
                configuration,
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
 * @property {RouterMapping[]} routers      The list of existing routers
 * @property {RouterConfig} configuration   The router configuration for all generated routers.
 * @returns {Router}
 */
function generateRouter(endpoint) {
    for (let router of this.routers) {
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
    let version = req.query && req.query[this.configuration.param]
        || req.params && req.params[this.configuration.param]
        || req.cookies && req.cookies[this.configuration.param]
        || req.get(this.configuration.header);
    let validator = (this.configuration.validate || validateVersion).bind({ req, res });
    validator(version, this.acceptVersion, matches => {
        if (matches){
            if (this.acceptVersion && !res.headersSent && this.configuration.responseHeader) {
                res.set(this.configuration.responseHeader, this.acceptVersion.toString());
            }
            this.router.handle(req, res, next);
        }
        next()
    });
}

/**
 * The default version validator that will match the incoming version against the acceptable version for various types.
 * @type versionCb
 */
function validateVersion(incomingVersion, acceptVersion, cb) {
    let acceptRequest = false;
    switch (typeof acceptVersion) {
        case 'string':
            incomingVersion = semverizeVersion(incomingVersion);
            acceptRequest = semver.satisfies(incomingVersion, acceptVersion);
            break;
        case 'number':
            acceptRequest = acceptVersion == incomingVersion;
            break;
        case 'object':
            if (acceptVersion instanceof RegExp) {
                acceptRequest = acceptVersion.test(incomingVersion);
                break;
            }
        //noinspection FallThroughInSwitchStatementJS
        default:
            acceptRequest = true;
    }
    cb(acceptRequest);
}

/**
 * This function tries to convert an incoming version into something that semver might understand.
 * @param {string} version
 * @returns {string}
 */
function semverizeVersion(version) {
    version = '' + version;
    let splitVersion = version.split('.');
    switch(splitVersion.length) {
        case 1:
            return version + '.0.0';
        case 2:
            return splitVersion.join('.') + '.0';
        default:
            return version;
    }
}

module.exports = Router;
