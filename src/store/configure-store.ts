import { createStore, applyMiddleware, compose, combineReducers } from 'redux';
import thunk from 'redux-thunk';
import promiseMiddleware from './promise-middleware';
import logger from './logger';
import rootReducer from '../reducers/root';

function configureStore(initialState: any, extraReducers?: any) {
    const root = extraReducers ? combineReducers({ ...rootReducer, ...extraReducers }) : combineReducers(rootReducer);
    const store = (<any>compose)( //HACK: Something bogus about the compose() declaration
        _getMiddleware(),
        ..._getEnhancers()
    )(createStore)(root, initialState);

    _enableHotLoader(store);
    return store;
}

function _getMiddleware() {
    let middleware = [
        promiseMiddleware,
        thunk,
    ];

    if (__DEV__) {
        middleware = [...middleware, logger];
    }

    return applyMiddleware(...middleware);
}

function _getEnhancers() {
    let enhancers = [] as any[];
    if (__DEV__ && window.__REDUX_DEVTOOLS_EXTENSION__) {
        enhancers = [...enhancers, window.__REDUX_DEVTOOLS_EXTENSION__()];
    }
    return enhancers;
}

function _enableHotLoader(store: any) {
    if (__DEV__ && module.hot) {
        module.hot.accept('../reducers', () => {
            const nextRootReducer = require('../reducers');
            store.replaceReducer(nextRootReducer);
        });
    }
}


export default configureStore;
