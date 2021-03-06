/* global describe, beforeEach, afterEach, before, it */
'use strict';

var fire = require('..');
var assert = require('assert');
var Q = require('q');
var request = require('supertest');
var helper = require('./support/helper');
var fs = require('fs');
var path = require('path');

describe('access control', function() {
	var app = null;
	var createModels = null;
	var modules = null;

	beforeEach(function(done) {
		app = fire.app('accessControlTest', {type: 'angular'});

		if(createModels) {
			createModels();
		}

		fire.start()
			.then(function() {
				app.modules.forEach(function(module_) {
					if(module_.migrate) {
						module_.migrate(app.models);
					}
				});
			})
			.then(function() {
				var result = Q.when(true);

				app.models.forEach(function(model) {
		            result = result.then(function() {
		                return model.exists()
		                	.then(function(exists) {
		                    	if(!exists) {
		                        	return model.setup();
		                    	}
		                    	else {
		                        	return true;
		                    	}
		                	});
		            	});
	        	});

	        	return result;
			})
			.then(function() {
				var defer = Q.defer();

				fs.mkdir(path.join(__dirname, '..', 'temp'), function() {
					defer.resolve();
				});

				return defer.promise;
			})
			.then(function() {
				var result = Q.when(true);

				modules = [];

				app.models.forEach(function(model) {
					if(!model.disableAutomaticModelController) {
						result = result.then(function() {
							var writeStream = fs.createWriteStream(path.join(__dirname, '..', 'temp', model.getName().toLowerCase() + '.js'));

							return app.API.generateModelController(model, writeStream)
								.then(function() {
									modules.push(writeStream.path);

									require(writeStream.path);
								});
						});
					}
				});

				return result;
			})
			.then(function() {
				var defer = Q.defer();
				setImmediate(defer.makeNodeResolver());
				return defer.promise;
			})
			.then(function() {
				done();
			})
			.catch(function(error) {
				done(error);
			})
			.done();
	});

	afterEach(function(done) {
		var result = Q.when(true);

        app.models.forEach(function(model) {
            result = result.then(function() {
                return model.exists()
					.then(function(exists) {
	                    if(exists) {
	                        return model.forceDestroy();
	                    }
	                    else {
	                        return Q.when(true);
	                    }
	                })
					.then(function() {
						delete app.models[model.getName()];
						delete app.models.internals[model.getName()];
					});
            });
        });

        result
			.then(function() {
				app.models._authenticator = null;
			})
        	.then(function() {
            	return fire.stop();
        	})
			.then(function() {
				if(modules) {
					modules.forEach(function(modulPath) {
						delete require.cache[modulPath];
					});
				}
			})
        	.then(function() {
            	done();
        	})
        	.done();
	});

	describe('article access control', function() {
		var agent = null;

		before(function() {
			createModels = function() {
				function User() {
					this.name = [this.String, this.Authenticate];
					this.articles = [this.HasMany(this.models.Article)];
				}
				app.model(User);

				User.prototype.toJSON = function() {
					return {
						id: this.id,
						accessToken: this.accessToken,
						name: this.name
					};
				};

				function Article() {
					this.title = [this.String];
					this.author = [this.BelongsTo(this.models.User), this.Automatic, this.AutoFetch];
				}
				app.model(Article);

				Article.prototype.accessControl = function() {
					return {
						canCreate: function(authenticator) {
							return (authenticator && authenticator.name == 'Martijn');
						},
						canRead: true,
						canUpdate: function(authenticator) {
							return {
								author: authenticator
							};
						},
						canDelete: false
					};
				};

				Article.prototype.toJSON = function() {
					return {
						id: this.id,
						title: this.title,
						author: this.author
					};
				};
			};
		});

		beforeEach(function(done) {
			app.models.User.create({name: 'Martijn', password: 'test'})
				.then(function() {
					agent = request.agent(app.HTTPServer.express);

					// We authorize. This should set a session variable.
					agent.post('/api/users/access-token')
						.set('X-JSON-Params', true)
						.send(helper.jsonify({name: 'Martijn', password: 'test'}))
						.expect(200, function(error, response) {
							assert.equal(response.body.name, 'Martijn');
							assert.notEqual(response.body.accessToken, null);
							assert.equal(response.body.password, null);

							done(error);
						});
				})
				.catch(function(error) {
					done(error);
				})
				.done();
		});

		it('can create article', function(done) {
			agent.post('/api/articles')
				.send({
					title: 'Test Title'
				})
				.expect(200, function(error, response) {
					assert.equal(error, null);
					assert.equal(response.body.title, 'Test Title');
					assert.equal(response.body.author.name, 'Martijn');

					done(error);
				});
		});

		it('cannot create article when unauthorized', function(done) {
			var noone = request.agent(app.HTTPServer.express);

			noone.post('/api/articles')
				.set('X-JSON-Params', true)
				.send(helper.jsonify({
					title: 'Malicious'
				}))
				.expect(401, function(error) {
					done(error);
				});
		});

		it('cannot create article when not Martijn', function(done) {
			var smith = request.agent(app.HTTPServer.express);

			app.models.User.create({name: 'Agent Smith', password: 'test'})
				.then(function() {
					smith.post('/api/users/access-token')
						.set('X-JSON-Params', false)
						.send({name: 'Agent Smith', password: 'test'})
						.expect(200, function() {
							smith.post('/api/articles')
								.set('X-JSON-Params', false)
								.send({title: '+1 + -1'})
								.expect(403, function(error) {
									done(error);
								});
						});
				});
		});

		describe('update article', function() {
			var articleId = -1;

			beforeEach(function(done) {
				agent.post('/api/articles')
					.send(helper.jsonify({title: 'Test'}))
					.expect(200, function(error, response) {
						assert.notEqual(response.body.id, null);

						articleId = response.body.id;

						done(error);
					});
			});

			it('can update article', function(done) {
				agent.put('/api/articles/' + articleId)
					.send({title: 'Rename'})
					.expect(200, function(error, response) {
						assert.equal(response.body.id, articleId);
						assert.equal(response.body.title, 'Rename');

						done(error);
					});
			});

			it('cannot update id', function(done) {
				agent
					.put('/api/articles/' + articleId)
					.send(helper.jsonify({
						id: 123
					}))
					.expect(400, function(error) {
						done(error);
					});
			});

			it('cannot update article when unauthorized', function(done) {
				var newTitle = 'Not Possible ' + Math.floor(Math.random() * 1000);

				request.agent(app.HTTPServer.express)
					.put('/api/articles/' + articleId)
					.send(helper.jsonify({title: newTitle}))
					.expect(401, function(error) {
						app.models.Article.getOne({id:articleId})
							.then(function(article) {
								assert.notEqual(article.title, newTitle);

								done(error);
							})
							.done();
					});
			});

			it('cannot update article when not correctly authorized', function(done) {
				var smith = request.agent(app.HTTPServer.express);

				app.models.User.create({name: 'Agent Smith', password: 'test'})
					.then(function() {
						smith.post('/api/users/access-token')
							.send({name: 'Agent Smith', password: 'test'})
							.expect(200, function(error1) {
								assert.equal(error1, null);
								smith.put('/api/articles/' + articleId)
									.send({title: '+1 + -1'})
									.expect(403, function(error2) {
										done(error2);
									});
							});
					});
			});
		});

		it('can read articles', function(done) {
			agent
				.get('/api/articles')
				.send()
				.expect(200, function(error) {
					done(error);
				});
		});

		it('can delete article', function(done) {
			agent
				.delete('/api/articles/1')
				.send()
				.expect(403, function(error) {
					done(error);
				});
		});
	});

	describe('associations', function() {
		before(function() {
			createModels = function() {
				function User(LockModel, SafeModel) {
					this.name = [this.String, this.Authenticate];
					this.locks = [this.HasMany(LockModel)];
					this.safe = [this.HasOne(SafeModel)];
				}
				app.model(User);

				User.prototype.accessControl = function() {
					return {
						canCreate: true,
						canUpdate: true,
						canDelete: true,
						canRead: true
					};
				};

				function Lock(UserModel) {
					this.name = [this.String, this.Required];
					this.user = [this.BelongsTo(UserModel), this.Required];
				}
				app.model(Lock);

				Lock.prototype.accessControl = function() {
					return {
						canCreate: false,
						canUpdate: false,
						canDelete: false,
						canRead: false
					};
				};

				function Safe(UserModel) {
					this.name = [this.String, this.Required];
					this.user = [this.BelongsTo(UserModel), this.Required];
				}
				app.model(Safe);

				Safe.prototype.accessControl = function() {
					return {
						canCreate: false,
						canUpdate: false,
						canDelete: false,
						canRead: false
					};
				};
			};
		});

		var userID = null;
		var lockPath = null;
		var detailLockPath = null;
		var safePath = null;
		var detailSafePath = null;

		beforeEach(function() {
			return app.models.User.create({name: 'Martijn', password: 'test'})
				.then(function(user) {
					userID = user.id;
					lockPath = '/api/users/' + userID + '/locks';

					return app.models.Lock.create({
							name: 'A lock',
							user: userID
						})
						.then(function(lock) {
							detailLockPath = lockPath + '/' + lock.id;

							return app.models.Safe.create({
								name: 'A safe',
								user: userID
							});
						})
						.then(function(safe) {
							safePath = '/api/users/' + userID + '/safe';
							detailSafePath = safePath + '/' + safe.id;
						});
				});
		});

		it('cannot create one-to-many', function(done) {
			request.agent(app.HTTPServer.express)
				.post(lockPath)
				.send({
					name: 'Test Lock',
					user: userID
				})
				.expect(401, function(error) {
					done(error);
				});
		});

		it('cannot read one-to-many', function(done) {
			request.agent(app.HTTPServer.express)
				.get(lockPath)
				.send()
				.expect(401, function(error) {
					done(error);
				});
		});

		it('cannot update one-to-many', function(done) {
			request.agent(app.HTTPServer.express)
				.put(detailLockPath)
				.send({
					name: 'Test Lock',
					user: userID
				})
				.expect(401, function(error) {
					done(error);
				});
		});

		it('cannot delete one-to-many', function(done) {
			request.agent(app.HTTPServer.express)
				.delete(detailLockPath)
				.send()
				.expect(401, function(error) {
					done(error);
				});
		});

		it('cannot create one-to-one', function(done) {
			request.agent(app.HTTPServer.express)
				.post(safePath)
				.send({
					name: 'Test Lock',
					user: userID
				})
				.expect(401, function(error) {
					done(error);
				});
		});

		it('cannot read one-to-one', function(done) {
			request.agent(app.HTTPServer.express)
				.get(safePath)
				.send()
				.expect(401, function(error) {
					done(error);
				});
		});

		it('cannot update one-to-one', function(done) {
			request.agent(app.HTTPServer.express)
				.put(safePath)
				.send({
					name: 'Test Lock',
					user: userID
				})
				.expect(401, function(error) {
					done(error);
				});
		});

		it('cannot delete one-to-one', function(done) {
			request.agent(app.HTTPServer.express)
				.delete(safePath)
				.send()
				.expect(401, function(error) {
					done(error);
				});
		});
	});

	describe('access control return object', function() {
		before(function() {
			createModels = function() {
				function User() {
					this.name = [this.String, this.Required];
					this.value = [this.Integer, this.Required];
				}
				app.model(User);

				User.prototype.accessControl = function() {
					return {
						canCreate: function() {
							return {
								value: 123
							};
						},

						canRead: function() {
							return {
								value: 123
							};
						},

						canUpdate: function() {
							return {
								value: 123
							};
						},

						canDelete: function() {
							return {
								value: 123
							};
						}
					};
				};
			};
		});

		var detailUserPath = null;

		beforeEach(function() {
			return app.models.User.create({name: 'Martijn', value: 124})
				.then(function(user) {
					detailUserPath = '/api/users/' + user.id;
				})
				.then(function() {
					return app.models.User.create({name: 'Test', value: 123});
				});
		});

		it('can create user', function(done) {
			request.agent(app.HTTPServer.express)
				.post('/api/users')
				.send({
					name: 'Test'
				})
				.expect(200, function(error, response) {
					assert.equal(response.body.value, 123);
					done(error);
				});
		});

		it('can read users', function(done) {
			request.agent(app.HTTPServer.express)
				.get('/api/users')
				.send()
				.expect(200, function(error, response) {
					assert.equal(response.body.length, 1);
					done(error);
				});
		});

		it('cannot read user', function(done) {
			request.agent(app.HTTPServer.express)
				.get(detailUserPath)
				.send()
				.expect(404, function(error) {
					done(error);
				});
		});
	});
});
