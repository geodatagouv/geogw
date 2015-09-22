function buildFeatureType(resource) {
    if (resource.type !== 'feature-type') return;
    if (!resource.featureType) return;
    if (!resource.featureType.matchingService) return;

    return {
        type: 'wfs-featureType',
        service: resource.featureType.matchingService,
        typeName: resource.featureType.matchingName || resource.featureType.candidateName,
        available: !!resource.featureType.matchingName,
        uniqueId: resource.featureType.matchingService + '@@' + (resource.featureType.matchingName || resource.featureType.candidateName)
    };
}


function buildLayers(resource) {
    if (resource.type !== 'remote-resource') return;
    if (!resource.remoteResource) return;
    if (!resource.remoteResource.layers || resource.remoteResource.layers.length === 0) return;

    return resource.remoteResource.layers.map(layer => {
        return {
            type: 'file-package',
            name: resource.name,
            location: resource.remoteResource.location,
            hashedLocation: resource.remoteResource.hashedLocation,
            available: resource.remoteResource.available,
            layer: layer,
            uniqueId: resource.remoteResource.hashedLocation + '@@' + layer
        };
    });
}

exports.buildFeatureType = buildFeatureType;
exports.buildLayers = buildLayers;
