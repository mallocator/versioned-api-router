/* global describe, it, beforeEach, afterEach */
const expect = require('chai').expect;
const express = require('express');
const request = require('supertest');
const stream = require('stream');

const Router = require('..');


describe('Api Router', () => {
    it('should process normal requests same as the default router', done => {
        let router = Router();
        router.get('/test', (req, res) => res.end('success'));

        let app = express();
        app.use(router);
        request(app).get('/test').expect(200, 'success').end(done);
    });

    it('should make all incoming and default parameters available on the request handler', done => {
        let router = Router();
        let config = {
            params: {
                var1: 'number',
                var2: 'string(foo)'
            }
        };

        router.get('/test', config, (req, res) => {
            expect(req.args.var1).to.equal(25);
            expect(req.args.var2).to.equal('foo');
            res.end('success');
        });

        let app = express();
        app.use(router);
        request(app).get('/test?var1=25').expect(200).end(done);
    });

    it('should recognize falsy values', done => {
        let router = Router();
        let config = {
            params: {
                var1: 'number',
                var2: 'boolean'
            }
        };

        router.get('/test', config, (req, res) => {
            expect(req.args.var1).to.equal(0);
            expect(req.args.var2).to.equal(false);
            res.end('success');
        });

        let app = express();
        app.use(router);
        request(app).get('/test?var1=0&var2=false').expect(200).end(done);
    });

    it('should not throw an error when no params have been configured', done => {
        let router = Router();
        let config = {
            description: 'this is a test',
            params: {}
        };

        router.post('/test', 1, config, (req, res) => res.end('success'));

        let app = express();
        app.use(router);
        request(app).post('/v1/test').send({param:'val'}).expect(200).end(done);
    });

    it('should make all be able to use parameters from multiple sources', done => {
        let router = Router();
        let config = {
            params: {
                var1: 'number',
                var2: 'string(foo)',
                var3: 'bool',
                var4: 'any(true)'
            }
        };

        router.get('/test/:var3', config, (req, res) => {
            expect(req.args.var1).to.equal(25);
            expect(req.args.var2).to.equal('foo');
            expect(req.args.var3).to.equal(true);
            expect(req.args.var4).to.equal('true');
            res.end('success');
        });

        let app = express();
        app.use(router);
        request(app).get('/test/true?var1=25').expect(200).end(done);
    });

    it('should verify all incoming parameters', done => {
        process.env.NODE_ENV = '';

        let router = Router();
        let config = {
            params: {
                var1: 'number'
            }
        };
        router.get('/test', config, (req, res) => res.end('success'));

        let app = express();
        app.use(router);
        request(app).get('/test').expect(422).end(done);
    });

    it('should verify all incoming parameters and complain about missing ones in development mode', done => {
        process.env.NODE_ENV = 'development';

        let router = Router();
        let config = {
            params: {
                var1: 'number',
                var2: 'number(1)',
                var3: 'string',
                var4: 'string(test)',
                var5: 'boolean',
                var6: 'boolean(true)'
            }
        };
        router.get('/test', config, (req, res) => res.end('success'));

        let app = express();
        app.use(router);
        // suppress error in console
        app.use((err, req, res, next) => {});
        request(app).get('/test').expect(422, {
            error: 'Required parameters are missing',
            params: {
                var1: { error: 'not set', type: 'number' },
                var3: { error: 'not set', type: 'string' },
                var5: { error: 'not set', type: 'boolean' }
            }
        }).end(done);
    });

    it('should support arrays in get parameters', done => {
        let router = Router();
        let config = {
            params: {
                var1: 'number[]'
            }
        };

        router.get('/test', config, (req, res) => {
            expect(req.args.var1).to.deep.equal([25, 30]);
            res.end('success');
        });

        let app = express();
        app.use(router);
        request(app).get('/test?var1=25&var1=30').expect(200).end(done);
    });

    it('should support arrays in query parameters', done => {
        let router = Router();
        let config = {
            params: {
                var1: 'number[]'
            }
        };

        router.get('/test/:var1', config, (req, res) => {
            expect(req.args.var1).to.deep.equal([25, 30]);
            res.end('success');
        });

        let app = express();
        app.use(router);
        request(app).get('/test/25,30').expect(200).end(done);
    });

    it('should return an api map', done => {
        let router = Router();
        let config = {
            description: 'An express endpoint',
            params: {
                var1: 'number'
            }
        };

        router.get('/test', config, (req, res) => {});

        let app = express();
        app.get('/api', router.api);
        request(app).get('/api').expect(200, {
            '/test': {
                GET: {
                    description: 'An express endpoint',
                    paramMap: 'args',
                    paramOrder: [ 'params', 'query', 'cookie', 'body', 'header' ],
                    params: {
                        var1: {
                            array: false,
                            required: true,
                            type: 'number'
                        }
                    },
                    versions: [ 0 ]
                }
            }
        }).end(done);
    });

    it('should return a prefixed api path', done => {
        let router = Router({ prefix: '/prefix' });
        let config = {
            description: 'An express endpoint',
            params: {
                var1: 'number'
            }
        };

        router.get('/test', config, (req, res) => {});

        expect(router.endpoints).to.deep.equal({
            '/prefix/test': {
                GET: {
                    description: 'An express endpoint',
                    paramMap: 'args',
                    paramOrder: [ 'params', 'query', 'cookie', 'body', 'header' ],
                    params: {
                        var1: {
                            array: false,
                            required: true,
                            type: 'number',
                            default: undefined,
                            error: undefined,
                            success: undefined,
                            validate: undefined
                        }
                    },
                    versions: [ 0 ]
                }
            }
        });

        let app = express();
        app.get('/api', router.api);
        request(app).get('/api').expect(200, {
            '/prefix/test': {
                GET: {
                    description: 'An express endpoint',
                    paramMap: 'args',
                    paramOrder: [ 'params', 'query', 'cookie', 'body', 'header' ],
                    params: {
                        var1: {
                            array: false,
                            required: true,
                            type: 'number'
                        }
                    },
                    versions: [ 0 ]
                }
            }
        }).end(done);
    });

    it('should return a nested api path', done => {
        let app = express();

        let parentRouter = Router();
        app.use('/parent', parentRouter);

        let router = Router();
        parentRouter.use('/nested', router);

        let config = {
            description: 'An express endpoint',
            params: {
                var1: 'number'
            }
        };
        router.get('/test', config, (req, res) => {});
        router.get('/api', router.api);

        request(app).get('/parent/nested/api').expect(200, {
            '/parent/nested/test': {
                GET: {
                    description: 'An express endpoint',
                    paramMap: 'args',
                    paramOrder: [ 'params', 'query', 'cookie', 'body', 'header' ],
                    params: {
                        var1: {
                            array: false,
                            required: true,
                            type: 'number'
                        }
                    },
                    versions: [ 0 ]
                }
            }
        }).end(done);
    });

    it('should allow the user to overwrite the api prefix', done => {
        let app = express();

        let parentRouter = Router();
        app.use('/parent', parentRouter);

        let router = Router({ prefix: '/custom'});
        parentRouter.use('/nested', router);

        let config = {
            description: 'An express endpoint',
            params: {
                var1: 'number'
            }
        };
        router.get('/test', config, (req, res) => {});
        router.get('/api', router.api);

        request(app).get('/parent/nested/api').expect(200, {
            '/custom/test': {
                GET: {
                    description: 'An express endpoint',
                    paramMap: 'args',
                    paramOrder: [ 'params', 'query', 'cookie', 'body', 'header' ],
                    params: {
                        var1: {
                            array: false,
                            required: true,
                            type: 'number'
                        }
                    },
                    versions: [ 0 ]
                }
            }
        }).end(done);
    });
});
