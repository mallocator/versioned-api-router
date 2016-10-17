var path = require('path');
var versionVerifier = require('./versionVerifier');


class Endpoints {
    /**
     * @param {RouterConfig} configuration
     */
    constructor(configuration) {
        this._mapping = {};
        this._config = configuration;
    }

    /**
     * Add a new configuration to the endpoint mapping.
     * @param {string} path
     * @param {string} method
     * @param {Array.<number|string|RegExp>} [versions]
     * @param {RouterConfig} config
     */
    add(path, method, versions, config) {
        versions = versions.length ? versions : [ 0 ];
        path = this._unversion(path);
        config.versions = versions;
        for (let version of versions) {
            this._mapping[version] = this._mapping[version] || {};
            this._mapping[version][path] = this._mapping[version][path] || {};
            this._mapping[version][path][method.toUpperCase()] = config;
        }
    }

    /**
     * Retrieve the mapping configuration for an endpoint.
     * @param {string} path
     * @param {string} method
     * @param {string} incomingVersion
     * @returns {*}
     */
    get(path, method, incomingVersion = 0) {
        path = this._unversion(path);
        try {
            let config = {};
            for (let version in this._mapping) {
                if (versionVerifier.validateVersion(incomingVersion, version)) {
                    config[version] = config[version] || {};
                    config[version][path] = config[version][path] || {};
                    config[version][path][method] = this._mapping[version][path][method];
                }
            }
            if (Object.keys(config).length == 1) {
                return config[Object.keys(config)[0]][path][method];
            }
            // TODO not sure where and how to use this, but the format is wrong.
            return config;
        } catch (e) {
            return null;
        }
    }

    /**
     * Removes the version prefix from a given path (if there is one)
     * @param {string} path
     * @returns {string}
     * @private
     */
    _unversion(path) {
        if (path.startsWith('/v:' + this._config.param)) {
            return path.substr(('/v:' + this._config.param).length);
        }
        return path;
    }

    /**
     *
     * @param {string} [prefix]
     * @param {string|number|RegExp} [version]
     */
    list(prefix = this._config.prefix, version = 0) {
        let map = {};
        for (let prop in this._mapping[version]) {
            map[path.join(prefix, prop)] = this._mapping[version][prop];
        }
        return map;

    }
}

module.exports = Endpoints;
