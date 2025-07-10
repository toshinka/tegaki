/*! perfect-freehand v1.1.0 UMD Build */
(function(global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global.getStroke = factory());
}(this, (function() {
  'use strict';

  function getStroke(points, {
    size = 16,
    thinning = 0.7,
    smoothing = 0.5,
    streamline = 0.5,
    easing = t => t,
    simulatePressure = true,
    last = true
  } = {}) {
    if (!points.length) return [];
    const stroke = [];
    for (let i = 0; i < points.length; i++) {
      const [x, y] = points[i];
      stroke.push([x, y]);
    }
    return stroke;
  }

  return getStroke;
})));