import _ from "underscore";
import Backbone from "backbone";
import AuthenticationContext from "adal-angular";
import $ from "jquery";

window.AuthenticationContext = AuthenticationContext; //AuthenticationContext  should be available on the window. See AuthenticationContext.prototype.getRequestInfo

//Extend the basic Backbone.Router with adal.js
//https://github.com/AzureAD/azure-activedirectory-library-for-js
Backbone.AdalRouter = function (options) {
    const that = this;
    options || (options = {});
    if (options.routes) that.routes = options.routes;

    that._bindRoutes();
    that._initAuth().done(function () {
        that.initialize.apply(that, arguments);
    });
};

Backbone.AdalRouter.prototype = Backbone.Router.prototype;
Backbone.AdalRouter.extend = Backbone.Router.extend;

Backbone.AdalRouter = Backbone.AdalRouter.extend({
    _initAuth: function () {
        const deferred = $.Deferred();
        if (this.adalConfig) {
            this.authContext = new AuthenticationContext(this.adalConfig);
            Backbone.sync.authContext = this.authContext; //inject the authentication context
            this.authContext.callback = this.authContext.config.callback = _.bind(this._callback, this);

            // Check For & Handle Redirect From AAD After Login
            if (this.authContext.isCallback(window.location.hash)) {
                this.authContext.handleWindowCallback();
            } else deferred.resolve();
        } else deferred.resolve();

        return deferred;
    },
    _callback: function (errorDesc, token, error) {
        if (errorDesc) {
            this.authContext.error(errorDesc);
        } else {
            const location = this.authContext._getItem(this.authContext.CONSTANTS.STORAGE.LOGIN_REQUEST);
            if (location !== this.authContext.config.postLogoutRedirectUri)
                window.location = this.authContext._getItem(this.authContext.CONSTANTS.STORAGE.LOGIN_REQUEST);
            else window.location = window.location.origin;
        }
    },
    _auth: function (params, next) {
        if (this.authContext) {
            var isAuth = this.authContext.getCachedUser();
            var authenticate = !isAuth && !this.isAnonymous;

            if (authenticate) {
                this.authContext.login();
            } else {
                return next();
            }
        } else return next();
    },
    getCachedUser: function () {
        return this.authContext ? this.authContext.getCachedUser() : null;
    },
    login: function () {
        if (this.authContext)
            this.authContext.login();
    },
    logOut: function () {
        if (this.authContext)
            this.authContext.logOut();
    },
    before: function (params, next) {
        return next();
    },
    after: function () {
    },
    route: function (route, name, callback) {
        if (!_.isRegExp(route)) route = this._routeToRegExp(route);
        if (_.isFunction(name)) {
            callback = name;
            name = "";
        }
        if (!callback) callback = this[name];

        const router = this;

        Backbone.history.route(route, function (fragment) {
            const args = router._extractParameters(route, fragment),
                next = function () {
                    callback && callback.apply(router, args);
                    router.trigger.apply(router, ['route:' + name].concat(args));
                    router.trigger('route', name, args);
                    Backbone.history.trigger('route', router, name, args);
                    router.after.apply(router, args);
                },
                before = function () {
                    router.before.apply(router, [args, next]);
                };
            router._auth.apply(router, [args, before]);
        });
        return router;
    }
});

Object.defineProperty(Backbone.AdalRouter.prototype, 'isAnonymous', {
    get: function () {
        return this.authContext ? this.authContext.getResourceForEndpoint(window.location.href) === null : true;
    },
    set: function () { //ignore
    },
    enumerable: true,
    configurable: false
});

const originSync = Backbone.sync;
Backbone.sync = function (method, model, options) {
    const that = this,
        authContext = Backbone.sync.authContext,
        resource = authContext.getResourceForEndpoint($.isFunction(model.url) ? model.url() : model.url);
    let dfd = $.Deferred();
    if (resource !== null) {
        authContext.acquireToken(resource, function (error, token) {
            if (error || !token) {
                authContext.error(error);
                return;
            }

            options.headers = options.headers || {}
            $.extend(options.headers,
                {
                    "Authorization": "Bearer " + token
                });

            dfd = originSync.call(that, method, model, options);
        });
    } else dfd.resolve();
    return dfd.promise();
}