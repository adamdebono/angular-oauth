# angular-oauth

Easily add oauth2 support to $http.

## Usage

1: Configure your app with your api keys

```javascript
angular.module('myAngularApp', [
		'angularOauth'
		//Any other dependencies you might have
	])
	.config(function(oauthConfigProvider) {
		oauthConfigProvider.configure({
			authUrl: 'https://www.example.com/oauth/authorize',
			clientId: 'your-client-id',
			clientSecret: 'your-client-secret',
			verifyUrl: 'https://api.uow.edu.au/oauth/access_token'
		});
		//Configure the rest of your app...
	});
```

2: Authorize

The user will be navigated to the page specified in `authUrl`. The oauth client 
should redirect back to your angular deployment where the `authorize()` function
is called from.

```javascript
	.controller('myController', ['oauth', function(oauth) {
		oauth.authorize().then(function() {
			//Success code goes here
			alert('Successfully logged in');
		}, function(reason) {
			//Failure code goes here
			alert('Failed to log in: '+reason);
		})
	}]);
```

3: Access you web services using $http

angularOauth will transparently intercept each request and insert your oauth
token in the Authorization header.

```javascript
	.controller('myWebController', ['$http', function($http) {
		$http({
			url: 'https://www.example.com/api/message',
			method: 'GET'
		}).success(function(data) {
			alert(data.message);
		}).error(function(data) {
			alert('Unable to load data');
		});
	}])
```

## License

The MIT License (MIT)

Copyright (c) 2014 Adam Debono

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.