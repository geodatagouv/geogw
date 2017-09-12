const { get, uniq, compact, flatten, pick, identity, groupBy } = require('lodash');
const bboxPolygon = require('@turf/bbox-polygon');
const union = require('@turf/union');
const { communes, epci, departements, regions } = require('@etalab/fr-bounding-boxes')
const moment = require('moment');
const bboxMatch = require('bbox-match');
const { removeDiacritics } = require('natural');
const themes = require('./themes.json');

const adminLevels = communes
  .concat(epci)
  .concat(departements)
  .concat(regions);

const matchAdminLevel = bboxMatch(adminLevels);

function makeStringComparable(str) {
  return removeDiacritics(str)
    .replace(/(\s|\-|\'|\,)/g, '')
    .toLowerCase();
}

const themesPatterns = {};
themes.forEach(th => {
  themesPatterns[makeStringComparable(th.label.fr)] = th;
  themesPatterns[makeStringComparable(th.label.en)] = th;
});


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

function getBbox(g) {
  let xMin;
  let xMax;
  let yMin;
  let yMax;
  if (g.westBoundLongitude <= g.eastBoundLongitude) {
    xMin = g.westBoundLongitude
    xMax = g.eastBoundLongitude
  } else {
    xMax = g.westBoundLongitude
    xMin = g.eastBoundLongitude
  }
  if (g.northBoundLatitude >= g.southBoundLatitude) {
    yMax = g.northBoundLatitude
    yMin = g.southBoundLatitude
  } else {
    yMin = g.northBoundLatitude
    yMax = g.southBoundLatitude
  }
  return [xMin, yMin, xMax, yMax];
}

function getCoveredTerritories(metadata) {
  return get(metadata, 'identificationInfo.extent', [])
    .map(extent => {
      const g = extent.geographicElement;
      if (!g) return;
      return getBbox(g);
    })
    .filter(bbox => Boolean(bbox))
    .map(bbox => {
      const matchResult = matchAdminLevel(bbox);
      if (matchResult) return matchResult.id;
    })
    .filter(territories => Boolean(territories));
}

function getConsolidatedExtent(metadata) {
  const candidateExtent = get(metadata, 'identificationInfo.extent');
  if (!candidateExtent) return;
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

function getDates(metadata) {
  const rawDates = get(metadata, 'identificationInfo.citation.date', []);
  const validDates = rawDates.filter(date => moment(date.date).isValid() && date.dateType);
  const groupedDates = groupBy(validDates, 'dateType');
  const dates = {};

  function selectOne(dates, sort) {
    const candidates = dates.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return sort === 'older' ? dateA > dateB : dateA < dateB;
    });
    return candidates[0].date;
  }

  if (groupedDates.creation) {
    dates.creationDate = selectOne(groupedDates.creation, 'older');
  }

  if (groupedDates.revision) {
    dates.revisionDate = selectOne(groupedDates.revision, 'last');
  }

  if (!dates.revisionDate && dates.creationDate) {
    dates.revisionDate = dates.creationDate;
  }

  return dates;
}

function getSpatialResolution(record) {
  const { unit, value } = get(record, 'identificationInfo.spatialResolution.distance', {});
  if (!value || isNaN(value)) return;
  if (unit && unit.toLowerCase().startsWith('rad')) {
    return { value, unit: 'radian' };
  }
  if (unit && unit.toLowerCase().startsWith('deg')) {
    return { value, unit: 'degree' };
  }
  return { value, unit: 'meter' };
}

const STATUSES = [
  'completed',
  'historicalArchive',
  'obsolete',
  'onGoing',
  'planned',
  'required',
  'underDevelopment',
];

const STATUSES_MAPPING = {};

STATUSES.forEach(value => STATUSES_MAPPING[value.toLowerCase()] = value);

function getStatus(record) {
  const candidateValue = (get(record, 'identificationInfo.status') || '')
    .toLowerCase().trim();
  if (!candidateValue) return;
  return candidateValue in STATUSES_MAPPING ? STATUSES_MAPPING[candidateValue] : 'unknown';
}

const TOPIC_CATEGORIES = [
  'farming',
  'biota',
  'boundaries',
  'climatologyMeteorologyAtmosphere',
  'economy',
  'elevation',
  'environment',
  'geoscientificInformation',
  'health',
  'imageryBaseMapsEarthCover',
  'intelligenceMilitary',
  'inlandWaters',
  'location',
  'oceans',
  'planningCadastre',
  'society',
  'structure',
  'transportation',
  'utilitiesCommunication',
];

const TOPIC_CATEGORIES_MAPPING = {};

TOPIC_CATEGORIES.forEach(value => TOPIC_CATEGORIES_MAPPING[value.toLowerCase()] = value);

function getTopicCategory(record) {
  const candidateValue = (get(record, 'identificationInfo.topicCategory') || '')
    .toLowerCase().trim();
  if (!candidateValue) return;
  return candidateValue in TOPIC_CATEGORIES_MAPPING ? TOPIC_CATEGORIES_MAPPING[candidateValue] : 'unknown';
}

function getInspireThemeFromKeywords(keywords = []) {
  const candidate = keywords.map(makeStringComparable).find(kwd => kwd in themesPatterns);
  if (candidate) return themesPatterns[candidate];
}


module.exports = {
  getAllContacts,
  getAllKeywords,
  getAllOnLineResources,
  getConsolidatedExtent,
  getUpdateFrequency,
  getDates,
  getSpatialResolution,
  getStatus,
  getTopicCategory,
  getInspireThemeFromKeywords,
  getCoveredTerritories,
};
