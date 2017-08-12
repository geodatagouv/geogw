'use strict'

/* eslint-env mocha */
const { normalizeTypeName } = require('../lib/jobs/consolidate-record/feature-types')
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
        expect(normalizeTypeName(testCase)).to.be(testCases[testCase])
      })
    })
  })

})
