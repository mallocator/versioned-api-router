var semver = require('semver');

/**
 * @callback versionCb
 * @param {string} incomingVersion                      The version that has been parsed off of the incoming request
 * @param {string[]|number[]|RegExp[]} acceptVersion    The version that this endpoint is accepting
 * @param {versionResponseCb} [cb]                      A callback that should, be called in case your verifier works
 *                                                      async, otherwise you can just return the truth value.
 * @property {ClientRequest} req    The http request object
 * @property {ServerResponse} res   The http response object
 * @returns {boolean|*} Should return a boolean if no callback has been provided, otherwise this value is ignored.
 */

/**
 * @callback versionResponseCb
 * @param {boolean} match   Signal whether the version is a match or not.
 */

/**
 *
 * @param {ClientRequest} req
 * @param {ServerResponse} res
 * @param {function} next
 * @this {Context}
 */
exports.parseVersion = function (req, res, next) {
    let version = null;
    for (let params of this.configuration.paramOrder) {
        if (params == 'header') {
            version = version || req.get(this.configuration.header);
        } else {
            version = version || req[params] && req[params][this.configuration.param];
        }
    }
    let validator = (this.configuration.validate || exports.validateVersion).bind({req, res});
    validator(version, this.acceptVersion, matches => {
        if (matches) {
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
};

/**
 * The default version validator that will match the incoming version against the acceptable version for various types.
 * @type versionCb
 */
exports.validateVersion = function(incomingVersion, acceptVersions, cb) {
    acceptVersions = Array.isArray(acceptVersions) ? acceptVersions : [ acceptVersions ];
    let acceptRequest = true;
    for (let acceptVersion of acceptVersions) {
        acceptRequest = false;
        switch (typeof acceptVersion) {
            case 'string':
                if (acceptVersion.startsWith('/') && acceptVersion.endsWith('/')) {
                    let regExpVersion = new RegExp(acceptVersion.substr(1, acceptVersion.length - 2));
                    return exports.validateVersion(incomingVersion, regExpVersion, cb);
                }
                incomingVersion = exports.semverizeVersion(incomingVersion);
                acceptRequest = semver.satisfies(incomingVersion, acceptVersion);
                break;
            case 'number':
                acceptRequest = acceptVersion == parseInt(incomingVersion);
                break;
            case 'object':
                if (acceptVersion instanceof RegExp) {
                    acceptRequest = acceptVersion.test(incomingVersion);
                    break;
                }
        }
        if (acceptRequest) {
            return cb ? cb(true) : true;
        }
    }
    cb ? cb(acceptRequest) : acceptRequest;
};

/**
 * This function tries to convert an incoming version into something that semver might understand.
 * @param {string} version
 * @returns {string}
 */
exports.semverizeVersion = function(version) {
    version = '' + version;
    let splitVersion = version.split('.');
    switch (splitVersion.length) {
        case 1:
            return version + '.0.0';
        case 2:
            return splitVersion.join('.') + '.0';
        default:
            return version;
    }
};
