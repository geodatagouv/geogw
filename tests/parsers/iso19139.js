import expect from 'expect.js';
import fs from 'fs';
import { parseIso } from '../../src/parsers/record/supportedTypes/MD_Metadata';
import libxml from 'libxmljs';

describe('ISO-19139 parser', () => {
    const sampleSrc = fs.readFileSync(__dirname + '/data/geopicardie-tache-urbaine.xml', 'utf8');
    const sample = libxml.parseXml(sampleSrc, { noblanks: true });
    const parsed = parseIso(sample.root());

    describe('#extents', () => {
        const extents = parsed.extents;
        it('should read all extents', () => expect(extents.length).to.be.eql(8));
        const extent = extents[0];
        it('should read all properties', () => expect(extent).to.be.eql({
            description: 'CC des Pays d\'Oise et d\'Halatte',
            minX: 2.48302188904224,
            maxX: 2.7161891493348334,
            minY: 49.2426356903796,
            maxY: 49.39528872551829
        }));
    });

});