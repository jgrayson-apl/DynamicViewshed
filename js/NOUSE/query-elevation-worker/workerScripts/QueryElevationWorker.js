define([
  "esri/layers/ElevationLayer",
  "esri/geometry/Multipoint"
], function (ElevationLayer, Multipoint) {

  function Worker() {
  }

  Worker.prototype.execute = function () {
    console.log("Worker: execute()");

    var layer = new ElevationLayer("https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer");

    return layer.load().then(function () {

      var points = [
        [86.9252, 27.9883],
        [86.9265, 27.9894],
        [86.9292, 27.9923],
        [86.9324, 27.9960],
        [86.9359, 27.9992]
      ];

      return layer.queryElevation(new Multipoint(points), { returnSampleInfo: true });

    }).then(function (result) {
      // Successfully sampled all points
      // Print result of each sampled point to the console
      return result.geometry.points.map(function (point, index) {
        var elevation = Math.round(point[2]);
        var resolution = result.sampleInfo[index].demResolution;

        var coordinateText = "(" + point[0] + ", " + point[1] + ")";
        var resolutionText = Math.round(resolution) + " meter resolution";

        return "Sampled " + coordinateText + ": " + elevation + " at " + resolutionText;
      });
    });
  };

  Worker.prototype.executeOnMainThread = function (params, connection) {
    console.log("Worker: executeOnMainThread()");

    var points = [
      [86.9252, 27.9883],
      [86.9265, 27.9894],
      [86.9292, 27.9923],
      [86.9324, 27.9960],
      [86.9359, 27.9992]
    ];

    return connection.invoke("queryElevation", { points: points }).then(function (result) {

      result = JSON.parse(result);

      // Successfully sampled all points
      // Print result of each sampled point to the console
      return result.geometry.points.map(function (point, index) {
        var elevation = Math.round(point[2]);
        var resolution = result.sampleInfo[index].demResolution;

        var coordinateText = "(" + point[0] + ", " + point[1] + ")";
        var resolutionText = Math.round(resolution) + " meter resolution";

        return "Sampled " + coordinateText + ": " + elevation + " at " + resolutionText;
      });
    });
  };

  return Worker;
});
