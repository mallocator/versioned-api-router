/**
 *
 * @param {ClientRequest} req       The client request object
 * @param {ServerResponse} res      The server response object
 * @param {Object} payload          The data to be send to the client
 * @param {number} [status]         A status code that will be set if you don't want express to set one for you
 */
exports.respond = function(req, res, payload, status) {
    status && res.status(status);
    if (!payload || !Object.keys(payload).length) {
        status || res.status(204);
        return res.end();
    }
    let format = req.params && req.params['format'] || req.query && req.query['format'] || 'json';
    switch(format.toLowerCase()) {
        case 'json':
            return res.jsonp ? res.jsonp(payload).end() : res.json(payload).end();
        case 'tree':
            return res.send('<html><body style="white-space: pre">' + JSON.stringify(payload, null, 4) + '</body></html>').end();
        case 'table':
            return res.send(exports.formatTable(payload)).end();
        case 'csv':
            return res.send(exports.formatCSV(payload)).end();
        case 'xml':
            return res.send('<xml version="1.0" encoding="UTF-8">' + exports.formatXML(payload)).end() + '</xml>';
        default:
            return res.status(422).send('Invalid format requested').end();
    }
};

/**
 * Creates an HTML table of the json data passed in.
 * @param {Object} payload
 * @returns {string}
 */
exports.formatTable = function (payload) {
    let table = exports.flatten(payload);
    let response = '<html><body><h1>' + table.title + '</h1><table><thead>';
    for (let header of table.headers) {
        response += '<th>' + header + '</th>';
    }
    response += '</thead><tbody>';
    for (let row of table.rows) {
        response += '<tr>';
        for (let column of row) {
            response += '<td>' + column + '</td>';
        }
        response += '</tr>';
    }
    response += '</tbody></table></body></html>';
    return response;
};

/**
 * Creates a CSV table of the json data passed in.
 * @param {Object} payload
 * @returns {string}
 */
exports.formatCSV = function (payload) {
    let table = exports.flatten(payload);
    let response = table.headers.join(',') + '\n';
    for (let row of table.rows) {
        for(let i = 0; i < row.length; i++) {
            row[i].replace(/"/g, '\\"');
            if (row[i].indexOf(',') !== -1) {
                row[i] = '"' + row[i] + '"';
            }
        }
        response += row.join(',') + '\n';
    }
    return response;
};

/**
 * A response that can be used by the different formatters to construct a table response out of the JSON tree structure.
 * @typedef {Object} TableResponse
 * @property {string} title             A title that should be printed at the head of a page
 * @property {string[]} headers         A list of headers to be printed before the actual data
 * @property {Array.<string[]>} rows    A list of rows represented by lists of strings to be printed in order
 */

/**
 * Converts the known response formats into a list of map like structure to represent a table
 * @param {Object} payload
 * @returns {TableResponse}    The response to be printed
 */
exports.flatten = function(payload) {
    let response = {
        rows: []
    };
    if (payload.error) {
        response.title = payload.error;
        response.headers = [ 'param', 'type', 'error', 'max', 'min'];
        for (let param in payload.params) {
            response.rows.push([
                param,
                payload.params[param].type,
                payload.params[param].error,
                isNaN(payload.params[param].max) ? '' : payload.params[param].max,
                isNaN(payload.params[param].min) ? '' : payload.params[param].min
            ])
        }
    } else {
        response.title = 'Api Map';
        response.headers = [ 'path', 'method', 'description', 'param', 'type', 'paramDescription'];
        for (let path in payload) {
            for (let method in payload[path]) {
                for (let param in payload[path][method].params) {
                    response.rows.push([
                        path,
                        method,
                        payload[path][method].description,
                        param,
                        payload[path][method].params[param].type,
                        payload[path][method].params[param].description
                    ]);
                }
            }
        }
    }
    return response;
};



/**
 * Creates an XML response of the json data passed in.
 * @param {Object|string} payload
 * @returns {string}
 */
exports.formatXML = function (payload) {
    let response = '';
    if (typeof payload == 'object') {
        for (let prop in payload) {
            response += '<' + prop + '>' + exports.formatXML(payload[prop]) + '</' + prop + '>';
        }
        return response;
    }
    return payload;
};
