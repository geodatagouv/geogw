'use strict'

require('./config/mongoose')
require('./util/jobs').configure(require('./lib/config/jobs'))
