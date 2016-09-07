/* global describe, it, beforeEach, afterEach */
'use strict';

var expect = require('chai').expect;
var express = require('express');
var request = require('supertest');

var Router = require('..');


describe('Router', () => {
    it('should process normal requests same as the default router as this defaults as catch all', done => {
        var router = Router();
        router.get('/test', (req, res) => res.end('success'));

        var app = express();
        app.use(router);
        request(app).get('/test').expect(200, 'success').end(done);
    });

    it('should only process versioned requests using a path param', done => {
        var router = Router();
        router.get('/test', 1, (req, res) => res.end('success'));

        var app = express();
        app.use(router);
        request(app).get('/test').expect(404).end(() => {
            request(app).get('/v1/test').expect(200, 'success').end(done);
        });
    });

    it('should only process versioned requests using a header', done => {
        var router = Router();
        router.get('/test', 1, (req, res) => res.end('success'));

        var app = express();
        app.use(router);
        request(app).get('/test').expect(404).end(() => {
            request(app).get('/test').set('X-ApiVersion', 1).expect(200, 'success').end(done);
        });
    });

    it('should only process versioned requests using a get parameter', done => {
        var router = Router();
        router.get('/test', 1, (req, res) => res.end('success'));

        var app = express();
        app.use(router);
        request(app).get('/test').expect(404).end(() => {
            request(app).get('/test?v=1').expect(200, 'success').end(done);
        });
    });

    it('should prevent me from passing in a path that is already versioned', () => {
        var router = Router();
        expect(router.get.bind(null, '/v:v/test')).to.throw(Error);
    });

    it('should be able to support multiple versions for the same endpoint', done => {
        var router = Router();
        router.get('/test', 1, (req, res) => res.end('success 1'));
        router.get('/test', 2, (req, res) => res.end('success 2'));

        var app = express();
        app.use(router);
        request(app).get('/v1/test').expect(200, 'success 1').end(() => {
            request(app).get('/v2/test').expect(200, 'success 2').end(done);
        });
    });

    it('should be able to support multiple versions for the same endpoint using strings', done => {
        var router = Router();
        router.get('/test', '1', (req, res) => res.end('success 1'));
        router.get('/test', '2', (req, res) => res.end('success 2'));

        var app = express();
        app.use(router);
        request(app).get('/v1/test').expect(200, 'success 1').end(() => {
            request(app).get('/v2/test').expect(200, 'success 2').end(done);
        });
    });

    it('should be able to support multiple versions for the same endpoint using RegExp', done => {
        var router = Router();
        router.get('/test', /1/, (req, res) => res.end('success 1'));
        router.get('/test', /2/, (req, res) => res.end('success 2'));

        var app = express();
        app.use(router);
        request(app).get('/v1/test').expect(200, 'success 1').end(() => {
            request(app).get('/v2/test').expect(200, 'success 2').end(done);
        });
    });

    it('should be able to support multiple paths for the same version', done => {
        var router = Router();
        router.get('/test1', /1/, (req, res) => res.end('success 1'));
        router.get('/test2', /1/, (req, res) => res.end('success 2'));

        var app = express();
        app.use(router);
        request(app).get('/v1/test1').expect(200, 'success 1').end(() => {
            request(app).get('/v1/test2').expect(200, 'success 2').end(done);
        });
    });

    it('should be able to support semver matching for strings', done => {
        var router = Router();
        router.get('/test', '^1', (req, res) => res.end('success'));

        var app = express();
        app.use(router);
        request(app).get('/v1.0/test').expect(200, 'success').end(() => {
            request(app).get('/v1.1.1/test').expect(200, 'success').end(done);
        });
    });

    it('should be able to support matching an array of all describe methods', done => {
        var router = Router();
        router.get('/test', ['^1', 2, /3|4/], (req, res) => res.end('success'));

        var app = express();
        app.use(router);
        request(app).get('/v1/test').expect(200, 'success').end(() => {
            request(app).get('/v2/test').expect(200, 'success').end(() => {
                request(app).get('/v3/test').expect(200, 'success').end(() => {
                    request(app).get('/v4/test').expect(200, 'success').end(done);
                });
            });
        });
    });

    it('should be able to handle a regex path', done => {
        var router = Router();
        router.get(/\/test/, 1, (req, res) => res.end('success'));

        var app = express();
        app.use(router);
        request(app).get('/test?v=1').expect(200, 'success').end(done);
    });

    it('should be able to process multiple handlers', done => {
        var router = Router();
        router.get(/\/test/, 1, (req, res, next) => next(), (req, res) => res.end('success'));

        var app = express();
        app.use(router);
        request(app).get('/test?v=1').expect(200, 'success').end(done);
    });

    it('should be able to support other request methods on the same path', done => {
        var router = Router();
        router.get('/test', 1, (req, res, next) => next(), (req, res) => res.end('success get'));
        router.post('/test', 1, (req, res, next) => next(), (req, res) => res.end('success post'));

        var app = express();
        app.use(router);
        request(app).get('/test?v=1').expect(200, 'success get').end(() => {
            request(app).post('/test?v=1').expect(200, 'success post').end(done);
        });
    });
});
