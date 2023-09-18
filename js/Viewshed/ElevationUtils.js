/**
 *
 * GenerateGridCellCenters
 *  - Generate Grid Cell Centers
 *
 * Author:   John Grayson - Applications Prototype Lab - Esri
 * Created:  12/19/2016 - 0.0.1 -
 * Modified: 10/26/2017 - 0.0.2 - Using Accessor
 * Modified: 10/30/2017 - 0.0.3 - rename to ElevationUtils, and removed unused code
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
  "esri/layers/ElevationLayer",

], function (Accessor, promiseUtils,
             Point, Multipoint, Extent, Polyline, Polygon, Circle,
             ElevationLayer) {

  const ElevationUtils = Accessor.createSubclass({

    // CLASS NAME //
    declaredClass: "ElevationUtils",

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
        this.getFinestContiguousResolution = this._getFinestContiguousResolution(this.elevationLayer);
        return { data: { success: true } };
      });
    },

    /**
     *
     * @param data
     * @returns {Promise}
     */
    createCellInfos: function (data) {

      // OFFSETS //
      const offsets = data.offsets;
      // DISTANCE //
      const analysisDistance = data.analysisDistance;

      // CELL SIZE //
      const cellSize = data.cellSize;
      // HALF CELL //
      const halfCellSize = (cellSize * 0.5);
      // SNAP TO CELL //
      const snapToCell = (coord) => {
        return coord - (coord % cellSize);
      };

      // LOCATION //
      const location = Point.fromJSON(data.location);

      // ANALYSIS AREA //
      const analysisArea = new Circle({ center: location, radius: analysisDistance, radiusUnit: "meters" });

      // ANALYSIS EXTENT //
      const extent = analysisArea.extent;
      const extentXmin = snapToCell(extent.xmin);
      const extentYmin = snapToCell(extent.ymin);

      //this.getFinestContiguousResolution(extent).then((finestContiguousCellSize) => {
      //  console.info("finestContiguousCellSize: ", finestContiguousCellSize);
      //});

      // SPATIAL REFERENCE //
      const spatialReferenceJson = location.spatialReference.toJSON();

      // CELL INFOS //
      const cellInfos = [];
      const cellCenters = [];
      let centerCellId = -1;

      const stepCount = (extent.width / cellSize);
      for (let stepCountY = 0; stepCountY < stepCount; stepCountY++) {
        const ymin = (extentYmin + (stepCountY * cellSize));
        const ymax = (ymin + cellSize);

        for (let stepCountX = 0; stepCountX < stepCount; stepCountX++) {
          const xmin = (extentXmin + (stepCountX * cellSize));
          const xmax = (xmin + cellSize);

          const cellCenter = { x: (xmin + halfCellSize), y: (ymin + halfCellSize) };

          // CELL WITHIN ANALYSIS AREA //
          const distToObs = this._getDistance(location, cellCenter);
          if(distToObs < analysisDistance) {

            // IS CENTER CELL //
            const isCenterCell = (location.x > xmin) && (location.x < xmax) && (location.y > ymin) && (location.y < ymax);

            // CELL INFO //
            const cellInfo = {
              id: cellInfos.length,
              col: stepCountX,
              row: stepCountY,
              spatialReference: spatialReferenceJson,
              xmin: xmin,
              ymin: ymin,
              xmax: xmax,
              ymax: ymax,
              center: cellCenter,
              status: isCenterCell ? "leave" : "new",
              visible: isCenterCell ? "visible" : "notVisible"
            };

            if(isCenterCell) {
              // CELL CENTER ID //
              centerCellId = cellInfo.id;
            }

            // ADD CELL INFO //
            cellInfos[cellInfo.id] = cellInfo;
            // CELL CENTER //
            cellCenters.push([cellCenter.x, cellCenter.y]);
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
          // CELL DEM RESOLUTION //
          cellInfo.demResolution = queryElevationResult.sampleInfo[coordsIndex].demResolution;

          // CALC DISTANCE AND SLOPE //
          cellInfo.distance = this._getDistance(visibilityResults.location, cellInfo.center);
          cellInfo.slope = (((coords[2] + offsets.target) - (visibilityResults.location.z + offsets.observer)) / cellInfo.distance);

          // CALC ANGLES //
          this._calcCellAngles(visibilityResults.location, cellInfo);

          if(coordsIndex === centerCellId) {
            visibilityResults.nearbyCellInfos.push(cellInfo);

          } else {
            // ADJUST ANGLES //
            // NOTE: DON'T LIKE THIS AND NEED TO BETTER UNDERSTAND WHY WE NEED TO DO THIS...
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
          cellInfos: cellInfos,
          location: location,  // queryElevationResult.geometry.getPoint(centerCellId).toJSON(),
          nearbyCellInfos: [],
          cellEvents: []
        });


        // SORT CELL EVENTS BY ANGLE AND DISTANCE//
        visibilityResults.cellEvents.sort((cellEventA, cellEventB) => {
          if(cellEventA.angle === cellEventB.angle) {
            return (cellEventA.distance - cellEventB.distance);
          } else {
            return (cellEventA.angle - cellEventB.angle);
          }
        });

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
     * @returns {*}
     * @private
     */
    /*_getGeodesicDistance: function (fromPnt, toPnt) {
     const polyline = new Polyline({
     spatialReference: this.elevationLayer.spatialReference,
     paths: [[[fromPnt.x, fromPnt.y], [toPnt.x, toPnt.y]]]
     });
     return geometryEngine.geodesicLength(polyline);
     },*/

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
      cellInfo.angle = this._getAngle(location, cellInfo.center);
    },

    /**
     *
     * @param elevationLayer
     * @returns {function(*=)}
     * @private
     */
    _getFinestContiguousResolution: function (elevationLayer) {
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
    }

  });

  // VERSION //
  ElevationUtils.version = "0.0.3";

  // RETURN CLASS //
  return ElevationUtils;
});
  


