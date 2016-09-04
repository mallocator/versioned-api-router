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
        request(app).get('/test').expect(404).end();
        request(app).get('/v1/test').expect(200, 'success').end(done);
    });

    it('should only process versioned requests using a header', done => {
        var router = Router();
        router.get('/test', 1, (req, res) => res.end('success'));

        var app = express();
        app.use(router);
        request(app).get('/test').expect(404).end();
        request(app).get('/test').set('X-ProtocolVersion', 1).expect(200, 'success').end(done);
    });

    it('should only process versioned requests using a get parameter', done => {
        var router = Router();
        router.get('/test', 1, (req, res) => res.end('success'));

        var app = express();
        app.use(router);
        request(app).get('/test').expect(404).end();
        request(app).get('/test?v=1').expect(200, 'success').end(done);
    });
});