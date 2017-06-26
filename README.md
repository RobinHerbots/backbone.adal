# backbone.adal
Active Directory Authentication Library (ADAL) for Backbone

## Install

    $ npm install backbone.adal --save

## Usage

Derive your router from Backbone.Adal instead from Backbone.Router and add your azure ad config.  
For information about the adal config see [https://github.com/AzureAD/azure-activedirectory-library-for-js](https://github.com/AzureAD/azure-activedirectory-library-for-js)

``` javascript
import Backbone from "backbone";
import  "backone.adal";

let mainRouting = Backbone.AdalRouter.extend({
    adalConfig: {
        instance: AzureAd.AADInstance,
        tenant: AzureAd.TenantId,
        clientId: AzureAd.ClientId,
        postLogoutRedirectUri: postLogoutRedirectUri,
        redirectUri: window.location.origin,
        //cacheLocation: 'localStorage', // enable this for IE, as sessionStorage does not work for localhost.
        anonymousEndpoints: [
            ...
        ],
        endpoints: {
            ...
        },
        extraQueryParameter: "scope=openid,profile,email"
    },
    //extra before routing
    before: function (params, next) { return next(); },
    //extra after routing
    after: function () { },
    
    //continue normal setup for a router
    
```

