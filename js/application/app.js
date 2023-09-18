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
  "esri/identity/IdentityManager",
  "esri/config",
  "esri/core/lang",
  "esri/core/watchUtils",
  "esri/core/promiseUtils",
  "esri/portal/Portal",
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
  "esri/symbols/TextSymbol",
  "esri/layers/support/LabelClass",
  "esri/symbols/LabelSymbol3D",
  "esri/symbols/TextSymbol3DLayer",
  "esri/symbols/IconSymbol3DLayer",
  "esri/symbols/callouts/LineCallout3D",
  "esri/views/2d/draw/Draw",
  "esri/widgets/Home",
  "esri/widgets/Search",
  "esri/widgets/LayerList",
  "esri/widgets/Legend",
  "esri/widgets/Print",
  "esri/widgets/ScaleBar",
  "esri/widgets/Compass",
  "esri/widgets/BasemapGallery",
  "esri/widgets/Expand",
  "js/Viewshed/ViewshedTask"
], function (calcite, ItemHelper, UrlParamHelper, i18n, declare, lang, array, Color, colors, number, query, Deferred, on,
             dom, domAttr, domClass, domStyle, domGeom, domConstruct,
             IdentityManager, esriConfig, esriLang, watchUtils, promiseUtils, Portal, MapView,
             Layer, FeatureLayer, ImageryLayer,
             Graphic, Point, Multipoint, Polyline, Extent, Circle, Polygon, geometryEngine,
             PointSymbol3D, LineSymbol3D, PolygonSymbol3D, ObjectSymbol3DLayer, LineSymbol3DLayer, FillSymbol3DLayer,
             SimpleMarkerSymbol, SimpleLineSymbol, SimpleFillSymbol,
             SimpleRenderer, UniqueValueRenderer, TextSymbol, LabelClass, LabelSymbol3D, TextSymbol3DLayer, IconSymbol3DLayer, LineCallout3D,
             Draw, Home, Search, LayerList, Legend, Print, ScaleBar, Compass, BasemapGallery, Expand,
             ViewshedTask) {

  return declare(null, {

    config: null,
    direction: null,

    /**
     *
     */
    constructor() {
      calcite.init();
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
      const toggleLeftPaneNode = domConstruct.create("div", { title: "Toggle Left Panel", className: "toggle-pane-node esri-icon-collapse" });
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

      if(view.type === "2d") {
        // COMPASS //
        const compass = new Compass({ view: view });
        view.ui.add(compass, "top-left");
        // SCALEBAR //
        const scaleBar = new ScaleBar({ view: view, unit: "dual" });
        view.ui.add(scaleBar, { position: "bottom-left" });
      }


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
        content: searchWidget,
        expandIconClass: "esri-icon-search",
        expandTooltip: "Search"
      }, domConstruct.create("div"));
      view.ui.add(toolsExpand, "top-right");

      // BASEMAP GALLERY //
      /*const basemapGallery = new BasemapGallery({
        view: view,
        container: domConstruct.create("div")
      });
      // EXPAND BASEMAP GALLERY //
      const basemapGalleryExpand = new Expand({
        view: view,
        content: basemapGallery,
        expandIconClass: "esri-icon-basemap",
        expandTooltip: "Basemap"
      }, domConstruct.create("div"));
      view.ui.add(basemapGalleryExpand, "top-right");*/


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
        const slides = view.map.presentation.slides;
        slides.forEach(function (slide) {

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

      // ELEVATION LAYER //
      const elevationsLayer = this.findLayerByTitle(view, "TopoBathy 3D");
      elevationsLayer.load().then(() => {

        // VIEWSHED TASK //
        this.viewshedTask = new ViewshedTask({ elevationLayer: elevationsLayer });
        watchUtils.whenTrueOnce(this.viewshedTask, "ready", () => {

          const viewshedResultsByLocation = new Map();

          const setAnalysisLocation = (location, updateDisplay) => {
            return this.viewshedTask.calculateViewshed(location).then((viewshedResults) => {
              viewshedResultsByLocation.set(location, viewshedResults);
              if(updateDisplay) {
                this.displayAnalysisResults();
              }
            });
          };

          this.clearAnalysisLocations = () => {
            viewshedResultsByLocation.clear();
            domClass.add("viewshed-clear-btn", "btn-disabled");
          };

          this.addAnalysisLocation = (location, updateDisplay) => {
            domClass.remove("viewshed-clear-btn", "btn-disabled");
            if(this.viewshedHandle && (!this.viewshedHandle.isFulfilled())) {
              this.viewshedHandle.cancel();
            }
            return this.viewshedHandle = setAnalysisLocation(location, updateDisplay);
          };


          this.updateAnalysisResults = () => {
            const allViewshedHandles = [];
            viewshedResultsByLocation.forEach((viewshedResults, location) => {
              const viewshedHandle = setAnalysisLocation(location, false);
              allViewshedHandles.push(viewshedHandle);
            });
            promiseUtils.eachAlways(allViewshedHandles).then(() => {
              this.displayAnalysisResults();
            });
          };

          this.displayAnalysisResults = () => {

            this.analysisAreaLayer.source.removeAll();
            this.visibilityLayer.source.removeAll();

            if(viewshedResultsByLocation.size > 0) {

              const analysisAreas = [];
              const viewshedAreas = [];
              viewshedResultsByLocation.forEach((viewshedResults, location) => {
                this.locationsLayer.source.removeAll();
                this.locationsLayer.source.add(new Graphic({ geometry: location }));

                analysisAreas.push(viewshedResults.analysisArea);
                viewshedAreas.push(viewshedResults.viewshedArea);
              });

              const analysisArea = geometryEngine.union(analysisAreas);
              const viewshedArea = geometryEngine.union(viewshedAreas);

              this.analysisAreaLayer.source.add(new Graphic({ geometry: analysisArea, attributes: {} }));
              this.visibilityLayer.source.add(new Graphic({ geometry: viewshedArea, attributes: { visible: "visible" } }));

              //if(viewshedResultsByLocation.size === 1) {
              // DISPLAY DURATION INFO //
              //  dom.byId("info-node").innerHTML = JSON.stringify(viewshedResultsByLocation.values().next().value.durationInfo, null, "  ");
              //} else {

              // ALL DURATION INFOS //
              const durationInfos = {
                "Locations": viewshedResultsByLocation.size,
                "Cells": 0,
                "CellEvents": 0,
                "Prep": 0.000,
                "Analysis": 0.000,
                "Geometry": 0.000,
                "Total": 0.000
              };

              // SUM DURATION INFOS //
              viewshedResultsByLocation.forEach((viewshedResults) => {
                const durationInfo = viewshedResults.durationInfo;
                for (let infoType in durationInfo) {
                  if(durationInfo.hasOwnProperty(infoType) && durationInfos.hasOwnProperty(infoType)) {
                    durationInfos[infoType] += durationInfo[infoType];
                  }
                }
              });

              // FORMAT DURATION INFOS //
              for (let infoType in durationInfos) {
                if(durationInfos.hasOwnProperty(infoType)) {
                  durationInfos[infoType] = number.format(durationInfos[infoType]);
                }
              }
              // DISPLAY DURATION INFOS //
              dom.byId("info-node").innerHTML = JSON.stringify(durationInfos, null, "  ");
            }
          };


          // CELL SIZE //
          on(dom.byId("cell-size-select"), "change", () => {
            this.viewshedTask.cellSize = +dom.byId("cell-size-select").value;
            this.updateAnalysisResults();
          });

          // DISTANCE //
          on(dom.byId("distance-label"), "input", () => {
            this.viewshedTask.distance = dom.byId("distance-input").valueAsNumber = dom.byId("distance-label").valueAsNumber;
            this.updateAnalysisResults();
          });
          on(dom.byId("distance-label"), "change", () => {
            this.viewshedTask.distance = dom.byId("distance-input").valueAsNumber = dom.byId("distance-label").valueAsNumber;
            this.updateAnalysisResults();
          });
          on(dom.byId("distance-input"), "input", () => {
            this.viewshedTask.distance = dom.byId("distance-label").valueAsNumber = dom.byId("distance-input").valueAsNumber;
            this.updateAnalysisResults();
          });

          on(dom.byId("offset-label"), "input", () => {
            this.viewshedTask.observerOffset = dom.byId("offset-input").valueAsNumber = dom.byId("offset-label").valueAsNumber;
            this.updateAnalysisResults();
          });
          on(dom.byId("offset-label"), "change", () => {
            this.viewshedTask.observerOffset = dom.byId("offset-input").valueAsNumber = dom.byId("offset-label").valueAsNumber;
            this.updateAnalysisResults();
          });
          on(dom.byId("offset-input"), "input", () => {
            this.viewshedTask.observerOffset = dom.byId("offset-label").valueAsNumber = dom.byId("offset-input").valueAsNumber;
            this.updateAnalysisResults();
          });


          // ANALYSIS RESULTS LAYER //
          const analysisLayers = this.initialiseAnalysisResultsLayer(view);
          this.analysisAreaLayer = analysisLayers.analysisAreaLayer;
          this.visibilityLayer = analysisLayers.visibilityLayer;
          this.cellsLayer = analysisLayers.cellsLayer;
          this.sightlineLayer = analysisLayers.sightlineLayer;
          this.pathLayer = analysisLayers.pathLayer;
          this.locationsLayer = analysisLayers.locationsLayer;


          // LOCATION SYMBOL //
          /*const locationSymbol = new PointSymbol3D({
           symbolLayers: [
           new IconSymbol3DLayer({
           resource: {
           href: "//static.arcgis.com/images/Symbols/Basic/RedBeacon.png"
           },
           size: 20,
           outline: {
           color: "white",
           size: 2
           }
           })
           /!*new ObjectSymbol3DLayer({
           width: 50.0,
           height: 150.0,
           anchor: "bottom",
           resource: { primitive: "inverted-cone" },
           material: { color: Color.named.cyan }
           })*!/
           ],
           verticalOffset: {
           screenLength: 40,
           maxWorldLength: 200,
           minWorldLength: 35
           },
           callout: new LineCallout3D({
           color: Color.named.red,
           size: 2,
           border: {
           color: Color.named.white
           }
           })
           });

           const locationSymbolText = new TextSymbol({
           color: Color.named.red,
           text: '\ue61d',
           font: {
           size: 24,
           family: 'CalciteWebCoreIcons'
           }
           });

           const locationSymbolLabel = new LabelSymbol3D({
           symbolLayers: [

           new TextSymbol3DLayer({
           text: '\ue61d',
           font: {
           size: 20,
           family: 'CalciteWebCoreIcons'
           },
           material: { color: Color.named.red },
           size: 12
           })]
           });

           const locationSymbol2D = new SimpleMarkerSymbol({
           style: "x",
           color: Color.named.white,
           size: "17px",
           outline: {
           color: Color.named.red.concat(0.5),
           width: 3
           }
           });*/

          const createLocationSymbol = () => {
            const offset = dom.byId("offset-input").valueAsNumber;
            return new PointSymbol3D({
              symbolLayers: [
                new IconSymbol3DLayer({
                  resource: { href: "//static.arcgis.com/images/Symbols/Basic/RedBeacon.png" },
                  size: 20,
                  outline: { color: "white", size: 2 }
                })
              ],
              verticalOffset: {
                screenLength: 10,
                maxWorldLength: offset,
                minWorldLength: offset
              },
              callout: new LineCallout3D({
                color: Color.named.red,
                size: 2,
                border: { color: Color.named.white }
              })
            });
          };

          const pathSymbol = new LineSymbol3D({
            symbolLayers: [
              new LineSymbol3DLayer({
                size: 5.0,
                material: { color: Color.named.dodgerblue }
              })
            ]
          });

          // DRAW LOCATION FUNCTION //
          const locationSymbol = createLocationSymbol();
          this.drawLocation = this._drawPointGeometry(view, this.locationsLayer);
          this.drawPath = this._drawPolylineGeometry(view, this.pathLayer);

          // TOGGLE VIEWSHED BUTTONS //
          const enableViewshedButtons = (enabled) => {
            domClass.toggle(dom.byId("viewshed-location-btn"), "btn-disabled", !enabled);
            domClass.toggle(dom.byId("viewshed-path-btn"), "btn-disabled", !enabled);
          };

          // RESET ANALYSIS //
          const resetAnalysis = () => {
            enableViewshedButtons(false);

            domConstruct.destroy(dom.byId("process-node"));
            dom.byId("info-node").innerHTML = "";

            this.visibilityLayer.source.removeAll();
            this.analysisAreaLayer.source.removeAll();
            this.cellsLayer.source.removeAll();
            this.sightlineLayer.source.removeAll();
            this.pathLayer.source.removeAll();
            this.locationsLayer.source.removeAll();
          };

          // VIEWSHED LOCATION //
          on(dom.byId("viewshed-location-btn"), "click", () => {
            resetAnalysis();
            this.drawLocation().then(() => {
              enableViewshedButtons(true);
            });
          });

          on(dom.byId("viewshed-path-btn"), "click", () => {
            resetAnalysis();
            this.drawPath().then(() => {
              enableViewshedButtons(true);
            });
          });

          on(dom.byId("viewshed-clear-btn"), "click", () => {
            resetAnalysis();
            this.clearAnalysisLocations();
            this.displayAnalysisResults();
            enableViewshedButtons(true);
          });

          enableViewshedButtons(true);
        });
      });

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

      const pathLayer = new FeatureLayer({
        title: "Path",
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
        labelsVisible: false,
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
            width: 5.0
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

      view.map.addMany([analysisAreaLayer, visibilityLayer, cellsLayer, sightlineLayer, pathLayer, locationsLayer]);


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
        sightlineLayer: sightlineLayer,
        pathLayer: pathLayer,
        locationsLayer: locationsLayer
      };
    },

    /**
     *
     * @param view
     * @param layer
     * @returns {function(*)}
     * @private
     */
    _drawPointGeometry: function (view, layer) {

      let graphic = new Graphic();
      layer.source.add(graphic);

      return () => {
        const deferred = new Deferred();

        domStyle.set(view.container, "cursor", "crosshair");

        let geometry = null;
        this.clearAnalysisLocations();

        const updateGraphic = () => {
          if(geometry) {
            layer.source.remove(graphic);
            graphic = graphic.clone();
            graphic.geometry = geometry;
            layer.source.add(graphic);

            this.clearAnalysisLocations();
            this.addAnalysisLocation(geometry, true);
          }
        };

        const endDrawing = () => {
          pointerDownHandle.remove();
          pointerDragHandle.remove();
          pointerUpHandle.remove();
          keyUpHandle.remove();
          domStyle.set(view.container, "cursor", "default");
          updateGraphic();
          deferred.resolve(geometry.clone());
        };

        const pointerDownHandle = view.on("pointer-down", (pointerDownEvt) => {
          pointerDownEvt.stopPropagation();
          geometry = view.toMap({ x: pointerDownEvt.x, y: pointerDownEvt.y });
          geometry.z = view.basemapTerrain.getElevation(geometry);
          updateGraphic();
        });
        const pointerUpHandle = view.on("pointer-up", (pointerUpEvt) => {
          pointerUpEvt.stopPropagation();
          endDrawing()
        });

        const pointerDragHandle = view.on("drag", (dragEvt) => {
          dragEvt.stopPropagation();
          switch (dragEvt.action) {
            case "start":
            case "update":
              geometry = view.toMap({ x: dragEvt.x, y: dragEvt.y });
              geometry.z = view.basemapTerrain.getElevation(geometry);
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
     * @param view
     * @param layer
     * @returns {function()}
     * @private
     */
    _drawPolylineGeometry: function (view, layer) {

      let graphic = new Graphic();
      layer.source.add(graphic);

      return () => {
        const deferred = new Deferred();

        domStyle.set(view.container, "cursor", "crosshair");

        let geometry = null;

        const updateGraphic = () => {
          if(geometry) {
            layer.source.remove(graphic);
            graphic = graphic.clone();
            graphic.geometry = geometry;
            layer.source.add(graphic);
          }
        };

        const endDrawing = () => {
          domStyle.set(view.container, "cursor", "default");
          updateGraphic();
          deferred.resolve();
        };

        const verticesToPolyline = (vertices) => {
          return new Polyline({ paths: vertices, spatialReference: view.spatialReference });
        };

        const draw = new Draw({ view: view });
        const action = draw.create("polyline");

        this.clearAnalysisLocations();

        action.on("cursor-update", (evt) => {
          geometry = verticesToPolyline(evt.vertices);
          updateGraphic();
        });

        action.on("vertex-add", (evt) => {
          geometry = verticesToPolyline(evt.vertices);
          updateGraphic();

          const location = geometry.getPoint(0, evt.vertexIndex).clone();
          location.z = view.basemapTerrain.getElevation(location);
          this.addAnalysisLocation(location, true);
        });

        action.on("draw-complete", (evt) => {
          geometry = verticesToPolyline(evt.vertices);
          endDrawing();
        });

        return deferred.promise;
      }
    }

  });
});
