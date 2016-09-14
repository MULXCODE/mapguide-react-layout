Components
==========

 * Task Pane
   * URLs loaded into the task pane push actual entries into the browser's navigation stack

 * Toolbars
   * Only one level of menu nesting is supported. Flyouts within Flyouts is not supported/implemented.
   * Toolbars currently make no attempts to gracefully handle overflow when the toolbar has more items than the physical screen/container space allows. 

Viewer
======

 * Viewer will only accept Map Definitions in coordinate systems that have a corresponding EPSG code

 * Map will silently fail to load if projection is not known to proj4js
   * Solution: Register the projection before the viewer is mounted
      * Example: `MapGuide.Externals.proj4.defs("EPSG:28355","+proj=utm +zone=55 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");`
      * You can find proj4js definitions at [epsg.io](http://epsg.io)

 * OpenLayers will render "buffered" versions of map images (possibly to take rotation into account). As a result, if your Map has watermarks, they may not be shown due to being cut off by the map viewport.

 * [#29](https://github.com/jumpinjackie/mapguide-react-layout/issues/29): When the active tool is select, it may interfere with digitization-based selection tools (eg. Select Radius/Polygon)
   * Workaround: Do not have the active tool as select before digitizing

 * [#34](https://github.com/jumpinjackie/mapguide-react-layout/issues/34): Digitization tools have poor user experience on mobile/tablet devices
 * [#34](https://github.com/jumpinjackie/mapguide-react-layout/issues/34): Feature Tooltips does not work on mobile/tablet devices

Templates
=========

 * No known issues