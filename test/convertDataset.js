/* eslint-env mocha */
const convertDataset = require('../src/helpers/convertDataset');
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
