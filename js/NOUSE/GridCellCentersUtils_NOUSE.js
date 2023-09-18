/**
 *
 * GenerateGridCellCenters
 *  - Generate Grid Cell Centers
 *
 * Author:   John Grayson - Applications Prototype Lab - Esri
 * Created:  12/19/2016 - 0.0.1 -
 * Modified:
 *
 */
define([
  "esri/core/Accessor",
  "esri/core/promiseUtils",
  "esri/geometry/Point",
  "esri/geometry/Multipoint",
  "esri/geometry/Extent",
  "esri/geometry/Polyline",
  "esri/geometry/Polygon",
  "esri/geometry/Circle",
  "esri/geometry/geometryEngine",
  "esri/layers/ElevationLayer",

], function (Accessor, promiseUtils,
             Point, Multipoint, Extent, Polyline, Polygon, Circle, geometryEngine,
             ElevationLayer) {

  const GridCellCentersUtils = Accessor.createSubclass({

    // CLASS NAME //
    declaredClass: "GridCellCentersUtils",

    properties: {
      elevationLayer: {
        value: null
      }
    },

    /**
     *
     * @param data
     * @returns {Promise}
     */
    setElevationLayer: function (data) {
      const elevationLayer = new ElevationLayer({ url: data.url });
      return elevationLayer.load().then(() => {
        this.elevationLayer = elevationLayer;
        return { data: { success: true } };
      });
    },




    /**
     *
     * @param data
     * @returns {Promise}
     */
    createCellInfos: function (data) {

      const location = Point.fromJSON(data.location);
      const analysisDistance = data.analysisDistance;
      const cellSize = data.cellSize;
      const offsets = data.offsets;

      // HALF CELL //
      const halfCellSize = (cellSize * 0.5);

      // ANALYSIS AREA //
      const analysisArea = geometryEngine.buffer(location, analysisDistance, "meters");
      // ANALYSIS EXTENT //
      const extent = analysisArea.extent;

      const spatialReferenceJson = location.spatialReference.toJSON();

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
          const distToObs = this._getDistance(location, { x: cellXCenter, y: cellYCenter });
          if(distToObs < analysisDistance) {

            // NEARBY/WITHIN //
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
              visible: nearby ? "visible" : "notVisible"
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
      return this.elevationLayer.queryElevation(cellCentersMP, {
        demResolution: cellSize,
        returnSampleInfo: true,
        noDataValue: -99999
      }).then((queryElevationResult) => {

        const visibilityResults = queryElevationResult.geometry.points.reduce((visibilityResults, coords, coordsIndex) => {

          // CELL INFO //
          const cellInfo = visibilityResults.cellInfos[coordsIndex];
          cellInfo.demResolution = queryElevationResult.sampleInfo[coordsIndex].demResolution;

          // CALC DISTANCE AND SLOPE //
          cellInfo.distance = this._getDistance(visibilityResults.observerLocation, { x: cellInfo.centerX, y: cellInfo.centerY });
          cellInfo.slope = (((coords[2] + offsets.target) - (visibilityResults.observerLocation.z + offsets.observer)) / cellInfo.distance);

          // CALC ANGLES //
          this._calcCellAngles(visibilityResults.observerLocation, cellInfo);

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
          analysisArea: analysisArea.toJSON(),
          snapLocationIndex: snapLocationIndex,
          //observerLocation: location,
          observerLocation: queryElevationResult.geometry.getPoint(snapLocationIndex).toJSON(),
          cellInfos: cellInfos,
          nearbyCellInfos: [],
          cellEvents: []
        });

        // REMOVE NEARBY CELL //
        //visibilityResults.cellInfos.splice(visibilityResults.snapLocationIndex, 1);

        return { data: visibilityResults };
      });

    },

    /**
     *
     * @param fromPnt
     * @param toPnt
     * @returns {number}
     * @private
     */
    _getDistance: function (fromPnt, toPnt) {
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
    _getAngle: function (fromPnt, toPnt) {
      let angle = Math.atan2(toPnt.y - fromPnt.y, toPnt.x - fromPnt.x) * 180.0 / Math.PI;
      return (angle < 0.0) ? (angle + 360.0) : angle;
    },

    /**
     *
     * @param location
     * @param cellInfo
     * @returns {{min: number, center: (*|number), max: number}}
     */
    _calcCellAngles: function (location, cellInfo) {

      // GET ANGLES FROM THE ANALYSIS LOCATION TO THE FOUR CORNERS OF CELL //
      const angles = [];
      angles.push(this._getAngle(location, { x: cellInfo.xmin, y: cellInfo.ymin }));
      angles.push(this._getAngle(location, { x: cellInfo.xmin, y: cellInfo.ymax }));
      angles.push(this._getAngle(location, { x: cellInfo.xmax, y: cellInfo.ymin }));
      angles.push(this._getAngle(location, { x: cellInfo.xmax, y: cellInfo.ymax }));

      // SET MIN/MAX ANGLES //
      cellInfo.minAngle = Math.min(...angles);
      cellInfo.maxAngle = Math.max(...angles);

      // SED ANGLE TO CENTER OF CELL //
      cellInfo.angle = this._getAngle(location, { x: cellInfo.centerX, y: cellInfo.centerY });
    },

    /**
     *
     * @param data
     * @returns {String|*|Promise.<{data: {success: boolean, isVisible: boolean}}>}
     */
    activeCellsToLOS: function (data) {

      const cellInfo = data.cellInfo;
      const activeCellInfos = data.activeCellInfos;

      let isVisible = false;
      const cellsCloserToObserver = activeCellInfos.filter((activeCellInfo) => {
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

      return promiseUtils.resolve({ data: { success: true, isVisible: isVisible } });
    },

    /**
     *
     * @param data
     * @returns {Promise.<{data: {success: boolean, sightLines: Array}}>}
     */
    generateSightLines: function (data) {

      // INPUTS //
      const cellSize = data.cellSize;
      const extent = new Extent(data.extent);
      const center = extent.center;

      // SIGHT LINES //
      let sightLines = [];

      // MAX RADIUS //
      const maxRadius = Math.max(extent.width, extent.height) * 0.5;
      // NUMBER OF POINTS //
      const numberOfPoints = ((2.0 * Math.PI * maxRadius) / cellSize);
      // INNER AND OUTER CIRCLES //
      const outerCircle = new Circle({ center: center, numberOfPoints: numberOfPoints, radius: maxRadius, radiusUnit: "meters", geodesic: true });

      // CREATE SIGHT LINES //
      outerCircle.rings[0].forEach((coords, coordsIndex) => {
        const sightLine = new Polyline({
          spatialReference: extent.spatialReference,
          paths: [[[center.x, center.y], coords]]
        });
        //const geodesicSightLine = geometryEngine.geodesicDensify(sightLine, cellSize, "meters");
        sightLines.push(sightLine.toJSON());
      });

      // OUTPUTS //
      return promiseUtils.resolve({ data: { success: true, radius: maxRadius, center: center.toJSON(), sightLines: sightLines } });
    },


    _createGridCellInfos: function (extent, colCount, rowCount) {

         const spatialReferenceJSON = extent.spatialReference.toJSON();

         const cellSizeX = (extent.width / colCount);
         const cellSizeY = (extent.width / rowCount);

         const gridCellInfos = {
           extentsJSON: [],
           centersJSON: []
         };

         for (let stepCountY = 0; stepCountY < rowCount; stepCountY++) {
           const ymin = extent.ymin + (stepCountY * cellSizeY);

           for (let stepCountX = 0; stepCountX < colCount; stepCountX++) {
             const xmin = extent.xmin + (stepCountX * cellSizeX);

             const gridCellJSON = {
               spatialReference: spatialReferenceJSON,
               xmin: xmin, xmax: (xmin + cellSizeX),
               ymin: ymin, ymax: (ymin + cellSizeY)
             };
             gridCellInfos.extentsJSON.push(gridCellJSON);

             const centerJSON = {
               spatialReference: spatialReferenceJSON,
               x: xmin + (cellSizeX * 0.5),
               y: ymin + (cellSizeY * 0.5)
             };
             gridCellInfos.centersJSON.push(centerJSON);

           }
         }

         return gridCellInfos;
       },

    generateSightLines2: function (data) {

      // INPUTS //
      const cellSize = data.cellSize;
      const extent = new Extent(data.extent);
      const center = extent.center;

      // SIGHT LINES //
      let sightLines = [];

      // MAX RADIUS //
      const maxRadius = Math.max(extent.width, extent.height) * 0.5;
      // NUMBER OF POINTS //
      const numberOfPoints = ((2.0 * Math.PI * maxRadius) / cellSize);
      // INNER AND OUTER CIRCLES //
      const outerCircle = new Circle({ center: center, numberOfPoints: numberOfPoints, radius: maxRadius, radiusUnit: "meters", geodesic: true });

      // CREATE SIGHT LINES //
      outerCircle.rings[0].forEach((coords, coordsIndex) => {
        const sightLine = new Polyline({
          spatialReference: extent.spatialReference,
          paths: [[[center.x, center.y], coords]]
        });
        //const geodesicSightLine = geometryEngine.geodesicDensify(sightLine, cellSize, "meters");
        sightLines.push(sightLine.toJSON());
      });

      // OUTPUTS //
      return promiseUtils.resolve({ data: { success: true, radius: maxRadius, center: center.toJSON(), sightLines: sightLines } });
    },

    /**
     *
     * @param data
     * @param data.extent {} - Extent as JSON
     * @param data.extent.xmin Number
     * @param data.extent.ymin Number
     * @param data.extent.xmax Number
     * @param data.extent.ymax Number
     * @param data.cellSize Number
     * @returns {Promise}
     */
    generateGridCellCenters: function (data) {

      // INPUTS //
      const extent = Extent.fromJSON(data.extent);
      const center = extent.center;
      const cellSize = data.cellSize;
      const halfCell = (cellSize * 0.5);

      const distanceToCenter = (x, y) => {
        const dx = (x - center.x);
        const dy = (y - center.y);
        return Math.sqrt(dx * dx + dy * dy);
      };

      // CELL CENTER LOCATIONS //
      let cellCenters = [];

      // ROWS //
      for (let cellYCenter = extent.ymin + halfCell; cellYCenter <= extent.ymax; cellYCenter += cellSize) {
        // COLUMNS //
        for (let cellXCenter = extent.xmin + halfCell; cellXCenter <= extent.xmax; cellXCenter += cellSize) {
          // CELL CENTER //
          cellCenters.push([cellXCenter, cellYCenter, distanceToCenter(cellXCenter, cellYCenter)]);
        }
      }

      cellCenters.sort((a, b) => {
        return b[2] - a[2];
      });

      // OUTPUTS //
      return promiseUtils.resolve({ data: { success: true, cellCenters: cellCenters } });
    },


    /**
     *
     * @param data
     * @param data.extent {} - Extent as JSON
     * @param data.extent.xmin Number
     * @param data.extent.ymin Number
     * @param data.extent.xmax Number
     * @param data.extent.ymax Number
     * @param data.cellSize Number
     * @returns {Promise}
     */
    generateCellIntersections_2: function (data) {

      // INPUTS //
      const extent = Extent.fromJSON(data.extent);
      const searchDistance = (extent.width * 0.5);
      const observer = extent.center;
      const cellSize = data.cellSize;
      const halfCellSize = (cellSize * 0.5);

      const distanceToObserver = (x, y) => {
        const dx = (x - observer.x);
        const dy = (y - observer.y);
        return Math.sqrt(dx * dx + dy * dy);
      };

      // SIGHTLINES //
      const sightlines = [];

      // CELLS //
      const cellsPolygon = new Polygon({
        spatialReference: extent.spatialReference,
        rings: []
      });

      // ROWS //
      for (let cellYCenter = extent.ymin + halfCellSize; cellYCenter <= extent.ymax; cellYCenter += cellSize) {
        // COLUMNS //
        for (let cellXCenter = extent.xmin + halfCellSize; cellXCenter <= extent.xmax; cellXCenter += cellSize) {
          if(distanceToObserver(cellXCenter, cellYCenter) < searchDistance) {

            // CELL //
            cellsPolygon.addRing((new Polygon.fromExtent(new Extent({
              spatialReference: extent.spatialReference,
              xmin: cellXCenter - halfCellSize, ymin: cellYCenter - halfCellSize,
              xmax: cellXCenter + halfCellSize, ymax: cellYCenter + halfCellSize
            }))).rings[0]);

            // SIGHT LINE //
            const sightline = new Polyline({
              spatialReference: extent.spatialReference,
              paths: [[[observer.x, observer.y], [cellXCenter, cellYCenter]]]
            });
            sightlines.push(sightline);

          }
        }
      }

      const sightlineIntersections = sightlines.map((sightline) => {
        let sightlineCellsIntersections = geometryEngine.intersect(cellsPolygon, sightline);
        sightlineCellsIntersections.hasM = true;
        sightlineCellsIntersections.paths[0].forEach((coords) => {
          coords.push(distanceToObserver(coords[0], coords[1]));
        });
        return sightlineCellsIntersections.toJSON();
      });

      // OUTPUTS //
      return promiseUtils.resolve({ data: { success: true, cellsPolygon: cellsPolygon.toJSON(), sightlineIntersections: sightlineIntersections } });
    },


    generateCellIntersections_3: function (data) {

      // INPUTS //
      const extent = Extent.fromJSON(data.extent);
      const searchDistance = (extent.width * 0.5);
      const observer = extent.center;
      const cellSize = data.cellSize;
      const halfCellSize = (cellSize * 0.5);

      const distanceToObserver = (x, y) => {
        const dx = (x - observer.x);
        const dy = (y - observer.y);
        return Math.sqrt(dx * dx + dy * dy);
      };

      // CELLS POLYGON //
      const cellsPolygon = new Polygon({
        spatialReference: extent.spatialReference,
        rings: []
      });

      // CELL CENTERS //
      const cellsCenters = [];


      // ROWS //
      for (let cellYCenter = extent.ymin + halfCellSize; cellYCenter <= extent.ymax; cellYCenter += cellSize) {
        // COLUMNS //
        for (let cellXCenter = extent.xmin + halfCellSize; cellXCenter <= extent.xmax; cellXCenter += cellSize) {
          if(distanceToObserver(cellXCenter, cellYCenter) < searchDistance) {

            // CELL EXTENT //
            const cellExtent = new Extent({
              spatialReference: extent.spatialReference,
              xmin: cellXCenter - halfCellSize, ymin: cellYCenter - halfCellSize,
              xmax: cellXCenter + halfCellSize, ymax: cellYCenter + halfCellSize
            });

            // CELL //
            cellsPolygon.addRing((new Polygon.fromExtent(cellExtent).rings[0]));

            // CENTER //
            cellsCenters.push(cellExtent.center.clone());

          }
        }
      }

      // SIGHTLINE INTERSECTIONS //
      const sightlineIntersections = new Polyline({
        spatialReference: extent.spatialReference,
        hasM: true,
        paths: []
      });

      // MAX RADIUS //
      const maxRadius = Math.max(extent.width, extent.height) * 0.5;
      // NUMBER OF POINTS //
      const numberOfPoints = ((2.0 * Math.PI * maxRadius) / cellSize);
      // OUTER CIRCLES //
      const outerCircle = new Circle({ center: observer, numberOfPoints: numberOfPoints, radius: maxRadius, radiusUnit: "meters" });
      // CREATE SIGHTLINE INTERSECTIONS FOR EACH LOCATION AROUND OUTER CIRCLE //
      outerCircle.rings[0].forEach((coords) => {
        // SIGHTLINE //
        const sightline = new Polyline({
          spatialReference: extent.spatialReference,
          paths: [[[observer.x, observer.y], coords]]
        });

        // SIGHTLINE INTERSECTED WITH ALL CELLS //
        let sightlineCellsIntersections = geometryEngine.intersect(cellsPolygon, sightline);
        // ADD DISTANCE TO OBSERVER TO EACH INTERSECTION //
        sightlineCellsIntersections.hasM = true;
        sightlineCellsIntersections.paths[0].forEach((coords) => {
          coords.push(distanceToObserver(coords[0], coords[1]));
        });
        sightlineIntersections.addPath(sightlineCellsIntersections.paths[0]);

        // CELL CENTERS //
        const distanceToCenters = cellsCenters.reduce((nearbyInfo, point, pointIndex) => {
          const distanceToSightline = geometryEngine.distance(point, sightline, "meters");
          if(distanceToSightline < 5.0) {
            nearbyInfo[pointIndex] = distanceToSightline;
          }
          return nearbyInfo;
        }, {});
        console.info("distanceToCenters: ", distanceToCenters);

      });

      // OUTPUTS //
      return promiseUtils.resolve({ data: { success: true, cellsPolygon: cellsPolygon.toJSON(), sightlineIntersections: sightlineIntersections.toJSON() } });
    },


    generateCellIntersections: function (data) {

      // INPUTS //
      const extent = Extent.fromJSON(data.extent);
      const searchDistance = (extent.width * 0.5);
      const observer = extent.center;
      const cellSize = data.cellSize;
      const halfCellSize = (cellSize * 0.5);

      const distanceToObserver = (x, y) => {
        const dx = (x - observer.x);
        const dy = (y - observer.y);
        return Math.sqrt(dx * dx + dy * dy);
      };

      // CELLS //
      const cells = [];
      const distancesToObserver = [];

      // ROWS //
      for (let cellYCenter = extent.ymin + halfCellSize; cellYCenter <= extent.ymax; cellYCenter += cellSize) {
        // COLUMNS //
        for (let cellXCenter = extent.xmin + halfCellSize; cellXCenter <= extent.xmax; cellXCenter += cellSize) {
          const distToObs = distanceToObserver(cellXCenter, cellYCenter);
          if(distToObs < searchDistance) {
            // CELL //
            cells.push(new Extent({
              spatialReference: extent.spatialReference,
              xmin: cellXCenter - halfCellSize, ymin: cellYCenter - halfCellSize,
              xmax: cellXCenter + halfCellSize, ymax: cellYCenter + halfCellSize
            }));
            distancesToObserver.push(distToObs);
          }
        }
      }

      // MAX RADIUS //
      const maxRadius = Math.max(extent.width, extent.height) * 0.5;
      // NUMBER OF POINTS //
      const numberOfPoints = ((2.0 * Math.PI * maxRadius) / cellSize);
      // OUTER CIRCLES //
      const outerCircle = new Circle({ center: observer, numberOfPoints: numberOfPoints, radius: maxRadius, radiusUnit: "meters" });
      // CREATE SIGHTLINE INTERSECTIONS FOR EACH LOCATION AROUND OUTER CIRCLE //
      const sightlineInfos = outerCircle.rings[0].map((coords, coordsIndex) => {

        // SIGHTLINE //
        const sightline = new Polyline({
          spatialReference: extent.spatialReference,
          paths: [[[observer.x, observer.y], coords]]
        });

        // FIND ACTIVE CELL CENTERS //
        const cellCentersInfos = [];
        cells.forEach((cell, cellIndex) => {
          if(geometryEngine.intersects(cell, sightline)) {
            cellCentersInfos.push({
              center: cell.center.clone(),
              distance: distancesToObserver[cellIndex]
            });
          }
        });

        // SORT BASED ON PROXIMITY TO OBSERVER //
        cellCentersInfos.sort((cellCentersInfoA, cellCentersInfoB) => {
          return (cellCentersInfoB.distance - cellCentersInfoA.distance)
        });

        // ACTIVE CELL CENTERS //
        const activeCellCenters = new Multipoint({
          spatialReference: extent.spatialReference,
          hasM: true,
          points: cellCentersInfos.map((cellCentersInfo) => {
            return [cellCentersInfo.center.x, cellCentersInfo.center.y, cellCentersInfo.distance];
          })
        });

        // SIGHTLINE INFO //
        return {
          index: coordsIndex,
          sightline: sightline.toJSON(),
          activeCellCenters: activeCellCenters.toJSON()
        };

      });

      // OUTPUTS //
      return promiseUtils.resolve({ data: { success: true, sightlineInfos: sightlineInfos } });
    },


    /**
     *
     * @param data
     * @returns {*|String|Promise.<{data: {success: boolean, losInfos: {geometry: (string|String), attributes: {visible: string, slope: (number|*), distance: *, index, demResolution: *}}}}>}
     */
    calculateLOS_2: function (data) {

      const sightlineIndex = data.sightlineIndex;
      const cellSize = data.cellSize;
      const offsets = data.offsets;

      const sightlineIntersections = Polyline.fromJSON(data.sightlineIntersections);
      const intersections = sightlineIntersections.paths[0];
      const target = sightlineIntersections.getPoint(0, intersections.length - 1);
      const observer = sightlineIntersections.getPoint(0, 0);
      const observerElevation = (observer.z + offsets.observer);

      // LOS CALCULATION //
      const LOS = intersections.reduce((losInfo, coords, coordsIndex) => {
        const slope = ((coords[2] + offsets.target) - observerElevation) / coords[3];
        switch (coordsIndex) {
          case 0:
            break;
          case (intersections.length - 1):
            losInfo.slopeToTarget = slope;
            break;
          default:
            losInfo.maxSlope = Math.max(losInfo.maxSlope, slope);
        }
        return losInfo;
      }, { maxSlope: -Infinity, slopeToTarget: -Infinity });

      // VISIBILITY //
      const isVisible = (LOS.slopeToTarget > LOS.maxSlope) ? "visible" : "notVisible";

      // VISIBILITY GRAPHIC //
      const visibilityInfo = {
        geometry: target.toJSON(),
        attributes: {
          "visible": isVisible,
          "slope": LOS.slopeToTarget,
          "distance": target.m,
          "index": sightlineIndex,
          "demResolution": cellSize
        }
      };

      return promiseUtils.resolve({ data: { success: true, visibilityInfo: visibilityInfo } });
    },

    calculateLOS_3: function (data) {

      const spatialReference = data.spatialReference;
      const sightlineIndex = data.sightlineIndex;
      const cellSize = data.cellSize;
      const offsets = data.offsets;

      const intersections = data.sightlineIntersections;
      const target = intersections[intersections.length - 1];
      const observer = intersections[0];
      const observerElevation = (observer[2] + offsets.observer);

      // LOS CALCULATION //
      const LOS = intersections.reduce((losInfo, coords, coordsIndex) => {
        const slope = ((coords[2] + offsets.target) - observerElevation) / coords[3];
        switch (coordsIndex) {
          case 0:
            break;
          case (intersections.length - 1):
            losInfo.slopeToTarget = slope;
            break;
          default:
            losInfo.maxSlope = Math.max(losInfo.maxSlope, slope);
        }
        return losInfo;
      }, { maxSlope: -Infinity, slopeToTarget: -Infinity });

      // VISIBILITY //
      const isVisible = (LOS.slopeToTarget > LOS.maxSlope) ? "visible" : "notVisible";

      // VISIBILITY GRAPHIC //
      const visibilityInfo = {
        geometry: { spatialReference: spatialReference, x: target[0], y: target[1] },
        attributes: {
          "visible": isVisible,
          "slope": LOS.slopeToTarget,
          "distance": target[3],
          "index": sightlineIndex,
          "demResolution": cellSize
        }
      };

      return promiseUtils.resolve({ data: { success: true, visibilityInfo: visibilityInfo } });
    },

    calculateLOS: function (data) {

      const spatialReference = data.spatialReference;
      const sightlineIndex = data.sightlineIndex;
      const cellSize = data.cellSize;
      const offsets = data.offsets;
      const sightline = Polyline.fromJSON(data.sightline);
      const observer = sightline.paths[0][0];
      const observerElevation = (observer[2] + offsets.observer);
      const target = sightline.paths[0][sightline.paths[0].length - 1];

      const intersections = data.intersections;

      // LOS CALCULATION //
      const LOS = intersections.reduce((losInfo, coords, coordsIndex) => {
        const slope = ((coords[2] + offsets.target) - observerElevation) / coords[3];
        switch (coordsIndex) {
          case 0:
            break;
          case (intersections.length - 1):
            losInfo.slopeToTarget = slope;
            break;
          default:
            losInfo.maxSlope = Math.max(losInfo.maxSlope, slope);
        }
        return losInfo;
      }, { maxSlope: -Infinity, slopeToTarget: -Infinity });

      // VISIBILITY //
      const isVisible = (LOS.slopeToTarget > LOS.maxSlope) ? "visible" : "notVisible";

      // VISIBILITY GRAPHIC //
      const visibilityInfo = {
        geometry: { spatialReference: spatialReference, x: target[0], y: target[1] },
        attributes: {
          "visible": isVisible,
          "slope": LOS.slopeToTarget,
          "distance": target[3],
          "index": sightlineIndex,
          "demResolution": cellSize
        }
      };

      console.info(visibilityInfo);

      return promiseUtils.resolve({ data: { success: true, visibilityInfo: visibilityInfo } });
    },

    createExtentCells: function (data) {

      // INPUTS //
      const extent = Extent.fromJSON(data.extent);
      const extentSRJson = extent.spatialReference.toJSON();
      const cellSize = data.cellSize;
      const halfCellSize = (cellSize * 0.5);

      const _distanceToCenter = (extent) => {
        const centerX = extent.center.x;
        const centerY = extent.center.y;
        return (x, y) => {
          const dx = (x - centerX);
          const dy = (y - centerY);
          return Math.sqrt(dx * dx + dy * dy);
        };
      };
      const _withinSearchDistance = (extent) => {
        const maxDistance = (extent.width * 0.5);
        const distanceToCenter = _distanceToCenter(extent);
        return (x, y) => {
          return (distanceToCenter(x, y) < maxDistance);
        };
      };
      const _angleToCenter = (extent) => {
        const centerX = extent.center.x;
        const centerY = extent.center.y;
        return (x, y) => {
          return Math.atan2(y - centerY, x - centerX); // * 180.0 / Math.PI;
        }
      };

      const withinSearchDistance = _withinSearchDistance(extent);
      const angleToCenter = _angleToCenter(extent);

      // CELLS //
      const cellInfos = [];

      // ROWS //
      for (let cellYCenter = extent.ymin + halfCellSize; cellYCenter <= extent.ymax; cellYCenter += cellSize) {
        // COLUMNS //
        for (let cellXCenter = extent.xmin + halfCellSize; cellXCenter <= extent.xmax; cellXCenter += cellSize) {
          if(withinSearchDistance(cellXCenter, cellYCenter)) {
            // CELL INFO //
            cellInfos.push({
              angle: angleToCenter(cellXCenter, cellYCenter),
              coords: [cellXCenter, cellYCenter],
              cell: {
                spatialReference: extentSRJson,
                xmin: cellXCenter - halfCellSize, ymin: cellYCenter - halfCellSize,
                xmax: cellXCenter + halfCellSize, ymax: cellYCenter + halfCellSize
              }
            });
          }
        }
      }

      cellInfos.sort((cellInfoA, cellInfoB) => {
        return (cellInfoB.angle - cellInfoA.angle);
      });

      // OUTPUTS //
      return promiseUtils.resolve({ data: { success: true, cellInfos: cellInfos } });
    },


    /**
     *
     * @param data
     * @returns {Promise}
     */
    generateGridCells: function (data) {

      // INPUTS //
      let extent = data.extent;
      let spatialReference = data.spatialReference;
      let cellSize = data.cellSize;

      // CELLS //
      let cells = [];

      // ROWS //
      for (let cellYMin = extent.ymin; cellYMin <= extent.ymax; cellYMin += cellSize) {
        // COLUMNS //
        for (let cellXMin = extent.xmin; cellXMin <= extent.xmax; cellXMin += cellSize) {
          cells.push({
            spatialReference: spatialReference,
            xmin: cellXMin, xmax: (cellXMin + cellSize),
            ymin: cellYMin, ymax: (cellYMin + cellSize)
          });
        }
      }

      // OUTPUTS //
      return promiseUtils.resolve({ data: { success: true, cells: cells } });
    },

    /**
     *
     * @param data
     * @returns {Promise}
     */
    createCellExtents: function (data) {

      // INPUTS //
      let points = data.points;
      let spatialReference = data.spatialReference;
      let halfCell = (data.cellSize * 0.5);

      let cellsExtents = points.map((point) => {
        return {
          spatialReference: spatialReference,
          xmin: (point[0] - halfCell), xmax: (point[0] + halfCell),
          ymin: (point[1] - halfCell), ymax: (point[1] + halfCell)
        };
      });

      // OUTPUTS //
      return promiseUtils.resolve({ data: { success: true, cellsExtents: cellsExtents } });
    },

    /**
     *
     * @param data
     * @param data.points Number[][]
     * @param data.cellSize Number
     * @param data.contourElevation Number
     * @returns {Promise}
     */
    calcCellFillVolume: function (data) {

      // INPUTS //
      let points = data.points;
      let cellArea = (data.cellSize * data.cellSize);
      let contourElevation = data.contourElevation;

      // point.m = fill volume = (contour elevation - surface elevation) * cell area //
      // TODO: ASSUMES Z IN INDEX 2...
      let coordsWithZsAndMs = points.map((coordWithZs) => {
        return coordWithZs.concat((contourElevation - (coordWithZs[2] || 0.0)) * cellArea);
      });

      // OUTPUTS //
      return promiseUtils.resolve({ data: { success: true, coordsWithZsAndMs: coordsWithZsAndMs } });
    },

    /**
     *
     * @param data
     * @param data.points Number[][]
     * @param data.contourElevation Number
     * @param data.spatialReference SpatialReference
     * @param data.cellSize Number
     * @returns {Promise}
     */
    createContourGeometries: function (data) {

      // INPUTS //
      let points = data.points;
      let spatialReference = data.spatialReference;
      let contourElevation = data.contourElevation;
      let halfCell = (data.cellSize * 0.5);

      let contourPoints = points.filter((coords) => {
        return (coords[2] < contourElevation)
      });

      let contourCells = contourPoints.map((point) => {
        return {
          spatialReference: spatialReference,
          xmin: (point[0] - halfCell), xmax: (point[0] + halfCell),
          ymin: (point[1] - halfCell), ymax: (point[1] + halfCell)
        };
      });

      // OUTPUTS //
      return promiseUtils.resolve({ data: { success: true, contourPoints: contourPoints, contourCells: contourCells } });
    }

  });

  // VERSION //
  GridCellCentersUtils.version = "0.0.1";

  // RETURN CLASS //
  return GridCellCentersUtils;
});
  


