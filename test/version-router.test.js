/* global describe, it, beforeEach, afterEach */
const async = require('async');
const expect = require('chai').expect;
const express = require('express');
const request = require('supertest');

const Router = require('..');


describe('Version Router', () => {
    it('should process normal requests same as the default router as this defaults as catch all', done => {
        let router = Router();
        router.get('/test', (req, res) => res.end('success'));

        let app = express();
        app.use(router);
        request(app).get('/test').expect(200, 'success').end(done);
    });

    it('should only process versioned requests using a path param', done => {
        let router = Router();
        router.get('/test', 1, (req, res) => res.end('success'));

        let app = express();
        app.use(router);
        async.series([
            cb => request(app).get('/test').expect(404).end(cb),
            cb => request(app).get('/v1/test').expect(200, 'success').end(cb)
        ], done);
    });

    it('should only process versioned requests using a header', done => {
        let router = Router();
        router.get('/test', 1, (req, res) => res.end('success'));

        let app = express();
        app.use(router);
        async.series([
            cb => request(app).get('/test').expect(404).end(cb),
            cb => request(app).get('/test').set('ApiVersion', 1).expect(200, 'success').end(cb)
        ], done);
    });

    it('should only process versioned requests using a get parameter', done => {
        let router = Router();
        router.get('/test', 1, (req, res) => res.end('success'));

        let app = express();
        app.use(router);
        async.series([
            cb => request(app).get('/test').expect(404).end(cb),
            cb => request(app).get('/test?v=1').expect(200, 'success').end(cb)
        ], done);
    });

    it('should prevent me from passing in a path that is already versioned', () => {
        let router = Router();
        expect(router.get.bind(null, '/v:v/test')).to.throw(Error);
    });

    it('should prevent me from not passing in a path', () => {
        let router = Router();
        expect(router.get.bind({})).to.throw(Error);
        expect(router.get.bind(() => {})).to.throw(Error);
    });

    it('should be able to support multiple versions for the same endpoint', done => {
        let router = Router();
        router.get('/test', 1, (req, res) => res.end('success 1'));
        router.get('/test', 2, (req, res) => res.end('success 2'));

        let app = express();
        app.use(router);
        async.series([
            cb => request(app).get('/v1/test').expect(200, 'success 1').end(cb),
            cb => request(app).get('/v2/test').expect(200, 'success 2').end(cb)
        ], done);
    });

    it('should be able to support multiple versions for the same endpoint using strings', done => {
        let router = Router();
        router.get('/test', '1', (req, res) => res.end('success 1'));
        router.get('/test', '2', (req, res) => res.end('success 2'));

        let app = express();
        app.use(router);
        async.series([
            cb => request(app).get('/v1/test').expect(200, 'success 1').end(cb),
            cb => request(app).get('/v2/test').expect(200, 'success 2').end(cb)
        ], done);
    });

    it('should be able to support multiple versions for the same endpoint using RegExp', done => {
        let router = Router();
        router.get('/test', /1/, (req, res) => res.end('success 1'));
        router.get('/test', /2/, (req, res) => res.end('success 2'));

        let app = express();
        app.use(router);
        async.series([
            cb => request(app).get('/v1/test').expect(200, 'success 1').end(cb),
            cb => request(app).get('/v2/test').expect(200, 'success 2').end(cb)
        ], done);
    });

    it('should be able to support multiple paths for the same version', done => {
        let router = Router();
        router.get('/test1', /1/, (req, res) => res.end('success 1'));
        router.get('/test2', /1/, (req, res) => res.end('success 2'));

        let app = express();
        app.use(router);
        async.series([
            cb => request(app).get('/v1/test1').expect(200, 'success 1').end(cb),
            cb => request(app).get('/v1/test2').expect(200, 'success 2').end(cb)
        ], done);
    });

    it('should be able to support semver matching for strings', done => {
        let router = Router();
        router.get('/test', '^1', (req, res) => res.end('success'));

        let app = express();
        app.use(router);
        async.series([
            cb => request(app).get('/v1.0/test').expect(200, 'success').end(cb),
            cb => request(app).get('/v1.1.1/test').expect(200, 'success').end(cb)
        ], done);
    });

    it('should be able to support matching an array of all described methods', done => {
        let router = Router();
        router.get('/test', ['^1', 2, /(3|4)/], (req, res) => res.end('success ' + req.incomingVersion));

        let app = express();
        app.use(router);
        async.series([
            cb => request(app).get('/v1/test').expect(200, 'success 1').end(cb),
            cb => request(app).get('/v2/test').expect(200, 'success 2').end(cb),
            cb => request(app).get('/v3/test').expect(200, 'success 3').end(cb),
            cb => request(app).get('/v4/test').expect(200, 'success 4').end(cb)
        ], done);
    });

    it('should be able to handle a regex path', done => {
        let router = Router();
        router.get(/\/test/, 1, (req, res) => res.end('success'));

        let app = express();
        app.use(router);
        request(app).get('/test?v=1').expect(200, 'success').end(done);
    });

    it('should be able to process multiple handlers', done => {
        let router = Router();
        router.get(/\/test/, 1, (req, res, next) => next(), (req, res) => res.end('success'));

        let app = express();
        app.use(router);
        request(app).get('/test?v=1').expect(200, 'success').end(done);
    });

    it('should still support standard routing for multiple path definitions', done => {
        let router = Router();
        router.get('/test', 1, (req, res, next) => next());
        router.get('/test', 1, (req, res) => res.end('success'));

        let app = express();
        app.use(router);
        request(app).get('/test?v=1').expect(200, 'success').end(done);
    });

    it('should be able to support other request methods on the same path', done => {
        let router = Router();
        router.get('/test', 1, (req, res) => res.end('success get'));
        router.post('/test', 1, (req, res) => res.end('success post'));

        let app = express();
        app.use(router);
        async.series([
            cb => request(app).get('/test').expect(404).end(cb),
            cb => request(app).get('/test?v=1').expect(200, 'success get').end(cb),
            cb => request(app).post('/test?v=1').expect(200, 'success post').end(cb)
        ], done);
    });

    it('should not change the req object if disabled', done => {
        let router = Router({ passVersion: false });
        router.get('/test', ['^1', 2, /(3|4)/], (req, res) => res.end(req.incomingVersion + ' ' + req.acceptedVersion));

        let app = express();
        app.use(router);
        request(app).get('/v1/test').expect(200, 'undefined undefined').end(done);
    });

    it('should support the param method without a version', done => {
        let router = Router();
        router.param('variable', (req, res, next, variable) => res.end('success ' + variable));
        router.get('/:variable', () => {});

        let app = express();
        app.use(router);
        request(app).get('/test').expect(200, 'success test').end(done);
    });

    it('should support the standard route method', done => {
        let router = Router();
        router.route('/test')
        .get((req, res) => res.end('success get'))
        .post((req, res) => res.end('success post'));

        let app = express();
        app.use(router);
        async.series([
            cb => request(app).get('/test').expect(200, 'success get').end(cb),
            cb => request(app).post('/test').expect(200, 'success post').end(cb)
        ], done);
    });

    it('should support middleware functions', done => {
        let router = Router();
        router.use((req, res, next) => next(), (req, res) => res.end('success'));

        let app = express();
        app.use(router);
        request(app).get('/test').expect(200, 'success').end(done);
    });

    it('should support middleware functions with a path', done => {
        let router = Router();
        router.use('/test', (req, res, next) => next(), (req, res) => res.end('success'));

        let app = express();
        app.use(router);
        request(app).get('/test').expect(200, 'success').end(done);
    });
});
