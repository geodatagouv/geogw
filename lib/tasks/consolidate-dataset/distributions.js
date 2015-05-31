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
    if (resource.remoteResource.type !== 'file-distribution') return;

    return {
        type: 'file-package',
        location: resource.remoteResource.location,
        available: resource.remoteResource.available
    };
}

exports.buildFeatureType = buildFeatureType;
exports.buildFile = buildFile;
