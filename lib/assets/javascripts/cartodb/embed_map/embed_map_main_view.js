var _ = require('underscore-cdb-v3');
var cdb = require('cartodb.js-v3');
var EmbedMapContentView = require('./embed_map_content_view');
var VendorScriptsView = require('../common/vendor_scripts_view');
var MapOptionsHelper = require('../helpers/map_options');

module.exports = cdb.core.View.extend({
  initialize: function () {
    this._initModels();
    this._initViews();
    this._initVendorViews();
    this._createVis();
  },

  _initModels: function () {
    this.data = this.options.data;
    this.assetsVersion = this.options.assetsVersion;
    this.vizdata = this.options.vizdata;
    this.pass = this.options.pass;
    this.mapId = this.options.mapId;
    this.currentUser = this.options.currentUser;
    this.mapOwnerUser = this.options.mapOwnerUser;
    this.vis = null;
  },

  _createVis: function () {
    var apiURLTemplate = _.template('/u/<%= owner %>/api/v2/viz/<%= uuid %>/viz.json');

    var loadingTime = cdb.core.Profiler.metric('cartodb-js.embed.time_full_loaded').start();
    var visReadyTime = cdb.core.Profiler.metric('cartodb-js.embed.time_vis_loaded').start();

    var vizUrl = apiURLTemplate({
      uuid: this.vizdata.id,
      owner: this.data.config.user_name
    });

    var mapOptions = _.extend(MapOptionsHelper.getMapOptions(), {
      https: true,
      no_cdn: true,
      description: false,
      title: false,
      cartodb_logo: false,
      scrollwheel: false,
      mobile_layout: false
    });

    if (this.pass) {
      vizUrl = vizUrl + '?pass=' + this.pass;
      mapOptions = _.extend({}, mapOptions, {
        auth_token: this.vizdata.auth_tokens
      });
    }

    var self = this;
    cdb.createVis(this.mapId, vizUrl, mapOptions, function (vis) {
      var fullscreen = vis.getOverlay('fullscreen');

      visReadyTime.end();
      vis.on('load', function () {
        loadingTime.end();
      });

      if (fullscreen) {
        fullscreen.options.doc = '.cartodb-public-wrapper';
        fullscreen.model.set('allowWheelOnFullscreen', true);
      }

      self.vis = vis;
      self.$('.js-spinner').remove();
    })
      .on('error', this._manageError);
  },

  _manageError: function (error, layer) {
    if (layer && layer.get('type') === 'torque') {
      this.trigger('map_error', error);
      this.vis.getOverlays().forEach(function (overlay) {
        overlay.hide && overlay.hide();
      });
    }
  },

  _initViews: function () {
    var embedMapContentView = new EmbedMapContentView({
      className: 'embed-full-height',
      owner: this.mapOwnerUser,
      vizID: this.vizdata.id,
      likes: this.vizdata.likes,
      liked: this.vizdata.liked
    });
    this.addView(embedMapContentView);
    this.$el.append(embedMapContentView.render().el);
  },

  _initVendorViews: function () {
    var vendorScriptsView = new VendorScriptsView({
      config: this.data.config,
      assetsVersion: this.assetsVersion,
      user: this.currentUser,
      trackjsAppKey: 'embeds',
      googleAnalyticsTrack: 'embeds',
      googleAnalyticsPublicView: true
    });
    document.body.appendChild(vendorScriptsView.render().el);
    this.addView(vendorScriptsView);
  }
});