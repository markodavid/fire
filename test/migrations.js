'use strict';

var fire = require('..');
var Models = require('./../lib/models');
var Migrations = require('./../lib/migrations');
var assert = require('assert');

describe('migrations', function() {
    var models;
    var migrations;

    beforeEach(function(done) {
        models = new Models();
        models.setup(null);

        migrations = new Migrations();
        migrations.setup(null, models)
            .then(function() {
                return models.Schema.removeAll();
            })
            .then(function() {
                function FirstMigration() {}
                FirstMigration.prototype.up = function() {
                    return this.createModel('FirstTest', {
                        name: [this.String]
                    });
                };
                FirstMigration.prototype.down = function() {
                    return this.destroyModel('FirstTest');
                };

                function SecondMigration() {}
                SecondMigration.prototype.up = function() {
                    return this.createModel('SecondTest', {
                        name: [this.String]
                    });
                };
                SecondMigration.prototype.down = function() {
                    return this.destroyModel('SecondTest');
                };

                function ThirdMigration() {}
                ThirdMigration.prototype.up = function() {
                    return this.createModel('ThirdTest', {
                        name: [this.String]
                    });
                };
                ThirdMigration.prototype.down = function() {
                    return this.destroyModel('ThirdTest');
                };

                function FourthMigration() {}
                FourthMigration.prototype.up = function() {
                    return this.addProperties(this.models.ThirdTest, {
                        value: [this.Integer]
                    });
                }
                FourthMigration.prototype.down = function() {
                    return this.removeProperties(this.models.ThirdTest, ['value']);
                }

                migrations.addMigration(FirstMigration, 1);
                migrations.addMigration(SecondMigration, 2);
                migrations.addMigration(ThirdMigration, 3);
                migrations.addMigration(FourthMigration, 4);

                done();
            })
            .fail(function(error) {
                done(error);
            })
            .done();
    });

    it('can migrate once', function(done) {
        migrations.migrate(0, 1)
            .then(function() {
                return migrations.currentVersion();
            })
            .then(function(currentVersion) {
                assert.equal(currentVersion, 1);
                done();
            })
            .done();
    })

    it('can migrate twice', function(done) {
        migrations.migrate(0, 2)
            .then(function() {
                return migrations.currentVersion();
            })
            .then(function(currentVersion) {
                assert.equal(currentVersion, 2);
                done();
            })
            .done();
    })

    it('can migrate thrice', function(done) {
        migrations.migrate(0, 3)
            .then(function() {
                return migrations.currentVersion();
            })
            .then(function(currentVersion) {
                assert.equal(currentVersion, 3);
                done();
            })
            .done();
    });

    it('can migrate to 3 rollback to 0', function(done) {
        migrations.migrate(0, 3)
            .then(function() {
                return migrations.currentVersion();
            })
            .then(function(currentVersion) {
                assert.equal(currentVersion, 3);
                return true;
            })
            .then(function() {
                // Let's clear all the models
                models['FirstTest'] = null;
                models['SecondTest'] = null;
                models['ThirdTest'] = null;
                return true;
            })
            .then(function() {
                return migrations.migrate(3, 0);
            })
            .then(function() {
                return migrations.currentVersion();
            })
            .then(function(currentVersion) {
                assert.equal(currentVersion, 0);
                done();
            })
            .done();
    });

    it('can edit existing models', function(done) {
        migrations.migrate(0, 4)
            .then(function() {
                return migrations.currentVersion();
            })
            .then(function(currentVersion) {
                assert.equal(currentVersion, 4);
                return true;
            })
            .then(function() {
                return models.ThirdTest.createOne({
                    name: 'Test :-)',
                    value: 123
                });
            })
            .then(function(model) {
                return assert.equal(model.value, 123);
            })
            .then(function() {
                // Let's clear all the models
                models.FirstTest = null;
                models.SecondTest = null;
                models.ThirdTest = null;
                return true;
            })
            .then(function() {
                return migrations.migrate(4, 3);
            })
            .then(function() {
                return migrations.currentVersion();
            })
            .then(function(currentVersion) {
                assert.equal(currentVersion, 3);
                done();
            })
            .done();
    });
});