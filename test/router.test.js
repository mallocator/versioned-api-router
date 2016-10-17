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
});
