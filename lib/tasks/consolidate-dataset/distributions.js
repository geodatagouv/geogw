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

exports.buildFeatureType = buildFeatureType;
