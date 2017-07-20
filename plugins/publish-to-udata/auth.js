'use strict'

const OAuth2Strategy = require('passport-oauth2').Strategy
const dgv = require('./udata')

const strategy = new OAuth2Strategy({
  authorizationURL: process.env.DATAGOUV_URL + '/oauth/authorize',
  tokenURL: process.env.DATAGOUV_URL + '/oauth/token',
  clientID: process.env.DATAGOUV_CLIENT_ID,
  clientSecret: process.env.DATAGOUV_CLIENT_SECRET,
  callbackURL: process.env.DATAGOUV_CB_URL,
}, function(accessToken, refreshToken, profile, done) {
  dgv.getProfile(accessToken)
    .then(profile => {
      profile.accessToken = accessToken
      done(null, profile)
    })
    .catch(done)
})

module.exports = { strategy }
