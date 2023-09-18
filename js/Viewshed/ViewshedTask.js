/**
 *
 * ViewshedTask
 *  - Calculate Viewshed
 *
 * Author:   John Grayson - Applications Prototype Lab - Esri
 * Created:  10/30/2017 - 0.0.1 -
 * Modified:
 *
 */
define([
  "require",
  "esri/core/Accessor",
  "esri/core/Evented",
  "esri/config",
  "esri/core/promiseUtils",
  "esri/core/workers",
  "esri/geometry/Point",
  "esri/geometry/Polygon",
  "esri/geometry/Extent",
  "esri/geometry/geometryEngine",
  "./ActiveCellList",
], function (require, Accessor, Evented,
             esriConfig, promiseUtils, workers,
             Point, Polygon, Extent, geometryEngine,
             ActiveCellList) {

  // VIEWSHED WORKER //
  esriConfig.workers.loaderConfig = {
    paths: {
      viewshedScripts: (window.location.origin + require.toUrl("./")).slice(0,-1),
    }
  };

  /**
   * VIEWSHED TASK
   */
  const ViewshedTask = Accessor.createSubclass([Evented], {

    properties: {
      ready: {
        value: false
      },
      elevationLayer: {
        value: null,
        set: function (value) {
          // SET ELEVATION LAYER //
          this._set("elevationLayer", value);

          // CONNECTION TO WORKERS //
          workers.open(this, "viewshedScripts/ElevationUtils").then((connection) => {

            // INITIALIZE ELEVATION LAYERS ON BACKGROUND WORKERS //
            const promiseArray = connection.broadcast("setElevationLayer", { url: this.elevationLayer.url });
            promiseUtils.eachAlways(promiseArray).then(() => {

              // CREATE CELL INFOS USING WORKERS //
              this.createCellInfos = (location) => {
                return connection.invoke("createCellInfos", {
                  location: location.toJSON(),
                  analysisDistance: this.distance,
                  cellSize: this.cellSize,
                  offsets: { observer: this.observerOffset, target: this.targetOffset }
                }).then((createCellInfosResponse) => {
                  createCellInfosResponse.analysisArea = Polygon.fromJSON(createCellInfosResponse.analysisArea);
                  createCellInfosResponse.observerLocation = Point.fromJSON(createCellInfosResponse.observerLocation);
                  return createCellInfosResponse;
                });
              };

              // WORKERS READY //
              this.ready = true;

            }).otherwise(console.error);
          }).otherwise(console.error);

        }
      },
      distance: {
        type: Number,
        value: 1000.0
      },
      cellSize: {
        type: Number,
        value: 90.0
      },
      observerOffset: {
        type: Number,
        value: 0.0
      },
      targetOffset: {
        type: Number,
        value: 0.0
      },
      activeCellInfos: {
        value: new ActiveCellList()
      }
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
     * @param location
     * @returns {Promise}
     */
    calculateViewshed: function (location) {

      const startTime = new Date();
      return this.createCellInfos(location).then((createCellInfosResult) => {
        const prepTime = new Date();

        //
        // VISIBLE AREAS //
        //
        const visibleAreas = createCellInfosResult.nearbyCellInfos.map(this.cellInfoToExtent);

        //
        // ACTIVE CELL INFOS
        //
        this.activeCellInfos.reset();

        /**
         * PROCESS CELL INFO
         *
         * @param cellInfo
         */
        const processCellVisibility = (cellInfo) => {

          let isVisible = false;
          const cellsCloserToObserver = this.activeCellInfos.filter((activeCellInfo) => {
            return (activeCellInfo.distance < cellInfo.distance);
          });
          if(cellsCloserToObserver.length > 0) {
            isVisible = cellsCloserToObserver.every((cellCloserToObserver) => {
              return (cellCloserToObserver.slope < cellInfo.slope);
            });
          } else {
            // TODO: BAD ASSUMPTION THAT CELL IS NEXT TO OBSERVER CELL... //
            isVisible = true;
          }

          if(isVisible) {
            // SET VISIBILITY RESULT AND ADD TO VISIBLE AREA //
            cellInfo.visible = "visible";
            visibleAreas.push(cellInfo);
          }
        };


        //
        // CELL INFOS //
        //
        const cellInfos = createCellInfosResult.cellInfos;

        //
        // CELL EVENTS //
        //
        const cellEvents = createCellInfosResult.cellEvents;
        const cellEventsCount = Number(cellEvents.length);

        /**
         * PROCESS CELL EVENTS
         */
        //let processStep = 0;
        while (cellEvents.length) {

          // ACTIVE CELL EVENT //
          const cellEvent = cellEvents.shift();
          // ACTIVE CELL INFO //
          const cellInfo = cellInfos[cellEvent.cellId];
          //console.info(`Active: ${this.activeCellInfos.length}  Event ${cellEvent.type}: ${cellEvent.angle}  Cell: ${cellInfo.angle} @ ${cellInfo.distance}m `);

          // UPDATE CELLINFO STATUS //
          cellInfo.status = cellEvent.type;

          // PROCESS EVENT BASED ON TYPE //
          switch (cellEvent.type) {
            case "enter":
              // ADD TO ACTIVE LIST //
              this.activeCellInfos.insert(cellInfo);
              break;

            case "over":
              // PROCESS VISIBILITY //
              //cellInfo.step = ++processStep;
              processCellVisibility(cellInfo);
              break;

            case "leave":
              // REMOVE FROM ACTIVE LIST //
              this.activeCellInfos.remove(cellInfo);
              break;
          }
        }

        //
        // VISIBILITY ANALYSIS FINISHED //
        //
        const analysisTime = new Date();

        // VIEWSHED POLYGON //
        const viewshedArea = geometryEngine.union(visibleAreas.map(this.cellInfoToExtent));
        viewshedArea.spatialReference = location.spatialReference;

        const endTime = new Date();

        const calcDurationSeconds = (fromTime, toTime) => {
          return +(((toTime.valueOf() - fromTime.valueOf()) / 1000).toFixed(3));
        };
        const prepDuration = calcDurationSeconds(startTime, prepTime);
        const analysisDuration = calcDurationSeconds(prepTime, analysisTime);
        const geometryDuration = calcDurationSeconds(analysisTime, endTime);
        const totalDuration = calcDurationSeconds(startTime, endTime);

        const durationInfo = {
          "Cells": cellInfos.length,
          "CellEvents": cellEventsCount,
          "Prep": prepDuration,
          "Analysis": analysisDuration,
          "Geometry": geometryDuration,
          "Total": totalDuration
        };

        return {
          analysisArea: createCellInfosResult.analysisArea,
          viewshedArea: viewshedArea,
          durationInfo: durationInfo
        };
      });

    }

  });

  ViewshedTask.version = "0.0.1";

  return ViewshedTask;
});
