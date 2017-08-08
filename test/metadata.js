'use strict'

/* eslint-env mocha */
const { getLicenseFromLinks } = require('../lib/metadata/common/licenses')
const { getAllContacts } = require('../lib/metadata/iso/contacts')
const { getDates, getSpatialResolution } = require('../lib/metadata/iso')
const expect = require('expect.js')

describe('convertDataset.getLicenseFromLinks()', () => {

  describe('called with an empty array', () => {
    it('should return undefined', () => {
      const result = getLicenseFromLinks([])
      expect(result).to.be(undefined)
    })
  })

  describe('called with an array containing a link to French Open License', () => {
    it('should return fr-lo', () => {
      const result = getLicenseFromLinks([
        {
          name: 'Licence ouverte (Etalab)',
        },
      ])
      expect(result).to.be('fr-lo')
    })
  })

})

describe('convertDataset.getAllContacts()', () => {
  describe('called with representative metadata', () => {
    it('should return contacts array', () => {
      const metadata = {
        contact: {
          organisationName: 'Tralala',
          individualName: 'Régis',
          role: 'OWNER',
          contactInfo: {
            address: {
              deliveryPoint: '1 rue République',
              postalCode: '75015',
              city: 'Paris 15e',
              electronicMailAddress: 'info@acme.org',
              country: 'Groland',
            },
            phone: {
              voice: '0147200001',
              facSimile: '3615',
            },
          },
        },
        identificationInfo: {
          pointOfContact: [
            {
              organisationName: 'ACME',
            },
            {
              individualName: 'AAA',
            },
          ],
        },
      }
      const result = getAllContacts(metadata)
      expect(result).to.eql([
        {
          organizationName: 'Tralala',
          role: 'owner',
          address: '1 rue République',
          postalCode: '75015',
          town: 'Paris 15e',
          email: 'info@acme.org',
          country: 'Groland',
          phoneNumber: '0147200001',
          relatedTo: 'metadata',
        },
        {
          organizationName: 'ACME',
          role: 'notDefined',
          relatedTo: 'data',
        },
      ])
    })
  })
})

describe('convertDataset.getDates()', () => {
  it('should extract dates', () => {
    const record = {
      identificationInfo: {
        citation: {
          date: [
            {
              date: '1980-01-01',
            },
            {
              date: 'lol',
              dateType: 'creation',
            },
            {
              date: '2000-01-01',
              dateType: 'creation',
            },
            {
              date: '2005-01-01',
              dateType: 'creation',
            },
            {
              date: '2010-01-01',
              dateType: 'revision',
            },
            {
              date: '2012-01-01',
              dateType: 'revision',
            },
          ],
        },
      },
    }
    expect(getDates(record)).to.eql({
      creationDate: '2000-01-01',
      revisionDate: '2012-01-01',
    })
  })
})

describe('convertDataset.getSpatialResolution()', () => {
  function buildWithValues(value, unit) {
    return {
      identificationInfo: {
        spatialResolution: {
          distance: { value, unit },
        },
      },
    }
  }
  describe('no value', () => {
    it('should return undefined', () => {
      expect(getSpatialResolution(buildWithValues(undefined, 'meter'))).to.be(undefined)
    })
  })
  describe('NaN value', () => {
    it('should return undefined', () => {
      expect(getSpatialResolution(buildWithValues(NaN, 'meter'))).to.be(undefined)
    })
  })
  describe('value with known unit', () => {
    it('should return value with unit', () => {
      expect(getSpatialResolution(buildWithValues(1, 'rad'))).to.eql({
        value: 1,
        unit: 'radian',
      })
      expect(getSpatialResolution(buildWithValues(1, 'deg'))).to.eql({
        value: 1,
        unit: 'degree',
      })
    })
  })
  describe('value with no unit', () => {
    it('should default to meter', () => {
      expect(getSpatialResolution(buildWithValues(1, undefined))).to.eql({
        value: 1,
        unit: 'meter',
      })
    })
  })
})
