'use strict'

const { get, pickBy } = require('lodash')

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
  '': 'notDefined',
}

function validateEmail(email) {
  if (!email) return false
  const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/ // eslint-disable-line
  return re.test(email)
}

exports.getAllContacts = function (metadata) {
  const contacts = []

  function pushContact(originalContact, type) {
    if (!originalContact.organisationName) return
    const candidateEmail = get(originalContact, 'contactInfo.address.electronicMailAddress')
    const candidateRole = (originalContact.role || '').toLowerCase()
    const role = candidateRole in ROLES_MAPPING ? ROLES_MAPPING[candidateRole] : 'other'
    const contact = {
      organizationName: originalContact.organisationName,
      role,
      email: validateEmail(candidateEmail) ? candidateEmail : undefined,
      address: get(originalContact, 'contactInfo.address.deliveryPoint'),
      town: get(originalContact, 'contactInfo.address.city'),
      postalCode: get(originalContact, 'contactInfo.address.postalCode'),
      country: get(originalContact, 'contactInfo.address.country'),
      phoneNumber: get(originalContact, 'contactInfo.phone.voice'),
    }
    contacts.push(Object.assign({ relatedTo: type }, pickBy(contact)))
  }

  if (metadata.contact) {
    pushContact(metadata.contact, 'metadata')
  }

  if (metadata.identificationInfo && metadata.identificationInfo.pointOfContact) {
    metadata.identificationInfo.pointOfContact.forEach(contact => {
      pushContact(contact, 'data')
    })
  }

  return contacts
}
