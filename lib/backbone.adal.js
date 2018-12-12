var _ = require("underscore"),
    Backbone = require("backbone"),
    AuthenticationContext = require("adal-angular"),
    $ = require("jquery");

window.AuthenticationContext = AuthenticationContext; //AuthenticationContext  should be available on the window. See AuthenticationContext.prototype.getRequestInfo

//Extend the basic Backbone.Router with adal.js
//https://github.com/AzureAD/azure-activedirectory-library-for-js
Backbone.AdalRouter = function (options) {
    var that = this;
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
        var deferred = $.Deferred();
        if (this.adalConfig) {
            this.authContext = new AuthenticationContext(this.adalConfig);
            Backbone.sync.authContext = this.authContext; //inject the authentication context
            this.authContext.callback = this.authContext.config.callback = _.bind(this._callback, this);

            // Check For & Handle Redirect From AAD After Login
            if (this.authContext.isCallback(window.location.hash))
                this.authContext.handleWindowCallback();
            else deferred.resolve();
        } else deferred.resolve();

        return deferred;
    },
    _callback: function (errorDesc, token, error) {
        if (error) {
            this.authContext.error(errorDesc);
        } else {
            var location = this.authContext._getItem(this.authContext.CONSTANTS.STORAGE.LOGIN_REQUEST);
            window.location = location !== this.authContext.config.postLogoutRedirectUri ? this.authContext._getItem(this.authContext.CONSTANTS.STORAGE.LOGIN_REQUEST) : window.location = window.location.origin;
        }
    },
    _auth: function (params, next) {
        if (this.authContext) {
            var authenticate = !this.isAuth() && !this.isAnonymous;

            if (authenticate) {
                this.login();
            } else {
                return next();
            }
        } else return next();
    },
    isAuth: function () {
        return this.getCachedUser() && this.authContext.getCachedToken(this.adalConfig.clientId);
    },
    getCachedUser: function () {
        return this.authContext ? this.authContext.getCachedUser() : null;
    },
    login: function () {
        if (this.authContext) {
            var user = this.getCachedUser();
            if (user) { //https://github.com/AzureAD/azure-activedirectory-library-for-js/issues/580#issuecomment-436979019
                this.authContext.config.extraQueryParameter = 'login_hint=' + user.userName;
            }
            this.authContext.login();
        }
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

        var router = this;

        Backbone.history.route(route, function (fragment) {
            var args = router._extractParameters(route, fragment),
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

var originSync = Backbone.sync;
Backbone.sync = function (method, model, options) {
    options = options || {};
    var that = this,
        authContext = Backbone.sync.authContext,
        resource = authContext.getResourceForEndpoint(options.url || ($.isFunction(model.url) ? model.url() : model.url));
    var dfd = $.Deferred();
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