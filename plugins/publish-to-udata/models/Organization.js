'use strict';

const mongoose = require('mongoose');
const Promise = require('bluebird');
const { addUserToOrganization, removeUserFromOrganization } = require('../udata');

const Schema = mongoose.Schema;
const { ObjectId } = Schema.Types;

const schema = new Schema({

    /* Dates */
    createdAt: Date,
    updatedAt: Date,

    /* Status */
    enabled: Boolean,

    /* Configuration */
    sourceCatalogs: [ObjectId],
    publishAll: Boolean,

});

schema.method('enable', function (accessToken) {
  if (this.enabled) return Promise.resolve(this);

  const userId = process.env.UDATA_PUBLICATION_USER_ID;
  return addUserToOrganization(userId, this._id, accessToken)
    .then(() => this.set('enabled', true).save())
    .thenReturn(this);
});

schema.method('disable', function (accessToken) {
  if (!this.enabled) return Promise.resolve(this);

  const userId = process.env.UDATA_PUBLICATION_USER_ID;
  return removeUserFromOrganization(userId, this._id, accessToken)
    .then(() => this.set('enabled', false).save())
    .thenReturn(this);
});

schema.pre('save', function (next) {
  if (this.isNew) {
    this.createdAt = new Date();
    this.enabled = false;
    this.publishAll = false;
  }
  this.updatedAt = new Date();
  next();
});

mongoose.model('Organization', schema);
