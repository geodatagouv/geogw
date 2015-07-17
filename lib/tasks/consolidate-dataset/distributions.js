function buildFeatureType(resource) {
    if (resource.type !== 'feature-type') return;
    if (!resource.featureType) return;
    if (!resource.featureType.matchingService) return;

    return {
        type: 'wfs-featureType',
        service: resource.featureType.matchingService,
        typeName: resource.featureType.matchingName || resource.featureType.candidateName,
        available: !!resource.featureType.matchingName
    };
}


function buildFile(resource) {
    if (resource.type !== 'remote-resource') return;
    if (!resource.remoteResource) return;

    return {
        type: 'file-package',
        name: resource.name,
        location: resource.remoteResource.location,
        hashedLocation: resource.remoteResource.hashedLocation,
        available: resource.remoteResource.available
    };
}

exports.buildFeatureType = buildFeatureType;
exports.buildFile = buildFile;
