var ogr2ogr = require('ogr2ogr');


function downloadDataset(req, res) {
    var layerName = req.ogr2ogr.layerName;
    var options = [layerName];

    var ogrstream = ogr2ogr(req.ogr2ogr.src)
        .timeout(60000);

    // Projection
    if (req.query.projection === 'WGS84') {
        ogrstream.project('EPSG:4326');
    } else if (req.query.projection === 'Lambert93') {
        ogrstream.project('EPSG:2154');
    } else {
        return res.status(400).send({
            code: 400,
            message: 'No valid projection given'
        });
    }

    // Format
    if (req.query.format === 'GeoJSON') {
        res.type('json');
        res.attachment(layerName + '.json');
        options.push('-explodecollections');
    } else if (req.query.format === 'KML') {
        res.type('application/vnd.google-earth.kml+xml');
        res.attachment(layerName + '.kml');
        ogrstream.format('KML');
        options.push('-explodecollections');
    } else if (req.query.format === 'SHP') {
        res.type('application/x-shapefile');
        res.attachment(layerName + '.zip');
        ogrstream.format('ESRI Shapefile');
    } else if (req.query.format === 'CSV') {
        res.type('text/csv');
        res.attachment(layerName + '.csv');
        ogrstream.format('CSV');
    } else {
        return res.status(400).send({
            code: 400,
            message: 'No valid format given'
        });
    }

    ogrstream.options(options).stream().pipe(res);
}


exports.downloadDataset = downloadDataset;
