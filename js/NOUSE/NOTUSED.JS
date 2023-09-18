const not_used = {


  /**
   *
   * @param elevationLayer
   * @returns {function(Extent, number)}
   * @private
   */
  _getElevations: function (elevationLayer) {
    return (extent, cellSize, useBestResolution) => {
      let deferred = new Deferred();

      let params = {
        extent: extent.toJSON(),
        cellSize: cellSize
      };

      // GENERATE CELL CENTERS //
      this.gridUtilsConnection.invoke("generateGridCellCenters", params).then(function (response) {
        if(response.success) {
          //console.info("generateGridCellCenters: ", response);

          // EXTENT LOCATIONS WITH MS //
          const extentLocations = new Multipoint({ points: response.cellCenters, spatialReference: extent.spatialReference, hasM: true });

          // ADD Z VALUES (ELEVATIONS) //
          // demResolution: useBestResolution ? "finest-contiguous" : cellSize
          elevationLayer.queryElevation(extentLocations, { demResolution: cellSize, returnSampleInfo: true, noDataValue: -99999 }).then(function (queryElevationResult) {

            // LOSS OF Ms FIXED AT 4.4 //
            queryElevationResult.geometry = new Multipoint({
              hasZ: true, hasM: true,
              spatialReference: extentLocations.spatialReference,
              points: queryElevationResult.geometry.points.filter((coords) => {
                return coords[2] > queryElevationResult.noDataValue;
              })
            });

            deferred.resolve(queryElevationResult);
          }.bind(this), console.warn);
        } else {
          deferred.reject(new Error("Error generating grid cell centers..."));
        }
      }).otherwise(() => {
        deferred.reject();
        this.gridUtilsConnection.close();
      });

      return deferred.promise;
    }
  },

  /**
   *
   * @param elevationLayer
   * @returns {function(*)}
   * @private
   */
  _getSightLines: function (elevationLayer) {
    return (extent, cellSize, useBestResolution) => {
      let deferred = new Deferred();

      let params = {
        cellSize: cellSize,
        extent: extent.toJSON()
      };

      // GENERATE SIGHT LINES //
      this.gridUtilsConnection.invoke("generateSightLines", params).then(function (response) {
        if(response.success) {
          //console.info("generateSightLines: ", response);

          const center = Point.fromJSON(response.center);
          const radius = response.radius;

          const querySightLineElevations = response.sightLines.map((sightLineJson) => {
            // demResolution: useBestResolution ? "finest-contiguous" : cellSize

            return elevationLayer.queryElevation(Polyline.fromJSON(sightLineJson), { demResolution: cellSize, returnSampleInfo: true, noDataValue: -9999 }).then((queryElevationResult) => {

              const sightline = queryElevationResult.geometry.clone();
              sightline.hasM = true;
              sightline.paths[0].forEach((coords, coordsIndex) => {
                coords[3] = radius;
              });

              return sightline;
            }, console.warn);

          });
          promiseUtils.eachAlways(querySightLineElevations).then((querySightLineElevationsResults) => {
            const sightLines = querySightLineElevationsResults.map((querySightLineElevationsResult) => {
              return querySightLineElevationsResult.value;
            });
            deferred.resolve({ sightLines: sightLines });
          }, console.warn);
        } else {
          deferred.reject(new Error("Error generating sight lines..."));
        }
      }).otherwise(() => {
        deferred.reject();
        this.gridUtilsConnection.close();
      });

      return deferred.promise;
    }
  },


  _getCellElevations: function (elevationLayer) {
    return (extent, cellSize) => {
      let deferred = new Deferred();

      let params = {
        extent: extent.toJSON(),
        cellSize: cellSize
      };

      // GENERATE CELL CENTERS //
      this.gridUtilsConnection.invoke("createExtentCells", params).then(function (createExtentCellsResponse) {
        if(createExtentCellsResponse.success) {

          // CELL CENTERS AS MULTIPOINT //
          const cellCenters = new Multipoint({
            points: createExtentCellsResponse.cellInfos.map((cellInfo) => {
              return cellInfo.coords;
            }),
            spatialReference: extent.spatialReference
          });

          // ADD Z VALUES (ELEVATIONS) //
          // demResolution: useBestResolution ? "finest-contiguous" : cellSize
          elevationLayer.queryElevation(cellCenters, { demResolution: cellSize, returnSampleInfo: true, noDataValue: -99999 }).then(function (queryElevationResult) {

            queryElevationResult.geometry = new Multipoint({
              hasZ: true,
              spatialReference: extent.spatialReference,
              points: queryElevationResult.geometry.points.filter((coords) => {
                return coords[2] > queryElevationResult.noDataValue;
              })
            });

            const cellInfos = createExtentCellsResponse.cellInfos.map((cellInfo, cellInfoIndex) => {
              cellInfo.coords.push(queryElevationResult.geometry.points[cellInfoIndex][2]);
              return cellInfo;
            });

            deferred.resolve({ cellInfos: cellInfos });
          }.bind(this), console.warn);
        } else {
          deferred.reject(new Error("Error generating grid cell centers..."));
        }
      }).otherwise(() => {
        deferred.reject();
        this.gridUtilsConnection.close();
      });

      return deferred.promise;
    }
  },

  /**
   *
   * @param elevationLayer
   * @returns {function(*)}
   * @private
   */
  _getSightlineIntersections_2: function (elevationLayer) {
    return (extent, cellSize, offsets) => {
      let deferred = new Deferred();

      let params = {
        extent: extent.toJSON(),
        cellSize: cellSize
      };

      // GENERATE CELL CENTERS //
      this.gridUtilsConnection.invoke("generateCellIntersections", params).then((cellIntersectionsResults) => {
        if(cellIntersectionsResults.success) {

          const calculateAllCellIntersectionLOSResults = cellIntersectionsResults.sightlineIntersections.map((sightlineIntersectionsJson, index) => {
            // demResolution: useBestResolution ? "finest-contiguous" : cellSize
            const sightlineIndex = index;

            return elevationLayer.queryElevation(Polyline.fromJSON(sightlineIntersectionsJson), { demResolution: cellSize, returnSampleInfo: true, noDataValue: -9999 }).then((querySightlineElevationsResult) => {

              return this.gridUtilsConnection.invoke("calculateLOS", {
                sightlineIndex: sightlineIndex,
                cellSize: cellSize,
                offsets: offsets,
                sightlineIntersections: querySightlineElevationsResult.geometry.toJSON()
              }).then((losResults) => {
                return {
                  sightline: querySightlineElevationsResult.geometry,
                  visibilityInfo: losResults.visibilityInfo
                }
              });
            });
          });
          promiseUtils.eachAlways(calculateAllCellIntersectionLOSResults).then((cellIntersectionLOSResults) => {

            const visibilityResults = cellIntersectionLOSResults.map((cellIntersectionLOSResult) => {
              return cellIntersectionLOSResult.value;
            });
            deferred.resolve({
              cellsPolygon: Polygon.fromJSON(cellIntersectionsResults.cellsPolygon),
              visibilityResults: visibilityResults
            });

          }, console.warn);
        } else {
          deferred.reject(new Error("Error generating sightline intersections..."));
        }
      }).otherwise(() => {
        deferred.reject();
        this.gridUtilsConnection.close();
      });

      return deferred.promise;
    }
  },


  _getSightlineIntersections_3: function (elevationLayer) {
    return (extent, cellSize, offsets) => {
      let deferred = new Deferred();

      let params = {
        extent: extent.toJSON(),
        cellSize: cellSize
      };

      // GENERATE CELL CENTERS //
      this.gridUtilsConnection.invoke("generateCellIntersections", params).then((cellIntersectionsResults) => {
        if(cellIntersectionsResults.success) {

          return elevationLayer.queryElevation(Polyline.fromJSON(cellIntersectionsResults.sightlineIntersections), { demResolution: cellSize, returnSampleInfo: true, noDataValue: -9999 }).then((querySightlineElevationsResult) => {

            const calculateAllCellIntersectionLOSResults = querySightlineElevationsResult.geometry.paths.map((path, pathIndex) => {

              return this.gridUtilsConnection.invoke("calculateLOS", {
                spatialReference: extent.spatialReference,
                sightlineIndex: pathIndex,
                cellSize: cellSize,
                offsets: offsets,
                sightlineIntersections: path
              }).then((losResults) => {

                return {
                  visibilityInfo: losResults.visibilityInfo
                };

              });

            });
            promiseUtils.eachAlways(calculateAllCellIntersectionLOSResults).then((cellIntersectionLOSResults) => {

              const visibilityResults = cellIntersectionLOSResults.map((cellIntersectionLOSResult) => {
                return cellIntersectionLOSResult.value;
              });
              deferred.resolve({
                cellsPolygon: Polygon.fromJSON(cellIntersectionsResults.cellsPolygon),
                sightline: querySightlineElevationsResult.geometry,
                visibilityResults: visibilityResults
              });

            }, console.warn);

          });
        } else {
          deferred.reject(new Error("Error generating sightline intersections..."));
        }
      }).otherwise(() => {
        deferred.reject();
        this.gridUtilsConnection.close();
      });

      return deferred.promise;
    }
  },

  _getSightlineIntersections: function (elevationLayer) {
    return (extent, cellSize, offsets) => {
      let deferred = new Deferred();

      let params = {
        extent: extent.toJSON(),
        cellSize: cellSize
      };

      // GENERATE CELL CENTERS //
      this.gridUtilsConnection.invoke("generateCellIntersections", params).then((cellIntersectionsResults) => {
        if(cellIntersectionsResults.success) {

          /**
           *   index,  sightline, activeCellCenters
           */
          const calculateAllCellIntersectionLOSResults = cellIntersectionsResults.sightlineInfos.map((sightlineInfo, sightlineInfoIndex) => {

            return elevationLayer.queryElevation(Polyline.fromJSON(sightlineInfo.sightline), { demResolution: cellSize, returnSampleInfo: true, noDataValue: -9999 }).then((querySightlineElevationsResult) => {

              return elevationLayer.queryElevation(Multipoint.fromJSON(sightlineInfo.activeCellCenters), { demResolution: cellSize, returnSampleInfo: true, noDataValue: -9999 }).then((queryActiveCellsElevationsResult) => {

                return this.gridUtilsConnection.invoke("calculateLOS", {
                  spatialReference: extent.spatialReference.toJSON(),
                  sightlineIndex: sightlineInfoIndex,
                  cellSize: cellSize,
                  offsets: offsets,
                  sightline: querySightlineElevationsResult.geometry.toJSON(),
                  intersections: queryActiveCellsElevationsResult.geometry.points
                });
              });
            });
          });

          promiseUtils.eachAlways(calculateAllCellIntersectionLOSResults).then((cellIntersectionLOSResults) => {

            const visibilityInfos = cellIntersectionLOSResults.map((cellIntersectionLOSResult) => {
              return cellIntersectionLOSResult.value.visibilityInfo;
            });
            deferred.resolve({
              //cellsPolygon: Polygon.fromJSON(cellIntersectionsResults.cellsPolygon),
              //sightline: querySightlineElevationsResult.geometry,
              visibilityInfos: visibilityInfos
            });

          }, console.warn);
        } else {
          deferred.reject(new Error("Error generating sightline intersections..."));
        }
      }).otherwise(() => {
        deferred.reject();
        this.gridUtilsConnection.close();
      });

      return deferred.promise;
    }
  },

  /**
   *
   * @param view
   * @param extent
   * @param cellSize
   * @returns {*}
   * @private
   */
  getExtentCells: function (view, extent, cellSize) {
    let deferred = new Deferred();
    this.gridUtilsConnection.invoke("createCells", {
      extent: extent.toJSON(),
      cellSize: cellSize
    }).then(function (response) {
      if(response.success) {
        deferred.resolve(response.cells);
      } else {
        deferred.reject(new Error("Error generating grid cell extents..."));
      }
    }).otherwise((error) => {
      deferred.reject(error);
      this.gridUtilsConnection.close();
    });
    return deferred.promise;
  },

  /**
   *
   * @param view
   * @param location
   * @param useBestResolution
   */
  calculateViewshed2: function (view, location, useBestResolution) {

    const observerOffset = dom.byId("offset-input").valueAsNumber;
    const observerElevation = (location.z + observerOffset);
    const analysisDistance = dom.byId("distance-input").valueAsNumber;
    const analysisArea = geometryEngine.buffer(location, analysisDistance, "meters");
    const cellSize = useBestResolution ? 30.0 : +dom.byId("cell-size-select").value;

    return this.getSightLines(analysisArea.extent, cellSize, useBestResolution).then((getSightLinesResult) => {

      const viewshedInfo = getSightLinesResult.sightLines.reduce((visibilityInfo, sightLine) => {

        let maxSlope = null;
        let isVisible = null;
        sightLine.paths[0].forEach((coords, coordsIndex) => {
          const slope = (coords[2] - observerElevation) / coords[3];

          if(coordsIndex === 0) {
            maxSlope = slope;
            isVisible = true;
          } else {
            if(slope > maxSlope) {
              maxSlope = slope;
              isVisible = true;
            } else {
              isVisible = false;
            }
          }

          // VISIBILITY //
          const visibility = isVisible ? "visible" : "notVisible";

          // CELL LOCATION //
          const cellLocation = sightLine.getPoint(0, coordsIndex);

          // CELL GRAPHIC //
          const cellGraphic = new Graphic({
            geometry: cellLocation,
            attributes: {
              "visible": visibility,
              "slope": slope,
              "demResolution": cellSize //queryElevationResult.sampleInfo[pointIndex].demResolution
            }
          });

          // ADD CELL TO RESULTS //
          //visibilityInfo[visibility].centers.push(cellLocation);
          visibilityInfo[visibility].graphics.push(cellGraphic);

          ++visibilityInfo.count;
        });

        return visibilityInfo;
      }, { count: 0, visible: { centers: [], graphics: [] }, notVisible: { centers: [], graphics: [] } });

      console.info(viewshedInfo);


      // UPDATE CELL COUNTS //
      dom.byId("location-count").value = number.format(viewshedInfo.count);
      dom.byId("visible-count").value = number.format(viewshedInfo.visible.graphics.length);
      dom.byId("not-visible-count").value = number.format(viewshedInfo.notVisible.graphics.length);

      // ADD VIEWSHED CELLS TO VIEW //
      this.cellsLayer.source.removeAll();
      this.cellsLayer.source.addMany(viewshedInfo.visible.graphics);
      this.cellsLayer.source.addMany(viewshedInfo.notVisible.graphics);

    });

  },

  /**
   *
   * @param view
   * @param location
   * @param useBestResolution
   */
  calculateViewshed_3: function (view, location, useBestResolution) {

    const observerOffset = dom.byId("offset-input").valueAsNumber;
    //const observerElevation = (location.z + observerOffset);
    const analysisDistance = dom.byId("distance-input").valueAsNumber;
    const analysisArea = geometryEngine.buffer(location, analysisDistance, "meters");
    const cellSize = useBestResolution ? 30.0 : +dom.byId("cell-size-select").value;


    const intersectionSymbol = new SimpleMarkerSymbol({
      style: "circle",
      color: Color.named.dodgerblue.concat(0.5),
      size: "7px",
      outline: {
        color: Color.named.cyan.concat(0.5),
        width: 0.5
      }
    });
    const locationSymbol = new SimpleMarkerSymbol({
      style: "diamond",
      color: Color.named.purple,
      size: "9px",
      outline: {
        color: Color.named.white.concat(0.1),
        width: 0.5
      }
    });
    const redFillSymbol = new SimpleFillSymbol({
      color: Color.named.red.concat(0.2),
      style: "solid",
      outline: {
        color: Color.named.darkred.concat(0.1),
        width: 1
      }
    });
    const greenFillSymbol = new SimpleFillSymbol({
      color: Color.named.lime.concat(0.4),
      style: "solid",
      outline: {
        color: Color.named.darkgreen.concat(0.1),
        width: 1
      }
    });
    const sightlineSymbol = new SimpleLineSymbol({
      color: Color.named.dodgerblue,
      width: 2.0
    });
    const sightlineBufferSymbol = new SimpleFillSymbol({
      color: null, //Color.named.white.concat(0.1),
      style: "solid",
      outline: {
        color: Color.named.white.concat(0.8),
        width: 1
      }
    });
    const analysisAreaSymbol = new SimpleFillSymbol({
      color: Color.named.yellow.concat(0.1),
      style: "solid",
      outline: {
        color: Color.named.gold.concat(0.8),
        width: 1.5
      }
    });
    const cellRadius = 10; //cellSize * 0.5;
    const createLocationGraphic = (location) => {
      return new Graphic({ geometry: new Point({ spatialReference: view.spatialReference, x: location[0], y: location[1] }), symbol: locationSymbol });
    };
    const createIntersectionGraphic = (location) => {
      return new Graphic({ geometry: new Point({ spatialReference: view.spatialReference, x: location[0], y: location[1] }), symbol: intersectionSymbol });
    };
    const createVisibleCellGraphic = (cellGraphic) => {
      return new Graphic({
        geometry: new Circle({ center: cellGraphic.geometry.clone(), radius: cellRadius, radiusUnit: "meters" }),
        symbol: greenFillSymbol
      });
    };
    const createNotVisibleCellGraphic = (cellGraphic) => {
      return new Graphic({
        geometry: new Circle({ center: cellGraphic.geometry.clone(), radius: cellRadius, radiusUnit: "meters" }),
        symbol: redFillSymbol
      });
    };
    const createCellExtentGraphic = (sightlineBuffer) => {
      return new Graphic({ geometry: sightlineBuffer, symbol: sightlineBufferSymbol });
    };
    const createSightlineGraphic = (sightline) => {
      return new Graphic({ geometry: sightline, symbol: sightlineSymbol });
    };
    const createAnalysisAreaGraphic = (analysisArea) => {
      return new Graphic({ geometry: analysisArea, symbol: analysisAreaSymbol });
    };

    this.mapView.graphics.removeAll();
    this.mapView.graphics.add(createAnalysisAreaGraphic(analysisArea));
    this.mapView.graphics.add(createLocationGraphic([location.x, location.y]));


    /*return this.getCellElevations(analysisArea.extent, cellSize).then((cellElevationsResults) => {
     cellElevationsResults.cellInfos.forEach(cellInfo => {
     this.mapView.graphics.add(createCellExtentGraphic(Polygon.fromExtent(new Extent(cellInfo.cell))));
     this.mapView.graphics.add(createIntersectionGraphic(cellInfo.coords));
     });
     });*/


    return this.getSightlineIntersections(analysisArea.extent, cellSize, { observer: observerOffset, target: 0 }).then((getSightlineIntersectionsResults) => {

      //const cellsPolygon = getSightlineIntersectionsResults.cellsPolygon;
      //this.mapView.graphics.add(createCellExtentGraphic(cellsPolygon));

      //const sightlineIntersections = getSightlineIntersectionsResults.sightline;
      //sightlineIntersections.paths.forEach((path) => {
      //  this.mapView.graphics.addMany(path.map(createIntersectionGraphic));
      //});

      const analysisResults = getSightlineIntersectionsResults.visibilityInfos.reduce((results, visibilityInfo) => {

        const visibilityGraphic = Graphic.fromJSON(visibilityInfo);
        const visibility = visibilityGraphic.getAttribute("visible");
        results[visibility].push(visibilityGraphic);
        ++results.count;

        return results;
      }, { count: 0, visible: [], notVisible: [] });

      // UPDATE CELL COUNTS //
      dom.byId("location-count").value = number.format(analysisResults.count);
      dom.byId("visible-count").value = number.format(analysisResults.visible.length);
      dom.byId("not-visible-count").value = number.format(analysisResults.notVisible.length);

      // ADD VIEWSHED CELLS TO VIEW //
      this.cellsLayer.source.removeAll();
      this.cellsLayer.source.addMany(analysisResults.notVisible);
      this.cellsLayer.source.addMany(analysisResults.visible);

    });


    /* return this.getSightlineIntersections(analysisArea.extent, cellSize, { observer: observerOffset, target: 0 }).then((getSightlineIntersectionsResults) => {

     const cellsPolygon = getSightlineIntersectionsResults.cellsPolygon;
     this.mapView.graphics.add(createCellExtentGraphic(cellsPolygon));

     const sightlineIntersections = getSightlineIntersectionsResults.sightline;
     sightlineIntersections.paths.forEach((path) => {
     this.mapView.graphics.addMany(path.map(createIntersectionGraphic));
     });

     const analysisResults = getSightlineIntersectionsResults.visibilityResults.reduce((results, visibilityResult) => {

     const visibilityGraphic = Graphic.fromJSON(visibilityResult.visibilityInfo);
     const visibility = visibilityGraphic.getAttribute("visible");
     results[visibility].push(visibilityGraphic);
     ++results.count;

     return results;
     }, { count: 0, visible: [], notVisible: [] });

     // UPDATE CELL COUNTS //
     dom.byId("location-count").value = number.format(analysisResults.count);
     dom.byId("visible-count").value = number.format(analysisResults.visible.length);
     dom.byId("not-visible-count").value = number.format(analysisResults.notVisible.length);

     // ADD VIEWSHED CELLS TO VIEW //
     this.cellsLayer.source.removeAll();
     this.cellsLayer.source.addMany(analysisResults.notVisible);
     this.cellsLayer.source.addMany(analysisResults.visible);

     });*/

    /* return this.getElevations(analysisArea.extent, cellSize, useBestResolution).then((queryElevationResult) => {
     console.info("Calculate Viewshed: ", queryElevationResult);

     const results = {
     count: 0,
     visible: [],
     notVisible: []
     };

     // LOCATIONS WITHIN ANALYSIS AREA //
     const cellLocationsWithinAnalysisArea = geometryEngine.intersect(queryElevationResult.geometry, analysisArea);
     const cellLocations = cellLocationsWithinAnalysisArea.clone();

     const halfCellSize = (cellSize * 0.5);*/

    /*
     const cells = cellLocations.points.map((coords) => {
     return new Extent({
     spatialReference: cellLocations.spatialReference,
     xmin: coords[0] - halfCellSize, ymin: coords[1] - halfCellSize,
     xmax: coords[0] + halfCellSize, ymax: coords[1] + halfCellSize
     });
     });
     this.mapView.graphics.addMany(cells.map(createCellExtentGraphic));
     */

    /* const allCells = new Polygon({
     spatialReference: cellLocations.spatialReference,
     rings: cellLocations.points.map((coords) => {
     return (new Polygon.fromExtent(new Extent({
     spatialReference: cellLocations.spatialReference,
     xmin: coords[0] - halfCellSize, ymin: coords[1] - halfCellSize,
     xmax: coords[0] + halfCellSize, ymax: coords[1] + halfCellSize
     }))).rings[0];
     })
     });
     this.mapView.graphics.add(createCellExtentGraphic(allCells));*/
    //this.mapView.graphics.addMany(cellLocations.points.map(createLocationGraphic));


    /* const visitedCells = {};
     const sightlines = [];
     const sightlineBuffers = [];*/

    // ---------------------------------- //
    // ---------------------------------- //
    /// cellLocations.points.forEach((coords, coordsIndex) => {

    //if(visitedCells[coordsIndex] == null) {
    //const cellLocation = cellLocations.getPoint(coordsIndex);

    // SIGHT LINE //
    /*const sightLine = new Polyline({
     spatialReference: cellLocations.spatialReference,
     paths: [[coords, [location.x, location.y]]]
     });
     sightlines.push(sightLine);

     const sightlineCellIntersection = geometryEngine.intersect(allCells, sightLine);*/

    //elevationLayer.queryElevation(extentLocations, { demResolution: cellSize, returnSampleInfo: true, noDataValue: -99999 }).then(function (queryElevationResult) {


    /* const targetIndex = (sightlineCellIntersection.paths[0].length - 1);
     sightlineCellIntersection.paths[0].forEach((coord, coordIndex) => {
     // DON'T USE FIRST OR LAST [FIRST=TARGET LOCATION] [LAST=CELL CENTER] //
     if((coordIndex > 0) && (coordIndex < targetIndex)) {

     const slope = (cellsAlongInfo.elevation - observerElevation) / cellsAlongInfo.distance;


     }
     });*/


    /*const sightLineBuffer = geometryEngine.buffer(sightLine, cellSize * 0.5, "meters");
     if(!sightLineBuffer) {
     console.info(sightLine)
     }
     sightlineBuffers.push(sightLineBuffer);*/


    //geometryEngine.intersect(cellLocations.points, sightLineBuffer);


    // ---------------------------------- //
    /*
     const cellsAlongInfos = cellLocations.points.reduce((alongInfos, cellCoords, cellCoordsIndex) => {
     const cellLocation = cellLocations.getPoint(cellCoordsIndex);
     if(sightLineBuffer.contains(cellLocation)) {

     alongInfos.push({
     idx: cellCoordsIndex,
     location: cellLocation,
     isVisible: visitedCells[cellCoordsIndex],
     elevation: cellCoords[2],
     distance: cellCoords[3]
     });

     }
     return alongInfos;
     }, []);

     cellsAlongInfos.sort((a, b) => {
     return b.distance - a.distance;
     });
     */

    //console.info(cellsAlongInfos);

    // ---------------------------------- //
    /*let maxSlope = 0.0;
     let isVisible = false;
     cellsAlongInfos.forEach((cellsAlongInfo) => {

     const slope = (cellsAlongInfo.elevation - observerElevation) / cellsAlongInfo.distance;
     if(slope > maxSlope) {
     maxSlope = slope;
     isVisible = true;
     } else {
     isVisible = false;
     }

     // VISIBILITY //
     const visibility = isVisible ? "visible" : "notVisible";

     // CELL GRAPHIC //
     const cellGraphic = new Graphic({
     geometry: cellsAlongInfo.location,
     attributes: {
     "visible": visibility,
     "slope": slope,
     "distance": cellsAlongInfo.distance.toFixed(0),
     "index": results.count,
     "demResolution": cellSize //queryElevationResult.sampleInfo[pointIndex].demResolution
     }
     });

     results[visibility].push(cellGraphic);
     ++results.count;

     visitedCells[cellsAlongInfo.idx] = isVisible;*/
    //});
    //}
    //});

    //console.info(visitedCells);

    // UPDATE CELL COUNTS //
    //dom.byId("location-count").value = number.format(results.count);
    //dom.byId("visible-count").value = number.format(results.visible.length);
    //dom.byId("not-visible-count").value = number.format(results.notVisible.length);

    // ADD VIEWSHED CELLS TO VIEW //
    //this.cellsLayer.source.removeAll();
    //this.cellsLayer.source.addMany(results.notVisible);
    //this.cellsLayer.source.addMany(results.visible);


    //this.mapView.graphics.addMany(sightlines.map(createSightlineGraphic));
    //this.mapView.graphics.addMany(results.notVisible.map(createNotVisibleCellGraphic));
    //this.mapView.graphics.addMany(results.visible.map(createVisibleCellGraphic));


    /*const viewshedCellInfo = cellLocations.points.reduce((cellInfo, coords, pointIndex) => {

     // CELL LOCATION //
     const cellLocation = cellLocations.getPoint(pointIndex);

     // WITHIN ANALYSIS DISTANCE //
     if(cellLocation.m < analysisDistance) {

     // SLOPE TO TARGET //
     const targetInfo = this.findExtendedLocation(view, location, cellLocation, (analysisDistance - cellLocation.m + cellSize));
     const slopeToTarget = (targetInfo.target.z - observerElevation) / targetInfo.distance;
     // SLOPE TO OBSERVER //
     const slopeToObserver = (cellLocation.z - observerElevation) / cellLocation.m;

     // IS CELL VISIBLE //
     const isVisible = (slopeToObserver <= slopeToTarget) ? "visible" : "notVisible";

     // CELL GRAPHIC //
     const cellGraphic = new Graphic({
     geometry: cellLocation,
     attributes: {
     "visible": isVisible,
     "slope": slopeToObserver,
     "demResolution": queryElevationResult.sampleInfo[pointIndex].demResolution
     }
     });

     // ADD CELL TO RESULTS //
     //cellInfo[isVisible].centers.push(point);
     cellInfo[isVisible].graphics.push(cellGraphic);

     ++cellInfo.count;
     }

     return cellInfo;
     }, { count: 0, visible: { centers: [], graphics: [] }, notVisible: { centers: [], graphics: [] } });*/


    // UPDATE CELL COUNTS //
    // dom.byId("location-count").value = number.format(viewshedCellInfo.count);
    // dom.byId("visible-count").value = number.format(viewshedCellInfo.visible.graphics.length);
    // dom.byId("not-visible-count").value = number.format(viewshedCellInfo.notVisible.graphics.length);


    // ADD VIEWSHED CELLS TO VIEW //
    // this.cellsLayer.source.removeAll();
    // this.cellsLayer.source.addMany(viewshedCellInfo.visible.graphics);
    // this.cellsLayer.source.addMany(viewshedCellInfo.notVisible.graphics);


    //});

  },


  calculateViewshed_4: function (view, location, useBestResolution) {

    const distanceToObserver = (x, y) => {
      const dx = (x - location.x);
      const dy = (y - location.y);
      return Math.sqrt(dx * dx + dy * dy);
    };

    const angleToObserver = (x, y) => {
      let angle = Math.atan2(y - location.y, x - location.x) * 180.0 / Math.PI;
      if(angle < 0) {
        angle += 360.0;
      }
      return angle;
    };

    const targetOffset = 0.0;//dom.byId("offset-input").valueAsNumber;
    const observerOffset = dom.byId("offset-input").valueAsNumber;
    const observerElevation = (view.basemapTerrain.getElevation(location) + observerOffset);

    const cellSize = useBestResolution ? 30.0 : +dom.byId("cell-size-select").value;
    const halfCellSize = (cellSize * 0.5);

    const analysisDistance = dom.byId("distance-input").valueAsNumber;
    const analysisArea = new Circle({ center: location, numberOfPoints: 360, radius: analysisDistance, radiusUnit: "meters" });
    //const analysisArea = geometryEngine.buffer(location, analysisDistance, "meters");
    const analysisExtent = analysisArea.extent;

    // CELL INFOS //
    const cellInfos = [];
    let row = 0;
    let col = 0;
    const startTime = new Date();

    // ROWS //
    for (let cellYCenter = analysisExtent.ymin + halfCellSize; cellYCenter <= analysisExtent.ymax; cellYCenter += cellSize, row++) {
      col = 0;
      // COLUMNS //
      for (let cellXCenter = analysisExtent.xmin + halfCellSize; cellXCenter <= analysisExtent.xmax; cellXCenter += cellSize, col++) {
        // CELL DISTANCE TO OBSERVER //
        const distToObs = distanceToObserver(cellXCenter, cellYCenter);
        if(distToObs < analysisDistance) {
          // CELL //
          const cell = new Extent({
            spatialReference: analysisExtent.spatialReference,
            xmin: cellXCenter - halfCellSize, ymin: cellYCenter - halfCellSize,
            xmax: cellXCenter + halfCellSize, ymax: cellYCenter + halfCellSize
          });

          // CELL STATS //
          const cellElevation = view.basemapTerrain.getElevation(cell.center);
          const cellSlope = (((cellElevation + targetOffset) - observerElevation) / distToObs);
          const cellAngle = angleToObserver(cellXCenter, cellYCenter);

          // CELL INFO //
          const cellInfo = {
            id: cellInfos.length,
            cell: cell,
            row: row,
            col: col,
            elevation: cellElevation,
            distance: distToObs,
            angle: cellAngle,
            slope: cellSlope,
            status: "new",
            visible: "unknown"
          };

          // CELL INFOS //
          cellInfos.push(cellInfo);
        }
      }
    }
    //console.info(`Rows:${row}  Cols:${col}  Cells:${row * col}`);
    const prepTime = new Date();

    // SORT BY ANGLE //
    cellInfos.sort((activeCellInfoA, activeCellInfoB) => {
      return (activeCellInfoB.angle - activeCellInfoA.angle);
    });

    // CELL LISTS //
    const cellLists = {
      newCells: cellInfos,
      activeCells: [],
      visitedCells: []
    };

    // ANALYSIS AREA LOCATIONS //
    const analysisAreaCoords = analysisArea.rings[0];
    analysisAreaCoords.forEach((endCoords, endCoordsIndex) => {

      // SIGHTLINE //
      const sightline = new Polyline({
        spatialReference: analysisArea.spatialReference,
        paths: [[[location.x, location.y], endCoords]]
      });
      let sightlineAngle = (endCoordsIndex === 0) ? 360.0 : angleToObserver(endCoords[0], endCoords[1]);

      // REMOVE ACTIVE CELLS THAT DON'T INTERSECT SIGHTLINE //
      let activeCellIndex = cellLists.activeCells.length;
      while (activeCellIndex--) {
        const cellInfo = cellLists.activeCells[activeCellIndex];
        const intersects = (geometryEngine.intersects(cellInfo.cell, sightline));
        if(!intersects) {
          cellLists.activeCells.splice(activeCellIndex, 1);
          cellInfo.status = "visited";
          cellLists.visitedCells.push(cellInfo);
        }
      }

      // ADD NEW CELLS THAT INTERSECT SIGHTLINE //
      let newCellIndex = cellLists.newCells.length;
      while (newCellIndex--) {
        const cellInfo = cellLists.newCells[newCellIndex];
        const intersects = (geometryEngine.intersects(cellInfo.cell, sightline));
        if(intersects) {
          cellLists.newCells.splice(newCellIndex, 1);
          cellInfo.status = "active";
          cellLists.activeCells.push(cellInfo);
        }
      }

      // SORT BY DISTANCE //
      cellLists.activeCells.sort((activeCellInfoA, activeCellInfoB) => {
        return (activeCellInfoA.distance - activeCellInfoB.distance);
      });

      // CALC VISIBILITY //
      cellLists.activeCells.forEach((cellInfo, cellInfoIndex) => {
        if((cellInfo.visible === "unknown") && (cellInfo.angle < sightlineAngle)) {
          // LOS ALONG ACTIVE CELLS UP TO CURRENT CELL //
          const losCells = cellLists.activeCells.slice(0, cellInfoIndex);
          const isVisible = losCells.every((losCellInfo) => {
            return (losCellInfo.slope <= cellInfo.slope);
          });
          // VISIBILITY //
          cellInfo.visible = isVisible ? "visible" : "notVisible";
        }
      });

    });
    const analysisTime = new Date();

    //console.info(`New: ${cellLists.newCells.length}  Active: ${cellLists.activeCells.length}  Visited: ${cellLists.visitedCells.length}`);
    //console.info("LISTS: ", cellLists);

    let analysisResults = cellLists.visitedCells.reduce((results, cellInfo) => {
      results[cellInfo.visible].push(cellInfo.cell);
      return results;
    }, { visible: [], notVisible: [], unknown: [] });

    analysisResults = cellLists.activeCells.reduce((results, cellInfo) => {
      results[cellInfo.visible].push(cellInfo.cell);
      return results;
    }, analysisResults);


    // UPDATE CELL COUNTS //
    const visibleAreaSquareMeters = Math.pow(analysisResults.visible.length, 2) * cellSize;
    dom.byId("visible-count").value = number.format(visibleAreaSquareMeters);

    // ADD VIEWSHED CELLS TO VIEW //
    //this.cellsLayer.source.removeAll();
    //this.cellsLayer.source.addMany(analysisResults.notVisible);
    //this.cellsLayer.source.addMany(analysisResults.visible);

    const visibleArea = geometryEngine.union(analysisResults.visible);
    //const notVisibleArea = geometryEngine.union(analysisResults.notVisible);
    //const visibleAreaSmooth = this.smoothGeometry(visibleArea, 8, null);
    //const notVisibleAreaSmooth = this.smoothGeometry(notVisibleArea, 8, null);

    const visibleGraphic = new Graphic({
      geometry: visibleArea,
      attributes: { visible: "visible" }
    });
    //const notVisibleGraphic = new Graphic({
    //  geometry: notVisibleArea,
    //  attributes: { visible: "notVisible" }
    //});
    this.visibilityLayer.source.removeAll();
    //this.visibilityLayer.source.add(notVisibleGraphic);
    this.visibilityLayer.source.add(visibleGraphic);


    const calcDurationSeconds = (fromTime, toTime) => {
      return (toTime.valueOf() - fromTime.valueOf()) / 1000;
    };

    const endTime = new Date();
    const prepDuration = calcDurationSeconds(startTime, prepTime);
    const analysisDuration = calcDurationSeconds(prepTime, analysisTime);
    const drawDuration = calcDurationSeconds(analysisTime, endTime);
    const totalDuration = calcDurationSeconds(startTime, endTime);

    const durationInfo = {
      "Rows: ": row,
      "Cols: ": col,
      "Cells: ": (row * col),
      "Prep: ": prepDuration,
      "Analysis: ": analysisDuration,
      "Draw:": drawDuration,
      "Total:": totalDuration
    };
    dom.byId("info-node").innerHTML = JSON.stringify(durationInfo, null, "  ");

  },

  calculateViewshed_5: function (view, location, useBestResolution) {

           const angleToObserver = (x, y) => {
             let angle = Math.atan2(y - location.y, x - location.x) * 180.0 / Math.PI;
             if(angle < 0) {
               angle += 360.0;
             }
             return angle;
           };

           const cellSize = useBestResolution ? 30.0 : +dom.byId("cell-size-select").value;
           const offsets = { target: 0.0, observer: dom.byId("offset-input").valueAsNumber };

           const analysisDistance = dom.byId("distance-input").valueAsNumber;
           const analysisArea = new Circle({ center: location, numberOfPoints: 360, radius: analysisDistance, radiusUnit: "meters" });
           const analysisExtent = analysisArea.extent;

           const startTime = new Date();
           return this.createCellInfos(location, analysisExtent, analysisDistance, cellSize, offsets).then((createCellInfosResult) => {
             const prepTime = new Date();

             // CELL EVENTS //
             const cellEvents = createCellInfosResult.cellEvents;
             cellEvents.sort((cellEventsA, cellEventsB) => {
               return (cellEventsB.angle - cellEventsA.angle);
             });
             console.table(cellEvents);

             // NEW CELL INFOS //
             const newCellInfos = createCellInfosResult.newCellInfos;

             // NEARBY CELL INFOS //
             const nearbyCellInfos = createCellInfosResult.nearbyCellInfos;
             console.table(nearbyCellInfos);


             // SORT BY ANGLE //
             newCellInfos.sort((activeCellInfoA, activeCellInfoB) => {
               return (activeCellInfoB.angle - activeCellInfoA.angle);
             });
             //console.table(newCellInfos);


             // CELL LISTS //
             const cellLists = {
               newCells: newCellInfos,
               activeCells: [],
               visitedCells: nearbyCellInfos
             };

             const add_details = [];
             const endPoints = [];
             const sightlines = [];
             const cellGraphics = [];

             // ANALYSIS AREA LOCATIONS //
             const analysisAreaCoords = analysisArea.rings[0].reverse();
             analysisAreaCoords.forEach((endCoords, endCoordsIndex) => {

               // SIGHTLINE //
               const sightline = new Polyline({
                 spatialReference: analysisArea.spatialReference,
                 paths: [[[location.x, location.y], endCoords]]
               });
               let sightlineAngle = angleToObserver(endCoords[0], endCoords[1]);

               //sightlines.push({ geometry: sightline.toJSON(), attributes: {} });
               //endPoints.push({ geometry: { spatialReference: view.spatialReference.toJSON(), x: endCoords[0], y: endCoords[1] }, attributes: { label: endCoordsIndex + "::" + sightlineAngle.toFixed(1) } });

               // REMOVE ACTIVE CELLS THAT DON'T INTERSECT SIGHTLINE //
               let activeCellIndex = cellLists.activeCells.length;
               while (activeCellIndex--) {
                 const cellInfo = cellLists.activeCells[activeCellIndex];
                 const intersects = (geometryEngine.intersects(cellInfo.cell, sightline));
                 if(!intersects) {
                   if(cellInfo.visible === "unknown") {
                     console.warn("Removing cell visible=unknown !!!");
                   }
                   cellLists.activeCells.splice(activeCellIndex, 1);
                   cellInfo.status = "visited";
                   cellLists.visitedCells.push(cellInfo);
                 }
               }

               // ADD NEW CELLS THAT INTERSECT SIGHTLINE //
               let newCellIndex = cellLists.newCells.length;
               while (newCellIndex--) {
                 const cellInfo = cellLists.newCells[newCellIndex];
                 const intersects = (geometryEngine.intersects(cellInfo.cell, sightline));
                 if(intersects) {
                   cellLists.newCells.splice(newCellIndex, 1);
                   cellInfo.status = "active";
                   cellLists.activeCells.push(cellInfo);
                 }
                 // TODO: WHAT IS THE CHECK THAT SAYS- WE DON'T NEED TO CHECK ANY MORE...
                 //if(cellInfo.angle > (sightlineAngle + 15.0)) {break;}
               }
               //add_details.push({ coord_index: endCoordsIndex, coord_angle: sightlineAngle, new_count: cellLists.newCells.length, new_index: newCellIndex });
               add_details.push({ coord_index: endCoordsIndex, coord_angle: sightlineAngle, new_count: cellLists.newCells.length });

               // SORT BY DISTANCE //
               cellLists.activeCells.sort((activeCellInfoA, activeCellInfoB) => {
                 return (activeCellInfoA.distance - activeCellInfoB.distance);
               });

               // CALC VISIBILITY //
               cellLists.activeCells.forEach((cellInfo, cellInfoIndex) => {
                 if((cellInfo.visible === "unknown") && (cellInfo.angle < sightlineAngle)) {

                   // LOS ALONG ACTIVE CELLS UP TO CURRENT CELL //
                   const losCells = cellLists.activeCells.slice(0, cellInfoIndex);
                   // CELL IS VISIBLE IF SLOPE IS GREATER THAN ALL ACTIVE CELLS //
                   const isVisible = losCells.every((losCellInfo) => {
                     return (losCellInfo.slope < cellInfo.slope);
                   });
                   // VISIBILITY //
                   cellInfo.visible = isVisible ? "visible" : "notVisible";


                   const nearestVerticesInfos = geometryEngine.nearestVertices(cellInfo.cell, location, analysisDistance, 3);
                   nearestVerticesInfos.forEach((nearestVertexInfo) => {
                     endPoints.push({ geometry: nearestVertexInfo.coordinate.toJSON(), attributes: {} });
                   });

                   cellGraphics.push({ geometry: cellInfo.cell.toJSON(), attributes: {} });
                 }
               });

               //add_details.push({ coord_index: endCoordsIndex, coord_angle: sightlineAngle, new_count: cellLists.newCells.length, active_count: cellLists.activeCells.length });
             });

             console.table(add_details);
             //console.info(`New: ${cellLists.newCells.length}  Active: ${cellLists.activeCells.length}  Visited: ${cellLists.visitedCells.length}`);

             // VISIBILITY ANALYSIS FINISHED //
             const analysisTime = new Date();

             // VISITED CELLS //
             let analysisResults = cellLists.visitedCells.reduce((results, cellInfo) => {
               results[cellInfo.visible].push(cellInfo.cell);
               return results;
             }, { visible: [], notVisible: [], unknown: [] });

             // ACTIVE CELLS //
             analysisResults = cellLists.activeCells.reduce((results, cellInfo) => {
               results[cellInfo.visible].push(cellInfo.cell);
               return results;
             }, analysisResults);


             // UPDATE VISIBLE AREA MEASUREMENT //
             const visibleAreaSquareMeters = Math.pow(analysisResults.visible.length, 2) * cellSize;
             dom.byId("visible-count").value = number.format(visibleAreaSquareMeters);

             // ADD VIEWSHED CELLS TO VIEW //
             this.cellsLayer.source.removeAll();
             this.cellsLayer.source.addMany(cellGraphics.map(Graphic.fromJSON));

             //this.cellsLayer.source.addMany(analysisResults.notVisible);
             //this.cellsLayer.source.addMany(analysisResults.visible);

             //const visibleAreaSmooth = this.smoothGeometry(visibleArea, 8, null);
             //const notVisibleAreaSmooth = this.smoothGeometry(notVisibleArea, 8, null);

             this.visibilityLayer.source.removeAll();

             /*this.visibilityLayer.source.add(new Graphic({
              geometry: geometryEngine.union(analysisResults.notVisible),
              attributes: { visible: "notVisible" }
              }));*/

             if(analysisResults.visible.length > 0) {
               this.visibilityLayer.source.add(new Graphic({
                 geometry: geometryEngine.union(analysisResults.visible),
                 attributes: { visible: "visible" }
               }));
             }

             if(endPoints && endPoints.length > 0) {
               this.locationsLayer.source.addMany(endPoints.map(Graphic.fromJSON));
             }

             if((sightlines && sightlines.length > 0)) {
               this.sightlineLayer.source.addMany(sightlines.map(Graphic.fromJSON));
             }

             // CELL COUNT //
             const cellCount = (createCellInfosResult.rows * createCellInfosResult.cols);

             const calcDurationSeconds = (fromTime, toTime) => {
               return (toTime.valueOf() - fromTime.valueOf()) / 1000;
             };

             const endTime = new Date();
             const prepDuration = calcDurationSeconds(startTime, prepTime);
             const analysisDuration = calcDurationSeconds(prepTime, analysisTime);
             const drawDuration = calcDurationSeconds(analysisTime, endTime);
             const totalDuration = calcDurationSeconds(startTime, endTime);


             const durationInfo = {
               //"Rows: ": row,
               //"Cols: ": col,
               "Cells: ": cellCount,
               "Prep: ": prepDuration,
               "Analysis: ": analysisDuration,
               "Draw:": drawDuration,
               "Total:": totalDuration
             };
             dom.byId("info-node").innerHTML = JSON.stringify(durationInfo, null, "  ");

           });
         },

  /**
   * Adapted from: https://github.com/stbaer/smooth-path/blob/master/index.js
   *               http://www.idav.ucdavis.edu/education/CAGDNotes/Chaikins-Algorithm/Chaikins-Algorithm.html
   *
   * @param geometry Polyline | Polygon
   * @param iterationsCount Number
   * @param ignorePolygon Polygon
   * @returns Polyline | Polygon
   */
  smoothGeometry: function (geometry, iterationsCount, ignorePolygon) {

    let offsetFactor = 0.25;
    let iterations = iterationsCount || 6;

    let smoothGeometry = geometry.clone();
    let geometryParts = (smoothGeometry.rings || smoothGeometry.paths);
    if(geometryParts) {

      let smoothParts = [];
      let smoothPart;
      let part;
      let p0x, p0y, p0z, p0m, p1x, p1y, p1z, p1m;

      for (let partIndex = 0; partIndex < geometryParts.length; partIndex++) {
        part = geometryParts[partIndex];
        for (let iteration = 0; iteration < iterations; iteration++) {
          smoothPart = [];
          for (let coordIndex = 0; coordIndex < (part.length - 1); coordIndex++) {

            // IGNORE POINTS WITHIN POLYGON //
            if(ignorePolygon && ignorePolygon.contains(new Point({ spatialReference: geometry.spatialReference, x: part[coordIndex][0], y: part[coordIndex][1] }))) {
              smoothPart[coordIndex] = part[coordIndex];
              smoothPart[coordIndex + 1] = part[coordIndex + 1];

            } else {
              p0x = part[coordIndex][0];
              p0y = part[coordIndex][1];
              p1x = part[coordIndex + 1][0];
              p1y = part[coordIndex + 1][1];

              smoothPart[coordIndex] = [
                ((1.0 - offsetFactor) * p0x + offsetFactor * p1x),
                ((1.0 - offsetFactor) * p0y + offsetFactor * p1y)
              ];
              smoothPart[coordIndex + 1] = [
                (offsetFactor * p0x + (1.0 - offsetFactor) * p1x),
                (offsetFactor * p0y + (1.0 - offsetFactor) * p1y)
              ];

              if(smoothGeometry.hasZ) {
                p0z = part[coordIndex][2] || 0.0;
                p1z = part[coordIndex + 1][2] || 0.0;
                smoothPart[coordIndex].push(((1.0 - offsetFactor) * p0z + offsetFactor * p1z));
                smoothPart[coordIndex + 1].push((offsetFactor * p0z + (1.0 - offsetFactor) * p1z));
              }
              /*if(smoothGeometry.hasM) {
               p0m = part[coordIndex][3] || 0.0;
               p1m = part[coordIndex + 1][3] || 0.0;
               smoothPart[coordIndex].push(((1.0 - offsetFactor) * p0m + offsetFactor * p1m));
               smoothPart[coordIndex + 1].push((offsetFactor * p0m + (1.0 - offsetFactor) * p1m));
               }*/
            }
          }
          part = smoothPart;
        }
        smoothParts.push(smoothPart);
      }
      smoothGeometry[smoothGeometry.paths ? "paths" : "rings"] = smoothParts;
    } else {
      console.warn("smoothGeometry() only works with Polyline and Polygon geometry types; input geometry type: ", geometry.type);
    }

    return smoothGeometry;
  },


  /**
   *
   * @param startPoint
   * @param angle
   * @param distance
   * @returns {Point}
   */
  atAngleAndDistance: function (startPoint, angle, distance) {
    return new Point({
      spatialReference: startPoint.spatialReference,
      x: Math.cos(angle * Math.PI / 180.0) * distance + startPoint.x,
      y: Math.sin(angle * Math.PI / 180.0) * distance + startPoint.y
    });
  },

  /**
   *
   * @param view
   * @param startPoint
   * @param endPoint
   * @param extendDistance
   * @returns {{target: *, distance}}
   */
  findExtendedLocation: function (view, startPoint, endPoint, extendDistance) {
    const distanceToTarget = startPoint.distance(endPoint);
    const targetLocation = new Point({
      spatialReference: startPoint.spatialReference,
      x: endPoint.x + (endPoint.x - startPoint.x) / distanceToTarget * extendDistance,
      y: endPoint.y + (endPoint.y - startPoint.y) / distanceToTarget * extendDistance
    });
    targetLocation.z = view.basemapTerrain.getElevation(targetLocation);

    return {
      target: targetLocation,
      distance: distanceToTarget
    }
  }

};