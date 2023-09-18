/*
 | Copyright 2016 Esri
 |
 | Licensed under the Apache License, Version 2.0 (the "License");
 | you may not use this file except in compliance with the License.
 | You may obtain a copy of the License at
 |
 |    http://www.apache.org/licenses/LICENSE-2.0
 |
 | Unless required by applicable law or agreed to in writing, software
 | distributed under the License is distributed on an "AS IS" BASIS,
 | WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 | See the License for the specific language governing permissions and
 | limitations under the License.
 */
define([
  "calcite",
  "boilerplate/ItemHelper",
  "boilerplate/UrlParamHelper",
  "dojo/i18n!./nls/resources",
  "dojo/_base/declare",
  "dojo/_base/lang",
  "dojo/_base/array",
  "dojo/_base/Color",
  "dojo/colors",
  "dojo/number",
  "dojo/query",
  "dojo/Deferred",
  "dojo/on",
  "dojo/dom",
  "dojo/dom-attr",
  "dojo/dom-class",
  "dojo/dom-style",
  "dojo/dom-geometry",
  "dojo/dom-construct",
  "dijit/ConfirmDialog",
  "esri/identity/IdentityManager",
  "esri/config",
  "esri/core/lang",
  "esri/core/watchUtils",
  "esri/core/promiseUtils",
  "esri/core/workers",
  "esri/portal/Portal",
  "esri/Map",
  "esri/views/MapView",
  "esri/layers/Layer",
  "esri/layers/FeatureLayer",
  "esri/layers/ImageryLayer",
  "esri/Graphic",
  "esri/geometry/Point",
  "esri/geometry/Multipoint",
  "esri/geometry/Polyline",
  "esri/geometry/Extent",
  "esri/geometry/Circle",
  "esri/geometry/Polygon",
  "esri/geometry/geometryEngine",
  "esri/symbols/PointSymbol3D",
  "esri/symbols/LineSymbol3D",
  "esri/symbols/PolygonSymbol3D",
  "esri/symbols/ObjectSymbol3DLayer",
  "esri/symbols/LineSymbol3DLayer",
  "esri/symbols/FillSymbol3DLayer",
  "esri/symbols/SimpleMarkerSymbol",
  "esri/symbols/SimpleLineSymbol",
  "esri/symbols/SimpleFillSymbol",
  "esri/renderers/SimpleRenderer",
  "esri/renderers/UniqueValueRenderer",
  "esri/layers/support/LabelClass",
  "esri/symbols/LabelSymbol3D",
  "esri/symbols/TextSymbol3DLayer",
  "esri/widgets/Home",
  "esri/widgets/Search",
  "esri/widgets/LayerList",
  "esri/widgets/Legend",
  "esri/widgets/Print",
  "esri/widgets/ScaleBar",
  "esri/widgets/Compass",
  "esri/widgets/BasemapGallery",
  "esri/widgets/Expand",
  "./ActiveCellList",
  "./layers/ViewshedLayer"
], function (calcite, ItemHelper, UrlParamHelper, i18n, declare, lang, array, Color, colors, number, query, Deferred, on,
             dom, domAttr, domClass, domStyle, domGeom, domConstruct, ConfirmDialog,
             IdentityManager, esriConfig, esriLang, watchUtils, promiseUtils, workers, Portal, Map, MapView,
             Layer, FeatureLayer, ImageryLayer,
             Graphic, Point, Multipoint, Polyline, Extent, Circle, Polygon, geometryEngine,
             PointSymbol3D, LineSymbol3D, PolygonSymbol3D, ObjectSymbol3DLayer, LineSymbol3DLayer, FillSymbol3DLayer,
             SimpleMarkerSymbol, SimpleLineSymbol, SimpleFillSymbol,
             SimpleRenderer, UniqueValueRenderer, LabelClass, LabelSymbol3D, TextSymbol3DLayer,
             Home, Search, LayerList, Legend, Print, ScaleBar, Compass, BasemapGallery, Expand,
             ActiveCellList, ViewshedLayer) {

  return declare(null, {

    config: null,
    direction: null,

    /**
     *
     */
    constructor() {
      calcite.init();
      esriConfig.workers.loaderConfig = {
        paths: {
          workerScripts: window.location.href.replace(/\/[^/]+$/, "/js/workers")
        }
      };
    },

    /**
     *
     * @param boilerplateResponse
     */
    init: function (boilerplateResponse) {
      if(boilerplateResponse) {
        this.direction = boilerplateResponse.direction;
        this.config = boilerplateResponse.config;
        this.settings = boilerplateResponse.settings;
        const boilerplateResults = boilerplateResponse.results;
        const webMapItem = boilerplateResults.webMapItem;
        const webSceneItem = boilerplateResults.webSceneItem;
        const groupData = boilerplateResults.group;

        document.documentElement.lang = boilerplateResponse.locale;

        this.urlParamHelper = new UrlParamHelper();
        this.itemHelper = new ItemHelper();

        this._setDirection();

        if(webMapItem) {
          this._createWebMap(webMapItem);
        } else if(webSceneItem) {
          this._createWebScene(webSceneItem);
        } else if(groupData) {
          this._createGroupGallery(groupData);
        } else {
          this.reportError(new Error("app:: Could not load an item to display"));
        }
      }
      else {
        this.reportError(new Error("app:: Boilerplate is not defined"));
      }
    },

    /**
     *
     * @param error
     * @returns {*}
     */
    reportError: function (error) {
      // remove loading class from body
      //domClass.remove(document.body, CSS.loading);
      //domClass.add(document.body, CSS.error);
      // an error occurred - notify the user. In this example we pull the string from the
      // resource.js file located in the nls folder because we've set the application up
      // for localization. If you don't need to support multiple languages you can hardcode the
      // strings here and comment out the call in index.html to get the localization strings.
      // set message
      let node = dom.byId("loading_message");
      if(node) {
        //node.innerHTML = "<h1><span class=\"" + CSS.errorIcon + "\"></span> " + i18n.error + "</h1><p>" + error.message + "</p>";
        node.innerHTML = "<h1><span></span>" + i18n.error + "</h1><p>" + error.message + "</p>";
      }
      return error;
    },

    /**
     *
     * @private
     */
    _setDirection: function () {
      let direction = this.direction;
      let dirNode = document.getElementsByTagName("html")[0];
      domAttr.set(dirNode, "dir", direction);
    },

    /**
     *
     * @param webMapItem
     * @private
     */
    _createWebMap: function (webMapItem) {
      this.itemHelper.createWebMap(webMapItem).then(function (map) {

        let viewProperties = {
          map: map,
          container: this.settings.webmap.containerId
        };

        if(!this.config.title && map.portalItem && map.portalItem.title) {
          this.config.title = map.portalItem.title;
        }

        lang.mixin(viewProperties, this.urlParamHelper.getViewProperties(this.config));
        require(["esri/views/MapView"], function (MapView) {

          let view = new MapView(viewProperties);
          view.then(function (response) {
            this.urlParamHelper.addToView(view, this.config);
            this._ready(view);
          }.bind(this), this.reportError);

        }.bind(this));
      }.bind(this), this.reportError);
    },

    /**
     *
     * @param webSceneItem
     * @private
     */
    _createWebScene: function (webSceneItem) {
      this.itemHelper.createWebScene(webSceneItem).then(function (map) {

        let viewProperties = {
          map: map,
          container: this.settings.webscene.containerId
        };

        if(!this.config.title && map.portalItem && map.portalItem.title) {
          this.config.title = map.portalItem.title;
        }

        lang.mixin(viewProperties, this.urlParamHelper.getViewProperties(this.config));
        require(["esri/views/SceneView"], function (SceneView) {

          let view = new SceneView(viewProperties);
          view.then(function (response) {
            this.urlParamHelper.addToView(view, this.config);
            this._ready(view);
          }.bind(this), this.reportError);
        }.bind(this));
      }.bind(this), this.reportError);
    },

    /**
     *
     * @param groupData
     * @private
     */
    _createGroupGallery: function (groupData) {
      let groupInfoData = groupData.infoData;
      let groupItemsData = groupData.itemsData;

      if(!groupInfoData || !groupItemsData || groupInfoData.total === 0 || groupInfoData instanceof Error) {
        this.reportError(new Error("app:: group data does not exist."));
        return;
      }

      let info = groupInfoData.results[0];
      let items = groupItemsData.results;

      this._ready();

      if(info && items) {
        let html = "";

        html += "<h1>" + info.title + "</h1>";

        html += "<ol>";

        items.forEach(function (item) {
          html += "<li>" + item.title + "</li>";
        });

        html += "</ol>";

        document.body.innerHTML = html;
      }

    },

    /**
     *
     * @private
     */
    _ready: function (view) {

      // TITLE //
      document.title = dom.byId("app-title-node").innerHTML = this.config.title;

      //
      // WIDGETS IN VIEW UI //
      //

      // LEFT PANE TOGGLE //
      const toggleLeftPaneNode = domConstruct.create("div", { title: "Toggle Left Panel", className: "toggle-pane-node esri-icon-expand" });
      view.ui.add(toggleLeftPaneNode, { position: "top-left", index: 0 });
      on(toggleLeftPaneNode, "click", function () {
        query(".ui-layout-left").toggleClass("hide");
        query(".ui-layout-center").toggleClass("column-18");
        query(".ui-layout-center").toggleClass("column-24");
        domClass.toggle(toggleLeftPaneNode, "esri-icon-collapse esri-icon-expand");
      }.bind(this));

      // HOME //
      const homeWidget = new Home({ view: view });
      view.ui.add(homeWidget, { position: "top-left", index: 1 });

      // COMPASS //
      if(view.type === "2d") {
        const compass = new Compass({ view: view });
        view.ui.add(compass, "top-left");
      }

      // SCALEBAR //
      const scaleBar = new ScaleBar({ view: view, unit: "dual" });
      view.ui.add(scaleBar, { position: "bottom-left" });

      //
      // WIDGETS IN EXPAND //
      //

      // SEARCH //
      const searchWidget = new Search({
        view: view,
        container: domConstruct.create("div")
      });
      // EXPAND SEARCH //
      const toolsExpand = new Expand({
        view: view,
        content: searchWidget.domNode,
        expandIconClass: "esri-icon-search",
        expandTooltip: "Search"
      }, domConstruct.create("div"));
      view.ui.add(toolsExpand, "top-right");

      // BASEMAP GALLERY //
      const basemapGallery = new BasemapGallery({
        view: view,
        container: domConstruct.create("div")
      });
      // EXPAND BASEMAP GALLERY //
      const basemapGalleryExpand = new Expand({
        view: view,
        content: basemapGallery.domNode,
        expandIconClass: "esri-icon-basemap",
        expandTooltip: "Basemap"
      }, domConstruct.create("div"));
      view.ui.add(basemapGalleryExpand, "top-right");


      //
      // WIDGETS IN TAB PANES //
      //

      // LAYER LIST //
      const layerList = new LayerList({
        view: view,
        createActionsFunction: function (evt) {
          let item = evt.item;

          let fullExtentAction = {
            id: "full-extent",
            title: "Go to full extent",
            className: "esri-icon-zoom-out-fixed"
          };

          let informationAction = {
            id: "information",
            title: "Layer information",
            className: "esri-icon-description"
          };

          let layerActions = [];
          if(item.layer) {
            layerActions.push(fullExtentAction);
            if(item.layer.url) {
              layerActions.push(informationAction);
            }
          }

          return [layerActions];
        }
      }, "layer-list-node");
      layerList.on("trigger-action", function (evt) {
        //console.info(evt);

        switch (evt.action.id) {
          case "full-extent":
            view.goTo(evt.item.layer.fullExtent);
            break;
          case "information":
            window.open(evt.item.layer.url);
            break;
        }
      }.bind(this));

      // LEGEND
      const legend = new Legend({ view: view }, "legend-node");

      // USER SIGN IN //
      this.initializeUserSignIn(view);

      // MAP DETAILS //
      this.displayMapDetails(view);

      // INITIALIZE PLACES //
      this.initializePlaces(view);

      // DYNAMIC VIEWSHED //
      this.initializeDynamicViewshed(view);

    },

    /**
     * USER SIGN IN
     */
    initializeUserSignIn: function (view) {

      // TOGGLE SIGN IN/OUT //
      let signInNode = dom.byId("sign-in-node");
      let signOutNode = dom.byId("sign-out-node");
      let userNode = dom.byId("user-node");

      // SIGN IN //
      let userSignIn = function () {
        this.portal = new Portal({ authMode: "immediate" });
        this.portal.load().then(function () {
          //console.info(this.portal, this.portal.user);

          dom.byId("user-firstname-node").innerHTML = this.portal.user.fullName.split(" ")[0];
          dom.byId("user-fullname-node").innerHTML = this.portal.user.fullName;
          dom.byId("username-node").innerHTML = this.portal.user.username;
          dom.byId("user-thumb-node").src = this.portal.user.thumbnailUrl;

          domClass.add(signInNode, "hide");
          domClass.remove(userNode, "hide");

          // MAP DETAILS //
          this.displayMapDetails(view, this.portal);

        }.bind(this), console.warn);
      }.bind(this);

      // SIGN OUT //
      let userSignOut = function () {
        IdentityManager.destroyCredentials();
        this.portal = new Portal({});
        this.portal.load().then(function () {

          this.portal.user = null;
          domClass.remove(signInNode, "hide");
          domClass.add(userNode, "hide");

          // MAP DETAILS //
          this.displayMapDetails(view);

        }.bind(this));
      }.bind(this);

      // CALCITE CLICK EVENT //
      on(signInNode, "click", userSignIn);
      on(signOutNode, "click", userSignOut);

      // PORTAL //
      this.portal = new Portal({});
      // CHECK THE SIGN IN STATUS WHEN APP LOADS //
      IdentityManager.checkSignInStatus(this.portal.url).always(userSignIn);

    },

    /**
     * DISPLAY MAP DETAILS
     *
     * @param view
     * @param portal
     */
    displayMapDetails: function (view, portal) {

      const item = view.map.portalItem;
      const itemLastModifiedDate = (new Date(item.modified)).toLocaleString();

      dom.byId("current-map-card-thumb").src = item.thumbnailUrl;
      dom.byId("current-map-card-thumb").alt = item.title;
      dom.byId("current-map-card-caption").innerHTML = lang.replace("A map by {owner}", item);
      dom.byId("current-map-card-caption").title = "Last modified on " + itemLastModifiedDate;
      dom.byId("current-map-card-title").innerHTML = item.title;
      dom.byId("current-map-card-title").href = lang.replace("//{urlKey}.{customBaseUrl}/home/item.html?id={id}", {
        urlKey: portal ? portal.urlKey : "www",
        customBaseUrl: portal ? portal.customBaseUrl : "arcgis.com",
        id: item.id
      });
      dom.byId("current-map-card-description").innerHTML = item.description;

    },

    /**
     *
     * @param view
     */
    initializePlaces: function (view) {

      const placesContainer = dom.byId("places-node");

      if(view.map.presentation && view.map.presentation.slides && (view.map.presentation.slides.length > 0)) {
        // SLIDES //
        view.map.presentation.slides.forEach(function (slide) {

          const slideNode = domConstruct.create("div", { className: "places-node" }, placesContainer);
          domConstruct.create("div", { className: "places-title", innerHTML: slide.title.text }, slideNode);
          domConstruct.create("img", { className: "places-thumbnail", src: slide.thumbnail.url }, slideNode);

          on(slideNode, "click", function () {
            query(".places-node").removeClass("selected");
            domClass.add(slideNode, "selected");

            slide.applyTo(view, {
              animate: true,
              speedFactor: 0.5,
              easing: "in-out-cubic"   // linear, in-cubic, out-cubic, in-out-cubic, in-expo, out-expo, in-out-expo
            });

          }.bind(this));
        });

        view.on("layerview-create", function (evt) {
          slides.forEach(function (slide) {
            slide.visibleLayers.add({ id: evt.layer.id });
          }.bind(this));
        }.bind(this));

      } else if(view.map.bookmarks && view.map.bookmarks.length > 0) {
        // BOOKMARKS //
        view.map.bookmarks.forEach(function (bookmark) {

          const bookmarkNode = domConstruct.create("div", { className: "places-node" }, placesContainer);
          domConstruct.create("div", { className: "places-title", innerHTML: bookmark.name }, bookmarkNode);

          on(bookmarkNode, "click", function () {
            query(".places-node").removeClass("selected");
            domClass.add(bookmarkNode, "selected");
            view.goTo(bookmark.extent);
          }.bind(this));

        }.bind(this));

      } else {
        //domConstruct.create("div", { className: "text-light-gray avenir-italic", innerHTML: "No places available in this map" }, placesContainer);
        query(".places-ui").addClass("hide");
        calcite.tabs();
      }

    },

    /**
     *
     * @param view
     * @param layerTitle
     * @returns {Layer}
     */
    findLayerByTitle: function (view, layerTitle) {
      return view.map.allLayers.find((layer) => {
        return (layer.title === layerTitle);
      });
    },

    /**
     *
     * @param view
     */
    initializeDynamicViewshed: function (view) {

      //this.initializeViewshedElevations(view);

      /*
       this.mapView = new MapView({
       container: "map-view-node",
       map: new Map({
       basemap: "streets-relief-vector",
       ground: "world-elevation"
       })
       });
       view.watch("viewpoint", (viewpoint) => {
       this.mapView.viewpoint = viewpoint;
       });*/


      on(dom.byId("distance-input"), "input", () => {
        dom.byId("distance-label").valueAsNumber = dom.byId("distance-input").valueAsNumber;
      });
      on(dom.byId("distance-label"), "input", () => {
        dom.byId("distance-input").valueAsNumber = dom.byId("distance-label").valueAsNumber;
      });

      on(dom.byId("offset-input"), "input", () => {
        dom.byId("offset-label").valueAsNumber = dom.byId("offset-input").valueAsNumber;
      });
      on(dom.byId("offset-label"), "input", () => {
        dom.byId("offset-input").valueAsNumber = dom.byId("offset-label").valueAsNumber;
      });

      const updateAnalysis = () => {
        if(this.analysisLocation) {
          this.calculateViewshed(view, this.analysisLocation, false);
        }
      };
      on(dom.byId("cell-size-select"), "change", updateAnalysis);
      on(dom.byId("distance-input"), "input", updateAnalysis);
      on(dom.byId("offset-input"), "input", updateAnalysis);


      // ELEVATION LAYER //
      const elevationsLayer = this.findLayerByTitle(view, "TopoBathy 3D");
      elevationsLayer.load().then(() => {

        // GET ELEVATIONS FUNCTION //
        //this.getElevations = this._getElevations(elevationsLayer);
        //this.getCellElevations = this._getCellElevations(elevationsLayer);
        //this.getSightLines = this._getSightLines(elevationsLayer);
        //this.getSightlineIntersections = this._getSightlineIntersections(elevationsLayer);

        this.createCellInfos = this._createCellInfos(view, elevationsLayer);
        this.getDEMResolution = this._getDEMResolution(elevationsLayer);

        // GRID UTILITIES //
        this.gridUtilsConnection = null;
        workers.open(this, "workerScripts/GridCellCentersUtils").then(function (connection) {
          this.gridUtilsConnection = connection;
          domClass.remove(dom.byId("viewshed-btn"), "btn-disabled");
        }.bind(this));

        // ANALYSIS RESULTS LAYER //
        const analysisLayers = this.initialiseAnalysisResultsLayer(view);
        this.cellsLayer = analysisLayers.cellsLayer;
        this.visibilityLayer = analysisLayers.visibilityLayer;
        this.locationsLayer = analysisLayers.locationsLayer;
        this.sightlineLayer = analysisLayers.sightlineLayer;
        this.analysisAreaLayer = analysisLayers.analysisAreaLayer;

        // LOCATION SYMBOL //
        let locationSymbol = new PointSymbol3D({
          symbolLayers: [
            new ObjectSymbol3DLayer({
              width: 50.0,
              height: 150.0,
              anchor: "bottom",
              resource: { primitive: "inverted-cone" },
              material: { color: Color.named.cyan }
            })
          ]
        });

        let locationSymbol2D = new SimpleMarkerSymbol({
          style: "x",
          color: Color.named.white,
          size: "17px",
          outline: {
            color: Color.named.red.concat(0.5),
            width: 3
          }
        });


        // DRAW LOCATION FUNCTION //
        this.drawLocation = this._drawPointGeometry(view, locationSymbol2D);

        // VIEWSHED BUTTON CLICK //
        on(dom.byId("viewshed-btn"), "click", () => {
          domClass.add(dom.byId("viewshed-btn"), "btn-disabled");
          domConstruct.destroy(dom.byId("process-node"));
          this.cellsLayer.source.removeAll();
          this.visibilityLayer.source.removeAll();
          this.locationsLayer.source.removeAll();
          this.sightlineLayer.source.removeAll();
          this.analysisAreaLayer.source.removeAll();
          this.drawLocation().then((location) => {
            this.analysisLocation = location;
            domClass.remove(dom.byId("viewshed-btn"), "btn-disabled");
          });
        });
      });

    },

    /**
     *
     * @param view
     */
    initializeViewshedElevations: function (view) {

      const elevationLayerUrl = "//elevation.arcgis.com/arcgis/rest/services/WorldElevation/TopoBathy/ImageServer";
      this.viewshedLayer = new ImageryLayer({ url: elevationLayerUrl, format: "lerc" });

      this.viewshedLayer.load().then(() => {
        this.getViewshedElevations = (extent) => {
          return this.viewshedLayer.fetchImage(extent, view.width, view.height).then((data) => {
            return data.pixelData.pixelBlock;
          }, console.warn);
        };
      }, console.warn);

      //this.viewshedLayer = new ViewshedLayer({});
      //view.map.add(this.viewshedLayer);
    },

    /**
     *
     * @param view
     * @returns {*}
     */
    initialiseAnalysisResultsLayer: function (view) {

      const cellResource = { primitive: "cube" };

      this.cellRenderers = {
        visibility: new UniqueValueRenderer({
          defaultLabel: "Unknown",
          defaultSymbol: SimpleFillSymbol({
            color: Color.named.transparent,
            style: "solid",
            outline: {
              color: Color.named.orange,
              width: 2
            }
          }),
          /*defaultSymbol: new PointSymbol3D({
           symbolLayers: [
           new ObjectSymbol3DLayer({
           width: 150.0,
           height: 50.0,
           resource: cellResource,
           material: { color: Color.named.silver.concat(0.6) }
           })
           ]
           }),*/
          field: "visible",
          uniqueValueInfos: [
            {
              value: "active",
              label: "Active",
              symbol: new SimpleFillSymbol({
                color: Color.named.red.concat(0.1),
                outline: {
                  color: Color.named.red,
                  width: 3.5
                }
              })
            },
            {
              value: "visible",
              label: "Visible",
              symbol: new PointSymbol3D({
                symbolLayers: [
                  new ObjectSymbol3DLayer({
                    width: 150.0,
                    height: 50.0,
                    resource: cellResource,
                    material: { color: Color.named.lime }
                  })
                ]
              })
            },
            {
              value: "notVisible",
              label: "Not Visible",
              symbol: new PointSymbol3D({
                symbolLayers: [
                  new ObjectSymbol3DLayer({
                    width: 150.0,
                    height: 50.0,
                    resource: cellResource,
                    material: { color: Color.named.salmon.concat(0.8) }
                  })
                ]
              })
            }
          ],
          visualVariables: [
            {
              type: "size",
              field: "demResolution",
              axis: "width",
              valueRepresentation: "width",
              valueUnit: "meters"
            }
          ]
        }),
        slope: new SimpleRenderer({
          symbol: new PointSymbol3D({
            symbolLayers: [
              new ObjectSymbol3DLayer({
                width: 150.0,
                height: 50.0,
                resource: cellResource,
                material: { color: Color.named.silver.concat(0.6) }
              })
            ]
          }),
          visualVariables: [
            {
              type: "size",
              field: "demResolution",
              axis: "width",
              valueRepresentation: "width",
              valueUnit: "meters"
            },
            {
              type: "color",
              field: "slope",
              stops: [
                { value: -1.0, color: Color.named.yellow },
                { value: 1.0, color: Color.named.purple }
              ]
            }
          ]
        })
      };

      const cellsLayer = new FeatureLayer({
        title: "Viewshed Cells",
        visible: true,
        spatialReference: view.spatialReference,
        geometryType: "point",
        hasZ: true,
        elevationInfo: { mode: "on-the-ground" },
        objectIdField: "ObjectID",
        fields: [
          {
            name: "ObjectID",
            alias: "ObjectID",
            type: "oid"
          },
          {
            name: "step",
            alias: "Process Step",
            type: "integer"
          },
          {
            name: "visible",
            alias: "Is Visible?",
            type: "string"
          },
          {
            name: "slope",
            alias: "Slope to Observer",
            type: "integer"
          },
          {
            name: "demResolution",
            alias: "Cell Resolution",
            type: "double"
          },
          {
            name: "distance",
            alias: "Distance To Observer",
            type: "double"
          },
          {
            name: "index",
            alias: "Analysis Index",
            type: "integer"
          },
          {
            name: "minAngle",
            alias: "minAngle",
            type: "double"
          },
          {
            name: "angle",
            alias: "angle",
            type: "double"
          },
          {
            name: "maxAngle",
            alias: "maxAngle",
            type: "double"
          },
          {
            name: "label",
            alias: "Label",
            type: "string"
          }
        ],
        source: [],
        labelsVisible: true,
        labelingInfo: [
          new LabelClass({
            labelExpressionInfo: {
              value: "{label}"
            },
            labelPlacement: "always-horizontal",
            symbol: new LabelSymbol3D({
              symbolLayers: [
                new TextSymbol3DLayer({
                  material: { color: Color.named.yellow },
                  size: 15,
                  font: {
                    style: "normal",
                    weight: "bold",
                    family: "Avenir Next W00"
                  }
                })
              ]
            })
          })
        ],
        renderer: this.cellRenderers.visibility,
        popupTemplate: {
          title: "{id}",
          content: "{*}"
        }
      });

      const visibilityLayer = new FeatureLayer({
        title: "Visibility",
        spatialReference: view.spatialReference,
        geometryType: "polygon",
        hasZ: true,
        elevationInfo: { mode: "on-the-ground" },
        objectIdField: "ObjectID",
        fields: [
          {
            name: "ObjectID",
            alias: "ObjectID",
            type: "oid"
          },
          {
            name: "visible",
            alias: "Is Visible?",
            type: "string"
          },
          {
            name: "slope",
            alias: "Slope to Observer",
            type: "integer"
          },
          {
            name: "demResolution",
            alias: "Cell Resolution",
            type: "double"
          }
        ],
        source: [],
        renderer: new UniqueValueRenderer({
          defaultLabel: "Unknown",
          defaultSymbol: new PolygonSymbol3D({
            symbolLayers: [
              new FillSymbol3DLayer({
                outline: { color: Color.named.silver.concat(0.5), size: 2.5 },
                material: { color: Color.named.transparent }
              })
            ]
          }),
          field: "visible",
          uniqueValueInfos: [
            {
              value: "visible",
              label: "Visible",
              symbol: new PolygonSymbol3D({
                symbolLayers: [
                  new FillSymbol3DLayer({
                    outline: { color: Color.named.darkgreen.concat(0.4), size: 2.5 },
                    material: { color: Color.named.lime.concat(0.7) }
                  })
                ]
              })
            },
            {
              value: "notVisible",
              label: "Not Visible",
              symbol: new PolygonSymbol3D({
                symbolLayers: [
                  new FillSymbol3DLayer({
                    outline: { color: Color.named.darkred.concat(0.4), size: 1.0 },
                    material: { color: Color.named.salmon.concat(0.2) }
                  })
                ]
              })
            }
          ]/*,
           visualVariables: [
           {
           type: "size",
           field: "demResolution",
           axis: "width",
           valueRepresentation: "width",
           valueUnit: "meters"
           }
           ]*/
        })/*,
         legendEnabled: false,
         listMode: "hide"*/
      });

      const locationsLayer = new FeatureLayer({
        title: "Analysis Locations",
        spatialReference: view.spatialReference,
        geometryType: "point",
        elevationInfo: { mode: "on-the-ground" },
        objectIdField: "ObjectID",
        fields: [
          {
            name: "ObjectID",
            alias: "ObjectID",
            type: "oid"
          },
          {
            name: "label",
            alias: "Label",
            type: "string"
          }
        ],
        source: [],
        labelsVisible: true,
        labelingInfo: [
          new LabelClass({
            labelExpressionInfo: {
              value: "{label}"
            },
            labelPlacement: "always-horizontal",
            symbol: new LabelSymbol3D({
              symbolLayers: [
                new TextSymbol3DLayer({
                  material: { color: Color.named.yellow },
                  size: 17,
                  font: {
                    style: "normal",
                    weight: "bold",
                    family: "Avenir Next W00"
                  }
                })
              ]
            })
          })
        ],
        renderer: new SimpleRenderer({
          symbol: new SimpleMarkerSymbol({
            style: "circle",
            color: Color.named.dodgerblue.concat(0.5),
            size: "11px",
            outline: {
              color: Color.named.yellow,
              width: 1.5
            }
          })
        })/*,
         popupTemplate: {
         title: "{visible}",
         content: "{*}"
         }*/
      });

      const sightlineLayer = new FeatureLayer({
        title: "Sightlines",
        spatialReference: view.spatialReference,
        geometryType: "polyline",
        elevationInfo: { mode: "on-the-ground" },
        objectIdField: "ObjectID",
        fields: [
          {
            name: "ObjectID",
            alias: "ObjectID",
            type: "oid"
          },
          {
            name: "label",
            alias: "Label",
            type: "string"
          }
        ],
        source: [],
        labelsVisible: true,
        labelingInfo: [
          new LabelClass({
            labelExpressionInfo: {
              value: "{label}"
            },
            labelPlacement: "always-horizontal",
            symbol: new LabelSymbol3D({
              symbolLayers: [
                new TextSymbol3DLayer({
                  material: { color: Color.named.yellow },
                  size: 17,
                  font: {
                    style: "normal",
                    weight: "bold",
                    family: "Avenir Next W00"
                  }
                })
              ]
            })
          })
        ],
        renderer: new SimpleRenderer({
          symbol: new SimpleLineSymbol({
            color: Color.named.dodgerblue.concat(0.8),
            width: 3.5
          })
        })
      });

      const analysisAreaLayer = new FeatureLayer({
        title: "Analysis Area",
        spatialReference: view.spatialReference,
        geometryType: "polygon",
        elevationInfo: { mode: "on-the-ground" },
        objectIdField: "ObjectID",
        fields: [
          {
            name: "ObjectID",
            alias: "ObjectID",
            type: "oid"
          }
        ],
        source: [],
        renderer: new SimpleRenderer({
          symbol: new PolygonSymbol3D({
            symbolLayers: [
              new LineSymbol3DLayer({
                size: 2.0,
                material: { color: Color.named.dodgerblue }
              }),
              new FillSymbol3DLayer({
                material: { color: Color.named.transparent }
              })
            ]
          })
        })
      });

      view.map.addMany([analysisAreaLayer, visibilityLayer, cellsLayer, locationsLayer, sightlineLayer]);


      /*on(dom.byId("visibility-renderer-btn"), "click", (evt) => {
       cellsLayer.renderer = this.cellRenderers.visibility;
       });
       on(dom.byId("slope-renderer-btn"), "click", () => {
       cellsLayer.renderer = this.cellRenderers.slope;
       });
       query(".renderer-btn").on("click", (evt) => {
       query(".renderer-btn").addClass("btn-clear");
       domClass.remove(evt.target, "btn-clear");
       });*/


      return {
        analysisAreaLayer: analysisAreaLayer,
        cellsLayer: cellsLayer,
        visibilityLayer: visibilityLayer,
        locationsLayer: locationsLayer,
        sightlineLayer: sightlineLayer
      };
    },

    /**
     *
     * @param view
     */
    disableViewNavigation: function (view) {
      view.popupManager.enabled = false;
      if(view.type === "3d") {
        if(view.inputManager.viewEvents.inputManager.hasHandlers("navigation")) {
          view.inputManager.viewEvents.inputManager.uninstallHandlers("navigation");
        }
      } else {
        if(view.navigation.inputManager.hasHandlers("navigation")) {
          view.navigation.inputManager.uninstallHandlers("navigation");
        }
      }
    },

    /**
     *
     * @param view
     */
    enableViewNavigation: function (view) {
      view.popupManager.enabled = true;
      if(view.type === "3d") {
        if(!view.inputManager.viewEvents.inputManager.hasHandlers("navigation")) {
          require([
            "esri/views/3d/input/handlers/MouseWheelZoom",
            "esri/views/3d/input/handlers/DoubleClickZoom",
            "esri/views/3d/input/handlers/DragPan",
            "esri/views/3d/input/handlers/DragRotate"
          ], (MouseWheelZoom, DoubleClickZoom, DragPan, DragRotate) => {
            view.inputManager.viewEvents.inputManager.installHandlers("navigation", [
              new MouseWheelZoom.MouseWheelZoom(view),
              new DoubleClickZoom.DoubleClickZoom(view),
              new DragPan.DragPan(view, "primary"),
              new DragRotate.DragRotate(view, "secondary")
            ]);
          });
        }
      } else {
        if(!view.navigation.inputManager.hasHandlers("navigation")) {
          require([
            "esri/views/2d/input/handlers/MouseWheelZoom",
            "esri/views/2d/input/handlers/DoubleClickZoom",
            "esri/views/2d/input/handlers/DragPan",
            "esri/views/2d/input/handlers/DragRotate"
          ], (MouseWheelZoom, DoubleClickZoom, DragPan, DragRotate) => {
            view.navigation.inputManager.installHandlers("navigation", [
              new MouseWheelZoom.MouseWheelZoom(view),
              new DoubleClickZoom.DoubleClickZoom(view),
              new DragPan.DragPan(view, "primary"),
              new DragRotate.DragRotate(view, "secondary")
            ]);
          });
        }
      }
    },

    /**
     *
     * @param view
     * @param symbol
     * @returns {function(*)}
     * @private
     */
    _drawPointGeometry: function (view, symbol) {
      return () => {
        const deferred = new Deferred();

        this.disableViewNavigation(view);
        domStyle.set(view.container, "cursor", "crosshair");

        let geometry = null;
        let graphic = null;
        let viewshedHandle = null;
        graphic = new Graphic({ geometry: geometry, symbol: symbol });
        view.graphics.removeAll();
        view.graphics.add(graphic);

        const updateGraphic = () => {
          if(geometry) {
            view.graphics.remove(graphic);
            graphic = graphic.clone();
            graphic.geometry = geometry.clone();
            //graphic.geometry.hasZ = true;
            graphic.geometry.z = view.basemapTerrain.getElevation(graphic.geometry);
            view.graphics.add(graphic);
            doAnalysis();
          }
        };

        const doAnalysis = (useBestResolution) => {
          if(viewshedHandle && (!viewshedHandle.isFulfilled())) {
            viewshedHandle.cancel();
          }
          viewshedHandle = this.calculateViewshed(view, geometry, useBestResolution);
        };

        const endDrawing = () => {
          //doAnalysis(true);
          pointerDownHandle.remove();
          pointerDragHandle.remove();
          pointerUpHandle.remove();
          keyUpHandle.remove();
          domStyle.set(view.container, "cursor", "default");
          updateGraphic();
          this.enableViewNavigation(view);
          deferred.resolve(graphic.geometry.clone());
        };


        const pointerDownHandle = view.on("pointer-down", (pointerDownEvt) => {
          geometry = view.toMap({ x: pointerDownEvt.x, y: pointerDownEvt.y });
          updateGraphic();
        });
        const pointerUpHandle = view.on("pointer-up", endDrawing);

        const pointerDragHandle = view.on("drag", (dragEvt) => {
          switch (dragEvt.action) {
            case "start":
            case "update":
              geometry = view.toMap({ x: dragEvt.x, y: dragEvt.y });
              updateGraphic();
              break;
            case "end":
              endDrawing();
              break;
          }
        });

        const keyUpHandle = view.on("key-up", function (evt) {
          if(evt.key.startsWith("Esc")) {
            endDrawing();
            deferred.reject(new Error("Draw action terminated by user."));
          }
        });

        deferred.promise.otherwise(endDrawing);

        return deferred.promise;
      }
    },

    /**
     *
     * @param elevationLayer
     * @returns {function(*=)}
     * @private
     */
    _getDEMResolution: function (elevationLayer) {
      return (extent) => {
        const extentPoints = new Multipoint({
          spatialReference: extent.spatialReference,
          points: Polygon.fromExtent(extent).rings[0]
        });
        return elevationLayer.queryElevation(extentPoints, {
          demResolution: "finest-contiguous",
          returnSampleInfo: true
        }).then((queryElevationResult) => {
          return queryElevationResult.sampleInfo[0].demResolution;
        });
      }
    },


    /**
     *
     * @param fromPnt
     * @param toPnt
     * @returns {number}
     */
    getDistance: function (fromPnt, toPnt) {
      const dx = (toPnt.x - fromPnt.x);
      const dy = (toPnt.y - fromPnt.y);
      return Math.sqrt(dx * dx + dy * dy);
    },

    /**
     *
     * @param fromPnt
     * @param toPnt
     * @returns {number}
     */
    getAngle: function (fromPnt, toPnt) {
      let angle = Math.atan2(toPnt.y - fromPnt.y, toPnt.x - fromPnt.x) * 180.0 / Math.PI;
      return (angle < 0.0) ? (angle + 360.0) : angle;
    },

    /**
     *
     * @param location
     * @param cellInfo
     * @returns {{min: number, center: (*|number), max: number}}
     */
    calcCellAngles: function (location, cellInfo) {
      const angles = [];
      angles.push(this.getAngle(location, { x: cellInfo.xmin, y: cellInfo.ymin }));
      angles.push(this.getAngle(location, { x: cellInfo.xmin, y: cellInfo.ymax }));
      angles.push(this.getAngle(location, { x: cellInfo.xmax, y: cellInfo.ymin }));
      angles.push(this.getAngle(location, { x: cellInfo.xmax, y: cellInfo.ymax }));

      cellInfo.minAngle = Math.min(...angles);
      cellInfo.angle = this.getAngle(location, { x: cellInfo.centerX, y: cellInfo.centerY });
      cellInfo.maxAngle = Math.max(...angles);

    },

    /**
     *
     * @param cellInfo
     * @returns {*}
     */
    cellInfoToExtent: function (cellInfo) {
      return Extent.fromJSON({
        spatialReference: cellInfo.spatialReference,
        xmin: cellInfo.xmin, ymin: cellInfo.ymin,
        xmax: cellInfo.xmax, ymax: cellInfo.ymax
      });
    },

    /**
     *
     * @param view
     * @param elevationLayer
     * @returns {function(*=, *, *, *=, *=)}
     * @private
     */
    _createCellInfos: function (view, elevationLayer) {

      const spatialReferenceJson = view.spatialReference.toJSON();

      return (location, analysisDistance, cellSize, offsets) => {

        // HALF CELL //
        const halfCellSize = (cellSize * 0.5);

        // ANALYSIS AREA //
        const analysisArea = geometryEngine.buffer(location, analysisDistance, "meters");
        // ANALYSIS EXTENT //
        const extent = analysisArea.extent;

        // CELL INFOS //
        const cellInfos = [];
        const cellCenters = [];

        let snapLocationIndex = null;

        // COLUMNS //
        let col = 0;
        let cellXMax;
        for (let cellXMin = extent.xmin; cellXMin <= extent.xmax; cellXMin += cellSize, col++) {
          cellXMin -= (cellXMin % cellSize);
          cellXMax = (cellXMin + cellSize);

          // ROWS //
          let row = 0;
          let cellYMin;
          for (let cellYMax = extent.ymax; cellYMax >= extent.ymin; cellYMax -= cellSize, row++) {
            cellYMax -= (cellYMax % cellSize);
            cellYMin = (cellYMax - cellSize);

            // CELL CENTER //
            let cellXCenter = (cellXMin + halfCellSize);
            let cellYCenter = (cellYMin + halfCellSize);

            // CELL DISTANCE TO OBSERVER //
            const distToObs = this.getDistance(location, { x: cellXCenter, y: cellYCenter });
            if(distToObs < analysisDistance) {

              // IS NEARBY/WITHIN //
              //const nearby = (distToObs < cellSize);
              const nearby = (location.x > cellXMin) && (location.x < cellXMax) && (location.y > cellYMin) && (location.y < cellYMax);
              // SNAP TO CELL CENTER //
              if(nearby) {
                snapLocationIndex = cellInfos.length;
              }

              // CELL INFO //
              const cellInfo = {
                id: cellInfos.length,
                spatialReference: spatialReferenceJson,
                col: col,
                row: row,
                xmin: cellXMin,
                ymin: cellYMin,
                xmax: cellXMax,
                ymax: cellYMax,
                centerX: cellXCenter,
                centerY: cellYCenter,
                status: nearby ? "leave" : "new",
                visible: nearby ? "visible" : "unknown"
              };

              // ADD CELL INFO //
              cellInfos[cellInfo.id] = cellInfo;
              // CELL CENTER //
              cellCenters.push([cellXCenter, cellYCenter]);
            }
          }
        }

        // CELL CENTERS //
        const cellCentersMP = new Multipoint({
          spatialReference: extent.spatialReference,
          points: cellCenters
        });

        // QUERY ELEVATIONS FOR CELL CENTERS //
        return elevationLayer.queryElevation(cellCentersMP, {
          demResolution: cellSize,
          returnSampleInfo: true,
          noDataValue: -99999
        }).then((queryElevationResult) => {

          const visibilityResults = queryElevationResult.geometry.points.reduce((visibilityResults, coords, coordsIndex) => {

            // CELL INFO //
            const cellInfo = visibilityResults.cellInfos[coordsIndex];
            cellInfo.demResolution = queryElevationResult.sampleInfo[coordsIndex].demResolution;

            // CALC DISTANCE AND SLOPE //
            cellInfo.distance = this.getDistance(visibilityResults.observerLocation, { x: cellInfo.centerX, y: cellInfo.centerY });
            cellInfo.slope = (((coords[2] + offsets.target) - (visibilityResults.observerLocation.z + offsets.observer)) / cellInfo.distance);
            // CALC ANGLES //
            this.calcCellAngles(visibilityResults.observerLocation, cellInfo);

            if(coordsIndex === visibilityResults.snapLocationIndex) {
              visibilityResults.nearbyCellInfos.push(cellInfo);
            } else {

              // ADJUST ANGLES //
              if((cellInfo.maxAngle - cellInfo.minAngle) > 180.0) {
                if(cellInfo.angle < 0.0) {
                  console.warn("BIG angle that is less than zero: ", cellInfo);
                } else {
                  console.info("Adjusting angles: ", cellInfo);

                  visibilityResults.cellEvents.push({ type: "enter", angle: cellInfo.maxAngle, distance: cellInfo.distance, cellId: cellInfo.id });
                  const adjustedMinAngle = (cellInfo.maxAngle - 360.0);
                  cellInfo.maxAngle = cellInfo.minAngle;
                  cellInfo.minAngle = adjustedMinAngle;
                }
              }

              // CREATE CELL EVENTS //
              visibilityResults.cellEvents.push({ type: "enter", angle: cellInfo.minAngle, distance: cellInfo.distance, cellId: cellInfo.id });
              visibilityResults.cellEvents.push({ type: "over", angle: cellInfo.angle, distance: cellInfo.distance, cellId: cellInfo.id });
              visibilityResults.cellEvents.push({ type: "leave", angle: cellInfo.maxAngle, distance: cellInfo.distance, cellId: cellInfo.id });
            }

            return visibilityResults;
          }, {
            analysisArea: analysisArea,
            snapLocationIndex: snapLocationIndex,
            observerLocation: location, //  queryElevationResult.geometry.getPoint(snapLocationIndex);
            cellInfos: cellInfos,
            nearbyCellInfos: [],
            cellEvents: []
          });

          // REMOVE NEARBY CELL //
          //visibilityResults.cellInfos.splice(visibilityResults.snapLocationIndex, 1);

          return visibilityResults;

        });

      }
    },

    /**
     *
     * @param view
     * @param location
     * @param useBestResolution
     */

    calculateViewshed: function (view, location, useBestResolution) {

      const cellSize = useBestResolution ? 30.0 : +dom.byId("cell-size-select").value;
      const offsets = { target: 0.0, observer: dom.byId("offset-input").valueAsNumber };
      const analysisDistance = dom.byId("distance-input").valueAsNumber;

      const startTime = new Date();

      return this.createCellInfos(location, analysisDistance, cellSize, offsets).then((createCellInfosResult) => {
        const prepTime = new Date();

        this.cellsLayer.source.removeAll();

        const snappedLocation = createCellInfosResult.observerLocation;

        // CELL INFOS //
        const cellInfos = createCellInfosResult.cellInfos;
        // VISIBLE AREAS //
        let visibleAreas = createCellInfosResult.nearbyCellInfos.map(this.cellInfoToExtent);

        //
        // ACTIVE CELL INFOS
        //
        const activeCellInfos = new ActiveCellList();

        const process = [];

        /**
         * PROCESS CELL INFO
         *
         * @param cellInfo
         */
        const processCellVisibility = (cellInfo) => {
          cellInfo.status = "over";

          const slopes = [];
          let isVisible = false;
          const cellsCloserToObserver = activeCellInfos.filter((activeCellInfo) => {
            return (activeCellInfo.distance < cellInfo.distance);
          });
          if(cellsCloserToObserver.length > 0) {
            isVisible = cellsCloserToObserver.every((cellCloserToObserver) => {
              slopes.push(cellCloserToObserver.slope.toFixed(5));
              return (cellCloserToObserver.slope < cellInfo.slope);
            });
          } else {
            isVisible = true;
          }

          // SET VISIBILITY RESULT //
          cellInfo.visible = isVisible ? "visible" : "notVisible";
          // ADD TO VISIBLE AREA //
          if(isVisible) {
            visibleAreas.push(cellInfo);
          }


          process.push({
            cellInfo: esriLang.clone(cellInfo),
            activeCellInfos: esriLang.clone(activeCellInfos._list)
          });


          /*if(this.cellsLayer.visible) {
           this.cellsLayer.source.add(new Graphic({
           geometry: this.cellInfoToExtent(cellInfo),
           attributes: {
           label: lang.replace("{step}", {
           step: cellInfo.step
           })
           }
           }));
           }*/

        };

        //
        // CELL EVENTS //
        //
        const cellEvents = createCellInfosResult.cellEvents;
        // SORT CELL EVENTS BY ANGLE AND DISTANCE//
        cellEvents.sort((cellEventA, cellEventB) => {
          if(cellEventA.angle === cellEventB.angle) {
            return (cellEventA.distance - cellEventB.distance);
          } else {
            return (cellEventA.angle - cellEventB.angle);
          }
        });
        //console.table(cellEvents);

        /**
         * PROCESS CELL EVENTS
         */
        let processStep = 0;
        while (cellEvents.length) {

          // ACTIVE CELL EVENT //
          const cellEvent = cellEvents.shift();
          // ACTIVE CELL INFO //
          const cellInfo = cellInfos[cellEvent.cellId];
          //console.info(`Active: ${activeCellInfos.length}  Event ${cellEvent.type}: ${cellEvent.angle}  Cell: ${cellInfo.angle} @ ${cellInfo.distance}m `);

          // PROCESS EVENT BASED ON TYPE //
          switch (cellEvent.type) {
            case "enter":
              // ADD TO ACTIVE LIST //
              activeCellInfos.insert(cellInfo);
              break;

            case "over":
              // PROCESS VISIBILITY //
              cellInfo.step = ++processStep;
              processCellVisibility(cellInfo);
              break;

            case "leave":
              // REMOVE FROM ACTIVE LIST //
              activeCellInfos.remove(cellInfo);
              break;
          }
        }
        //
        // VISIBILITY ANALYSIS FINISHED //
        //
        const analysisTime = new Date();
        const totalProcessSteps = processStep;

        // DEBUG STUFF //
        const unprocessedCells = cellInfos.filter((cellInfo) => {
          return cellInfo.visible === "unknown"
        });
        if(unprocessedCells.length) {
          console.table(unprocessedCells);
        }
        //console.table(cellInfos);
        //console.table(process);

        domConstruct.destroy(dom.byId("process-node"));
        const processNode = domConstruct.create("mark", { id: "process-node", className: "label-blue font-size-4" });
        view.ui.add(processNode, "bottom-right");
        const labelNode = domConstruct.create("span", { innerHTML: "Process Steps" }, processNode);
        const activeListNode = dom.byId("active-list-node");

        let displayStep = 0;
        const displayProcessStep = () => {
          labelNode.innerHTML = lang.replace("Step: {0}", [displayStep]);
          activeListNode.innerHTML = "";

          const processStepCellInfo = process[displayStep].cellInfo;
          const processActiveCellInfos = process[displayStep].activeCellInfos;

          this.sightlineLayer.source.removeAll();
          this.cellsLayer.source.removeAll();
          this.cellsLayer.source.addMany(processActiveCellInfos.map((processActiveCellInfo) => {

            if(processActiveCellInfo.id === processStepCellInfo.id) {

              domConstruct.create("div", {
                className: "text-red avenir-bold",
                innerHTML: lang.replace("[{step}] {slope} @ {distance}", {
                  step: processStepCellInfo.step || "???",
                  slope: processStepCellInfo.slope.toFixed(5),
                  distance: processStepCellInfo.distance.toFixed(1),
                })
              }, activeListNode);

              return new Graphic({
                geometry: this.cellInfoToExtent(processStepCellInfo),
                attributes: {
                  visible: "active",
                  label: lang.replace("{slope}\n{visible}", {
                    slope: processStepCellInfo.slope.toFixed(5),
                    visible: processStepCellInfo.visible
                  })
                }
              });

            } else {

              domConstruct.create("div", {
                innerHTML: lang.replace("[{step}] {slope} @ {distance}", {
                  step: processActiveCellInfo.step || "???",
                  slope: processActiveCellInfo.slope.toFixed(5),
                  distance: processActiveCellInfo.distance.toFixed(1),
                })
              }, activeListNode);

              return new Graphic({
                geometry: this.cellInfoToExtent(processActiveCellInfo),
                attributes: {
                  label: lang.replace("{slope}", {
                    slope: processActiveCellInfo.slope.toFixed(5)
                  })
                }
              });

            }

          }));

          /*this.cellsLayer.source.add(new Graphic({
           geometry: this.cellInfoToExtent(processStepCellInfo),
           attributes: {
           visible: "active",
           label: lang.replace("{slope}\n{visible}", {
           slope: processStepCellInfo.slope.toFixed(5),
           visible: processStepCellInfo.visible
           })
           }
           }));*/

          this.sightlineLayer.source.add(new Graphic({
            geometry: new Polyline({
              spatialReference: view.spatialReference,
              paths: [[[snappedLocation.x, snappedLocation.y], [processStepCellInfo.centerX, processStepCellInfo.centerY]]]
            })
          }));
        };

        const previousNode = domConstruct.create("span", { className: "icon-ui-left hide" }, processNode, "first");
        const nextNode = domConstruct.create("span", { className: "icon-ui-right hide" }, processNode, "last");
        on(previousNode, "click", () => {
          displayStep--;
          if(displayStep < 0) {
            displayStep = (totalProcessSteps - 1);
          }
          displayProcessStep();
        });
        on(nextNode, "click", () => {
          displayStep++;
          if(displayStep > totalProcessSteps) {
            displayStep = 0;
          }
          displayProcessStep();
        });
        on.once(labelNode, "click", () => {
          domClass.remove(previousNode, "hide");
          domClass.remove(nextNode, "hide");
          displayProcessStep();
        });


        // ANALYSIS AREA //
        this.analysisAreaLayer.source.removeAll();
        this.analysisAreaLayer.source.add(new Graphic({ geometry: createCellInfosResult.analysisArea, attributes: {} }));

        // VISIBLE AREAS GRAPHIC //
        this.visibilityLayer.source.removeAll();
        this.visibilityLayer.source.add(new Graphic({
          geometry: geometryEngine.union(visibleAreas.map(this.cellInfoToExtent)),
          attributes: { visible: "visible" }
        }));


        const endTime = new Date();

        const calcDurationSeconds = (fromTime, toTime) => {
          return (toTime.valueOf() - fromTime.valueOf()) / 1000;
        };
        const prepDuration = calcDurationSeconds(startTime, prepTime);
        const analysisDuration = calcDurationSeconds(prepTime, analysisTime);
        const drawDuration = calcDurationSeconds(analysisTime, endTime);
        const totalDuration = calcDurationSeconds(startTime, endTime);

        const durationInfo = {
          "Events": cellEvents.length,
          "Cells: ": cellInfos.length,
          "Nearby: ": createCellInfosResult.nearbyCellInfos.length,
          "Prep: ": prepDuration,
          "Analysis: ": analysisDuration,
          "Draw:": drawDuration,
          "Total:": totalDuration
        };
        dom.byId("info-node").innerHTML = JSON.stringify(durationInfo, null, "  ");

      });
    }

  });
});





