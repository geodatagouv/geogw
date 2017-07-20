'use strict'

const passport = require('passport')

passport.use('udata', require('./auth').strategy)
passport.serializeUser((user, done) => done(null, user))
passport.deserializeUser((user, done) => done(null, user))
