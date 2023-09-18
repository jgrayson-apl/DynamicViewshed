define([
  "esri/layers/BaseDynamicLayer",
  "esri/layers/ImageryLayer",
  "esri/geometry/geometryEngine",
  "esri/geometry/Extent",
  "esri/request",
  "esri/core/promiseUtils"
], function (BaseDynamicLayer, ImageryLayer,
             geometryEngine, Extent, esriRequest, promiseUtils) {


  /*
   paths: {
   lerc: "https://cdn.rawgit.com/Esri/lerc/b0650ff9/OtherLanguages/js/"
   }
   */

  const ViewshedLayer = BaseDynamicLayer.createSubclass({

    declaredClass: "ViewshedLayer",

    properties: {
      title: "Viewshed Layer",
      url: "//elevation.arcgis.com/arcgis/rest/services/WorldElevation/TopoBathy/ImageServer",
      analysisArea: null
    },

    load: function () {

      this._elevation = new ImageryLayer({
        url: this.url,
        format: "lerc"
      });

      this._elevation.otherwise((error) => {
        console.warn(error);
      });

      this.addResolvingPromise(this._elevation.load());
    },

    fetchImage: function (extent, width, height) {

      if(!this.analysisArea) {
        return this.getEmptyTile("silver", width, height);
      }
      if(!extent.intersects(this.analysisArea)) {
        return this.getEmptyTile("orange", width, height);
      }

      return this._elevation.fetchImage(this.analysisArea.extent, width, height).then((data) => {
        console.info(data);

        const pixelBlock = data.pixelData.pixelBlock;


        return this.getEmptyTile("red", width, height);
      });


      /*var url = this.getImageUrl(extent, width, height);

       // request for the image  based on the generated url
       return esriRequest(url, { responseType: "image", allowImageDataAccess: true }).then(function (response) {
       var image = response.data;

       // create a canvas with teal fill
       var canvas = document.createElement("canvas");
       var context = canvas.getContext("2d");
       canvas.width = width;
       canvas.height = height;


       context.fillStyle = "rgb(0,200,200)";
       context.fillRect(0, 0, width, height);
       context.globalCompositeOperation = "destination-atop";
       context.drawImage(image, 0, 0, width, height);

       return canvas;
       }.bind(this));*/
    },

    getEmptyTile: function (color, width, height) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      if(color) {
        const context = canvas.getContext("2d");
        context.lineWidth = "3";
        context.strokeStyle = color || "black";
        context.rect(0, 0, canvas.width, canvas.height);
        context.stroke();
      }
      return promiseUtils.resolve(canvas);
    },

    /* fetchTile: function (level, row, col) {
     const url = this.getTileUrl(level, row, col);

     const bounds = this.getTileBounds(level, row, col);
     const extent = new Extent({
     xmin: bounds[0], ymin: bounds[1],
     xmax: bounds[2], ymax: bounds[3],
     spatialReference: this.spatialReference
     });

     if(!this.analysisArea) {
     return this.getEmptyTile("silver");
     }
     if(!extent.intersects(this.analysisArea)) {
     return this.getEmptyTile("orange");
     }

     const tileSize = this.tileInfo.size[0];

     return this._elevation.fetchImage(this.analysisArea.extent, tileSize, tileSize).then((data) => {
     console.info(level, row, col, data);

     const pixelBlock = data.pixelData.pixelBlock;


     return this.getEmptyTile("red");
     });


     // requested encoded elevation information
     /!*return esriRequest(url, { responseType: "array-buffer" }).then((response) => {
     // create a canvas to draw the processed image
     const canvas = document.createElement("canvas");
     const context = canvas.getContext("2d");
     canvas.width = this.tileInfo.size[0];
     canvas.height = this.tileInfo.size[1];

     // uncompress raw elevation values in lerc format into a pre-allocated array of elevation values.
     const lerc = LercDecode.decode(response.data, { noDataValue: 0 });
     // Array of elevation values
     const pixels = lerc.pixels[0];
     const stats = lerc.statistics[0];
     const noDataValue = stats.noDataValue;

     /!*
     const grid = [];
     const spacing = 4;
     for (let x = 0; x < canvas.width; x += spacing) {
     for (let y = 0; y < canvas.height; y += spacing) {
     const elev = pixels[x * y];
     if(elev !== noDataValue) {
     grid.push([x, y, elev]);
     }
     }
     }
     console.info("GRID: ", grid);
     *!/


     // Create a new blank image data object with the specified dimensions.
     // The imageData represents the underlying pixel data of the canvas.
     const imageData = context.createImageData(canvas.width, canvas.height);
     // get one-dimensional array containing the data in the RGBA order,
     // with integer values between 0 and 255 (included).
     const data = imageData.data;

     const factor = 256 / (stats.maxValue - stats.minValue);
     let value = 0;
     let adjustedIndex;

     // Loop through elevation array to generate an image that will be displayed.
     // As mentioned above `pixels` is a flat array of color values and alpha [r, g, b, a, r, g, b, a, ...]
     // We need to iterate through elevations and assign color and alpha values respectively.
     for (let index = 0; index < (canvas.width * canvas.height); index++) {
     // map tile size is 256x256. Elevation values have a tile size of 257 so we skip the last elevation
     // whenever "i" is incremented by 256 to jump to the next row.
     adjustedIndex = index + Math.floor(index / canvas.width);
     // read the elevation value at the given index from the elevation array and multiply it by the factor.
     // This will define the shade of blue color for the pixel.
     value = (pixels[adjustedIndex] - stats.minValue) * factor;


     // create RGBA value for the pixels
     data[index * 4] = value; // r
     data[index * 4 + 1] = value; // g
     data[index * 4 + 2] = 0; // b
     data[index * 4 + 3] = pixels[index] === noDataValue ? 0 : 125; // a
     }

     // The elevation change image and ready for display
     context.putImageData(imageData, 0, 0);

     return canvas;
     });*!/
     }*/

  });

  ViewshedLayer.version = "0.0.1";

  return ViewshedLayer;
});