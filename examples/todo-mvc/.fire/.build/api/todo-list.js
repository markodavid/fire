'use strict';

var Q = require('q');

var fire = require('fire');
var app = fire.app('todomvc');

function merge(dest, source) {
	Object.keys(source).forEach(function(key) {
		dest[key] = source[key];
	});
	return dest;
}

function unauthenticatedError(authenticator) {
	var error = new Error();

	if(authenticator) {
		error.status = 403;
		error.message = 'Forbidden';
	}
	else {
		error.status = 401;
		error.message = 'Unauthorized';
	}

	return error;
}

function badRequestError() {
	var error = new Error();
	error.status = 400;
	error.message = 'Bad Request';
	return error;
}

function _canUpdateProperties(propertyNames, model) {
	for(var i = 0, il = propertyNames.length; i < il; i++) {
		var propertyName = propertyNames[i];
		var property = model.getProperty(propertyName);

		// TODO: Implement function-based checks.
		if(property && (typeof property.options.canUpdate != 'undefined' && property.options.canUpdate !== true || typeof property.options.canSet != 'undefined' && property.options.canSet !== true)) {
			return false;
		}
	}

	return true;
}

function _canSetProperties(propertyNames, model) {
	for(var i = 0, il = propertyNames.length; i < il; i++) {
		var propertyName = propertyNames[i];
		var property = model.getProperty(propertyName);

		// TODO: Implement function-based checks.
		if(property && typeof property.options.canSet != 'undefined' && property.options.canSet !== true) {
			return false;
		}
	}

	return true;
}

function findAuthenticator(authenticatorModel, request) {
	if(!authenticatorModel) {
		return Q.when(null);
	}

	var credentials = null;
	if(request.headers.authorization && request.headers.authorization.length > 6) {
		credentials = (new Buffer(request.headers.authorization.substring(6), 'base64')).toString('utf8').split(':');

		if(!credentials.length) {
			credentials = null;
		}
		else if(credentials.length == 1) {
			credentials.push('');
		}
	}

	if(credentials) {
		var findMap = {};
		findMap[authenticatorModel.options.authenticatingProperty.name] = credentials[0];
		findMap.accessToken = credentials[1];
		return authenticatorModel.findOne(findMap);
	}

	if(!request.session.at) {
		return Q.when(null);
	}

	return authenticatorModel.findOne({accessToken: request.session.at});
}


app.post('/api/todo-lists', function(app, response, request, TodoListModel) {
	return findAuthenticator(null, request)
		.then(function(authenticator) {
			var accessControl = TodoListModel.getAccessControl();
			return Q.when(accessControl.canCreate({authenticator: authenticator, request: request, response: response}))
				.then(function(canCreate) {
					if(canCreate) {
						var checkCreateMap = function(createMap) {
							if(typeof canCreate == 'object') {
								createMap = merge(createMap, canCreate);
							}

							if(TodoListModel.options.automaticPropertyName) {
								createMap[TodoListModel.options.automaticPropertyName] = authenticator;
							}

							if(_canSetProperties(Object.keys(createMap), TodoListModel)) {
								return createMap;
							}
							else {
								throw badRequestError();
							}
						};

						console.log('Body:');
						console.log(request.body);

						if(Array.isArray(request.body)) {
							

							var createMaps = request.body.map(function(createMap) {
								return checkCreateMap(createMap);
							});

							console.log('Create maps:');
							console.log(createMaps);

							return TodoListModel.create(createMaps);
							
						}
						else {
							return TodoListModel.create(checkCreateMap(request.body || {}));
						}
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
});

app.get('/api/todo-lists', function(request, response, app,  TodoListModel) {
	return findAuthenticator(null, request)
		.then(function(authenticator) {
			var accessControl = TodoListModel.getAccessControl();
			return Q.when(accessControl.canRead({authenticator: authenticator, request: request, response: response}))
				.then(function(canRead) {
					if(canRead) {
						var queryMap = request.query || {};
						var optionsMap = {};

						if(typeof canRead == 'object') {
							queryMap = merge(queryMap, canRead);
						}

						if(queryMap.$options) {
							optionsMap = queryMap.$options;
							delete queryMap.$options;
						}

						if(TodoListModel.options.automaticPropertyName) {
							queryMap[TodoListModel.options.automaticPropertyName] = authenticator;
						}

						return TodoListModel.find(queryMap, optionsMap);
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
});

app.get('/api/todo-lists/:id', function(request, response, app,  TodoListModel) {
	return findAuthenticator(null, request)
		.then(function(authenticator) {
			var accessControl = TodoListModel.getAccessControl();
			return Q.all([accessControl.canRead({authenticator: authenticator, request: request, response: response}), authenticator]);
		})
		.spread(function(canRead, authenticator) {
			if(canRead) {
				var whereMap = request.query || {};
				whereMap.id = request.param('id');

				if(typeof canRead == 'object') {
					whereMap = merge(whereMap, canRead);
				}

				if(TodoListModel.options.automaticPropertyName) {
					whereMap[TodoListModel.options.automaticPropertyName] = authenticator;
				}

				return TodoListModel.getOne(whereMap);
			}
			else {
				throw unauthenticatedError(authenticator);
			}
		});
});

app.put('/api/todo-lists/:id', function(request, response, app,  TodoListModel) {
	var accessControl = TodoListModel.getAccessControl();
	return findAuthenticator(null, request)
		.then(function(authenticator) {
			return Q.all([accessControl.canUpdate({authenticator: authenticator, request: request, response: response}), authenticator]);
		})
		.spread(function(canUpdate, authenticator) {
			if(canUpdate) {
				var whereMap = request.query || {};

				if(typeof canUpdate == 'object') {
					whereMap = merge(whereMap, canUpdate);
				}

				if(TodoListModel.options.automaticPropertyName) {
					whereMap[TodoListModel.options.automaticPropertyName] = authenticator;
				}

				whereMap.id = request.param('id');
				return [_canUpdateProperties(Object.keys(request.body), TodoListModel), whereMap, authenticator];
			}
			else {
				throw unauthenticatedError(authenticator);
			}
		})
		.all()
		.spread(function(canUpdateProperties, whereMap, authenticator) {
			if(canUpdateProperties) {
				return Q.all([TodoListModel.updateOne(whereMap, request.body), authenticator]);
			}
			else {
				throw badRequestError();
			}
		})
		.spread(function(modelInstance, authenticator) {
			if(modelInstance) {
				return modelInstance;
			}
			else {
				throw unauthenticatedError(authenticator);
			}
		})
		.catch(function(error) {
			throw error;
		});
});

app.put('/api/todo-lists', function(request, response, app,  TodoListModel) {
	return findAuthenticator(null, request)
		.then(function(authenticator) {
			var accessControl = TodoListModel.getAccessControl();
			return Q.when(accessControl.canUpdate({authenticator: authenticator, request: request, response: response}))
				.then(function(canUpdate) {
					if(canUpdate) {
						return Q.when(_canUpdateProperties(Object.keys(request.body || {}), TodoListModel))
							.then(function(canUpdateProperties) {
								if(canUpdateProperties) {
									var whereMap = request.query || {};

									if(typeof canUpdate == 'object') {
										whereMap = merge(whereMap, canUpdate);
									}

									if(TodoListModel.options.automaticPropertyName) {
										whereMap[TodoListModel.options.automaticPropertyName] = authenticator;
									}

									return TodoListModel.update(whereMap, request.body || {});
								}
								else {
									throw badRequestError();
								}
							});
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
});

app.delete('/api/todo-lists', function(request, response, app,  TodoListModel) {
	return findAuthenticator(null, request)
		.then(function(authenticator) {
			var accessControl = TodoListModel.getAccessControl();
			return Q.when(accessControl.canDelete({authenticator: authenticator, request: request, response: response}))
				.then(function(canDelete) {
					if(canDelete) {
						var whereMap = request.query || {};

						if(typeof canDelete == 'object') {
							whereMap = merge(whereMap, canDelete);
						}

						if(TodoListModel.options.automaticPropertyName) {
							whereMap[TodoListModel.options.automaticPropertyName] = authenticator;
						}

						return TodoListModel.remove(whereMap);
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
});

app.delete('/api/todo-lists/:id', function(request, response, app,  TodoListModel) {
	return findAuthenticator(null, request)
		.then(function(authenticator) {
			var accessControl = TodoListModel.getAccessControl();
			return Q.when(accessControl.canDelete({authenticator: authenticator, request: request, response: response}))
			.then(function(canDelete) {
				if(canDelete) {
					var whereMap = request.query || {};

					if(typeof canDelete == 'object') {
						whereMap = merge(whereMap, canDelete);
					}

					whereMap.id = request.param('id');

					if(TodoListModel.options.automaticPropertyName) {
						whereMap[TodoListModel.options.automaticPropertyName] = authenticator;
					}

					return TodoListModel.removeOne(whereMap);
				}
				else {
					throw unauthenticatedError(authenticator);
				}
			});
		});
});










app.post('/api/todo-lists/:id/items', function(request, response, app,  TodoListModel) {
	return findAuthenticator(null, request)
		.then(function(authenticator) {
			var property = TodoListModel.getProperty('items');
			return Q.all([typeof property.options.canCreate != 'undefined' ? app.injector.call(property.options.canCreate, {request: request, response: response, authenticator: authenticator}) : true, authenticator]);
		})
		.spread(function(canCreate, authenticator) {
			if(typeof canCreate == 'object') {
				throw new Error('PropertyTypes#CanCreate does not support returning an object. Either return true or false. AccessControl#CanCreate supports returning objects.');
			}

			if(canCreate !== true) {
				throw unauthenticatedError(authenticator);
			}
			else {
				return authenticator;
			}
		})
		.then(function(authenticator) {
			var association = TodoListModel.getAssociation('items');
			var associatedModel = association.getAssociatedModel();

			var accessControl = associatedModel.getAccessControl();
			return Q.when(accessControl.canCreate({authenticator: authenticator, request: request, response: response}))
				.then(function(canCreate) {
					if(canCreate) {
						var createMap = request.body || {};
						createMap[association.options.hasMany] = request.param('id');

						if(typeof canCreate == 'object') {
							createMap = merge(createMap, canCreate);
						}

						if(associatedModel.options.automaticPropertyName) {
							if(createMap[associatedModel.options.automaticPropertyName] && createMap[associatedModel.options.automaticPropertyName] != authenticator.id) {
								var error = new Error('Cannot set automatic property manually.');
								error.status = 400;
								throw error;
							}

							createMap[associatedModel.options.automaticPropertyName] = authenticator;
						}

						if(_canSetProperties(Object.keys(createMap), associatedModel)) {
							return associatedModel.create(createMap);
						}
						else {
							throw badRequestError();
						}
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
});

app.get('/api/todo-lists/:id/items', function(request, response, app,  TodoListModel) {
	return findAuthenticator(null, request)
		.then(function(authenticator) {
			var association = TodoListModel.getProperty('items');
			var associatedModel = association.options.relationshipVia.model;

			var accessControl = associatedModel.getAccessControl();
			return Q.when(accessControl.canRead({authenticator: authenticator, request: request, response: response}))
				.then(function(canRead) {
					if(canRead) {
						var queryMap = request.query || {};
						var optionsMap = {};

						if(queryMap.$options) {
							optionsMap = queryMap.$options;
							delete queryMap.$options;
						}

						var association = TodoListModel.getProperty('items');
						var associatedModel = association.options.relationshipVia.model;

						if(typeof canRead == 'object') {
							queryMap = merge(queryMap, canRead);
						}

						queryMap[association.options.relationshipVia.name] = request.param('id');

						if(associatedModel.options.automaticPropertyName) {
							if(queryMap[associatedModel.options.automaticPropertyName] && queryMap[associatedModel.options.automaticPropertyName] != authenticator.id) {
								var error = new Error('Cannot set automatic property manually.');
								error.status = 400;
								throw error;
							}

							queryMap[associatedModel.options.automaticPropertyName] = authenticator;
						}

						return associatedModel.find(queryMap, optionsMap);
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
});

app.delete('/api/todo-lists/:id/items/:associationID', function(request, response, app,  TodoListModel) {
	return findAuthenticator(null, request)
		.then(function(authenticator) {
			var association = TodoListModel.getProperty('items');
			var associatedModel = association.getAssociatedModel();

			var accessControl = associatedModel.getAccessControl();

			return Q.all([accessControl.canDelete({authenticator: authenticator, request: request, response: response}), authenticator]);
		})
		.spread(function(canDelete, authenticator) {
			if(canDelete) {
				var removeMap = request.query || {};
				var optionsMap = {};

				if(removeMap.$options) {
					optionsMap = removeMap.$options;
					delete removeMap.$options;
				}

				if(typeof canDelete == 'object') {
					removeMap = merge(removeMap, canDelete);
				}

				var association = TodoListModel.getProperty('items');
				var associatedModel = association.getAssociatedModel();

				removeMap[association.options.hasMany] = request.param('id');
				removeMap.id = request.param('associationID');

				if(associatedModel.options.automaticPropertyName) {
					// This is definitely a bad request if the user tries to set the automatic property manually.
					if(removeMap[associatedModel.options.automaticPropertyName] && removeMap[associatedModel.options.automaticPropertyName] != authenticator.id) {
						var error = new Error('Cannot set automatic property manually.');
						error.status = 400;
						throw error;
					}

					removeMap[associatedModel.options.automaticPropertyName] = authenticator;
				}

				return associatedModel.removeOne(removeMap, optionsMap);
			}
			else {
				throw unauthenticatedError(authenticator);
			}
		});
});

app.delete('/api/todo-lists/:id/items', function(request, response, app,  TodoListModel) {
	return findAuthenticator(null, request)
		.then(function(authenticator) {
			var association = TodoListModel.getProperty('items');
			var associatedModel = association.getAssociatedModel();

			var accessControl = associatedModel.getAccessControl();
			return Q.all([accessControl.canDelete({authenticator: authenticator, request: request, response: response}), authenticator]);
		})
		.spread(function(canDelete, authenticator) {
			if(canDelete) {
				var removeMap = request.query || {};

				if(typeof canDelete == 'object') {
					removeMap = merge(removeMap, canDelete);
				}

				var association = TodoListModel.getProperty('items');
				var associatedModel = association.getAssociatedModel();

				removeMap[association.options.hasMany] = request.param('id');

				if(associatedModel.options.automaticPropertyName) {
					// This is definitely a bad request if the user tries to set the automatic property manually.
					if(removeMap[associatedModel.options.automaticPropertyName] && removeMap[associatedModel.options.automaticPropertyName] != authenticator.id) {
						var error = new Error('Cannot set automatic property manually.');
						error.status = 400;
						throw error;
					}

					removeMap[associatedModel.options.automaticPropertyName] = authenticator;
				}

				var optionsMap = {};

				if(removeMap.$options) {
					optionsMap = removeMap.$options;
					delete removeMap.$options;
				}

				return associatedModel.remove(removeMap, optionsMap);
			}
			else {
				throw unauthenticatedError(authenticator);
			}
		});
});

app.put('/api/todo-lists/:id/items/:associationID', function(request, response, app,  TodoListModel) {
	return findAuthenticator(null, request)
		.then(function(authenticator) {
			var association = TodoListModel.getProperty('items');
			var associatedModel = association.options.relationshipVia.model;

			var accessControl = associatedModel.getAccessControl();
			return Q.when(accessControl.canUpdate({authenticator: authenticator, request: request, response: response}))
				.then(function(canUpdate) {
					if(canUpdate) {
						return Q.when(_canUpdateProperties(Object.keys(request.body || {}), associatedModel))
							.then(function(canUpdateProperties) {
								var error;
								if(canUpdateProperties) {
									var whereMap = request.query || {};

									if(typeof canUpdate == 'object') {
										whereMap = merge(whereMap, canUpdate);
									}

									whereMap[association.options.relationshipVia.name] = request.param('id');
									whereMap.id = request.param('associationID');

									if(associatedModel.options.automaticPropertyName) {
										// This is definitely a bad request if the user tries to set the automatic property manually.
										if(whereMap[associatedModel.options.automaticPropertyName] && whereMap[associatedModel.options.automaticPropertyName] != authenticator.id) {
											error = new Error('Cannot set automatic property manually.');
											error.status = 400;
											throw error;
										}

										whereMap[associatedModel.options.automaticPropertyName] = authenticator;
									}

									return associatedModel.updateOne(whereMap, request.body);
								}
								else {
									throw badRequestError();
								}
							});
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
});

app.put('/api/todo-lists/:id/items', function(request, response, app,  TodoListModel) {
	return findAuthenticator(null, request)
		.then(function(authenticator) {
			var association = TodoListModel.getProperty('items');
			var associatedModel = association.options.relationshipVia.model;

			var accessControl = associatedModel.getAccessControl();
			return Q.when(accessControl.canUpdate({authenticator: authenticator, request: request, response: response}))
				.then(function(canUpdate) {
					if(canUpdate) {
						return Q.when(_canUpdateProperties(Object.keys(request.body || {}), associatedModel))
							.then(function(canUpdateProperties) {
								var error;
								if(canUpdateProperties) {
									var whereMap = request.query || {};
									whereMap[association.options.relationshipVia.name] = request.param('id');

									if(typeof canUpdate == 'object') {
										whereMap = merge(whereMap, canUpdate);
									}

									if(associatedModel.options.automaticPropertyName) {
										// This is definitely a bad request if the user tries to set the automatic property manually.
										if(whereMap[associatedModel.options.automaticPropertyName] && whereMap[associatedModel.options.automaticPropertyName] != authenticator.id) {
											error = new Error('Cannot set automatic property manually.');
											error.status = 400;
											throw error;
										}

										whereMap[associatedModel.options.automaticPropertyName] = authenticator;
									}

									return associatedModel.update(whereMap, request.body);
								}
								else {
									throw badRequestError();
								}
							});
					}
					else {
						throw unauthenticatedError(authenticator);
					}
				});
		});
});








