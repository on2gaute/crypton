(function () {
  var Container = crypton.Container = function (session) {
    this.keys = {};
    this.session = session;
    this.versions = {};
    this.version = +new Date();
    this.name = null;
  };

  Container.prototype.add = function (key, value) {
    if (this.keys[key]) {
      callback('Key already exists');
      return;
    }

    this.keys[key] = {};
  };

  Container.prototype.get = function (key, callback) {
    if (!this.keys[key]) {
      callback('Key does not exist');
      return;
    }

    callback(null, this.keys[key]);
  };

  Container.prototype.save = function (callback) {
    this.getDiff(function (err, diff) {
      console.log(diff);
      var now = +new Date();
      this.versions[now] = JSON.parse(JSON.stringify(this.keys));
      this.version = now;

      var tx = new crypton.Transaction(this.session);
      tx.save(diff);
      tx.commit(function (err) {
        callback();
      });
    }.bind(this));
  };

  Container.prototype.getDiff = function (callback) {
    var last = this.latestVersion();
    var old = this.versions[last] || {};
    callback(null, crypton.diff.create(old, this.keys));
  };

  Container.prototype.getVersions = function () {
    return Object.keys(this.versions);
  };

  Container.prototype.getVersion = function (version) {
    return this.versions[version];
  };

  Container.prototype.latestVersion = function () {
    var versions = this.getVersions();

    if (!versions.length) {
      return this.version;
    } else {
      return Math.max.apply(Math, versions);
    }
  };

  Container.prototype.getPublicName = function () {
    var containerNameHmac = CryptoJS.HmacSHA256(
      this.name,
      this.session.account.containerNameHmacKey
    );
    return containerNameHmac.toString();
  };

  Container.prototype.getHistory = function (callback) {
    var containerNameHmac = this.getPublicName();
    superagent.get(crypton.url() + '/container/' + containerNameHmac)
      .set('session-identifier', this.session.id)
      .end(function (res) {
        if (!res.body || res.body.success !== true) {
          callback(res.body.error);
          return;
        }

        callback(null, res.body.records);
      });
  };

  Container.prototype.parseHistory = function (records, callback) {
    var keys = {};
    var versions = {};

    for (var i in records) {
      var record = this.decryptRecord(records[i]);
      // TODO apply diff to keys object
      console.log(record);
    }

    callback(null, keys);
  };

  Container.prototype.decryptRecord = function (record) {
    var hp = CryptoJS.enc.Hex.parse;

    var sessionKeyCiphertext = hp(record.sessionKeyCiphertext).toString(CryptoJS.enc.Utf8);
    var sessionKey = hp(this.session.account.keypair.decrypt(sessionKeyCiphertext));

    var hmacKeyCiphertext = hp(record.hmacKeyCiphertext).toString(CryptoJS.enc.Utf8);
    var hmacKey = hp(this.session.account.keypair.decrypt(hmacKeyCiphertext));

    // TODO authenticate payload
    var payloadHmac = CryptoJS.HmacSHA256(record.payloadCiphertext, hmacKey);

    var payloadIv = hp(record.payloadIv);
    var encrypted = CryptoJS.lib.CipherParams.create({
      ciphertext: hp(record.payloadCiphertext),
      iv: payloadIv
    });
    var payloadRaw = CryptoJS.AES.decrypt(
      encrypted, hmacKey, {
        iv: payloadIv,
        mode: CryptoJS.mode.CFB,
        padding: CryptoJS.pad.Pkcs7
      }
    );
    var payload = JSON.parse(payloadRaw.toString(CryptoJS.enc.Utf8));

    return {
      time: +new Date(record.creationTime),
      diff: payload
    };
  };

  Container.prototype.sync = function (callback) {
    var that = this;
    this.getHistory(function (err, records) {
      that.parseHistory(records, function (err, keys, versions) {
        that.keys = keys;
        callback(err);
      });
    });
  };
})();

