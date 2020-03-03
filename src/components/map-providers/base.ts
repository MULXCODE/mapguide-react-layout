import * as ReactDOM from "react-dom";
import { IMapView, IExternalBaseLayer, Dictionary, ReduxDispatch, Bounds, GenericEvent, ActiveMapTool, DigitizerCallback, LayerProperty, Size2, RefreshMode, KC_U, ILayerManager, Coordinate2D, KC_ESCAPE, IMapViewer, IMapGuideViewerSupport } from '../../api/common';
import { MouseTrackingTooltip } from '../tooltips/mouse';
import Map from "ol/Map";
import OverviewMap from 'ol/control/OverviewMap';
import DragBox from 'ol/interaction/DragBox';
import Select from 'ol/interaction/Select';
import Draw, { GeometryFunction } from 'ol/interaction/Draw';
import { SelectedFeaturesTooltip } from '../tooltips/selected-features';
import { MapGuideMockMode } from '../map-viewer-context';
import Feature from 'ol/Feature';
import Polygon from 'ol/geom/Polygon';
import Geometry from 'ol/geom/Geometry';
import { MapOptions } from 'ol/PluggableMap';
import Attribution from 'ol/control/Attribution';
import Rotate from 'ol/control/Rotate';
import DragRotate from 'ol/interaction/DragRotate';
import DragPan from 'ol/interaction/DragPan';
import PinchRotate from 'ol/interaction/PinchRotate';
import PinchZoom from 'ol/interaction/PinchZoom';
import KeyboardPan from 'ol/interaction/KeyboardPan';
import KeyboardZoom from 'ol/interaction/KeyboardZoom';
import MouseWheelZoom from 'ol/interaction/MouseWheelZoom';
import View from 'ol/View';
import Point from 'ol/geom/Point';
import GeometryType from 'ol/geom/GeometryType';
import LineString from 'ol/geom/LineString';
import Circle from 'ol/geom/Circle';
import Interaction from 'ol/interaction/Interaction';
import Overlay from 'ol/Overlay';
import { ProjectionLike } from 'ol/proj';
import { MgLayerManager } from '../../api/layer-manager';
import Collection from 'ol/Collection';
import * as olExtent from "ol/extent";
import * as olEasing from "ol/easing";
import MapBrowserEvent from 'ol/MapBrowserEvent';
import { tr, DEFAULT_LOCALE } from '../../api/i18n';
import { LayerSetGroupBase } from '../../api/layer-set-group-base';
import { assertIsDefined } from '../../utils/assert';
import { info } from '../../utils/logger';
import { setCurrentView, setViewRotation, mapResized, setMouseCoordinates, setBusyCount, setViewRotationEnabled, setActiveTool } from '../../actions/map';
import { IBasicPointCircleStyle, DEFAULT_POINT_CIRCLE_STYLE, IPointIconStyle, DEFAULT_POINT_ICON_STYLE, IBasicVectorLineStyle, DEFAULT_LINE_STYLE, IBasicVectorPolygonStyle, DEFAULT_POLY_STYLE } from '../../api/ol-style-helpers';
import { Toaster, Intent } from '@blueprintjs/core';
import { IOLFactory, OLFactory } from '../../api/ol-factory';
import { ISubscriberProps } from '../../containers/subscriber';
import isMobile from "ismobilejs";

export function isMiddleMouseDownEvent(e: MouseEvent): boolean {
    return (e && (e.which == 2 || e.button == 4));
}

export interface IViewerComponent {
    isContextMenuOpen: () => boolean;
    setDigitizingType: (digitizingType: string | undefined) => void;
    onDispatch: ReduxDispatch;
    onHideContextMenu: () => void;
    addImageLoading(): void;
    addImageLoaded(): void;
}

export interface IMapProviderState {
    activeTool: ActiveMapTool;
    view: IMapView | undefined;
    viewRotation: number;
    viewRotationEnabled: boolean;
    mapName: string | undefined;
    locale: string;
    externalBaseLayers: IExternalBaseLayer[] | undefined;
    cancelDigitizationKey: number;
    undoLastPointKey: number;
    overviewMapElementSelector?: () => Element | null;
}

/**
 * Defines a mapping provider
 * 
 * @since 0.14
 */
export interface IMapProviderContext extends IMapViewer {
    getProviderName(): string;
    isDigitizing(): boolean;
    getActiveTool(): ActiveMapTool;
    isMouseOverTooltip(): boolean;
    incrementBusyWorker(): void;
    decrementBusyWorker(): void;
    attachToComponent(el: HTMLElement, comp: IViewerComponent): void;
    setToasterRef(ref: React.RefObject<Toaster>): void;
    setProviderState(nextState: IMapProviderState): void;
    onKeyDown(e: GenericEvent): void;
}

export abstract class BaseMapProviderContext<TState extends IMapProviderState, TLayerSetGroup extends LayerSetGroupBase> implements IMapProviderContext {
    private _toasterRef: React.RefObject<Toaster> | undefined;
    protected _state: TState;
    /**
     * Indicates if touch events are supported.
     */
    protected _supportsTouch: boolean;
    /**
     * The internal OpenLayers map instance
     *
     * @private
     * @type {Map}
     */
    protected _map: Map | undefined;
    protected _ovMap: OverviewMap | undefined;

    protected _layerSetGroups: Dictionary<TLayerSetGroup>;
    protected _mouseTooltip: MouseTrackingTooltip | undefined;
    protected _selectTooltip: SelectedFeaturesTooltip | undefined;

    protected _comp: IViewerComponent | undefined;
    protected _zoomSelectBox: DragBox;

    protected _busyWorkers: number;
    protected _triggerZoomRequestOnMoveEnd: boolean;
    protected _select: Select;
    protected _dispatcher: ReduxDispatch | undefined;
    protected _activeDrawInteraction: Draw | null;

    constructor(private olFactory: OLFactory = new OLFactory()) {
        this._busyWorkers = 0;
        this._layerSetGroups = {};
        this._triggerZoomRequestOnMoveEnd = true;
        const ism = isMobile(navigator.userAgent);
        this._supportsTouch = ism.phone || ism.tablet;
        this._state = {
            activeTool: ActiveMapTool.None,
            view: undefined,
            viewRotation: 0,
            viewRotationEnabled: true,
            locale: DEFAULT_LOCALE,
            cancelDigitizationKey: KC_ESCAPE,
            undoLastPointKey: KC_U,
            mapName: undefined,
            externalBaseLayers: undefined,
            ...this.getInitialProviderState()
        } as TState;
    }

    //#region IMapViewer
    /**
     * @virtual
     * @returns {(IMapGuideViewerSupport | undefined)}
     * @memberof BaseMapProviderContext
     */
    mapguideSupport(): IMapGuideViewerSupport | undefined {
        return undefined;
    }
    setActiveTool(tool: ActiveMapTool): void {
        this._comp?.onDispatch(setActiveTool(tool));
    }
    getOLFactory(): IOLFactory {
        return this.olFactory;
    }
    getMapName(): string {
        return this._state.mapName!;
    }
    setViewRotation(rotation: number): void {
        this._comp?.onDispatch(setViewRotation(rotation));
    }
    getViewRotation(): number {
        return this._state.viewRotation;
    }
    isViewRotationEnabled(): boolean {
        return this._state.viewRotationEnabled;
    }
    setViewRotationEnabled(enabled: boolean): void {
        this._comp?.onDispatch(setViewRotationEnabled(enabled));
    }
    toastSuccess(iconName: string, message: string | JSX.Element): string | undefined {
        return this._toasterRef?.current?.show({ icon: (iconName as any), message: message, intent: Intent.SUCCESS });
    }
    toastWarning(iconName: string, message: string | JSX.Element): string | undefined {
        return this._toasterRef?.current?.show({ icon: (iconName as any), message: message, intent: Intent.WARNING });
    }
    toastError(iconName: string, message: string | JSX.Element): string | undefined {
        return this._toasterRef?.current?.show({ icon: (iconName as any), message: message, intent: Intent.DANGER });
    }
    toastPrimary(iconName: string, message: string | JSX.Element): string | undefined {
        return this._toasterRef?.current?.show({ icon: (iconName as any), message: message, intent: Intent.PRIMARY });
    }
    dismissToast(key: string): void {
        this._toasterRef?.current?.dismiss(key);
    }
    addImageLoading(): void {
        this._comp?.addImageLoading();
    }
    addImageLoaded(): void {
        this._comp?.addImageLoaded();
    }
    addSubscribers(props: ISubscriberProps[]): string[] {
        throw new Error("Method not implemented (addSubscribers).");
    }
    removeSubscribers(names: string[]): boolean {
        throw new Error("Method not implemented (removeSubscribers).");
    }
    getSubscribers(): string[] {
        throw new Error("Method not implemented (getSubscribers).");
    }
    dispatch(action: any): void {
        this._comp?.onDispatch(action);
    }
    getDefaultPointCircleStyle(): IBasicPointCircleStyle {
        return { ...DEFAULT_POINT_CIRCLE_STYLE };
    }
    getDefaultPointIconStyle(): IPointIconStyle {
        return { ...DEFAULT_POINT_ICON_STYLE };
    }
    getDefaultLineStyle(): IBasicVectorLineStyle {
        return { ...DEFAULT_LINE_STYLE };
    }
    getDefaultPolygonStyle(): IBasicVectorPolygonStyle {
        return { ...DEFAULT_POLY_STYLE };
    }
    //#endregion

    protected abstract getInitialProviderState() : Omit<TState, keyof IMapProviderState>;
    //#region IMapViewerContextCallback
    protected getMockMode() : MapGuideMockMode | undefined { return undefined; }
    protected addFeatureToHighlight(feat: Feature | undefined, bAppend: boolean): void {
        if (this._state.mapName) {
            // Features have to belong to layer in order to be visible and have the highlight style, 
            // so in addition to adding this new feature to the OL select observable collection, we 
            // need to also add the feature to a scratch vector layer dedicated for this purpose
            const layerSet = this.getLayerSetGroup(this._state.mapName);
            if (layerSet) {
                const sf = this._select.getFeatures();
                if (!bAppend) {
                    sf.clear();
                    layerSet.clearScratchLayer();
                }

                if (feat) {
                    layerSet.addScratchFeature(feat);
                    sf.push(feat);
                }
            }
        }
    }
    //#endregion

    //#region Map Context
    protected getScaleForExtent(bounds: Bounds): number {
        assertIsDefined(this._map);
        assertIsDefined(this._state.mapName);
        const activeLayerSet = this.getLayerSetGroup(this._state.mapName);
        assertIsDefined(activeLayerSet);
        const mcsW = olExtent.getWidth(bounds);
        const mcsH = olExtent.getHeight(bounds);
        const size = this._map.getSize();
        const devW = size[0];
        const devH = size[1];
        const metersPerPixel = 0.0254 / activeLayerSet.getDpi();
        const metersPerUnit = activeLayerSet.getMetersPerUnit();
        //Scale calculation code from AJAX viewer
        let mapScale: number;
        if (devH * mcsW > devW * mcsH)
            mapScale = mcsW * metersPerUnit / (devW * metersPerPixel); // width-limited
        else
            mapScale = mcsH * metersPerUnit / (devH * metersPerPixel); // height-limited
        return mapScale;
    }
    public getViewForExtent(extent: Bounds): IMapView {
        assertIsDefined(this._map);
        const scale = this.getScaleForExtent(extent);
        const center = olExtent.getCenter(extent);
        return {
            x: center[0],
            y: center[1],
            scale: scale,
            resolution: this._map.getView().getResolution()
        };
    }
    protected onZoomSelectBox(e: GenericEvent) {
        if (this._comp) {
            const extent = this._zoomSelectBox.getGeometry();
            switch (this._state.activeTool) {
                case ActiveMapTool.Zoom:
                    {
                        const ext: any = extent.getExtent();
                        this._comp.onDispatch(setCurrentView(this.getViewForExtent(ext)));
                    }
                    break;
                case ActiveMapTool.Select:
                    {
                        //this.sendSelectionQuery(this.buildDefaultQueryOptions(extent));
                        this.selectFeaturesByExtent(extent);
                    }
                    break;
            }
        }
    }
    /**
     * @virtual
     * @protected
     * @param {GenericEvent} e
     * @returns
     * @memberof BaseMapProviderContext
     */
    protected onMouseMove(e: GenericEvent) {
        if (this._comp) {
            this.handleMouseTooltipMouseMove(e);
            if (this._comp.isContextMenuOpen()) {
                return;
            }
            if (this._state.mapName) {
                this._comp.onDispatch(setMouseCoordinates(this._state.mapName, e.coord));
            }
        }
    }
    public incrementBusyWorker() {
        this._busyWorkers++;
        this._comp?.onDispatch(setBusyCount(this._busyWorkers));
    }
    public decrementBusyWorker() {
        this._busyWorkers--;
        this._comp?.onDispatch(setBusyCount(this._busyWorkers));
    }
    protected applyView(layerSet: LayerSetGroupBase, vw: IMapView) {
        this._triggerZoomRequestOnMoveEnd = false;
        layerSet.getView().setCenter([vw.x, vw.y]);
        //Don't use this.scaleToResolution() as that uses this.props to determine
        //applicable layer set, but we already have that here
        const res = layerSet.scaleToResolution(vw.scale);
        layerSet.getView().setResolution(res);
        this._triggerZoomRequestOnMoveEnd = true;
    }
    protected removeActiveDrawInteraction() {
        if (this._activeDrawInteraction && this._map && this._comp) {
            this._map.removeInteraction(this._activeDrawInteraction);
            this._activeDrawInteraction = null;
            this._comp.setDigitizingType(undefined);
        }
    }

    public getActiveTool(): ActiveMapTool { return this._state.activeTool; }

    public cancelDigitization(): void {
        if (this.isDigitizing()) {
            this.removeActiveDrawInteraction();
            this.clearMouseTooltip();
            //this._mouseTooltip.clear();
        }
    }
    private onBeginDigitization = (callback: (cancelled: boolean) => void) => {
        this._comp?.onDispatch(setActiveTool(ActiveMapTool.None));
        //Could be a small timing issue here, but the active tool should generally
        //be "None" before the user clicks their first digitizing vertex/point
        callback(false);
    };
    protected pushDrawInteraction<T extends Geometry>(digitizingType: string, draw: Draw, handler: DigitizerCallback<T>, prompt?: string): void {
        assertIsDefined(this._comp);
        this.onBeginDigitization(cancel => {
            if (!cancel) {
                assertIsDefined(this._map);
                assertIsDefined(this._comp);
                this.removeActiveDrawInteraction();
                //this._mouseTooltip.clear();
                this.clearMouseTooltip();
                if (prompt) {
                    //this._mouseTooltip.setText(prompt);
                    this.setMouseTooltip(prompt);
                }
                this._activeDrawInteraction = draw;
                this._activeDrawInteraction.once("drawend", (e: GenericEvent) => {
                    const drawnFeature: Feature = e.feature;
                    const geom: T = drawnFeature.getGeometry() as T;
                    this.cancelDigitization();
                    handler(geom);
                })
                this._map.addInteraction(this._activeDrawInteraction);
                this._comp.setDigitizingType(digitizingType);
            }
        });
    }
    /**
     * @virtual
     * @protected
     * @param {Polygon} geom
     * @memberof BaseMapProviderContext
     */
    protected selectFeaturesByExtent(geom: Polygon) { }

    protected zoomByDelta(delta: number) {
        assertIsDefined(this._map);
        const view = this._map.getView();
        if (!view) {
            return;
        }
        const currentZoom = view.getZoom();
        if (currentZoom !== undefined) {
            const newZoom = view.getConstrainedZoom(currentZoom + delta);
            if (view.getAnimating()) {
                view.cancelAnimations();
            }
            view.animate({
                zoom: newZoom,
                duration: 250,
                easing: olEasing.easeOut
            });
        }
    }
    protected ensureAndGetLayerSetGroup(nextState: TState) {
        assertIsDefined(nextState.mapName);
        let layerSet = this._layerSetGroups[nextState.mapName];
        if (!layerSet) {
            layerSet = this.initLayerSet(nextState);
            this._layerSetGroups[nextState.mapName] = layerSet;
        }
        return layerSet;
    }
    //public getLayerSet(name: string, bCreate: boolean = false, props?: IMapViewerContextProps): MgLayerSet {
    public getLayerSetGroup(name: string | undefined): TLayerSetGroup | undefined {
        let layerSet: TLayerSetGroup | undefined;
        if (name) {
            layerSet = this._layerSetGroups[name];
            /*
            if (!layerSet && props && bCreate) {
                layerSet = this.initLayerSet(props);
                this._layerSets[props.map.Name] = layerSet;
                this._activeMapName = props.map.Name;
            }
            */
        }
        return layerSet;
    }
    /**
     * @virtual
     * @readonly
     * @memberof BaseMapProviderContext
     */
    public isMouseOverTooltip() { return this._selectTooltip?.isMouseOver ?? false; }
    protected clearMouseTooltip(): void {
        this._mouseTooltip?.clear();
    }
    protected setMouseTooltip(text: string) {
        this._mouseTooltip?.setText(text);
    }
    protected handleMouseTooltipMouseMove(e: GenericEvent) {
        this._mouseTooltip?.onMouseMove?.(e);
    }
    protected hideSelectedVectorFeaturesTooltip() {
        this._selectTooltip?.hide();
    }
    protected showSelectedVectorFeatures(features: Collection<Feature>, pixel: [number, number], locale?: string) {
        this._selectTooltip?.showSelectedVectorFeatures(features, pixel, locale);
    }
    protected queryWmsFeatures(currentLayerSet: LayerSetGroupBase | undefined, layerMgr: ILayerManager, coord: Coordinate2D) {
        if (this._map) {
            const res = this._map.getView().getResolution();
            this._selectTooltip?.queryWmsFeatures(currentLayerSet, layerMgr, coord, res, {
                getLocale: () => this._state.locale,
                addFeatureToHighlight: (feat, bAppend) => this.addFeatureToHighlight(feat, bAppend)
            });
        }
    }
    /**
     * @virtual
     * @protected
     * @param {GenericEvent} e
     * @memberof BaseMapProviderContext
     */
    protected onImageError(e: GenericEvent) { }

    protected onMapClick(e: MapBrowserEvent) {
        if (!this._comp || !this._map) {
            return;
        }

        if (this._comp.isContextMenuOpen()) {
            // We're going on the assumption that due to element placement
            // if this event is fired, it meant that the user clicked outside
            // the context menu, otherwise the context menu itself would've handled
            // the event
            this._comp.onHideContextMenu?.();
        }
        if (this.isDigitizing()) {
            return;
        }
        if (this._state.activeTool == ActiveMapTool.WmsQueryFeatures) {
            const activeLayerSet = this.getLayerSetGroup(this._state.mapName);
            this.queryWmsFeatures(activeLayerSet, this.getLayerManager(), e.coordinate as Coordinate2D);
        } else {
            let vfSelected = 0;
            if (this._state.activeTool == ActiveMapTool.Select) {
                /*
                //Shift+Click is the default OL selection append mode, so if no shift key
                //pressed, clear the existing selection
                if (!this.state.shiftKey) {
                    this._select.getFeatures().clear();
                }
                */
                //TODO: Our selected feature tooltip only shows properties of a single feature
                //and displays upon said feature being selected. As a result, although we can
                //(and should) allow for multiple features to be selected, we need to figure
                //out the proper UI for such a case before we enable multiple selection.
                this._select.getFeatures().clear();
                this._map.forEachFeatureAtPixel(e.pixel, (feature, layer) => {
                    if (vfSelected == 0) { //See TODO above
                        if (layer.get(LayerProperty.IS_SELECTABLE) == true && feature instanceof Feature) {
                            this._select.getFeatures().push(feature);
                            vfSelected++;
                        }
                    }
                });
            }
            // We'll only fall through the normal map selection query route if no 
            // vector features were selected as part of this click
            const px = e.pixel as [number, number];
            if (vfSelected == 0) {
                this.hideSelectedVectorFeaturesTooltip();
                this.onProviderMapClick(px);
            } else {
                this.showSelectedVectorFeatures(this._select.getFeatures(), px, this._state.locale);
            }
        }
    }
    protected abstract onProviderMapClick(px: [number, number]): void;
    protected abstract initLayerSet(nextState: TState): TLayerSetGroup;
    public abstract getProviderName(): string;

    protected initContext(layerSet: TLayerSetGroup, locale?: string, overviewMapElementSelector?: () => (Element | null)) {
        if (this._map) {
            // HACK: className property not documented. This needs to be fixed in OL api doc.
            const overviewMapOpts: any = {
                className: 'ol-overviewmap ol-custom-overviewmap',
                layers: layerSet.getLayersForOverviewMap(),
                view: new View({
                    projection: layerSet.getProjection()
                }),
                tipLabel: tr("OL_OVERVIEWMAP_TIP", locale),
                collapseLabel: String.fromCharCode(187), //'\u00BB',
                label: String.fromCharCode(171) //'\u00AB'
            };

            if (overviewMapElementSelector) {
                const el = overviewMapElementSelector();
                if (el) {
                    overviewMapOpts.target = ReactDOM.findDOMNode(el);
                    overviewMapOpts.collapsed = false;
                    overviewMapOpts.collapsible = false;
                }
            }
            this._ovMap = new OverviewMap(overviewMapOpts);
            this._map.addControl(this._ovMap);
            this.onBeforeAttachingLayerSetGroup(layerSet);
            layerSet.attach(this._map, this._ovMap, false);
        }
    }
    //#endregion

    /**
     * @virtual
     * @protected
     * @param {TLayerSetGroup} layerSetGroup
     * @memberof BaseMapProviderContext
     */
    protected onBeforeAttachingLayerSetGroup(layerSetGroup: TLayerSetGroup): void { }
    public setToasterRef(ref: React.RefObject<Toaster>) {
        this._toasterRef = ref;
    }
    public abstract setProviderState(nextState: TState): void;

    public onKeyDown(e: GenericEvent) {
        const cancelKey = this._state.cancelDigitizationKey ?? KC_ESCAPE;
        const undoKey = this._state.undoLastPointKey ?? KC_U;
        if (e.keyCode == cancelKey) {
            this.cancelDigitization();
        } else if (e.keyCode == undoKey && this._activeDrawInteraction) {
            this._activeDrawInteraction.removeLastPoint();
        }
    }

    public isDigitizing(): boolean {
        if (!this._map)
            return false;
        const activeDraw = this._map.getInteractions().getArray().filter(inter => inter instanceof Draw)[0];
        return activeDraw != null;
    }
    /**
     * @virtual
     * @param {HTMLElement} el
     * @param {IViewerComponent} comp
     * @memberof BaseMapProviderContext
     */
    public attachToComponent(el: HTMLElement, comp: IViewerComponent): void {
        this._comp = comp;
        this._select = new Select({
            condition: (e) => false,
            layers: (layer) => layer.get(LayerProperty.IS_SELECTABLE) == true || layer.get(LayerProperty.IS_SCRATCH) == true
        });
        this._zoomSelectBox = new DragBox({
            condition: (e) => !this.isDigitizing() && (this._state.activeTool === ActiveMapTool.Select || this._state.activeTool === ActiveMapTool.Zoom)
        });
        this._zoomSelectBox.on("boxend", this.onZoomSelectBox.bind(this));
        const mapOptions: MapOptions = {
            target: el as any,
            //layers: layers,
            //view: view,
            controls: [
                new Attribution({
                    tipLabel: tr("OL_ATTRIBUTION_TIP", this._state.locale)
                }),
                new Rotate({
                    tipLabel: tr("OL_RESET_ROTATION_TIP", this._state.locale)
                })
            ],
            interactions: [
                this._select,
                new DragRotate(),
                new DragPan({
                    condition: (e) => {
                        const startingMiddleMouseDrag = e.type == "pointerdown" && isMiddleMouseDownEvent((e as any).originalEvent);
                        const enabled = (startingMiddleMouseDrag || this._supportsTouch || this._state.activeTool === ActiveMapTool.Pan);
                        //console.log(e);
                        //console.log(`Allow Pan - ${enabled} (middle mouse: ${startingMiddleMouseDrag})`);
                        return enabled;
                    }
                }),
                new PinchRotate(),
                new PinchZoom(),
                new KeyboardPan(),
                new KeyboardZoom(),
                new MouseWheelZoom(),
                this._zoomSelectBox
            ]
        };
        this._map = new Map(mapOptions);
        const activeLayerSet = this.ensureAndGetLayerSetGroup(this._state);
        this.initContext(activeLayerSet, this._state.locale, this._state.overviewMapElementSelector);
        this._mouseTooltip = new MouseTrackingTooltip(this._map, this._comp.isContextMenuOpen);
        this._selectTooltip = new SelectedFeaturesTooltip(this._map);
        this._map.on("pointermove", this.onMouseMove.bind(this));
        this._map.on("change:size", this.onResize.bind(this));
        this._map.on("click", this.onMapClick.bind(this));
        this._map.on("moveend", (e: GenericEvent) => {
            //HACK:
            //
            //What we're hoping here is that when the view has been broadcasted back up
            //and flowed back in through new view props, that the resulting zoom/pan
            //operation in componentDidUpdate() is effectively a no-op as the intended
            //zoom/pan location has already been reached by this event right here
            //
            //If we look at this through Redux DevTools, we see 2 entries for Map/SET_VIEW
            //for the initial view (un-desirable), but we still only get one map image request
            //for the initial view (good!). Everything is fine after that.
            if (this._triggerZoomRequestOnMoveEnd) {
                this._comp?.onDispatch(setCurrentView(this.getCurrentView()));
            } else {
                info("Triggering zoom request on moveend suppresseed");
            }
            if (e.frameState.viewState.rotation != this._state.viewRotation) {
                this._comp?.onDispatch(setViewRotation(e.frameState.viewState.rotation));
            }
        });

        if (this._state.view) {
            const { x, y, scale } = this._state.view;
            this.zoomToView(x, y, scale);
        } else {
            const extents = activeLayerSet.getExtent();
            this._map.getView().fit(extents);
        }
        this.onResize(this._map.getSize());
    }
    private onResize = (e: GenericEvent) => {
        if (this._map) {
            const [w, h ] = this._map.getSize();
            this._comp?.onDispatch(mapResized(w, h));
        }
    }
    public scaleToResolution(scale: number): number {
        assertIsDefined(this._state.mapName);
        const activeLayerSet = this.getLayerSetGroup(this._state.mapName);
        assertIsDefined(activeLayerSet);
        return activeLayerSet.scaleToResolution(scale);
    }

    public resolutionToScale(resolution: number): number {
        assertIsDefined(this._state.mapName);
        const activeLayerSet = this.getLayerSetGroup(this._state.mapName);
        assertIsDefined(activeLayerSet);
        return activeLayerSet.resolutionToScale(resolution);
    }

    public getCurrentView(): IMapView {
        const ov = this.getOLView();
        const center = ov.getCenter();
        const resolution = ov.getResolution();
        const scale = this.resolutionToScale(resolution);
        return {
            x: center[0],
            y: center[1],
            scale: scale,
            resolution: resolution
        };
    }
    public getCurrentExtent(): Bounds {
        assertIsDefined(this._map);
        return this._map.getView().calculateExtent(this._map.getSize()) as Bounds;
    }
    public getSize(): Size2 {
        assertIsDefined(this._map);
        return this._map.getSize() as Size2;
    }
    public getOLView(): View {
        assertIsDefined(this._map);
        return this._map.getView();
    }
    public zoomToView(x: number, y: number, scale: number): void {
        if (this._map) {
            const view = this._map.getView();
            view.setCenter([x, y]);
            view.setResolution(this.scaleToResolution(scale));
        }
    }
    /**
     * @virtual
     * @param {RefreshMode} [mode=RefreshMode.LayersOnly | RefreshMode.SelectionOnly]
     * @memberof BaseMapProviderContext
     */
    public refreshMap(mode: RefreshMode = RefreshMode.LayersOnly | RefreshMode.SelectionOnly): void { }
    public getMetersPerUnit(): number {
        assertIsDefined(this._state.mapName);
        const activeLayerSet = this.getLayerSetGroup(this._state.mapName);
        assertIsDefined(activeLayerSet);
        return activeLayerSet.getMetersPerUnit();
    }
    public initialView(): void {
        assertIsDefined(this._comp);
        assertIsDefined(this._state.mapName);
        const activeLayerSet = this.getLayerSetGroup(this._state.mapName);
        assertIsDefined(activeLayerSet);
        this._comp.onDispatch(setCurrentView(this.getViewForExtent(activeLayerSet.getExtent())));
    }

    public zoomDelta(delta: number): void {
        //TODO: To conform to redux uni-directional data flow, this should
        //broadcast the new desired view back up and flow it back through to this
        //component as new props
        this.zoomByDelta(delta);
    }
    public zoomToExtent(extent: Bounds): void {
        this._comp?.onDispatch(setCurrentView(this.getViewForExtent(extent)));
    }
    public digitizePoint(handler: DigitizerCallback<Point>, prompt?: string): void {
        assertIsDefined(this._comp);
        const draw = new Draw({
            type: GeometryType.POINT // "Point"//ol.geom.GeometryType.POINT
        });
        this.pushDrawInteraction("Point", draw, handler, prompt || tr("DIGITIZE_POINT_PROMPT", this._state.locale));
    }
    public digitizeLine(handler: DigitizerCallback<LineString>, prompt?: string): void {
        assertIsDefined(this._comp);
        const draw = new Draw({
            type: GeometryType.LINE_STRING, // "LineString", //ol.geom.GeometryType.LINE_STRING,
            minPoints: 2,
            maxPoints: 2
        });
        this.pushDrawInteraction("Line", draw, handler, prompt || tr("DIGITIZE_LINE_PROMPT", this._state.locale));
    }
    public digitizeLineString(handler: DigitizerCallback<LineString>, prompt?: string): void {
        assertIsDefined(this._comp);
        const draw = new Draw({
            type: GeometryType.LINE_STRING, //"LineString", //ol.geom.GeometryType.LINE_STRING,
            minPoints: 2
        });
        this.pushDrawInteraction("LineString", draw, handler, prompt || tr("DIGITIZE_LINESTRING_PROMPT", this._state.locale, {
            key: String.fromCharCode(this._state.undoLastPointKey ?? KC_U) //Pray that a sane (printable) key was bound
        }));
    }
    public digitizeCircle(handler: DigitizerCallback<Circle>, prompt?: string): void {
        assertIsDefined(this._comp);
        const draw = new Draw({
            type: GeometryType.CIRCLE  // "Circle" //ol.geom.GeometryType.CIRCLE
        });
        this.pushDrawInteraction("Circle", draw, handler, prompt || tr("DIGITIZE_CIRCLE_PROMPT", this._state.locale));
    }
    public digitizeRectangle(handler: DigitizerCallback<Polygon>, prompt?: string): void {
        assertIsDefined(this._comp);
        const geomFunc: GeometryFunction = (coordinates, geometry) => {
            if (!geometry) {
                geometry = new Polygon([]);
            }
            const start: any = coordinates[0];
            const end: any = coordinates[1];
            (geometry as any).setCoordinates([
                [start, [start[0], end[1]], end, [end[0], start[1]], start]
            ]);
            return geometry;
        };
        const draw = new Draw({
            type: GeometryType.LINE_STRING, //"LineString", //ol.geom.GeometryType.LINE_STRING,
            maxPoints: 2,
            geometryFunction: geomFunc
        });
        this.pushDrawInteraction("Rectangle", draw, handler, prompt || tr("DIGITIZE_RECT_PROMPT", this._state.locale));
    }
    public digitizePolygon(handler: DigitizerCallback<Polygon>, prompt?: string): void {
        assertIsDefined(this._comp);
        const draw = new Draw({
            type: GeometryType.POLYGON //"Polygon" //ol.geom.GeometryType.POLYGON
        });
        this.pushDrawInteraction("Polygon", draw, handler, prompt || tr("DIGITIZE_POLYGON_PROMPT", this._state.locale, {
            key: String.fromCharCode(this._state.undoLastPointKey ?? KC_U) //Pray that a sane (printable) key was bound
        }));
    }

    public addInteraction<T extends Interaction>(interaction: T): T {
        assertIsDefined(this._map);
        this._map.addInteraction(interaction);
        return interaction;
    }
    public removeInteraction<T extends Interaction>(interaction: T): void {
        this._map?.removeInteraction(interaction);
    }
    public addOverlay(overlay: Overlay): void {
        this._map?.addOverlay(overlay);
    }
    public removeOverlay(overlay: Overlay): void {
        this._map?.removeOverlay(overlay);
    }
    public getProjection(): ProjectionLike {
        assertIsDefined(this._map);
        return this._map.getView().getProjection();
    }
    public addHandler(eventName: string, handler: Function) {
        this._map?.on(eventName, handler as any);
    }
    public removeHandler(eventName: string, handler: Function) {
        this._map?.un(eventName, handler as any);
    }
    public updateSize() {
        this._map?.updateSize();
    }

    public getLayerManager(mapName?: string): ILayerManager {
        assertIsDefined(this._map);
        assertIsDefined(this._state.mapName);
        const layerSet = this.ensureAndGetLayerSetGroup(this._state); // this.getLayerSet(mapName ?? this._state.mapName, true, this._comp as any);
        return new MgLayerManager(this._map, layerSet);
    }
    public screenToMapUnits(x: number, y: number): [number, number] {
        let bAllowOutsideWindow = false;
        const [mapDevW, mapDevH] = this.getSize();
        const [extX1, extY1, extX2, extY2] = this.getCurrentExtent();
        if (!bAllowOutsideWindow) {
            if (x > mapDevW - 1) x = mapDevW - 1;
            else if (x < 0) x = 0;

            if (y > mapDevH - 1) y = mapDevH - 1;
            else if (y < 0) y = 0;
        }
        x = extX1 + (extX2 - extX1) * (x / mapDevW);
        y = extY1 - (extY1 - extY2) * (y / mapDevH);
        return [x, y];
    }
    public getSelectedFeatures() {
        return this._select.getFeatures();
    }
    public getPointSelectionBox(point: Coordinate2D, ptBuffer: number): Bounds {
        assertIsDefined(this._map);
        const ll = this._map.getCoordinateFromPixel([point[0] - ptBuffer, point[1] - ptBuffer]);
        const ur = this._map.getCoordinateFromPixel([point[0] + ptBuffer, point[1] + ptBuffer]);
        return [ll[0], ll[1], ur[0], ur[1]];
    }
    public getResolution(): number {
        assertIsDefined(this._map)
        return this._map.getView().getResolution();
    }
    public updateOverviewMapElement(overviewMapElementSelector: () => (Element | null)) {
        if (this._ovMap) {
            const el = overviewMapElementSelector();
            if (el) {
                this._ovMap.setCollapsed(false);
                this._ovMap.setCollapsible(false);
                this._ovMap.setTarget(ReactDOM.findDOMNode(el) as any);
            } else {
                this._ovMap.setCollapsed(true);
                this._ovMap.setCollapsible(true);
                this._ovMap.setTarget(null as any);
            }
        }
    }
}