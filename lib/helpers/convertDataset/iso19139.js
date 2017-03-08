const { get, uniq, compact, flatten, pick, identity } = require('lodash');
const bboxPolygon = require('@turf/bbox-polygon');
const union = require('@turf/union');


function getUniformArray(src) {
    return uniq(compact(flatten(src)));
}

function getAllKeywords(metadata) {
    const candidateKeywords = [get(metadata, 'identificationInfo.topicCategory')];
    const descriptiveKeywords = get(metadata, 'identificationInfo.descriptiveKeywords') || [];
    descriptiveKeywords.forEach(dk => candidateKeywords.push(dk.keyword));
    return getUniformArray(candidateKeywords);
}

function getAllOnLineResources(metadata) {
    const candidateLinks = [];
    const transferOptions = get(metadata, 'distributionInfo.transferOptions') || [];
    transferOptions.forEach(to => (to.onLine || []).forEach(resource => candidateLinks.push(resource)));
    return getUniformArray(candidateLinks);
}

function validateEmail(email) {
    if (!email) return false;
    const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email);
}

const ROLES_MAPPING = {
	owner: 'owner',
	pointofontact: 'pointOfContact',
	author: 'author',
	distributor: 'distributor',
	custodian: 'custodian',
	processor: 'processor',
	publisher: 'publisher',
	originator: 'originator',
	resourceprovider: 'resourceProvider',
	principalinvestigator: 'principalInvestigator',
	user: 'user',
	'propriã©taire': 'owner',
	provider: 'resourceProvider',
	'point of contact': 'pointOfContact',
  '': 'notDefined'
};

function getAllContacts(metadata) {
  const contacts = [];

  function pushContact(originalContact, type) {
    if (!originalContact.organisationName) return;
    const candidateEmail = get(originalContact, 'contactInfo.address.electronicMailAddress');
    const candidateRole = (originalContact.role || '').toLowerCase();
    const role = candidateRole in ROLES_MAPPING ? ROLES_MAPPING[candidateRole] : 'other';
    const contact = {
      organizationName: originalContact.organisationName,
      role,
      email: validateEmail(candidateEmail) ? candidateEmail : undefined,
      address: get(originalContact, 'contactInfo.address.deliveryPoint'),
      town: get(originalContact, 'contactInfo.address.city'),
      postalCode: get(originalContact, 'contactInfo.address.postalCode'),
      country: get(originalContact, 'contactInfo.address.country'),
      phoneNumber: get(originalContact, 'contactInfo.phone.voice'),
    };
    contacts.push(Object.assign({ relatedTo: type }, pick(contact, identity)));
  }

  if (metadata.contact) {
    pushContact(metadata.contact, 'metadata');
  }

  if (metadata.identificationInfo && metadata.identificationInfo.pointOfContact) {
    metadata.identificationInfo.pointOfContact.forEach(contact => {
      pushContact(contact, 'data');
    });
  }

  return contacts;
}

function getConsolidatedExtent(metadata) {
  if (!metadata.identificationInfo.extent) return;
  const bboxPolygons = metadata.identificationInfo.extent
    .map(extent => {
      const g = extent.geographicElement;
      if (!g) return;
      return [g.westBoundLongitude, g.southBoundLatitude, g.eastBoundLongitude, g.northBoundLatitude];
    })
    .filter(bbox => !!bbox)
    .map(bbox => bboxPolygon(bbox));

  if (bboxPolygons.length === 0) return;

  return bboxPolygons.length === 1 ? bboxPolygons[0].geometry : union(...bboxPolygons).geometry;
}

const UPDATE_FREQUENCIES = [
  'continual',
  'daily',
  'weekly',
  'fortnightly',
  'quarterly',
  'biannually',
  'annually',
  'asNeeded',
  'irregular',
  'notPlanned',
  'unknown',
];

const UPDATE_FREQUENCIES_MAPPING = {};

UPDATE_FREQUENCIES.forEach(uf => UPDATE_FREQUENCIES_MAPPING[uf.toLowerCase()] = uf);

function getUpdateFrequency(metadata) {
  const candidateValue = (get(metadata, 'identificationInfo.resourceMaintenance.maintenanceAndUpdateFrequency') || '')
    .toLowerCase();
  if (!candidateValue) return;
  return candidateValue in UPDATE_FREQUENCIES_MAPPING ? UPDATE_FREQUENCIES_MAPPING[candidateValue] : 'other';
}

module.exports = {
  getAllContacts,
  getAllKeywords,
  getAllOnLineResources,
  getConsolidatedExtent,
  getUpdateFrequency,
};
