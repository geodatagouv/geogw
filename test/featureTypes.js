'use strict'

/* eslint-env mocha */
const { normalizeFeatureTypeName } = require('../lib/featureType')
const expect = require('expect.js')

describe('normalizeFeatureTypeName()', () => {

  describe('basic use cases', () => {
    const testCases = {
      'ABC:DEF:1234': 'def:1234',
      'abcdef': 'abcdef',
      'AZE_TYUP:TYUI_PP': 'tyui_pp',
      'ABCDEF': 'abcdef',
    }
    Object.keys(testCases).forEach(testCase => {
      it(`should normalize ${testCase} into ${testCases[testCase]}`, () => {
        expect(normalizeFeatureTypeName(testCase)).to.be(testCases[testCase])
      })
    })
  })

})
