"use strict";
process.env.NODE_ENV = 'test';

var should = require('should'),
  assert = require('assert'),
  AnnotationService = require('./sut-require')('../lib/annot').AnnotsService,
  mongoose = require('mongoose');

describe("AnnotationService", function() {

  var asc = null,
    requestFixture = {
      domainX: {
        domainName: 'test.readin.no',
        validShareSet: [],
        user: {
          _id: null,
          id: '',
          email: ''
        }
      },
      domainY: {
        domainName: 'another.readin.no',
        validShareSet: [],
        user: {
          _id: null,
          id: '',
          email: ''
        }
      }
    },
    userFixture = {
      loggedin: {
        email: 'dummyA@readin.no',
        _id: mongoose.Types.ObjectId(),
        id: mongoose.Types.ObjectId().toString()
      },
      outsider: {
        email: 'dummyB@readin.no',
        _id: mongoose.Types.ObjectId(),
        id: mongoose.Types.ObjectId().toString()
      },
      shared:  mongoose.Types.ObjectId().toString()
    },
    defaultDomain,
    loggedInUser,
    annotations;



  before(function(done) {
    var dbURI = "mongodb://localhost:27017/test_annotations";
    asc = new AnnotationService(dbURI);

    //Storage
    annotations = [];

    //Setting default user on default domain
    defaultDomain = requestFixture.domainX;
    loggedInUser = userFixture.loggedin;
    defaultDomain.user = loggedInUser;

    done();
  });

  after(function(done) {
    console.log("\n == CLEANUP test_ db == ");

    if(! process.env.NODE_ENV == 'test' ) {
      throw new Error("NOT IN TEST MODE");
    }

    var dbURI = "mongodb://localhost:27017/test_annotations",
      conn = mongoose.createConnection(dbURI);

    var Annotation = require('./sut-require')('../lib/model/annotation')(conn);
    Annotation.remove(done);
  });

  it("create should fail", function(done) {
    var failingBody = {
      urlFragFree: 'some/url',
      domainName: defaultDomain.domainName
      },
      params = {
        userId: loggedInUser._id,
        validShareSet: defaultDomain.validShareSet
      };

    asc.createAnnot(failingBody, params, {
      MODEL_ERR: function(err) {
        err.should.not.be.null;
        done();
      },
      DEFAULT: function(res) {
      }
    });
  });

  it("create should fail with wrong share", function(done) {
    var failingBody = {
        urlFragFree: 'some/url',
        domainName: defaultDomain.domainName,
        shareSet: [userFixture.shared._id]
      },
      params = {
        userId: loggedInUser._id,
        validShareSet: defaultDomain.validShareSet
      };

    asc.createAnnot(failingBody, params, {
      MODEL_ERR: function(err) {
        err.should.not.be.null;
        done();
      },
      DEFAULT: function(res) {
      }
    });
  });

  it("create should be ok", function(done) {
    var body = {
        urlFragFree: 'some/url',
        urlFrag: 'id42',
        domainName: defaultDomain.domainName,
        content: 'Lorem ipsum dolor sit amet, ' +
          'consectetur adipiscing elit, sed do eiusmod tempor ' +
          'incididunt ut labore et dolore magna aliqua. Ut enim ' +
          'ad minim veniam, quis nostrud exercitation ullamco laboris ' +
          'nisi ut aliquip ex ea commodo consequat.'
      },
      params = {
        userId: loggedInUser._id,
        validShareSet: defaultDomain.validShareSet
      };

    asc.createAnnot(body, params, {
      MODEL_ERR: function(err) {
        should.not.exist(err);
      },
      DEFAULT: function(res) {
        assert.notDeepEqual(res, {});
        annotations[res.data.encUri] = res;
        done();
      }
    });
  });

  it("find should fail in model with invalid objectid", function(done) {
    asc.findSingleAnnot('dfdf', userFixture.outsider._id, {
      MODEL_ERR: function(err) {
        err.should.not.be.null;
        done();
      },
      NOT_FOUND: function() {

      },
      DEFAULT: function(res) {
      }
    });
  });

  it("find should not return Annotation created by different user", function(done) {
    var url = encodeURIComponent("some/url#id42");

    asc.findSingleAnnot(annotations[url].data.id, userFixture.outsider._id, {
      MODEL_ERR: function(err) {
        should.not.exist(err);
      },
      NOT_FOUND: function() {
        done();
      },
      DEFAULT: function(res) {
      }
    });
  });

  it("find should return Annotation created by user", function(done) {
    var url = encodeURIComponent("some/url#id42");

    asc.findSingleAnnot(annotations[url].data.id, defaultDomain.user._id, {
      MODEL_ERR: function(err) {
        should.not.exist(err);
      },
      NOT_FOUND: function() {
      },
      DEFAULT: function(res) {
        assert.notDeepEqual(res, {});
        res.data.id.should.equal(annotations[url].data.id);
        done();
      }
    });
  });

  it("search with filter=private should return result", function (done) {
    var query = {
        href: encodeURIComponent("some/url#id42"),
        filter: "private"

      },
      params = {
        userId: defaultDomain.user._id,
        domainName: defaultDomain.domainName,
        validShareSet: defaultDomain.validShareSet
      };
    asc.searchAnnots(query, params, {
      MODEL_ERR: function(err) {
        should.not.exist(err);
      },
      DEFAULT: function(res) {
        assert.notDeepEqual(res.embeds.annots, []);
        done();
      }
    });
  });

  it("update should fail in model", function(done) {
    var url = encodeURIComponent("some/url#id42"),
      annotData = annotations[url].data,
      params = {
        userId: defaultDomain.user._id,
        validShareSet: defaultDomain.validShareSet
      };

    asc.updateAnnot(annotations[url].data.id, annotData, params, {
      MODEL_ERR: function(err) {
        err.should.not.be.null;
        done();
      },
      NOT_FOUND: function() {
      },
      DEFAULT: function(res) {
      }
    });
  });

  it("update should not update Annotation created by different user", function(done) {
    var url = encodeURIComponent("some/url#id42"),
      annotData = annotations[url].data,
      params = {
        userId: userFixture.outsider._id,
        validShareSet: defaultDomain.validShareSet
      };
    delete annotData._id;

    asc.updateAnnot(annotData.id, annotData, params, {
      MODEL_ERR: function(err) {
        should.not.exist(err);
      },
      NOT_FOUND: function() {
        done();
      },
      DEFAULT: function(res) {
      }
    });
  });

  it("update should fail with wrong share", function(done) {
    var url = encodeURIComponent("some/url#id42"),
      annotData = annotations[url].data,
      params = {
        userId: defaultDomain.user._id,
        validShareSet: defaultDomain.validShareSet
      };
    delete annotData._id;
    annotData.content = "Edited";
    annotData.shareSet = [userFixture.shared];

    asc.updateAnnot(annotData.id, annotData, params, {
      MODEL_ERR: function(err) {
        err.should.not.be.null;
        done();
      },
      NOT_FOUND: function() {
      },
      DEFAULT: function(res) {
      }
    });
  });

  it("update should be ok", function(done) {
    var url = encodeURIComponent("some/url#id42"),
      annotData = annotations[url].data,
      params = {
        userId: defaultDomain.user._id,
        validShareSet: [userFixture.shared]
      };
    delete annotData._id;
    annotData.content = "Edited";
    annotData.shareSet = [userFixture.shared];

    asc.updateAnnot(annotData.id, annotData, params, {
      MODEL_ERR: function(err) {
        should.not.exist(err);
      },
      NOT_FOUND: function() {
      },
      DEFAULT: function(res) {
        assert.notDeepEqual(res, {});
        res.data.content.should.equal(annotData.content);
        res.data.modifiedDate.should.not.equal(annotData.modifiedDate);
        done();
      }
    });
  });

  it("overview should send empty result", function(done) {
    var encHref = encodeURIComponent("some/url"),
      params = {
        userId: userFixture.outsider._id,
        domainName: defaultDomain.domainName
      };

    asc.overview(encHref, params, {
      MODEL_ERR: function(err) {
        should.not.exist(err);
      },
      DEFAULT: function(res) {
        res.data.totalCount.should.equal(0);
        done();
      }
    });
  });

  it("overview with string id should contain Annotation", function(done) {
    var encHref = encodeURIComponent("some/url"),
      params = {
        userId: defaultDomain.user._id.toString(),
        domainName: defaultDomain.domainName,
        validShareSet: defaultDomain.validShareSet
      };

    asc.overview(encHref, params, {
      MODEL_ERR: function(err) {
        should.not.exist(err);
      },
      DEFAULT: function(res) {
        res.data.totalCount.should.equal(1);
        res.embeds.ids["id42"].should.be.ok;
        done();
      }
    });
  });

  it("overview with objectId id should also contain Annotation", function(done) {
    var encHref = encodeURIComponent("some/url"),
      params = {
        userId: defaultDomain.user._id,
        domainName: defaultDomain.domainName,
        validShareSet: defaultDomain.validShareSet
      };

    asc.overview(encHref, params, {
      MODEL_ERR: function(err) {
        should.not.exist(err);
      },
      DEFAULT: function(res) {
        res.data.totalCount.should.equal(1);
        res.embeds.ids["id42"].should.be.ok;
        done();
      }
    });
  });

  it("search should fail in model", function (done) {
    var query = {
        href: encodeURIComponent("some/url#id42"),
        page: 1
      },
      params = {
        userId: 'svada',
        domainName: defaultDomain.domainName
      };

    asc.searchAnnots(query, params, {
      MODEL_ERR: function(err) {
        err.should.not.be.null;
        done();
      },
      DEFAULT: function(res) {

      }
    });
  });

  it("search without frag should return empty result", function (done) {
    var query = {
        href: encodeURIComponent("some/url"),
        page: 1
      },
      params = {
        userId: userFixture.outsider._id,
        domainName: defaultDomain.domainName,
        validShareSet: defaultDomain.validShareSet
      };

    asc.searchAnnots(query, params, {
      MODEL_ERR: function(err) {
        should.not.exist(err);
      },
      DEFAULT: function(res) {
        assert.deepEqual(res.embeds.annots, []);
        done();
      }
    });
  });

  it("search should return empty result", function (done) {
    var query = {
        href: encodeURIComponent("some/url#id42"),
        page:1
      },
      params = {
        userId: userFixture.outsider._id,
        domainName: defaultDomain.domainName,
        validShareSet: defaultDomain.validShareSet
      };

    asc.searchAnnots(query, params, {
      MODEL_ERR: function(err) {
        should.not.exist(err);
      },
      DEFAULT: function(res) {
        assert.deepEqual(res.embeds.annots, []);
        done();
      }
    });
  });

  it("search without href should return result", function (done) {
    var query = {
        page: 1
      },
      params = {
        userId: defaultDomain.user._id,
        domainName: defaultDomain.domainName
      };

    asc.searchAnnots(query, params, {
      MODEL_ERR: function(err) {
        should.not.exist(err);
      },
      DEFAULT: function(res) {
        assert.notDeepEqual(res.embeds.annots, []);
        done();
      }
    });
  });

  it("search with filter=shared should return result", function (done) {
    var query = {
        href: encodeURIComponent("some/url#id42"),
        filter: "shared"

      },
      params = {
        userId: defaultDomain.user._id,
        domainName: defaultDomain.domainName,
        validShareSet: defaultDomain.validShareSet
      };
    asc.searchAnnots(query, params, {
      MODEL_ERR: function(err) {
        should.not.exist(err);
      },
      DEFAULT: function(res) {
        console.log('res ', res);
        assert.notDeepEqual(res.embeds.annots, []);
        done();
      }
    });
  });

  it("search with filter=shared-with-me should return result", function (done) {
    var query = {
        href: encodeURIComponent("some/url#id42"),
        filter: "shared-with-me"
      },
      params = {
        userId: userFixture.shared,
        domainName: defaultDomain.domainName,
        validShareSet: defaultDomain.validShareSet
      };
    asc.searchAnnots(query, params, {
      MODEL_ERR: function(err) {
        should.not.exist(err);
      },
      DEFAULT: function(res) {
        assert.notDeepEqual(res.embeds.annots, []);
        done();
      }
    });
  });

  it("search with paging should return result", function (done) {
    var query = {
        href: encodeURIComponent("some/url#id42"),
        page: 1,
        max: 60
      },
      params = {
        userId: defaultDomain.user._id,
        domainName: defaultDomain.domainName,
        validShareSet: defaultDomain.validShareSet
      };

    asc.searchAnnots(query, params, {
      MODEL_ERR: function(err) {
        should.not.exist(err);
      },
      DEFAULT: function(res) {
        res.data.totalCount.should.equal(1);
        assert.notDeepEqual(res.embeds.annots, []);
        done();
      }
    });
  });

  it("search page 2 should return result", function (done) {
    var query = {
        href: encodeURIComponent("some/url#id42"),
        page: 1,
        max: 1
      },
      params = {
        userId: defaultDomain.user._id,
        domainName: defaultDomain.domainName,
        validShareSet: defaultDomain.validShareSet
      };

    insertExtraSharedAnnotation(function() {
      asc.searchAnnots(query, params, {
        MODEL_ERR: function(err) {
          should.not.exist(err);
        },
        DEFAULT: function(res) {
          res.data.totalCount.should.equal(2);
          assert.notDeepEqual(res.embeds.annots, []);
          done();
        }
      });
    });

  });

  it("search without paging should return result", function (done) {
    var query = {
        href: encodeURIComponent("some/url#id42")
      },
      params = {
        userId: defaultDomain.user._id,
        domainName: defaultDomain.domainName,
        validShareSet: defaultDomain.validShareSet
      };

    asc.searchAnnots(query, params, {
      MODEL_ERR: function(err) {
        should.not.exist(err);
      },
      DEFAULT: function(res) {
        assert.notDeepEqual(res.embeds.annots, []);
        done();
      }
    });
  });

  it("trash should fail in model", function(done) {
    asc.trashAnnot("svada", defaultDomain.user._id, {
      MODEL_ERR: function(err) {
        err.should.not.be.null;
        done();
      },
      NOT_FOUND: function() {
      },
      DEFAULT: function(res) {
        assert.notDeepEqual(res, {});
        res.data.content.should.equal(annotData.content);
        res.data.modifiedDate.should.not.equal(annotData.modifiedDate);
        done();
      }
    });
  });

  it("trash should fail when wrong user", function(done) {
    var url = encodeURIComponent("some/url#id42"),
      annotId = annotations[url].data.id;

    asc.trashAnnot(annotId, userFixture.outsider._id, {
      MODEL_ERR: function(err) {
        should.not.exist(err);
      },
      NOT_FOUND: function() {
        done();
      },
      DEFAULT: function(res) {
      }
    });
  });

  it("trash should be ok", function(done) {
    var url = encodeURIComponent("some/url#id42"),
      annotId = annotations[url].data.id;

    asc.trashAnnot(annotId, defaultDomain.user._id, {
      MODEL_ERR: function(err) {
        should.not.exist(err);
      },
      NOT_FOUND: function() {
      },
      DEFAULT: function(res) {
        assert.notDeepEqual(res, {});
        done();
      }
    });
  });

  it("search with filter=deleted should return result", function (done) {
    var query = {
        href: encodeURIComponent("some/url#id42"),
        filter: "deleted"

      },
      params = {
        userId: defaultDomain.user._id,
        domainName: defaultDomain.domainName,
        validShareSet: defaultDomain.validShareSet
      };
    asc.searchAnnots(query, params, {
      MODEL_ERR: function(err) {
        should.not.exist(err);
      },
      DEFAULT: function(res) {
        assert.notDeepEqual(res.embeds.annots, []);
        done();
      }
    });
  });

  it("delete should fail in model", function(done) {
    asc.deleteTrashedAnnot("svada", defaultDomain.user._id, {
      MODEL_ERR: function(err) {
        err.should.not.be.null;
        done();
      },
      NOT_FOUND: function() {
      },
      DELETED: function() {
      }
    });
  });

  it("delete should fail when wrong user", function(done) {
    var url = encodeURIComponent("some/url#id42"),
      annotId = annotations[url].data.id;

    asc.deleteTrashedAnnot(annotId, userFixture.outsider._id, {
      MODEL_ERR: function(err) {
        should.not.exist(err);
      },
      NOT_FOUND: function() {
        done();
      },
      DELETED: function() {
      }
    });
  });

  it("delete should be ok", function(done) {
    var url = encodeURIComponent("some/url#id42"),
      annotId = annotations[url].data.id;

    asc.deleteTrashedAnnot(annotId, defaultDomain.user._id, {
      MODEL_ERR: function(err) {
        should.not.exist(err);
      },
      NOT_FOUND: function() {
      },
      DELETED: function() {
        done();
      }
    });
  });

  it("delete user annots should fail in model", function(done) {
    asc.deleteUserAnnots("svada", defaultDomain.domainName, {
      MODEL_ERR: function(err) {
        err.should.not.be.null;
        done();
      },
      DELETED: function() {
      }
    });
  });

  it("delete user annots should be ok", function(done) {
    asc.deleteUserAnnots(defaultDomain.user._id, defaultDomain.domainName, {
      MODEL_ERR: function(err) {
        should.not.exist(err);
      },
      DELETED: function() {
        done();
      }
    });
  });



  function insertExtraSharedAnnotation(done) {
    var body = {
        urlFragFree: 'some/url',
        urlFrag: 'id42',
        domainName: defaultDomain.domainName,
        shareSet: [userFixture.shared]
      },
      params = {
        userId: loggedInUser._id,
        validShareSet: [userFixture.shared, defaultDomain.domainName]
      };

    asc.createAnnot(body, params, {
      MODEL_ERR: function(err) {
        should.not.exist(err);
      },
      DEFAULT: function(res) {
        assert.notDeepEqual(res, {});
        done();
      }
    });
  }

});
