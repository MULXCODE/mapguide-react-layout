import * as Constants from "../constants";
const assign = require("object-assign");

const INITIAL_STATE = {
    selectionSet: null,
    layerIndex: -1,
    featureIndex: -1
};

export function selectionReducer(state = INITIAL_STATE, action = { type: '', payload: null }) {
    switch (action.type) {
        case Constants.MAP_SET_SELECTION:
            {
                return assign({}, state, {
                    selectionSet: action.payload,
                    layerIndex: -1,
                    featureIndex: -1
                });
            }
    }
    return state;
}