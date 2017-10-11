mongoose = require 'mongoose'
Schema = require('mongoose').Schema
_ = require 'underscore'

annotationSchema = Schema({
  domainName: {type: String, required: true}
  endUser: Schema.Types.ObjectId
  parentAnnotId: Schema.Types.ObjectId
  shareSet: [ String ]
  urlFragFree: {type: String, required: true}
  urlFrag: {type: String, required: true }
  content: String
  modifiedDate: {type: Date, default: Date.now}
  createdDate: {type: Date, default: Date.now}
  deleted: { type: Boolean, default: false }
  forPublisher: {type: Boolean, default: false}
  embedded: Object # free metadata/join data
})

annotationSchema.virtual('encUri').get ->
  encodeURIComponent "#{@urlFragFree}##{@urlFrag}"

annotationSchema.virtual('formatedCreatedDate').get ->
  date = new Date @.createdDate
  m = (date.getMonth() + 1)
  month = if m < 10 then "0" + m else m

  d = date.getDate()
  day = if d < 10 then "0" + d else d

  "#{day}-#{month}-#{date.getFullYear()}"

annotationSchema.virtual('ebookId').get ->
  split = @urlFragFree.split('/')
  if split.length >= 3
    split[2]
  else
    ""

# annotationSchema.virtual('isModified_').get ->
#   @.modifiedDate > @.createdDate

annotationSchema.virtual('formatedModifiedDate').get ->
  date = new Date @.modifiedDate
  m = (date.getMonth() + 1)
  month = if m < 10 then "0" + m else m

  d = date.getDate()
  day = if d < 10 then "0" + d else d

  "#{day}-#{month}-#{date.getFullYear()}"
  # date.getFullYear() + "-" + month + "-" + day

annotationSchema.virtual('shortContent').get ->
  maxLength = 150
  content = if @content then @content else ""
  if content.length > maxLength then content.substring(0, maxLength) + '...' else content

annotationSchema.statics.findSingle = (params, cb) ->
  dbQuery = {
    endUser: params.endUser,
    _id: params._id,
    deleted: false
  }

  @.findOne(dbQuery, cb)

annotationSchema.statics.overview = (params, cb) ->
  unless _.isArray params.validShareSet
    params.validShareSet = [params.validShareSet]

  currentShareSet = _.union(params.validShareSet, params.endUser)

  #NB!!! aggregate klarer ikke casting til ObjectId selv, så dette må gjøres manuelt..
  try
    aggregateQuery = [
        { $match:
          {
            $or: [
              {endUser: mongoose.Types.ObjectId(params.endUser)},
              {shareSet: { $in: currentShareSet }}
            ],
            urlFragFree: params.urlFragFree
            domainName: params.domainName
            deleted: false
          }
        },
        { $group:
          {
            _id: "$urlFrag",
            count: {$sum: 1}
          }
        }
      ]

    @.aggregate aggregateQuery, cb
  catch error
    cb error


annotationSchema.statics.legalSearchFilterVals = [
  "private","shared","shared-with-me","deleted","ALL"
]

annotationSchema.statics.search = (params, query, cb) ->

  absoluteMax = 1999  # just to avoid an STACKOVERFLOW :D


  unless _.isArray params.validShareSet
    params.validShareSet = [params.validShareSet]

  currentShareSet = _.union(params.validShareSet, params.endUser)
  dbQuery = {
    $or: [
      {endUser: params.endUser},
      {shareSet: { $in: currentShareSet }}
    ],
    domainName: params.domainName
    deleted: false
  }

  if query.href
    href = decodeURIComponent query.href
    [urlFragFree, urlFrag] = href.split '#'
    dbQuery.urlFragFree = urlFragFree
    if urlFrag
      dbQuery.urlFrag = urlFrag

  if query.filter
    switch query.filter
      when "private"
        delete dbQuery.$or
        dbQuery.endUser = params.endUser
        dbQuery.shareSet = []

      when "shared"
        delete dbQuery.$or
        dbQuery.endUser = params.endUser
        dbQuery.shareSet = {$not: {$size: 0}}

      when "shared-with-me"
        delete dbQuery.$or
        dbQuery.shareSet = {$in: currentShareSet}
        dbQuery.endUser = {$ne: params.endUser}

      when "deleted"
        delete dbQuery.$or
        dbQuery.endUser = params.endUser
        dbQuery.deleted = true
      else
        #do nothing since ALL

  if query.page
    
    pageSize = if query.max then query.max else 10
    if pageSize > absoluteMax
      pageSize = absoluteMax
    page = query.page - 1

    @.where(dbQuery).count (err, count) =>

      if err
        cb err
      else if count == 0
        cb null, []
      else
        @.find(dbQuery)
          .skip(pageSize * page)
          .limit(pageSize)
          .sort({createdDate: -1})
          .exec (err, annots) ->
            if err
              cb err
            else
              cb null, {totalCount: count, page: query.page, pageSize: pageSize, annots: annots}
  else
    @.find(dbQuery)
      .sort({createdDate: 1})
      .exec(cb)


shareSetControl = (askedForSet,legalSet,cb) ->

  console.log "askedForSet ",askedForSet
  console.log "legalSet ",legalSet

  interSection = _.intersection legalSet, askedForSet
  console.log 'intersection ', interSection
  isEqual = (_.difference askedForSet, interSection).length == 0

  if isEqual
    cb()
  else
    cb new Error "Not a valid shareSet "

annotationSchema.statics.create = (params, data, cb) ->

  shareSetControl data.shareSet, params.validShareSet, (err) =>
    if err
      cb err
    else
      annotation = new Annotation(data)
      annotation.save (err) =>
        if err
          cb err
        else
          cb null,annotation

annotationSchema.statics.updateSingle = (params, data, cb) ->

  shareSetControl data.shareSet, params.validShareSet, (err) =>
    if err
      cb err
    else
      dbQuery =
        endUser: params.endUser,
        _id: params._id

      data.modifiedDate = Date.now()
      @findOneAndUpdate dbQuery, data, {new:true}, cb


annotationSchema.statics.deleteSingle = (params, cb) ->
  updateData = {
    deleted: true
    modifiedDate: Date.now()
  }
  dbQuery = {
    endUser: params.endUser,
    _id: params._id
  }
  @findOneAndUpdate dbQuery, updateData, {new:true}, cb

Annotation = null
module.exports = (conn) ->
  Annotation = conn.model 'Annotation', annotationSchema
  return Annotation
