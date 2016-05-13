mongoose = require 'mongoose'
_ = require 'underscore'

MODID = "ANNOTATION"



class AnnotsService

  #Private variable to avoid exposing model
  Annotation = null

  constructor: (url) ->

    @conn = mongoose.createConnection url
    # ok, but close when SIGINT from outside here;
    monitorConn @conn

    Annotation = require('./model/annotation')(@conn)

    @viewHelpers = [
      {name: 'myAnnots', fn: @myAnnots}
    ]


  close: ->
    @conn.close()


  # View helper for listing of my annotations, DO NOT USE anywhere else!
  myAnnots: (options, cb) =>
    query = {
      filter: options.filter
      page: options.page
      max: options.max
    }

    params = {
      validShareSet: options.validShareSet
      endUser: options.userId
      domainName: options.domainName
    }


    Annotation.search params, query, (err, result) ->
      if err
        cb err
      else
        annots = if query.page then result.annots else result
        embedParams =
          paging: (if query.page then true else false)
          totalCount: result.totalCount
          page: result.page
          pageSize: result.pageSize
          filter: if query.filter then query.filter else ""

        cb null, appendSearchData(annots, embedParams)


  # params = {
  #   userId: String(ObjectId)
  #   domainName: String
  #   validShareSet: [id]
  # }
  # cbHash = {
  #   MODEL_ERR: cb(err)
  #   DEFAULT: cb(res)
  # }
  overview: (encHref, params, cbHash) ->
    modParams =
      urlFragFree: decodeURIComponent(encHref)
      endUser: params.userId.toString()
      domainName: params.domainName
      validShareSet: params.validShareSet or []

    Annotation.overview modParams, (err, result) ->
      if err
        cbHash.MODEL_ERR err
      else
        totalCount = 0
        cleanedResult = {}
        _.each result, (row) ->
          totalCount += row.count
          cleanedResult[row._id] = {fragmIdentUrl: '#' + row._id, count:  row.count }

        cbHash.DEFAULT {data: {totalCount: totalCount}, embeds: {ids:  cleanedResult }}


  # params = {
  #   userId: String(ObjectId)
  #   domainName: String
  #   validShareSet: []
  # }
  # cbHash = {
  #   MODEL_ERR: cb(err)
  #   DEFAULT: cb(res)
  # }
  searchAnnots: (query, params, cbHash) ->
    validShareSet = params.validShareSet or []

    params =
      endUser: params.userId
      domainName: params.domainName
      validShareSet: validShareSet

    Annotation.search params, query, (err, result) ->
      if err
        cbHash.MODEL_ERR err
      else
        annots = if query.page then result.annots else result
        embedParams =
          paging: (if query.page then true else false)
          totalCount: result.totalCount
          page: result.page
          pageSize: result.pageSize
          filter: if query.filter then query.filter else ""

        cbHash.DEFAULT appendSearchData(annots, embedParams)


  # cbHash = {
  #   MODEL_ERR: cb(err)
  #   NOT_FOUND: cb()
  #   DEFAULT: cb(res)
  # }
  findSingleAnnot: (id, userId, cbHash) ->
    params =
      _id: id
      endUser: userId

    Annotation.findSingle params, (err, annot) ->
      if err
        cbHash.MODEL_ERR err
      else if annot == null
        cbHash.NOT_FOUND()
      else
        cbHash.DEFAULT {data: annot.toObject({virtuals: true})}


  # params = {
  #   userId: String(ObjectId)
  #   domainName: String
  #   validShareSet: [String]
  # }
  # data = { see model }
  # cbHash = {
  #   MODEL_ERR: cb(err)
  #   DEFAULT: cb(res)
  # }
  createAnnot: (data, params, cbHash) ->
    annotData = data
    annotData.endUser = params.userId

    params =
      validShareSet: params.validShareSet

    if _.isEmpty(annotData.shareSet)
      annotData.shareSet = []

    Annotation.create params, annotData, (err, annot) =>
      if err
        cbHash.MODEL_ERR err
      else
        cbHash.DEFAULT {data: annot.toObject({virtuals: true})}


  # params = {
  #   userId: String(ObjectId)
  #   domainName: String
  #   validShareSet: [String]
  # }
  # data = {
  #     shareSet: [String]
  #     content: String
  # }
  # cbHash = {
  #   MODEL_ERR: cb(err)
  #   NOT_FOUND: cb()
  #   DEFAULT: cb(res)
  # }
  updateAnnot: (updateId, annotData, params, cbHash) =>

    params =
      _id: updateId
      endUser: params.userId
      validShareSet: params.validShareSet

    if _.isEmpty(annotData.shareSet)
      annotData.shareSet = []

    Annotation.updateSingle params, annotData, (err, annot) =>
      if err
        cbHash.MODEL_ERR err
      else if annot == null
        cbHash.NOT_FOUND()
      else
        cbHash.DEFAULT {data: annot.toObject({virtuals: true})}


  # cbHash = {
  #   MODEL_ERR: cb(err)
  #   NOT_FOUND: cb()
  #   DEFAULT: cb(res)
  # }
  trashAnnot: (trashId, userId, cbHash) =>
    params =
      _id: trashId
      endUser: userId

    Annotation.deleteSingle params, (err, removedAnnot) ->
      if err
        cbHash.MODEL_ERR err
      else if removedAnnot == null
        cbHash.NOT_FOUND()
      else
        cbHash.DEFAULT {data: removedAnnot.toObject({virtuals: true})}


  # cbHash = {
  #   MODEL_ERR: cb(err)
  #   NOT_FOUND: cb()
  #   DELETED: cb()
  # }
  deleteTrashedAnnot: (deleteId, userId, cbHash) =>
    query =
      _id: deleteId
      endUser: userId
      deleted: true

    Annotation.findOne query, (err, annot) ->
      if err
        cbHash.MODEL_ERR err
      else if annot == null
        cbHash.NOT_FOUND()
      else
        annot.remove (err) ->
          if err
            cbHash.MODEL_ERR err
          else
            cbHash.DELETED()


  # cbHash = {
  #   MODEL_ERR: cb(err)
  #   DELETED: cb()
  # }
  deleteUserAnnots: (userId, domainName, cbHash) =>
    query =
      endUser: userId
      domainName: domainName

    Annotation.remove query, (err) ->
      if err
        cbHash.MODEL_ERR err
      else
        cbHash.DELETED()


  #Privates
  appendSearchData = (annots, params) ->
    if params.paging
      radix = 10
      totalCount = parseInt(params.totalCount, radix)
      page = parseInt(params.page, radix)
      pageSize = parseInt(params.pageSize, radix)
      nextPage = if (totalCount - (page * pageSize) > 0) then page + 1 else page
      prevPage = if (totalCount - (page * pageSize) < pageSize) then page - 1 else page
      prevPage = if (prevPage == 0) then 1 else prevPage;

      data:
        totalCount: totalCount or 0,
        currentPage: page or 0,
        pageSize: pageSize or 0,
        pageCount: Math.ceil(totalCount/pageSize) or 0,
        nextPage: nextPage,
        prevPage: prevPage
        pageFilter: params.filter

      embeds:
        annots : _.map annots, (annot) ->
          annot.toObject({virtuals: true})
    else
      embeds:
        annots : _.map annots, (annot) ->
          annot.toObject({virtuals: true})


module.exports.AnnotsService = AnnotsService
monitorConn = (conn) ->
  conn.on 'error' , (err) ->
    console.error "#{MODID} ERROR conn :",err
  conn.on 'connected', ->
    console.log "#{MODID}: connected via mongoose."
  conn.on 'disconnected', ->
    console.warn "#{MODID}: disconnected via mongoose."
  #global guard:
  process.on 'SIGINT',->
    conn.connection.close ->
      console.log "#{MODID}: closed via SIGINT"
      process.exit 0 # safe this???
