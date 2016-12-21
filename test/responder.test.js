/* global describe, it, beforeEach, afterEach */
const expect = require('chai').expect;
const express = require('express');
const request = require('supertest');

const responder = require('../lib/responder');


describe('responder', () => {
    describe('#flatten()', () => {
        it('should convert an api response to a flattened table', () => {
            let response = responder.flatten({
                '/test': {
                    'GET': {
                        description: 'This is a test',
                        params: {
                            name: {
                                type: 'string',
                                description: 'The user name'
                            },
                            age: {
                                type: 'number',
                                description: 'The users age'
                            }
                        }
                    }
                }
            });

            expect(response).to.deep.equal({
                title: 'Api Map',
                headers: [ 'path', 'method', 'description', 'param', 'type', 'paramDescription'],
                rows: [
                    [ '/test', 'GET', 'This is a test', 'name', 'string', 'The user name' ],
                    [ '/test', 'GET', 'This is a test', 'age', 'number', 'The users age' ]
                ]
            });
        });

        it('should convert an error response to a flattened table', () => {
            let response = responder.flatten({
                error: 'Required parameters are missing',
                params: {
                    name: {
                        type: 'string',
                        error: 'not set'
                    },
                    age: {
                        type: 'number',
                        error: 'value exceeds max value',
                        max: 100
                    }
                }
            });

            expect(response).to.deep.equal({
                title: 'Required parameters are missing',
                headers: [ 'param', 'type', 'error', 'max', 'min'],
                rows: [
                    [ 'name', 'string', 'not set', '', '' ],
                    [ 'age', 'number', 'value exceeds max value', 100, '']
                ]
            });
        });
    });

    describe('#formatTable()', () => {
        it('should convert a json object to HTML table', () => {
            let response = responder.formatTable({
                error: 'This is a test',
                params: {
                    name: {
                        type: 'string',
                        error: 'The user name'
                    },
                    age: {
                        type: 'number',
                        error: 'The users age'
                    }
                }
            });

            expect(response).to.equal('<html><body><h1>This is a test</h1><table>' +
                '<thead><th>param</th><th>type</th><th>error</th><th>max</th><th>min</th></thead>' +
                '<tbody><tr><td>name</td><td>string</td><td>The user name</td><td></td><td></td></tr>' +
                '<tr><td>age</td><td>number</td><td>The users age</td><td></td><td></td></tr></tbody>' +
                '</table></body></html>');
        });
    });

    describe('#formatCSV()', () => {
        it('should convert a json object to CSV', () => {
            let response = responder.formatCSV({
                error: 'This is a test',
                params: {
                    name: {
                        type: 'string',
                        error: 'The "user" name'
                    },
                    age: {
                        type: 'number',
                        error: 'The users, age'
                    }
                }
            });

            expect(response).to.equal('param,type,error,max,min\nname,string,The "user" name,,\nage,number,"The users, age",,\n');
        });
    });

    describe('#formatXML()', () => {
        it('should convert a json object to XML', () => {
            let response = responder.formatXML({
                error: 'This is a test',
                params: {
                    name: {
                        type: 'string',
                        error: 'The user name'
                    },
                    age: {
                        type: 'number',
                        error: 'The users age'
                    }
                }
            });

            expect(response).to.equal('<error>This is a test</error><params><name><type>string</type>' +
                '<error>The user name</error></name><age><type>number</type>' +
                '<error>The users age</error></age></params>');
        });
    });

    describe('#respond()', () => {
        it('should respond with an error if an undefined format is selected', done => {
            let app = express();
            app.get('/:format', (req, res) => responder.respond(req, res, { params: {} }));

            request(app).get('/unknownFormat').expect(422, 'Invalid format requested').end(done)
        });

        it('should return a 204 status if the response is empty', done => {
            let app = express();
            app.get('/:format', (req, res) => responder.respond(req, res, {}));

            request(app).get('/any?format=xml').expect(204).end(done)
        });

        it('should respond with the api as a textual json tree', done => {
            let app = express();
            app.get('/:format', (req, res) => responder.respond(req, res, {
                description: 'This is a test',
                params: {
                    age: 'number'
                }
            }));

            request(app).get('/tree').expect(200, '<html><body style="white-space: pre">{\n    ' +
                '"description": "This is a test",\n    "params": {\n        "age": "number"\n    }\n}' +
                '</body></html>').end(done)
        });
    });
});
