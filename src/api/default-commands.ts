import {
    registerCommand,
    DefaultCommands,
    CommandConditions,
    openUrlInTarget
} from "./registry/command";
import {
    IMapView,
    IMapViewer,
    IApplicationState,
    ActiveMapTool,
    RefreshMode,
    ReduxDispatch,
    getInitialView,
    getSelectionSet,
    getRuntimeMap,
    getCurrentView,
    ITargetedCommand,
    DEFAULT_MODAL_SIZE
} from "./common";
import { QueryMapFeaturesResponse } from "./contracts/query";
import { RuntimeMap } from "./contracts/runtime-map";
import * as LegendActions from "../actions/legend";
import * as MapActions from "../actions/map";
import * as ModalActions from "../actions/modal";
import * as TemplateActions from "../actions/template";
import { tr } from "../api/i18n";
import { ensureParameters } from "../actions/taskpane";
import { DefaultComponentNames } from "../api/registry/component";
import { Toaster, Position, Intent } from "@blueprintjs/core";
import { getFusionRoot } from "../api/runtime";

function panMap(dispatch: ReduxDispatch, viewer: IMapViewer, value: "right" | "left" | "up" | "down") {
    const settings: any = {
        "right": [2, 1],
        "left": [0, 1],
        "down": [0, 1],
        "up": [0, 3]
    };

    const view = viewer.getCurrentView();
    const current_center = [ view.x, view.y ];
    const currentExtent = viewer.getCurrentExtent();
    let newPos: number[];

    const direction = settings[value];

    if (value == "right" || value == "left") {
        newPos = [
            currentExtent[direction[0]],
            current_center[direction[1]]
        ];

    } else {
        newPos = [
            current_center[direction[0]],
            currentExtent[direction[1]]
        ];
    }

    dispatch(MapActions.setCurrentView({ x: newPos[0], y: newPos[1], scale: view.scale }));
}

/**
 * Registers the default set of commands into the command registry. This is automatically called by the default viewer
 * bundle. If creating your own viewer bundle, be sure to call this function in your entry point, or invidually register
 * the commands you want to make available in your custom viewer bundle
 *
 * @export
 */
export function initDefaultCommands() {
    //Select Tool
    registerCommand(DefaultCommands.Select, {
        icon: "select.png",
        selected: (state) => {
            return state.viewer.tool === ActiveMapTool.Select;
        },
        enabled: () => true,
        invoke: (dispatch, getState, viewer, parameters) => {
            return dispatch(MapActions.setActiveTool(ActiveMapTool.Select));
        }
    });
    //Pan Tool
    registerCommand(DefaultCommands.Pan, {
        icon: "pan.png",
        selected: (state) => {
            return state.viewer.tool === ActiveMapTool.Pan;
        },
        enabled: () => true,
        invoke: (dispatch, getState, viewer, parameters) => {
            return dispatch(MapActions.setActiveTool(ActiveMapTool.Pan));
        }
    });
    //Zoom Tool
    registerCommand(DefaultCommands.Zoom, {
        icon: "zoom-in.png",
        selected: (state) => {
            return state.viewer.tool === ActiveMapTool.Zoom;
        },
        enabled: () => true,
        invoke: (dispatch, getState, viewer, parameters) => {
            return dispatch(MapActions.setActiveTool(ActiveMapTool.Zoom));
        }
    });
    //Feature Tooltips
    registerCommand(DefaultCommands.MapTip, {
        icon: "maptip.png",
        selected: (state) => {
            return state.viewer.featureTooltipsEnabled === true;
        },
        enabled: () => true,
        invoke: (dispatch, getState, viewer, parameters) => {
            const enabled = getState().viewer.featureTooltipsEnabled;
            return dispatch(MapActions.setFeatureTooltipsEnabled(!enabled));
        }
    });
    //Zoom in
    registerCommand(DefaultCommands.ZoomIn, {
        icon: "zoom-in-fixed.png",
        selected: () => false,
        enabled: () => true,
        invoke: (dispatch, getState, viewer, parameters) => {
            if (viewer) {
                viewer.zoomDelta(1);
            }
        }
    });
    //Zoom Out
    registerCommand(DefaultCommands.ZoomOut, {
        icon: "zoom-out-fixed.png",
        selected: () => false,
        enabled: () => true,
        invoke: (dispatch, getState, viewer, parameters) => {
            if (viewer) {
                viewer.zoomDelta(-1);
            }
        }
    });
    //Pan Left
    registerCommand(DefaultCommands.PanLeft, {
        icon: "pan-west.png",
        selected: () => false,
        enabled: () => true,
        invoke: (dispatch, getState, viewer, parameters) => {
            if (viewer) {
                panMap(dispatch, viewer, "left");
            }
        }
    });
    //Pan Right
    registerCommand(DefaultCommands.PanRight, {
        icon: "pan-east.png",
        selected: () => false,
        enabled: () => true,
        invoke: (dispatch, getState, viewer, parameters) => {
            if (viewer) {
                panMap(dispatch, viewer, "right");
            }
        }
    });
    //Pan Up
    registerCommand(DefaultCommands.PanUp, {
        icon: "pan-north.png",
        selected: () => false,
        enabled: () => true,
        invoke: (dispatch, getState, viewer, parameters) => {
            if (viewer) {
                panMap(dispatch, viewer, "up");
            }
        }
    });
    //Pan Down
    registerCommand(DefaultCommands.PanDown, {
        icon: "pan-south.png",
        selected: () => false,
        enabled: () => true,
        invoke: (dispatch, getState, viewer, parameters) => {
            if (viewer) {
                panMap(dispatch, viewer, "down");
            }
        }
    });
    //About
    registerCommand(DefaultCommands.About, {
        icon: "about.png",
        selected: () => false,
        enabled: () => true,
        invoke: (dispatch, getState, viewer, parameters) => {
            dispatch(ModalActions.showModalComponent({
                modal: {
                    title: tr("ABOUT", getState().config.locale),
                    backdrop: true,
                    size: DEFAULT_MODAL_SIZE
                },
                name: DefaultComponentNames.About,
                component: DefaultComponentNames.About
            }));
        }
    });
    //Help
    registerCommand(DefaultCommands.Help, {
        icon: "help.png",
        selected: () => false,
        enabled: () => true,
        invoke: (dispatch, getState, viewer, parameters) => {
            dispatch(ModalActions.showModalUrl({
                modal: {
                    title: tr("HELP", getState().config.locale),
                    backdrop: true,
                    size: DEFAULT_MODAL_SIZE
                },
                name: DefaultCommands.Help,
                url: "help/index.html"
            }));
        }
    });
    //Measure
    registerCommand(DefaultCommands.Measure, {
        icon: "measure.png",
        selected: () => false,
        enabled: () => true,
        invoke: (dispatch, getState, viewer, parameters) => {
            const config = getState().config;
            const url = "component://Measure";
            const cmdDef: ITargetedCommand = {
                target: "NewWindow"
            };
            if (config.capabilities.hasTaskPane && parameters.Target == "TaskPane") {
                cmdDef.target = "TaskPane";
            }
            openUrlInTarget(DefaultCommands.Measure, cmdDef, dispatch, url, tr("MEASURE", config.locale));
        }
    });
    //Quick Plot
    registerCommand(DefaultCommands.QuickPlot, {
        icon: "print.png",
        selected: () => false,
        enabled: () => true,
        invoke: (dispatch, getState, viewer, parameters) => {
            const config = getState().config;
            const url = "component://QuickPlot";
            const cmdDef: ITargetedCommand = {
                target: "NewWindow"
            };
            if (config.capabilities.hasTaskPane && parameters.Target == "TaskPane") {
                cmdDef.target = "TaskPane";
            }
            openUrlInTarget(DefaultCommands.QuickPlot, cmdDef, dispatch, url);
        }
    });
    //Viewer Options
    registerCommand(DefaultCommands.ViewerOptions, {
        icon: "options.png",
        selected: () => false,
        enabled: () => true,
        invoke: (dispatch, getState, viewer, parameters) => {
            const config = getState().config;
            const url = "component://ViewerOptions";
            const cmdDef: ITargetedCommand = {
                target: "NewWindow"
            };
            if (config.capabilities.hasTaskPane && parameters.Target == "TaskPane") {
                cmdDef.target = "TaskPane";
            }
            openUrlInTarget(DefaultCommands.ViewerOptions, cmdDef, dispatch, url, tr("VIEWER_OPTIONS", config.locale));
        }
    });
    //Select Radius
    registerCommand(DefaultCommands.SelectRadius, {
        icon: "select-radius.png",
        selected: () => false,
        enabled: () => true,
        invoke: (dispatch, getState, viewer, parameters) => {
            if (viewer) {
                viewer.digitizeCircle(circle => {
                    const fact = viewer.getOLFactory();
                    const geom = fact.createGeomPolygonFromCircle(circle);
                    viewer.selectByGeometry(geom);
                });
            }
        }
    });
    //Select Radius
    registerCommand(DefaultCommands.SelectPolygon, {
        icon: "select-polygon.png",
        selected: () => false,
        enabled: () => true,
        invoke: (dispatch, getState, viewer, parameters) => {
            if (viewer) {
                viewer.digitizePolygon(geom => {
                    viewer.selectByGeometry(geom);
                });
            }
        }
    });
    //Initial Center and scale
    registerCommand(DefaultCommands.RestoreView, {
        icon: "initial-center.png",
        selected: () => false,
        enabled: () => true,
        invoke: (dispatch, getState, viewer, parameters) => {
            if (viewer) {
                const view = getInitialView(getState());
                if (view != null) {
                    viewer.zoomToView(view.x, view.y, view.scale);
                } else {
                    viewer.initialView();
                }
            }
        }
    })
    //Zoom Extents
    registerCommand(DefaultCommands.ZoomExtents, {
        icon: "zoom-full.png",
        selected: () => false,
        enabled: () => true,
        invoke: (dispatch, getState, viewer, parameters) => {
            if (viewer) {
                viewer.initialView();
            }
        }
    });
    //Clear Selection
    registerCommand(DefaultCommands.ClearSelection, {
        icon: "select-clear.png",
        selected: () => false,
        enabled: CommandConditions.hasSelection,
        invoke: (dispatch, getState, viewer, parameters) => {
            if (viewer) {
                viewer.clearSelection();
            }
        }
    });
    //Zoom to Selection
    registerCommand(DefaultCommands.ZoomToSelection, {
        icon: "icon_zoomselect.gif",
        selected: () => false,
        enabled: CommandConditions.hasSelection,
        invoke: (dispatch, getState, viewer, parameters) => {
            if (viewer) {
                const fact = viewer.getOLFactory();
                const selection = getSelectionSet(getState());
                let bounds: ol.Extent | null = null;
                if (selection != null && selection.SelectedFeatures != null) {
                    selection.SelectedFeatures.SelectedLayer.forEach(layer => {
                        layer.Feature.forEach(feat => {
                            const b: any = feat.Bounds.split(" ").map(s => parseFloat(s));
                            if (bounds == null) {
                                bounds = b;
                            } else {
                                bounds = fact.extendExtent(bounds, b);
                            }
                        })
                    });
                }
                if (bounds) {
                    const view = viewer.getViewForExtent(bounds);
                    dispatch(MapActions.setCurrentView(view));
                }
            }
        }
    });
    //Refresh Map
    registerCommand(DefaultCommands.RefreshMap, {
        icon: "icon_refreshmap.gif",
        selected: () => false,
        enabled: CommandConditions.isNotBusy,
        invoke: (dispatch, getState, viewer, parameters) => {
            if (viewer) {
                viewer.refreshMap(RefreshMode.LayersOnly | RefreshMode.SelectionOnly);
                dispatch(LegendActions.refresh());
            }
        }
    });
    //Previous View
    registerCommand(DefaultCommands.PreviousView, {
        icon: "view-back.png",
        selected: () => false,
        enabled: CommandConditions.hasPreviousView,
        invoke: (dispatch, getState, viewer, parameters) => {
            const mapName = getState().config.activeMapName;
            if (mapName) {
                dispatch(MapActions.previousView(mapName));
            }
        }
    });
    //Next View
    registerCommand(DefaultCommands.NextView, {
        icon: "view-forward.png",
        selected: () => false,
        enabled: CommandConditions.hasNextView,
        invoke: (dispatch, getState, viewer, parameters) => {
            const mapName = getState().config.activeMapName;
            if (mapName) {
                dispatch(MapActions.nextView(mapName));
            }
        }
    });
    //Geolocation
    registerCommand(DefaultCommands.Geolocation, {
        icon: "geolocation.png",
        selected: () => false,
        enabled: CommandConditions.isNotBusy,
        invoke: (dispatch, getState, viewer, parameters) => {
            const state = getState();
            const view = getCurrentView(state);
            const rtMap = getRuntimeMap(state);
            const locale = state.config.locale;
            if (viewer && view && rtMap) {
                const fact = viewer.getOLFactory();
                const geoOptions: Partial<PositionOptions> = {};
                let zoomScale = view.scale;
                if (parameters.ZoomLevel) {
                    zoomScale = parseInt(parameters.ZoomLevel, 10);
                }
                if (parameters.EnableHighAccuracy) {
                    geoOptions.enableHighAccuracy = (parameters.EnableHighAccuracy == "true");
                }
                if (parameters.Timeout) {
                    geoOptions.timeout = parseInt(parameters.Timeout, 10);
                }
                if (parameters.MaximumAge) {
                    geoOptions.maximumAge = parseInt(parameters.MaximumAge, 10);
                }
                navigator.geolocation.getCurrentPosition(pos => {
                    const proj = viewer.getProjection();
                    const txCoord = fact.transformCoordinateFromLonLat([ pos.coords.longitude, pos.coords.latitude ], proj);
                    const testCoord = fact.transformCoordinateFromLonLat([ pos.coords.longitude, pos.coords.latitude ], `EPSG:${rtMap.CoordinateSystem.EpsgCode}`);
                    viewer.zoomToView(txCoord[0], txCoord[1], zoomScale);
                    const extents: [number, number, number, number] = [
                        rtMap.Extents.LowerLeftCoordinate.X,
                        rtMap.Extents.LowerLeftCoordinate.Y,
                        rtMap.Extents.UpperRightCoordinate.X,
                        rtMap.Extents.UpperRightCoordinate.Y
                    ];
                    if (fact.extentContainsXY(extents, testCoord[0], testCoord[1])) {
                        Toaster.create({ position: Position.TOP, className: "mg-toast" }).show({ iconName: "geolocation", message: tr("GEOLOCATION_SUCCESS", locale), intent: Intent.SUCCESS });
                    } else {
                        Toaster.create({ position: Position.TOP, className: "mg-toast" }).show({ iconName: "warning-sign", message: tr("GEOLOCATION_WARN_OUTSIDE_MAP", locale), intent: Intent.WARNING });
                    }
                }, err => {
                    Toaster.create({ position: Position.TOP, className: "mg-toast" }).show({ iconName: "error", message: tr("GEOLOCATION_ERROR", locale, { message: err.message, code: err.code }), intent: Intent.DANGER });
                }, geoOptions);
            }
        }
    });
    //Buffer
    registerCommand(DefaultCommands.Buffer, {
        icon: "buffer.png",
        selected: () => false,
        enabled: CommandConditions.hasSelection,
        invoke: (dispatch, getState, viewer, parameters) => {
            const state = getState();
            const map = getRuntimeMap(state);
            const config = state.config;
            if (map) {
                let url = ensureParameters(`${getFusionRoot()}/widgets/BufferPanel/BufferPanel.php`, map.Name, map.SessionId, config.locale, false);
                url += "&popup=false&us=0";
                const cmdDef: ITargetedCommand = {
                    target: parameters.Target || "TaskPane"
                };
                openUrlInTarget(DefaultCommands.Buffer, cmdDef, dispatch, url);
            }
        }
    });
    //Select Within
    registerCommand(DefaultCommands.SelectWithin, {
        icon: "select-features.png",
        selected: () => false,
        enabled: (state, parameters) => !CommandConditions.disabledIfEmptySelection(state, parameters),
        invoke: (dispatch, getState, viewer, parameters) => {
            const state = getState();
            const map = getRuntimeMap(state);
            const config = state.config;
            if (map) {
                let url = ensureParameters(`${getFusionRoot()}/widgets/SelectWithin/SelectWithinPanel.php`, map.Name, map.SessionId, config.locale, false);
                url += "&popup=false";
                const cmdDef: ITargetedCommand = {
                    target: parameters.Target || "TaskPane"
                };
                openUrlInTarget(DefaultCommands.SelectWithin, cmdDef, dispatch, url);
            }
        }
    });
    //Redline
    registerCommand(DefaultCommands.Redline, {
        icon: "redline.png",
        selected: () => false,
        enabled: CommandConditions.isNotBusy,
        invoke: (dispatch, getState, viewer, parameters) => {
            const state = getState();
            const map = getRuntimeMap(state);
            const config = state.config;
            if (map) {
                let url = ensureParameters(`${getFusionRoot()}/widgets/Redline/markupmain.php`, map.Name, map.SessionId, config.locale, true);
                url += "&POPUP=false&REDLINESTYLIZATION=ADVANCED";
                const cmdDef: ITargetedCommand = {
                    target: parameters.Target || "TaskPane"
                };
                openUrlInTarget(DefaultCommands.Redline, cmdDef, dispatch, url);
            }
        }
    });

    registerCommand(DefaultCommands.FeatureInfo, { icon: "feature-info.png", url: `${getFusionRoot()}/widgets/FeatureInfo/featureinfomain.php`, target: "TaskPane", parameters: [] });
    registerCommand(DefaultCommands.Query, { icon: "query.png", url: `${getFusionRoot()}/widgets/Query/querymain.php`, target: "TaskPane", parameters: [] });
    registerCommand(DefaultCommands.Theme, { icon: "theme.png", url: `${getFusionRoot()}/widgets/Theme/thememain.php`, target: "TaskPane", parameters: [] });

    //Fusion template helper commands
    /*
    registerCommand("showOverview", {
        icon: "invoke-script.png",
        selected: () => false,
        enabled: CommandConditions.isNotBusy,
        invoke: (dispatch, getState, viewer, parameters) => {

        }
    });
    */
    registerCommand("showTaskPane", {
        icon: "invoke-script.png",
        selected: () => false,
        enabled: CommandConditions.isNotBusy,
        invoke: (dispatch, getState, viewer, parameters) => {
            const tplState = getState().template;
            dispatch(TemplateActions.setTaskPaneVisibility(true));
        }
    });
    registerCommand("showLegend", {
        icon: "invoke-script.png",
        selected: () => false,
        enabled: CommandConditions.isNotBusy,
        invoke: (dispatch, getState, viewer, parameters) => {
            const tplState = getState().template;
            dispatch(TemplateActions.setLegendVisibility(true));
        }
    });
    registerCommand("showSelectionPanel", {
        icon: "invoke-script.png",
        selected: () => false,
        enabled: CommandConditions.isNotBusy,
        invoke: (dispatch, getState, viewer, parameters) => {
            const tplState = getState().template;
            dispatch(TemplateActions.setSelectionPanelVisibility(true));
        }
    });
}