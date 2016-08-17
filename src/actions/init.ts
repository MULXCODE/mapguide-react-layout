import * as Constants from "../constants";
import { Client } from "../api/client";
import { RuntimeMapFeatureFlags } from "../api/request-builder";

function getDefaultCommandSet() {
    return [
        { 
            command: "Select",
            tooltip: "Select"
        },
        { 
            command: "Pan",
            tooltip: "Pan",
        },
        { 
            command: "Zoom",
            tooltip: "Zoom" 
        },
        { isSeparator: true },
        {
            label: "Zoom",
            children: [
                {
                    command: "ZoomIn",
                    label: "Zoom In",
                    tooltip: "Zoom In"
                },
                {
                    command: "ZoomOut",
                    label: "Zoom Out",
                    tooltip: "Zoom Out" 
                }
            ]
        },
        { isSeparator: true },
        { 
            command: "MapTip",
            label: "Feature Tooltips",
            tooltip: "Feature Tooltips" 
        },
        { 
            command: "SelectRadius",
            //label: "Select Radius",
            tooltip: "Select Radius" 
        },
        {
            command: "SelectPolygon",
            //label: "Select Polygon",
            tooltip: "Select Polygon" 
        },
        { 
            command: "ZoomExtents",
            //label: "Zoom Extents",
            tooltip: "Zoom Extents" 
        },
        {
            command: "ClearSelection",
            //label: "Clear Selection",
            tooltip: "Clear Selection"
        },
        { command: "Buffer" },
        { command: "Measure" },
        { command: "QuickPlot" }
    ];
}

export function initApp(options) {
    return (dispatch, getState) => {
        const args = getState().config;
        const client = new Client(args.agentUri, args.agentKind);
        client.createRuntimeMap({
            mapDefinition: options.resourceId,
            requestedFeatures: RuntimeMapFeatureFlags.LayerFeatureSources | RuntimeMapFeatureFlags.LayerIcons | RuntimeMapFeatureFlags.LayersAndGroups,
            username: "Anonymous"
        }).then(res => {
            dispatch({
                type: Constants.INIT_APP,
                payload: {
                    map: res,
                    toolbars: {
                        "main": {
                            items: getDefaultCommandSet()
                        }
                    }
                }
            });
        });
    };
}