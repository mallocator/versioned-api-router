/* global describe, it, beforeEach, afterEach */
'use strict';

var expect = require('chai').expect;


var verifier = require('../lib/apiVerifier');


describe('verifier', () => {
    /**
     * @returns {ParamDef}
     */
    function mkParam(type, def, required = true, min, max) {
        var param = {
            array: type.endsWith('[]'),
            type: type.replace('[]', ''),
            default: def,
            required
        };
        min && (param.min = min);
        max && (param.max = max);
        return param;
    }

    describe('#configure()', () => {
        it('should normalize the configuration parameters', () => {
            var context = {
                endpoints: {},
                configuration: {
                    paramOrder: [ 'query' ]
                }
            };
            var api = {
                description: 'This is a test',
                params: {
                    name: 'string()',
                    age: 'number(30)',
                    married: 'boolean'
                }
            };
            verifier.configure(context, {
                method: 'get',
                path: '/test',
                api,
                version: []
            });
            expect(context.endpoints).to.deep.equal({
                "/test": {
                    GET: {
                        description: 'This is a test',
                        paramMap: 'args',
                        paramOrder: ['query'],
                        params: {
                            age: {
                                default: 30,
                                required: false,
                                array: false,
                                type: 'number',
                                error: undefined,
                                validate: undefined,
                                success: undefined
                            },
                            married: {
                                required: true,
                                array: false,
                                type: 'boolean',
                                default: undefined,
                                error: undefined,
                                validate: undefined,
                                success: undefined
                            },
                            name: {
                                required: false,
                                array: false,
                                type: 'string',
                                default: undefined,
                                error: undefined,
                                validate: undefined,
                                success: undefined
                            }
                        }
                    }
                }
            });
        });

        it('should apply global configuration options to individual endpoints', () => {
            var context = {
                endpoints: {},
                configuration: {
                    paramOrder: [ 'query' ],
                    error: 'error method',
                    validate: 'validate method',
                    success: 'success method'
                }
            };
            var api = {
                description: 'This is a test',
                params: {
                    name: 'string()',
                    age: 'number(30)',
                    married: 'boolean'
                }
            };
            verifier.configure(context, {
                method: 'get',
                path: '/test',
                api,
                version: []
            });
            expect(context.endpoints).to.deep.equal({
                "/test": {
                    GET: {
                        description: 'This is a test',
                        paramMap: 'args',
                        paramOrder: ['query'],
                        params: {
                            age: {
                                default: 30,
                                array: false,
                                required: false,
                                type: 'number',
                                error: 'error method',
                                validate: 'validate method',
                                success: 'success method'
                            },
                            married: {
                                required: true,
                                array: false,
                                type: 'boolean',
                                default: undefined,
                                error: 'error method',
                                validate: 'validate method',
                                success: 'success method'
                            },
                            name: {
                                required: false,
                                array: false,
                                type: 'string',
                                default: undefined,
                                error: 'error method',
                                validate: 'validate method',
                                success: 'success method'
                            }
                        }
                    }
                }
            });
        });
    });

    describe('#parseParam()', () => {
        it('should parse all simple types', () => {
            expect(verifier.parseParam('string')).to.deep.equal(mkParam('string'));
            expect(verifier.parseParam('number')).to.deep.equal(mkParam('number'));
            expect(verifier.parseParam('float')).to.deep.equal(mkParam('float'));
            expect(verifier.parseParam('double')).to.deep.equal(mkParam('double'));
            expect(verifier.parseParam('integer')).to.deep.equal(mkParam('integer'));
            expect(verifier.parseParam('short')).to.deep.equal(mkParam('short'));
            expect(verifier.parseParam('bool')).to.deep.equal(mkParam('bool'));
            expect(verifier.parseParam('boolean')).to.deep.equal(mkParam('boolean'));
            expect(verifier.parseParam.bind(null, 'something')).to.throw(Error);
        });

        it('should allow for optional params', () => {
            expect(verifier.parseParam('string()')).to.deep.equal(mkParam('string', undefined, false));
            expect(verifier.parseParam('number()')).to.deep.equal(mkParam('number', undefined, false));
            expect(verifier.parseParam('bool()')).to.deep.equal(mkParam('bool', undefined, false));
            expect(verifier.parseParam.bind(null, 'something()')).to.throw(Error);
        });

        it('should allow to set default params', () => {
            expect(verifier.parseParam('string(hello)')).to.deep.equal(mkParam('string', 'hello', false));
            expect(verifier.parseParam('number(20)')).to.deep.equal(mkParam('number', 20, false));
            expect(verifier.parseParam('bool(false)')).to.deep.equal(mkParam('bool', false, false));
            expect(verifier.parseParam.bind(null, 'something(someval)')).to.throw(Error);
        });

        it('should check that passed in params have all required fields', () => {
            expect(verifier.parseParam({ type: 'string' })).to.deep.equal(mkParam('string'));
            expect(verifier.parseParam({ type: 'string', required: false })).to.deep.equal(mkParam('string', undefined, false));
            expect(verifier.parseParam({ type: 'string', required: true })).to.deep.equal(mkParam('string', undefined, true));
            expect(verifier.parseParam({ type: 'string', default: 'test'})).to.deep.equal(mkParam('string', 'test', false));
        });

        it('should parse array version of all types', () => {
            expect(verifier.parseParam('string[]')).to.deep.equal(mkParam('string[]'));
            expect(verifier.parseParam('number[]()')).to.deep.equal(mkParam('number[]', undefined, false));
            expect(verifier.parseParam('bool[](false, true,true)')).to.deep.equal(mkParam('bool[]', [false, true, true], false));
        });
    });

    describe('#getParams()', () => {
        it('should return all parameters parsed in the right order', () => {
            var config = {
                paramOrder: ['params', 'query', 'body'],
                params: {
                    name: {
                        type: 'string'
                    },
                    age: {
                        type: 'number'
                    }
                }
            };
            var request = {
                params: {
                    name: 'Dough'
                },
                query: {
                    age: 30,
                    name: 'Doe'
                },
                body: {
                    age: 25,
                    name: 'Doh'
                }
            };
            var response = verifier.getParams(config, request);
            expect(response).to.deep.equal({
                name: 'Dough',
                age: 30
            });
        });
    });

    describe('#checkParams()', () => {
        it('should not reject an empty parameter list', () => {
            var config = {
                params: {
                    age: mkParam('number')
                }
            };
            var errors = verifier.checkParams(config, {});
            expect(errors).to.deep.equal({
                age: {
                    error: "not set",
                    type: "number"
                }
            });
        });

        it('should return an error for each missing parameters', () => {
            var config = {
                params: {
                    age: mkParam('number'),
                    name: mkParam('string')
                }
            };
            var errors = verifier.checkParams(config, {});
            expect(errors).to.deep.equal({
                age: {
                    error: "not set",
                    type: "number"
                },
                name: {
                    error: "not set",
                    type: "string"
                }
            });
        });

        it('should allow a request with all parameters set to pass', () => {
            var config = {
                params: {
                    age: mkParam('number'),
                    name: mkParam('string')
                }
            };
            var params = {
                age: 25,
                name: 'Jauhn Dough'
            };
            var errors = verifier.checkParams(config, params);
            expect(errors).to.deep.equal({});
        });

        it('should ignore params that have an empty or non empty default setting', () => {
            var config = {
                params: {
                    age: mkParam('number', 30, false),
                    name: mkParam('string', 'Jauhn Dough', false)
                }
            };
            var errors = verifier.checkParams(config, {});
            expect(errors).to.deep.equal({});
        });

        it('should check that minimum limits are respected', () => {
            var config = {
                params: {
                    age: mkParam('number', undefined, true, 10),
                    name: mkParam('string', undefined, true, 5)
                }
            };
            var params = {
                age: 9,
                name: '1234'
            };
            var errors = verifier.checkParams(config, params);
            expect(errors).to.deep.equal({
                age: {
                    error: "value below min value",
                    min: 10,
                    type: "number"
                },
                name: {
                    error: "value below min value",
                    min: 5,
                    type: "string"
                }
            });
        });

        it('should check that maximum limits are respected', () => {
            var config = {
                params: {
                    age: mkParam('number', undefined, true, undefined, 10),
                    name: mkParam('string', undefined, true, undefined, 5)
                }
            };
            var params = {
                age: 11,
                name: '123456'
            };
            var errors = verifier.checkParams(config, params);
            expect(errors).to.deep.equal({
                age: {
                    error: 'value exceeds max value',
                    max: 10,
                    type: 'number'
                },
                name: {
                    error: 'value exceeds max value',
                    max: 5,
                    type: 'string'
                }
            });
        });

        it('should be able to use a custom validator', () => {
            var ageDef = mkParam('number');
            ageDef.validate = (value, name, config) => {
                expect(value).to.equal(11);
                expect(name).to.equal('age');
                expect(config).to.deep.equal(ageDef);
                return 'Test error';
            };
            var config = {
                params: {
                    age: ageDef
                }
            };
            var params = {
                age: 11
            };
            var errors = verifier.checkParams(config, params);
            expect(errors).to.deep.equal({
                age: {
                    error: 'Test error',
                    type: 'number'
                }
            });
        });
    });

    describe('#fillParams()', () => {
        it('should fill parameters with the right primitive types', () => {
            var config = {
                params: {
                    age: mkParam('number', 25),
                    name: mkParam('string', 'Jauhn Dough')
                }
            };
            var result = verifier.fillParams(config, {});
            expect(result.age).to.equal(25);
            expect(result.age).to.not.equal('25');
            expect(result.name).to.equal('Jauhn Dough');
        });

        it('should keep empty defaults as undefined', () => {
            var config = {
                params: {
                    age: mkParam('number')
                }
            };
            var result = verifier.fillParams(config, {});
            expect(result).to.deep.equal({
                age: undefined
            })
        });

        it('should only fill parameters that haven\'t been set yet', () => {
            var config = {
                params: {
                    age: mkParam('number', 25),
                    name: mkParam('string', 'Jauhn Dough')
                }
            };
            var params = {
                name: 'The Narrator',
                origin: 'unknown'
            };
            var result = verifier.fillParams(config, params);
            expect(result).to.deep.equal({
                name: 'The Narrator',
                age: 25,
                origin: 'unknown'
            })
        });
    });

    describe('#verify()', () => {
        it('should be able to use a custom error handler', done => {
            var chain = () => {};
            var request = {
                route: {
                    path: '/test'
                },
                method: 'GET',
                params: {}
            };
            var response = {};
            var context = {
                globalConfiguration: {
                    paramOrder: [ 'params' ]
                },
                endpoints: {
                    '/test': {
                        GET: {
                            error: (error, req, res, next) => {
                                expect(error).to.be.instanceOf(Error);
                                expect(req).to.deep.equal(request);
                                expect(res).to.deep.equal(response);
                                expect(next).to.deep.equal(chain);
                                done();
                            },
                            params: {
                                age: 'number'
                            }
                        }
                    }
                }
            };

            verifier.verify.call(context, request, response, chain);
        });

        it('should be able to use a custom success handler', done => {
            var chain = () => {};
            var request = {
                route: {
                    path: '/test'
                },
                method: 'GET',
                params: {}
            };
            var response = {
                status: () => response,
                json: () => response,
                end: () => response
            };
            var context = {
                endpoints: {
                    '/test': {
                        GET: {
                            success: (error, req, res, next) => {
                                expect(error).to.be.not.ok;
                                expect(req).to.deep.equal(request);
                                expect(res).to.deep.equal(response);
                                expect(next).to.deep.equal(chain);
                                done();
                            },
                            paramOrder: [ 'params' ],
                            params: {
                                age: 'number'
                            }
                        }
                    }
                }
            };

            verifier.verify.call(context, request, response, chain);
        });
    });
});
