function buildOriginalDistribution(resource) {
    if (resource.type !== 'remote-resource') return;
    if (!resource.remoteResource) return;

    return {
        type: 'file-package',
        originalDistribution: true,
        name: resource.name,
        location: resource.remoteResource.location,
        hashedLocation: resource.remoteResource.hashedLocation,
        available: resource.remoteResource.available
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

exports.buildLayers = buildLayers;
exports.buildOriginalDistribution = buildOriginalDistribution;
