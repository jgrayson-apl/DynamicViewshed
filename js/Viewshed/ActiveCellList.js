/*

 */
define(["dojo/_base/declare"], function (declare) {

  const ActiveCellList = declare(null, {

    _list: null,

    constructor: function () {
      this._list = [];
    },

    /**
     *
     */
    reset: function () {
      this._list = [];
    },

    /**
     *
     */
    getCount: function () {
      return this._list.length;
    },

    getAnalysisItems: function () {
      return this._list.map((cellInfo) => {
        return { distance: cellInfo.distance, slope: cellInfo.slope }
      });
    },

    /**
     * COMPARE BY DISTANCE
     *
     * @param cellInfoA
     * @param cellInfoB
     * @returns {number}
     * @private
     */
    _compareByDistance: function (cellInfoA, cellInfoB) {
      return cellInfoA.distance - cellInfoB.distance;
    },

    /**
     * FIND INSERTION INDEX
     *
     * Adapted from: https://stackoverflow.com/questions/3464815/insert-item-in-javascript-array-and-sort
     *
     * @param cellInfo
     * @returns {number}
     */
    _findInsertionIndex: function (cellInfo) {
      let highIndex = this._list.length;
      let midIndex = -1;
      let lowIndex = 0;
      let compareResults = 0;
      while (lowIndex < highIndex) {
        midIndex = parseInt((lowIndex + highIndex) / 2);
        compareResults = this._compareByDistance(this._list[midIndex], cellInfo);
        if(compareResults < 0) {
          lowIndex = midIndex + 1;
        } else if(compareResults > 0) {
          highIndex = midIndex;
        } else {
          return midIndex;
        }
      }
      return lowIndex;
    },

    /**
     * INSERT SORTED BY DISTANCE
     *
     * @param cellInfo
     */
    insert: function (cellInfo) {
      this._list.splice(this._findInsertionIndex(cellInfo), 0, cellInfo);
    },

    /**
     * REMOVE BY ID
     *
     * @param cellInfo
     */
    remove: function (cellInfo) {
      let activeIndex = this._list.length;
      while (activeIndex--) {
        //const activeCellInfo = ;
        if(this._list[activeIndex].id === cellInfo.id) {
          this._list.splice(activeIndex, 1);
          break;
        }
      }
    },

    /**
     * FILTER
     *
     * @param filter
     * @returns {Array}
     */
    filter: function (filter) {
      return this._list.filter(filter);
    }

  });

  ActiveCellList.version = "0.0.1";

  return ActiveCellList;
});