import * as React from "react";
import { useDispatch } from "react-redux";
import {
    GenericEvent,
    UnitOfMeasure
} from "../api/common";
import { tr } from "../api/i18n";
import { getUnits, getUnitOfMeasure } from "../utils/units";
import { Slider, HTMLSelect } from '@blueprintjs/core';
import { useActiveMapName, useViewerFeatureTooltipsEnabled, useConfiguredManualFeatureTooltips, useViewerSizeUnits, useViewerLocale, useActiveMapExternalBaseLayers } from './hooks';
import { setManualFeatureTooltipsEnabled, setFeatureTooltipsEnabled, setLayerTransparency, setViewSizeUnits } from '../actions/map';
import { useActiveMapLayerTransparency } from './hooks-mapguide';
import { LAYER_ID_BASE, LAYER_ID_MG_BASE, LAYER_ID_MG_SEL_OVERLAY } from '../constants';

export interface IViewerOptionsProps {

}

const ViewerOptions = () => {
    const externalBaseLayers = useActiveMapExternalBaseLayers();
    const mapName = useActiveMapName();
    const layerTransparency = useActiveMapLayerTransparency();
    const featureTooltipsEnabled = useViewerFeatureTooltipsEnabled();
    const manualFeatureTooltips = useConfiguredManualFeatureTooltips();
    const viewSizeUnits = useViewerSizeUnits();
    const locale = useViewerLocale();
    const dispatch = useDispatch();
    const toggleManualMapTipsAction = (enabled: boolean) => dispatch(setManualFeatureTooltipsEnabled(enabled));
    const toggleMapTipsAction = (enabled: boolean) => dispatch(setFeatureTooltipsEnabled(enabled));
    const setLayerTransparencyAction = (mapName: string, id: string, opacity: number) => dispatch(setLayerTransparency(mapName, id, opacity));
    const setViewSizeDisplayUnitsAction = (units: UnitOfMeasure) => dispatch(setViewSizeUnits(units));
    const onMgLayerOpacityChanged = (mapName: string | undefined, layerId: string, value: number) => {
        if (mapName) {
            setLayerTransparencyAction?.(mapName, layerId, value);
        }
    };
    const onBaseOpacityChanged = (value: number) => {
        onMgLayerOpacityChanged(mapName, LAYER_ID_BASE, value);
    };
    const onMgOpacityChanged = (value: number) => {
        onMgLayerOpacityChanged(mapName, LAYER_ID_MG_BASE, value);
    };
    const onMgSelOpacityChanged = (value: number) => {
        onMgLayerOpacityChanged(mapName, LAYER_ID_MG_SEL_OVERLAY, value);
    };
    const onViewSizeUnitsChanged = (e: GenericEvent) => {
        setViewSizeDisplayUnitsAction(e.target.value);
    };
    const onFeatureTooltipsChanged = (e: GenericEvent) => {
        toggleMapTipsAction(e.target.checked);
    };
    const onManualFeatureTooltipsChanged = (e: GenericEvent) => {
        toggleManualMapTipsAction(e.target.checked);
    };
    const units = getUnits();
    let opBase = 1.0;
    let opMgBase = 1.0;
    let opMgSelOverlay = 1.0;
    if (layerTransparency) {
        if (LAYER_ID_BASE in layerTransparency) {
            opBase = layerTransparency[LAYER_ID_BASE];
        }
        if (LAYER_ID_MG_BASE in layerTransparency) {
            opMgBase = layerTransparency[LAYER_ID_MG_BASE];
        }
        if (LAYER_ID_MG_SEL_OVERLAY in layerTransparency) {
            opMgSelOverlay = layerTransparency[LAYER_ID_MG_SEL_OVERLAY];
        }
    }
    return <div className="component-viewer-options">
        <h5>{tr("VIEWER_OPTIONS", locale)}</h5>
        <hr />
        <label className="bp3-control bp3-switch">
            <input type="checkbox" checked={featureTooltipsEnabled} onChange={onFeatureTooltipsChanged} />
            <span className="bp3-control-indicator"></span>
            {tr("FEATURE_TOOLTIPS", locale)}
        </label>
        {(() => {
            if (featureTooltipsEnabled) {
                return <label className="bp3-control bp3-switch">
                    <input type="checkbox" checked={manualFeatureTooltips} onChange={onManualFeatureTooltipsChanged} />
                    <span className="bp3-control-indicator"></span>
                    {tr("MANUAL_FEATURE_TOOLTIPS", locale)}
                </label>;
            }
        })()}
        <fieldset>
            <legend>{tr("LAYER_TRANSPARENCY", locale)}</legend>
            {(() => {
                if (externalBaseLayers) {
                    return <label className="bp3-label noselect">
                        {tr("LAYER_ID_BASE", locale)}
                        <div style={{ paddingLeft: 8, paddingRight: 8 }}>
                            <Slider min={0} max={1.0} stepSize={0.01} value={opBase} onChange={onBaseOpacityChanged} />
                        </div>
                    </label>;
                }
            })()}
            <label className="bp3-label noselect">
                {tr("LAYER_ID_MG_BASE", locale)}
                <div style={{ paddingLeft: 8, paddingRight: 8 }}>
                    <Slider min={0} max={1.0} stepSize={0.01} value={opMgBase} onChange={onMgOpacityChanged} />
                </div>
            </label>
            <label className="bp3-label noselect">
                {tr("LAYER_ID_MG_SEL_OVERLAY", locale)}
                <div style={{ paddingLeft: 8, paddingRight: 8 }}>
                    <Slider min={0} max={1.0} stepSize={0.01} value={opMgSelOverlay} onChange={onMgSelOpacityChanged} />
                </div>
            </label>
        </fieldset>
        <label className="bp3-label">
            {tr("MAP_SIZE_DISPLAY_UNITS", locale)}
            <div className="bp3-select">
                <HTMLSelect value={viewSizeUnits} onChange={onViewSizeUnitsChanged}>
                    {units.map(u => {
                        const [uom] = u;
                        const ui = getUnitOfMeasure(uom);
                        return <option key={uom} value={uom}>{ui.localizedName(locale)}</option>;
                    })}
                </HTMLSelect>
            </div>
        </label>
    </div>;
};

export default ViewerOptions;