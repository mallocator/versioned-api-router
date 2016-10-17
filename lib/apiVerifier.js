'use strict';


var responder = require('./responder');

/**
 * @typedef {object} EndpointConfig
 * @private
 * @property {function} original       The original function (get, post, ...) on the router
 * @property {string} method           The name of that original function
 * @property {string|RegExp} path      The path definition, same as on the original router
 * @property {EndpointConfig} config   The configuration for this endpoint
 * @property {function[]} handlers     Any handlers that should be passed on to the original router
 */

/**
 * @typedef {Object} ParamDef
 * @property {string} type              The data type that this parameter is expected to be
 * @property {*} [default]              The default value to set the parameter to if it's not coming in through the request
 * @property {boolean} [required=false] Whether the request should be rejected if this parameter is missing
 * @property {boolean} [array=false]    Whether the incoming parameter is expected to be treated like an array
 * @property {string} [description]     A description of the parameter that will be printed with the endpoints api info
 * @property {number} [min]             min characters for string, min value for number, ignored for boolean
 * @property {number} [max]             max characters for string, min value for number, ignored for boolean
 * @property {validateCb} [validate]    A validator the overrides the default behavior for this parameter
 */

/**
 * @callback validateCb
 * @param {string} value    The value received from the request
 * @param {string} name     The name of the parameter that we're checking
 * @param {ParamDef} config The configuration for this parameter
 * @returns {string}    An error message or any falsy value if the parameter is valid
 */

/**
 * A path configuration function that will prepare the verifier with the given configuration and then call the same
 * method on the original router.
 * @param {Context} context
 * @param {string} method                   The name of that original function
 * @param {string|RegExp} path              The path definition, same as on the original router
 * @param {EndpointConfig} api              The configuration for this endpoint
 * @param {string|number|RegExp} version    The version configuration for this endpoint
 * @returns {*} Whatever the original function returns.
 */
exports.configure = function(context, { path, method, api, version}) {
    if (!api || typeof api === 'function' || method == 'param') {
        return (req, res, next) => next();
    }
    api.paramOrder = api.paramOrder || context.configuration.paramOrder;
    api.paramMap = api.paramMap || context.configuration.paramMap || 'args';
    version.length && (api.version = version);
    if (api.params) {
        for (let param in api.params) {
            var parsed = exports.parseParam(api.params[param]);
            parsed.error = parsed.error | api.error || context.configuration.error;
            parsed.validate = parsed.validate || api.validate || context.configuration.validate;
            parsed.success = parsed.success || api.success || context.configuration.success;
            api.params[param] = parsed;
        }
    }
    context.endpoints.add(path, method, version, api);
    return exports.verify.bind(context);
};

/**
 * Used to find parameter names and definitions.
 * @type {RegExp}
 */
const paramMatcher = /(\w+)(\[])?(\(([^)]*)\))?/;

/**
 * Converts a string parameter into a parameter definition.
 * @param {string|ParamDef} str
 * @returns {ParamDef}
 */
exports.parseParam = function(str) {
    if (typeof str == 'string') {
        var match = str.match(paramMatcher);
        var type = match[1].trim().toLowerCase();
        var array = !!match[2];
        var required = !match[3];
        var def = exports.parseValue(type, match[4], array);
        return { type, default: def, required, array }
    }
    if (typeof str == 'object') {
        switch(str.required) {
            case 0: case 'FALSE': case 'false': case 'F': case 'f': case 'no': case 'n': case false:
                str.required = false;
                break;
            default:
                str.required = !str.default;
        }
        str.default = str.default || undefined;
        str.array = !!str.array;
        return str;
    }
    throw new Error('Given parameter is incompatible');
};

/**
 *
 * @param {string} type     The type of value to be parsed from the given string
 * @param {string} value    The string from which to parse the value from
 * @param {boolean} array   Whether the value is expected to be an array
 * @returns {*}
 */
exports.parseValue = function(type, value, array) {
    if (Array.isArray(value)) {
        return value.map(entry => exports.parseValue(type, entry, false));
    } else if (value && array) {
        return value.split(',').map(entry => exports.parseValue(type, entry, false));
    }
    switch (type) {
        case 'string':
            value && value.length || (value = undefined);
            return value;
        case 'bool': case 'boolean':
            switch (value && value.trim().toLowerCase()) {
                case 'true': case 't': case 'yes': case 'y': case '1':
                    return true;
                case 'false': case 'f': case 'no': case 'n': case '0':
                    return false;
                default:
                    return undefined;
            }
        case 'number': case 'float': case 'double':
            value = parseFloat(value);
            isNaN(value) && (value = undefined);
            return value;
        case 'integer': case 'short':
            value = parseInt(value);
            isNaN(value) && (value = undefined);
            return value;
        default:
            throw new Error('Invalid type defined for parameter: ' + type);
    }
};

/**
 * This function is called with every request on this router and verifies incoming parameters and auto populates default
 * values on missing parameters.
 * @param {ClientRequest} req   The incoming http request
 * @param {ServerResponse} res  The outgoing http response
 * @param {function} next       The chaining function used to call the next handler for this endpoint
 * @this Context
 */
exports.verify = function(req, res, next) {
    var config = this.endpoints.get(req.route.path, req.method, req.incomingVersion);
    if (!config) {
        return next();
    }
    try {
        var params = exports.getParams(config, req);
    } catch (e) {
        if (config.error) {
            return config.error(e, req, res, next);
        }
        return responder.respond(req, res, {
            error: e.message,
            params: {}
        }, 422);
    }
    var missing = exports.checkParams(config, params);
    if (Object.keys(missing).length) {
        if (config.error) {
            return config.error(missing, req, res, next)
        }
        if (process.env.NODE_ENV == 'development') {
            return responder.respond(req, res, {
                error: 'Required parameters are missing',
                params: missing
            }, 422);
        }
        return responder.respond(req, res, null, 422);
    }
    req[config.paramMap] = exports.fillParams(config, params);
    if (config.success) {
        return config.success(null, req, res, next);
    }
    next();
};

/**
 * Retrieves any parameters that are on the client request.
 * @param {EndpointConfig} config   The configuration of this endpoint
 * @param {ClientRequest} req       The express client request
 * @returns {Object.<string, *>}    A map with all the passed in parameters that were found on the request object
 */
exports.getParams = function(config, req) {
    var params = {};
    for (let prop of config.paramOrder) {
        if (req[prop]) {
            for (let param in req[prop]) {
                if (params[param] === undefined && config.params[param]) {
                    params[param] = exports.parseValue(config.params[param].type, req[prop][param], config.params[param].array);
                }
            }
        }
    }
    return params;
};

/**
 * @typedef {Object} MissingInfo
 * @property {string} type  The parameter type such as boolean, number or string
 * @property {string} error A short description of the error that occurred
 * @property {number} [min] If the parameter is out of range, information about the range settings
 * @property {number} [max] If the parameter is out of range, information about the range settings
 */

/**
 * Verifies that all required parameters are set and fulfill all requirements.
 * @param {EndpointConfig} config       The configuration for this endpoint
 * @param {Object.<string, *>} params   The parameters that have been found on the client request
 * @returns {Object.<string, MissingInfo>}   A map of parameter names and any errors that have been found with them
 */
exports.checkParams = function(config, params) {
    var errors = {};
    for (let param in config.params) {
        var value = params[param];
        var paramConfig = config.params[param];
        if (paramConfig.validate) {
            var error = paramConfig.validate(value, param, paramConfig);
            if (error) {
                errors[param] = { type: paramConfig.type, error }
            }
            continue;
        }
        if (paramConfig.required && (!value || Array.isArray(value) && !value.length)) {
            errors[param] = {
                type: paramConfig.type,
                error: 'not set'
            }
        }
        if (value) {
            if (!isNaN(paramConfig.max)) {
                switch (paramConfig.type) {
                    case 'string':
                        if (value.length > paramConfig.max) {
                            errors[param] = {
                                type: paramConfig.type,
                                error: 'value exceeds max value',
                                max: paramConfig.max
                            }
                        }
                        break;
                    case 'number':
                        if (value > paramConfig.max) {
                            errors[param] = {
                                type: paramConfig.type,
                                error: 'value exceeds max value',
                                max: paramConfig.max
                            }
                        }
                        break;
                }
            }
            if (!isNaN(paramConfig.min)) {
                switch (paramConfig.type) {
                    case 'string':
                        if (value.length < paramConfig.min) {
                            errors[param] = {
                                type: paramConfig.type,
                                error: 'value below min value',
                                min: paramConfig.min
                            }
                        }
                        break;
                    case 'number':
                        if (value < paramConfig.min) {
                            errors[param] = {
                                type: paramConfig.type,
                                error: 'value below min value',
                                min: paramConfig.min
                            }
                        }
                        break;
                }
            }
        }
    }
    return errors;
};

/**
 * Sets the default value for any parameter that hasn't been set by the client request.
 * @param {EndpointConfig} config       The configuration for this endpoint
 * @param {Object.<string, *>} params   The parameters that have been found on the client request
 * @returns {Object.<string, *>}    The parameter map with filled default values.
 */
exports.fillParams = function(config, params) {
    for (let param in config.params) {
        if (params[param] === undefined) {
            params[param] = config.params[param].default;
        }
    }
    return params;
};
