'use strict'

const { get, groupBy } = require('lodash')
const moment = require('moment')

exports.getDates = function (metadata) {
  const rawDates = get(metadata, 'identificationInfo.citation.date', [])
  const validDates = rawDates.filter(date => moment(date.date, 'YYYY-MM-DD').isValid() && date.dateType)
  const groupedDates = groupBy(validDates, 'dateType')
  const dates = {}

  function selectOne(dates, sort) {
    const candidates = dates.sort((a, b) => {
      const dateA = new Date(a.date)
      const dateB = new Date(b.date)
      return sort === 'older' ? dateA > dateB : dateA < dateB
    })
    return candidates[0].date
  }

  if (groupedDates.creation) {
    dates.creationDate = selectOne(groupedDates.creation, 'older')
  }

  if (groupedDates.revision) {
    dates.revisionDate = selectOne(groupedDates.revision, 'last')
  }

  if (!dates.revisionDate && dates.creationDate) {
    dates.revisionDate = dates.creationDate
  }

  return dates
}
