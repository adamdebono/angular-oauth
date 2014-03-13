
angular.module('angularOauth', [])
	.config(['$provide', '$httpProvider', '$routeProvider', function($provide, $httpProvider, $routeProvider) {
		//Intercept any $http calls to include OAuth authorization
		$provide.factory('httpOauthIntercept', ['$q', 'oauthConfig', function($q, oauthConfig) {
			return {
				request: function(config) {
					if (oauthConfig.isAuthorized()) {
						if (typeof config === 'undefined') {
							config = {};
						}
						if (typeof config.headers === 'undefined') {
							config['headers'] = {};
						}
						config.headers['Authorization'] = oauthConfig.getAuthorizationHeader();
					}

					return config;
				},
				requestError: function(rejection) {
					return $q.reject(rejection);
				},
				response: function(response) {
					return response || $q.when(response);
				},
				responseError: function(rejection) {
					return $q.reject(rejection);
				}
			};
		}]);
		$httpProvider.interceptors.push('httpOauthIntercept');
	}])
	.provider('oauthConfig', [function() {
		var options = {
			authUrl: '_',
			clientId: '_',
			clientSecret: '_',
			verifyUrl: '_',

			localStorageKey: 'oauth',
			method: 'redirect'
		};
		
		this.configure = function(customOptions) {
			options = angular.extend(options, customOptions);
		};

		this.$get = function() {
			return {
				get: function(key) {
					return options[key];
				},
				set: function(key, value) {
					return (options[key] = value);
				},
				getAll: function() {
					return options;
				},

				getAccessToken: function() {
					return window.localStorage[options.localStorageKey+'.token'];
				},
				getAuthorizationHeader: function() {
					return window.localStorage[options.localStorageKey+'.token_type']+' '+window.localStorage[options.localStorageKey+'.token'];
				},
				isAuthorized: function() {
					return typeof this.getAccessToken() !== 'undefined';
				}
			};
		}
	}])
	.provider('oauth', function() {
		this.$get = ['$q', '$window', '$location', '$http', '$route', 'oauthConfig', function($q, $window, $location, $http, $route, oauthConfig) {
			//Check required options
			var missing = [];
			angular.forEach(oauthConfig.getAll(), function(value, key) {
				if (value === '_') {
					missing.push(key);
				}
			});
			if (missing.length) {
				throw new Error("OAuth insufficiently configured. The following missing options are required: " + missing.join(', '));
			}
			if (oauthConfig.get('authUrl').indexOf('https://') < 0) {
				throw new Error("Invalid authUrl. OAuth2 requires https connections");
			}

			var setToken = function(data) {
				/*
				 access_token: "c7965a7056717b3083c22663e27187f96f6727bc"
				 expires_in: 2591999
				 refresh_token: "925dcbb855697ee7a691a9186c31dcea1badb923"
				 scope: "read"
				 token_type: "Bearer"
				*/
				var expires = new Date();
				expires.setUTCSeconds(expires.getUTCSeconds()+parseInt(data['expires_in']));

				window.localStorage[oauthConfig.get('localStorageKey')+'.token'] = data['access_token'];
				window.localStorage[oauthConfig.get('localStorageKey')+'.token_type'] = data['token_type'];
				window.localStorage[oauthConfig.get('localStorageKey')+'.refresh_token'] = data['refresh_token'];
				window.localStorage[oauthConfig.get('localStorageKey')+'.scope'] = data['scope'];
				window.localStorage[oauthConfig.get('localStorageKey')+'.expires'] = expires;
			};
			var clearToken = function() {
				window.localStorage[oauthConfig.get('localStorageKey')+'.token'] = '';
				window.localStorage[oauthConfig.get('localStorageKey')+'.token_type'] = '';
				window.localStorage[oauthConfig.get('localStorageKey')+'.refresh_token'] = '';
				window.localStorage[oauthConfig.get('localStorageKey')+'.scope'] = '';
				window.localStorage[oauthConfig.get('localStorageKey')+'.expires'] = '';
			};

			var getAccessTokenFromCode = function(code, state) {
				var deferred = $q.defer();

				$http({
					url: oauthConfig.get('verifyUrl'),
					method: 'POST',
					data: $.param({
						client_id: oauthConfig.get('clientId'),
						client_secret: oauthConfig.get('clientSecret'),
						grant_type: 'authorization_code',
						code: code
					}),
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded'
					}
				}).success(function(data, status, headers, config) {
					setToken(data);
					deferred.resolve();
				}).error(function(data, status, headers, config) {
					deferred.reject('Unable to get access token');
				});

				return deferred.promise;
			};

			var getParameterByName = function(name) {
				name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
				var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
					results = regex.exec(location.search);
				return results == null ? null : decodeURIComponent(results[1].replace(/\+/g, " "));
			}

			return {
				getAccessToken: function() {
					return oauthConfig.getAccessToken();
				},
				getAuthorizationHeader: function() {
					return oauthConfig.getAuthorizationHeader();
				},
				isAuthorized: function() {
					return oauthConfig.isAuthorized();
				},
				authorize: function(params) {
					var deferred = $q.defer();

					if (this.isAuthorized()) {
						//Already Authorized
						setTimeout(function() {
							deferred.resolve();
						}, 10);
					} else {
						var code = getParameterByName('code');
						var state = getParameterByName('state');
						var error = getParameterByName('error');

						if (state != null) {
							if (code) {
								//Just returned from getting token.
								getAccessTokenFromCode(code, state).then(function() {
									deferred.resolve();
								}, function(reason) {
									deferred.reject(reason);
								});
							} else if (error) {
								var reason = '';
								if (error == 'access_denied') {
									reason = 'The authorization request was denied. You will need to reload the page and allow access.';
								} else {
									reason = 'Authorization failed.';
								}

								setTimeout(function() {
									deferred.reject(reason);
								}, 10);
							}
						} else {
							var defaultParams = {
								method: oauthConfig.get('method')
							};
							params = angular.extend(defaultParams, params);

							switch(params.method) {
								case 'overlay':
								case 'redirect'://default to overlay
								default:
									if (params.method != 'redirect') {
										console.log('Invalid authorization method. Defaulting to redirect');
									}

									//Build URL
									var redirectUri = $location.absUrl() + $location.path() + '#/oauthToken';
									redirectUri = window.encodeURIComponent(redirectUri);

									var url = oauthConfig.get('authUrl') + '?client_id='+oauthConfig.get('clientId')+'&response_type=token';//&redirect_uri='+redirectUri;
									$window.location.href = url;
									break;
							}
						}
					}

					return deferred.promise;
				},
				unAuthorize: function() {
					clearToken();
				},
				reAuthorize: function(params) {
					this.unAuthorize();
					this.authorize(params);
				},
				getOptions: function() {
					return options;
				}
			};
		}];
	});