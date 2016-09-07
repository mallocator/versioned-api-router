var express = require('express');
var semver = require('semver');


/**
 * @typedef {Object} RouterConfig
 * @property {boolean} [passVersion=true]           A flag that sets whether to have the version be available on the request object
 * @property {versionCb} [validate]                 A validator the overrides the default behavior for checking the version
 * @property {string} [param=v]                     The parameter name used for determining the version
 * @property {string} [header=X-ApiVersion]         The header name to look for the requested version
 * @property {string[]} paramOrder                  The order in which parameters are parsed from the client object for all endpoints
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
 * @callback versionCb
 * @param {string} incomingVersion                      The version that has been parsed off of the incoming request
 * @param {string[]|number[]|RegExp[]} acceptVersion    The version that this endpoint is accepting
 * @param {versionResponseCb} cb                        A callback that lets the router know whether the version should be
 *                                                      handled by this handler or not.
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
        router[method] = (endpoint, version, ...handlers) => {
            if (endpoint.toString().startsWith('/v:'+ configuration.param)) {
                throw new Error('Versioned paths will be generated automatically, please avoid prefixing paths');
            }
            let methodRouter = getRouter(endpoint, method);
            if (typeof version == 'function') {
                handlers.unshift(version);
                version = [];
            } else {
                version = Array.isArray(version) ? version : [version];
            }
            if (!(endpoint instanceof RegExp)) {
                methodRouter[method]('/v:' + configuration.param + endpoint, ...handlers);
                original.call(router, '/v:' + configuration.param + endpoint, parseVersion.bind({
                    configuration,
                    acceptVersion: version,
                    router: methodRouter
                }));
            }
            methodRouter[method](endpoint, ...handlers);
            original.call(router, endpoint, parseVersion.bind({
                configuration,
                acceptVersion: version,
                router: methodRouter
            }));
        }
    }
    router.use = (path, version, ...handlers) => {
        throw new Error('Not yet implemented');
    };
    return router;
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

/**
 *
 * @param {ClientRequest} req
 * @param {ServerResponse} res
 * @param {function} next
 * @property {Object} router
 * @property {string|number|RegExp} acceptVersion
 */
function parseVersion(req, res, next) {
    let version = null;
    for (let params of this.configuration.paramOrder) {
        if (params == 'header') {
            version = version || req.get(this.configuration.header);;
        } else {
            version = version || req[params] && req[params][this.configuration.param];
        }
    }
    let validator = (this.configuration.validate || validateVersion).bind({ req, res });
    validator(version, this.acceptVersion, matches => {
        if (matches){
            if (this.configuration.passVersion) {
                req.incomingVersion = version;
                req.acceptedVersion = this.acceptedVersion;
            }
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
function validateVersion(incomingVersion, acceptVersions, cb) {
    let acceptRequest = true;
    for (let acceptVersion of acceptVersions) {
        acceptRequest = false;
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
        }
        if (acceptRequest) {
            return cb(true);
        }
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
