/* eslint-env mocha */
const normalizeProducerNames = require('../france/normalizeProducerNames');
const expect = require('expect.js');

describe('normalizeProducerNames()', () => {

  describe('unknown or valid typography', () => {
    it('should return the same string', () => {
      expect(normalizeProducerNames('This is a test')).to.be('This is a test');
    });
  });

  describe('rewritable typography', () => {
    it('should return the same string', () => {
      expect(normalizeProducerNames('ANFR')).to.be('Agence Nationale des Fréquences (ANFR)');
    });
  });

  describe('erroneous typography', () => {
    it('should throw an error', () => {
      expect(() => normalizeProducerNames('-- Organisation --')).to.throwException(err => {
        expect(err.message).to.be('Rejected value');
      });
    });
  });

});
