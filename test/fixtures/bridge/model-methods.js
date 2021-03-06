'use strict';

/* jshint undef: true, unused: true */
/* global angular */

var app = angular.module('default', ['ngRoute']);




app.controller('TestController', ['$scope', 'fire', function($scope, fire) {/* jshint ignore:start */$scope.user = null; //jshint ignore:line
			// Test comment.

			$scope.submit = function() {
				fire.TestController.test()
					.then(function(result) {

					});
			};

			/* jshint ignore:end */
		}]);

app.controller('fn7', [function() {
			// Test :)
			//{
		}]);

app.controller('fn6', [function() {}]);

app.controller('fn5', [function() {}]);

app.controller('fn4', [function() { //jshint ignore:line
     		// Comments remains untouched.
     	}]);

app.controller('fn3', ['param1', 'param2', function(param1, param2) { //jshint ignore:line
			/* jshint ignore:start */
			alert('"There."');
			/* jshint ignore:end */
		}]);

app.controller('fn2', [function() {
    		/* jshint ignore:start */
    		test();
    		/* jshint ignore:end */
     	}]);

app.controller('fn1', [function() {
    		/* jshint ignore:start */
        	alert("/*This is not a comment, it's a string literal*/");
        	/* jshint ignore:end */
     	}]);

app.controller('fn0', ['param1', 'param2', function(param1, param2) { //jshint ignore:line
        	/*inside*/
        	/* jshint ignore:start */
        	execute(param2, param1);
        	/* jshint ignore:end */
    	}]);

function _getUUID(modelInstanceOrUUID) {
    var UUID;

    if(typeof modelInstanceOrUUID.toQueryValue != 'undefined') {
        UUID = modelInstanceOrUUID.toQueryValue();
    }
    else if(typeof modelInstanceOrUUID == 'string') {
        UUID = modelInstanceOrUUID;
    }
    else {
        var error = new FireError('Parameter `' + modelInstanceOrUUID + '` is not a valid model instance or UUID.');
        error.status = 400;
        throw error;
    }

    return UUID;
}

function transformQueryMap(fields, options) {
    var queryMap = {};

    Object.keys(fields || {}).forEach(function(key) {
        var value = fields[key];
        if(value && typeof value.toQueryValue != 'undefined') {
            queryMap[key] = value.toQueryValue();
        }
        else {
            queryMap[key] = value;
        }
    });

    if(options) {
        queryMap.$options = options;
    }

    return queryMap;
}

function FireError(message) {
    this.name = 'FireError';
    this.message = message || '';
	this.number = -1;
}
FireError.prototype = new Error();

app.factory('FireModel', ['$http', '$q', function($http, $q) {
    return function() {
        this._prepare = function(paramsOrList) {
            var prepare = function(params) {
                var map = {};
            	Object.keys(params || {}).forEach(function(key) {
            		map[key] = JSON.stringify(params[key]);
            	});
            	return map;
            };

            if(Array.isArray(paramsOrList)) {
                return paramsOrList.map(prepare);
            }
            else {
                return prepare(paramsOrList);
            }
        };

        this._action = function(verb, path, params, data) {
        	var defer = $q.defer();

        	var self = this;
        	$http({method: verb, url: path, data: data, params: params, headers: {'x-json-params': true}})
        		.success(function(result) {
        			defer.resolve(self.parseResult(result, path));
        		})
        		.error(function(data, statusCode) {
                    var error = new FireError(data);
                    error.number = statusCode;
        			defer.reject(error);
        		});

        	return defer.promise;
        };

        this._delete = function(path, fields) {
        	return this._action('delete', path, null, this._prepare(fields));
        };

        this._post = function(path, fields) {
        	return this._action('post', path, null, this._prepare(fields));
        };

        this._get = function(path, params) {
        	return this._action('get', path, this._prepare(params));
        };

        this._put = function(path, fields, query) {
        	return this._action('put', path, this._prepare(query), this._prepare(fields));
        };

        this.update = function(whereMap, setMap) {
            if(typeof whereMap == 'object') {
                return this._put(this.endpoint, transformQueryMap(setMap), transformQueryMap(whereMap));
            }
            else {
                return this._put(this.endpoint + '/' + whereMap, transformQueryMap(setMap));
            }
        };

        this.remove = function(modelInstanceMapOrUUID, options) {
            var UUID = null;

            if(typeof modelInstanceMapOrUUID.toQueryValue != 'undefined') {
                UUID = modelInstanceMapOrUUID.toQueryValue();
            }
            else if(typeof modelInstanceMapOrUUID == 'string') {
                UUID = modelInstanceMapOrUUID;
            }

            if(UUID) {
                return this._action('delete', this.endpoint + '/' + UUID);
            }
            else {
                return this._action('delete', this.endpoint, this._prepare(transformQueryMap(modelInstanceMapOrUUID, options)));
            }
        };

        this.updateOrCreate = function(where, set) {
            var self = this;
            return this.update(where, set).then(function(modelInstances) {
                if(modelInstances.length) {
                    return modelInstances[0];
                }
                else {
                    var createMap = {};
                    Object.keys(where || {}).forEach(function(key) {
                        createMap[key] = where[key];
                    });

                    Object.keys(set || {}).forEach(function(key) {
                        createMap[key] = set[key];
                    });

                    return self.create(createMap);
                }
            });
        };

        this.findOrCreate = function(where, set) {
        	var self = this;
        	return this.findOne(where)
        		.then(function(modelInstance) {
        			if(modelInstance) {
        				return modelInstance;
        			}
        			else {
        				var createMap = {};
        				Object.keys(where || {}).forEach(function(key) {
        					createMap[key] = where[key];
        				});

        				Object.keys(set || {}).forEach(function(key) {
        					createMap[key] = set[key];
        				});

        				return self.create(createMap);
        			}
        		});
        };

        this._create = function(path, fields) {
            if(Array.isArray(fields)) {
                return this._post(path, fields.map(function(map) {
                    return transformQueryMap(map);
                }));
            }
            else {
            	return this._post(path, transformQueryMap(fields));
            }

        };

        this.create = function(fields) {
        	return this._create(this.endpoint, fields);
        };

        this._find = function(path, fields, options) {
        	var queryMap = transformQueryMap(fields, options);
        	return this._get(path, queryMap);
        };

        this.find = function(fields, options) {
        	return this._find(this.endpoint, fields, options);
        };

        this.findOne = function(fields, options) {
        	var fieldsMap = fields || {};
        	if(fieldsMap.id) {
        		var modelID = fieldsMap.id;
        		delete fieldsMap.id;

        		var self = this;
        		return this._get(this.endpoint + '/' + modelID, transformQueryMap(fieldsMap))
        			.then(function(modelInstance) {
        				if(modelInstance) {
        					modelInstance._endpoint = self.endpoint + '/' + modelID;
        				}

        				return modelInstance;
        			});
        	}
        	else {
        		var optionsMap = options || {};
        		optionsMap.limit = 1;

        		return this.find(fieldsMap, optionsMap)
        			.then(function(list) {
        				if(list && list.length) {
        					return list[0];
        				}
        				else {
        					return null;
        				}
        			});
        	}

        };

        this.getOne = function(fields) {
        	var defer = $q.defer();
        	this.findOne(fields)
        		.then(function(model) {
        			if(model) {
        				defer.resolve(model);
        			}
        			else {
        				var error = new FireError('Not Found');
        				error.number = 404;
        				defer.reject(error);
        			}
        		});
        	return defer.promise;
        };
    };
}]);


app.factory('PetModel', ['$http', '$q', 'FireModel', '$injector', function($http, $q, FireModel, $injector) {
    var model = new FireModel();
    model.endpoint = '/api/pets';

    model.parseResult = function(setMapOrList, path) {
        function parseSetMap(setMap) {
            var fireModelInstanceConstructor = $injector.get('FireModelInstancePet');
            return new fireModelInstanceConstructor(setMap, path);
        }

    	if(Object.prototype.toString.call(setMapOrList) === '[object Array]') {
    		return setMapOrList.map(parseSetMap);
    	}
    	else {
    		return parseSetMap(setMapOrList);
    	}
    };

    

    

    return model;
}]);

app.factory('FireModelInstancePet', ['PetModel', '$q', '$http', '$injector', function(PetModel, $q, $http, $injector) {
    return function(setMap, path, shouldBeUndefined) {
        if(shouldBeUndefined) {
            throw new Error('FireModelInstancePet only accepts two arguments now.');
        }

        this._map = setMap || {};
        this._changes = {};

        if(this._map.id) {
            this._endpoint = path + '/' + this._map.id;
        }
        else {
            this._endpoint = null;
        }

        var self = this;
    
    	

    	Object.defineProperty(this, 'id', {
    		get: function() {
    			if(typeof self._changes['id'] != 'undefined') {
    				return self._changes['id'];
    			}

    			return self._map['id'];
    		},

    		set: function(value) {
    			self._changes['id'] = value;
    		}
    	});
    
    	

    	Object.defineProperty(this, 'name', {
    		get: function() {
    			if(typeof self._changes['name'] != 'undefined') {
    				return self._changes['name'];
    			}

    			return self._map['name'];
    		},

    		set: function(value) {
    			self._changes['name'] = value;
    		}
    	});
    

    
        
    
        
    



        this.cancel = function() {
            this._changes = {};
        };

        this.refresh = function(otherInstance) {
        	this._map = otherInstance._map;
        	return this;
        };

        this.toQueryValue = function() {
        	return this._map.id;
        };

        this.remove = function() {
        	return PetModel.remove(this._map.id);
        };

        this.save = function() {
            var self = this;
            return $q.when(Object.keys(this._changes).length)
                .then(function(numberOfChanges) {
                    if(numberOfChanges) {
                        var queryMap = transformQueryMap(self._changes);

                        return PetModel._put(self._endpoint, queryMap)
                            .then(function(instance) {
                                self._changes = {};

                                Object.keys(instance._map).forEach(function(key) {
                                    if(instance._map[key] !== null) {
                                        self._map[key] = instance._map[key];
                                    }
                                });
                                return self;
                            });
                    }
                    else {
                        return self;
                    }
                });
        };

        Object.defineProperty(this, '_model', {
            get: function() {
                throw new Error('FireModelInstancePet._model is deprecated.');
            }
        });

        

        
    };
}]);

app.factory('UserModel', ['$http', '$q', 'FireModel', '$injector', function($http, $q, FireModel, $injector) {
    var model = new FireModel();
    model.endpoint = '/api/users';

    model.parseResult = function(setMapOrList, path) {
        function parseSetMap(setMap) {
            var fireModelInstanceConstructor = $injector.get('FireModelInstanceUser');
            return new fireModelInstanceConstructor(setMap, path);
        }

    	if(Object.prototype.toString.call(setMapOrList) === '[object Array]') {
    		return setMapOrList.map(parseSetMap);
    	}
    	else {
    		return parseSetMap(setMapOrList);
    	}
    };

    

    

    return model;
}]);

app.factory('FireModelInstanceUser', ['UserModel', '$q', '$http', '$injector', function(UserModel, $q, $http, $injector) {
    return function(setMap, path, shouldBeUndefined) {
        if(shouldBeUndefined) {
            throw new Error('FireModelInstanceUser only accepts two arguments now.');
        }

        this._map = setMap || {};
        this._changes = {};

        if(this._map.id) {
            this._endpoint = path + '/' + this._map.id;
        }
        else {
            this._endpoint = null;
        }

        var self = this;
    
    	

    	Object.defineProperty(this, 'id', {
    		get: function() {
    			if(typeof self._changes['id'] != 'undefined') {
    				return self._changes['id'];
    			}

    			return self._map['id'];
    		},

    		set: function(value) {
    			self._changes['id'] = value;
    		}
    	});
    
    	

    	Object.defineProperty(this, 'name', {
    		get: function() {
    			if(typeof self._changes['name'] != 'undefined') {
    				return self._changes['name'];
    			}

    			return self._map['name'];
    		},

    		set: function(value) {
    			self._changes['name'] = value;
    		}
    	});
    

    
        
    
        
    



        this.cancel = function() {
            this._changes = {};
        };

        this.refresh = function(otherInstance) {
        	this._map = otherInstance._map;
        	return this;
        };

        this.toQueryValue = function() {
        	return this._map.id;
        };

        this.remove = function() {
        	return UserModel.remove(this._map.id);
        };

        this.save = function() {
            var self = this;
            return $q.when(Object.keys(this._changes).length)
                .then(function(numberOfChanges) {
                    if(numberOfChanges) {
                        var queryMap = transformQueryMap(self._changes);

                        return UserModel._put(self._endpoint, queryMap)
                            .then(function(instance) {
                                self._changes = {};

                                Object.keys(instance._map).forEach(function(key) {
                                    if(instance._map[key] !== null) {
                                        self._map[key] = instance._map[key];
                                    }
                                });
                                return self;
                            });
                    }
                    else {
                        return self;
                    }
                });
        };

        Object.defineProperty(this, '_model', {
            get: function() {
                throw new Error('FireModelInstanceUser._model is deprecated.');
            }
        });

        

        
    };
}]);

app.factory('ArticleModel', ['$http', '$q', 'FireModel', '$injector', function($http, $q, FireModel, $injector) {
    var model = new FireModel();
    model.endpoint = '/api/articles';

    model.parseResult = function(setMapOrList, path) {
        function parseSetMap(setMap) {
            var fireModelInstanceConstructor = $injector.get('FireModelInstanceArticle');
            return new fireModelInstanceConstructor(setMap, path);
        }

    	if(Object.prototype.toString.call(setMapOrList) === '[object Array]') {
    		return setMapOrList.map(parseSetMap);
    	}
    	else {
    		return parseSetMap(setMapOrList);
    	}
    };

    

    

    return model;
}]);

app.factory('FireModelInstanceArticle', ['ArticleModel', '$q', '$http', '$injector', function(ArticleModel, $q, $http, $injector) {
    return function(setMap, path, shouldBeUndefined) {
        if(shouldBeUndefined) {
            throw new Error('FireModelInstanceArticle only accepts two arguments now.');
        }

        this._map = setMap || {};
        this._changes = {};

        if(this._map.id) {
            this._endpoint = path + '/' + this._map.id;
        }
        else {
            this._endpoint = null;
        }

        var self = this;
    
    	

    	Object.defineProperty(this, 'id', {
    		get: function() {
    			if(typeof self._changes['id'] != 'undefined') {
    				return self._changes['id'];
    			}

    			return self._map['id'];
    		},

    		set: function(value) {
    			self._changes['id'] = value;
    		}
    	});
    
    	

    	Object.defineProperty(this, 'title', {
    		get: function() {
    			if(typeof self._changes['title'] != 'undefined') {
    				return self._changes['title'];
    			}

    			return self._map['title'];
    		},

    		set: function(value) {
    			self._changes['title'] = value;
    		}
    	});
    

    
        
    
        
    



        this.cancel = function() {
            this._changes = {};
        };

        this.refresh = function(otherInstance) {
        	this._map = otherInstance._map;
        	return this;
        };

        this.toQueryValue = function() {
        	return this._map.id;
        };

        this.remove = function() {
        	return ArticleModel.remove(this._map.id);
        };

        this.save = function() {
            var self = this;
            return $q.when(Object.keys(this._changes).length)
                .then(function(numberOfChanges) {
                    if(numberOfChanges) {
                        var queryMap = transformQueryMap(self._changes);

                        return ArticleModel._put(self._endpoint, queryMap)
                            .then(function(instance) {
                                self._changes = {};

                                Object.keys(instance._map).forEach(function(key) {
                                    if(instance._map[key] !== null) {
                                        self._map[key] = instance._map[key];
                                    }
                                });
                                return self;
                            });
                    }
                    else {
                        return self;
                    }
                });
        };

        Object.defineProperty(this, '_model', {
            get: function() {
                throw new Error('FireModelInstanceArticle._model is deprecated.');
            }
        });

        

        
    };
}]);


app.service('FireModels', [function() {
    throw new Error('FireModels service is deprecated.');
}]);
function unwrap(promise, initialValue) {
    var value = initialValue;

    promise.then(function(newValue) {
        angular.copy(newValue, value);
    });

    return value;
};

app.service('fire', ['FireModels', '$http', '$q', function(FireModels, $http, $q) {
    function unwrap(promise, initialValue) {
        var value = initialValue;

        promise.then(function(newValue) {
            angular.copy(newValue, value);
        });

        return value;
    };
    this.unwrap = unwrap;
    this.models = FireModels;

    this.isServer = function() {
        return false;
    };

    this.isClient = function() {
        return true;
    };
}]);

app.config(['$routeProvider', '$locationProvider', function($routeProvider, $locationProvider) {
    $locationProvider.html5Mode({
        enabled: true,
        requireBase: false
    });



















}]);
app.service('ChannelService', ['WebSocketService', '$rootScope', function(WebSocketService, $rootScope) {
	var channelsMap = {};

	function getChannelAddress(channelId, channelType) {
		return (channelType + ':' + channelId);
	}

	this.registerChannel = function(channel) {
		channelsMap[getChannelAddress(channel.id, channel.type)] = channel;

		this.sendMessageOnChannel({
			event: '_subscribe'
		}, channel);
	};

	this.getChannel = function(channelId, channelType) {
		return channelsMap[getChannelAddress(channelId, channelType)];
	};

	this.getUnknownMessage = function(messageMap, channelMap) { //jshint ignore:line
		console.log('Unknown message.');
	};

	this.sendMessageOnChannel = function(message, channel) {
		return WebSocketService.send({
			channel: {
				type: channel.type,
				id: channel.id
			},
			message: message
		});
	};

	var self = this;
	WebSocketService.parsePacket = function(packet) {
		var channel = self.getChannel(packet.channel.id, packet.channel.type);
		if(channel) {
			if(channel.delegate) {
				$rootScope.$apply(function() {
					channel.delegate(packet.message);
				});
			}
			else {
				console.log('Warning: no delegate set on channel.');
			}
		}
		else {
			$rootScope.$apply(function() {
				self.getUnknownMessage(packet.message, packet.channel);
			});
		}
	};
}]);

app.service('WebSocketService', ['$location', '$timeout', function($location, $timeout) {
	var queue = [];

	var reconnectInterval = 1000;
	var reconnectDecay = 1.5;
	var reconnectAttempts = 0;
	var reconnectMaximum = 60 * 1000;
	var socket = null;

	var self = this;
	var onOpen = function () {
		if(queue && queue.length > 0) {
			var queue_ = queue;
			queue = null;

			queue_.forEach(function(message) {
				self.send(message);
			});
		}
	};

	var onError = function(error) {
		console.log('error');
		console.log(error);
	};

	var onClose = function(event) {
		$timeout(connect, Math.max(reconnectMaximum, reconnectInterval * Math.pow(reconnectDecay, reconnectAttempts)));
	};

	var onMessage = function(event) {
		var packet = JSON.parse(event.data);

		// TODO: Change this to an event emitter instead. Now it's only possible to delegate the packets to 1 listeners.

		if(self.parsePacket) {
			self.parsePacket(packet);
		}
	};

	function connect() {
		reconnectAttempts++;

		socket = new WebSocket('ws://' + $location.host() + ($location.port() ? ':' + $location.port() : ''));
		socket.onopen = onOpen;
		socket.onerror = onError;
		socket.onclose = onClose;
		socket.onmessage = onMessage;
	}

	this.send = function(message) {
		if(queue !== null) {
			queue.push(message);
		}
		else {
			console.log(socket);

			socket.send(JSON.stringify(message));
		}
	};
	this.parsePacket = null;

	connect();
}]);


/* global window, app */
app.service('_StorageService', [function _StorageService() {
	var storage = {};

	this.get = function(key) {
		if(typeof storage[key] != 'undefined') {
			return storage[key];
		}
		else {
			return window.localStorage.getItem(key);
		}
	};

	this.set = function(key, value) {
		try {
			window.localStorage.setItem(key, value);
		}
		catch(error) {
			storage[key] = value;
		}
	};

	this.unset = function(key) {
		if(typeof storage[key] != 'undefined') {
			delete storage[key];
		}
		else {
			window.localStorage.removeItem(key);
		}
	};
}]);

app.provider('TestsService', [function() {
	var _delegate = null;
	this.delegate = function(delegate) {
		_delegate = delegate;
	};

	this.$get = function() {
		return {
			participate: function(test, variant) {
				if(_delegate === null) {
					throw new Error('Please set the TestsService.delegate');
				}
				else if(typeof _delegate != 'function') {
					throw new Error('TestsService#delegate must be a function.');
				}
				else {
					_delegate(test, variant);
				}
			}
		};
	}
}]);


