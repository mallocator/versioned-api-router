/* global describe, it, beforeEach, afterEach */

var async = require('async');
var expect = require('chai').expect;
var express = require('express');
var request = require('supertest');

var Router = require('..');

describe('Router', () => {
    it('should support both api configuration and versioning in one', done => {
        var router = Router();
        router.get('/test', 1, {
            params: {
                var1: 'number',
                var2: 'string(foo)'
            }
        }, (req, res) => res.end('success'));

        var app = express();
        app.use(router);
        async.series([
            cb => request(app).get('/test').expect(404).end(cb),
            cb => request(app).get('/v1/test').expect(422).end(cb),
            cb => request(app).get('/v1/test?var1=25').expect(200, 'success').end(cb)
        ], done);
    });

    it('should support multiple version with different parameters', done => {
        var router = Router();
        router.get('/test', 1, {
            params: {
                var1: 'number',
                var2: 'string(foo)'
            }
        }, (req, res) => {
            expect(req.args.var1).to.equal(25);
            expect(req.args.var2).to.equal('foo');
            expect(req.args.var3).to.be.not.ok;
            res.end('success')
        });

        router.get('/test', 2, {
            params: {
                var3: 'number',
                var2: 'string(foo)'
            }
        }, (req, res) => {
            expect(req.args.var1).to.be.not.ok;
            expect(req.args.var2).to.equal('foo');
            expect(req.args.var3).to.equal(25);
            res.end('success')
        });

        var app = express();
        app.use(router);
        async.series([
            cb => request(app).get('/v2/test?var3=25').expect(200, 'success').end(cb),
            cb => request(app).get('/v1/test?var1=25').expect(200, 'success').end(cb)
        ], done);
    });

    it('should support different version formats', done => {
        var router = Router();
        router.get('/test', 1, {
            params: {
                var1: 'number',
            }
        }, (req, res) => {
            expect(req.args.var1).to.equal(25);
            expect(req.args.var2).to.be.not.ok;
            res.end('success')
        });

        router.get('/test', '2', {
            params: {
                var2: 'number',
            }
        }, (req, res) => {
            expect(req.args.var1).to.be.not.ok;
            expect(req.args.var2).to.equal(25);
            res.end('success')
        });

        router.get('/test', [ 3, 4 ], {
            params: {
                var3: 'number',
            }
        }, (req, res) => {
            expect(req.args.var3).to.equal(25);
            res.end('success')
        });

        router.get('/test', /5/, {
            params: {
                var4: 'number',
            }
        }, (req, res) => {
            expect(req.args.var4).to.equal(25);
            res.end('success')
        });

        var app = express();
        app.use(router);
        async.series([
            cb => request(app).get('/v1/test?var1=25').expect(200, 'success').end(cb),
            cb => request(app).get('/v2/test?var2=25').expect(200, 'success').end(cb),
            cb => request(app).get('/v3/test?var3=25').expect(200, 'success').end(cb),
            cb => request(app).get('/v4/test?var3=25').expect(200, 'success').end(cb),
            cb => request(app).get('/v5/test?var4=25').expect(200, 'success').end(cb)
        ], done);
    });
});
