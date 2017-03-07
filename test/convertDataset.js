/* eslint-env mocha */
const convertDataset = require('../lib/helpers/convertDataset');
const { getAllContacts } = require('../lib/helpers/convertDataset/iso19139');
const expect = require('expect.js');

describe('convertDataset.getLicenseFromLinks()', () => {
    const getLicenseFromLinks = convertDataset.getLicenseFromLinks;

    describe('called with an empty array', () => {
        it('should return undefined', () => {
            const result = getLicenseFromLinks([]);
            expect(result).to.be(undefined);
        });
    });

    describe('called with an array containing a link to French Open License', () => {
        it('should return fr-lo', () => {
            const result = getLicenseFromLinks([
                {
                    name: 'Licence ouverte (Etalab)'
                }
            ]);
            expect(result).to.be('fr-lo');
        });
    });

});

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
              }
            }
          },
          identificationInfo: {
            pointOfContact: [
              {
                organisationName: 'ACME'
              },
              {
                individualName: 'AAA'
              }
            ]
          }
        };
        const result = getAllContacts(metadata);
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
          }
        ]);
      });
    });
});
