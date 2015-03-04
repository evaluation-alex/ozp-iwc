describe("Data API", function () {
    var client;
    var participant;

    beforeEach(function(done) {
        client=new ozpIwc.Client({
            peerUrl: "http://" + window.location.hostname + ":14002"
        });
        participant=new ozpIwc.test.MockParticipant({
            clientUrl: "http://" + window.location.hostname + ":14001",
            'client': client
        });

        var gate=doneSemaphore(2,done);

        participant.on("connected",gate);
        client.on("connected",gate);
    });

    afterEach(function() {
        client.disconnect();
        participant.close();
    });

	it("responds to a bulk get with matching entities", function(done) {
		var packetOne={'resource': "/family", 'entity': "value1"};
		var packetTwo={'resource': "/family_a", 'entity': "value2", 'contentType':"application/fake+b+json"};
        var packetThree={'resource': "/family_b", 'entity': "value3"};
        var packetFour={'resource': "/notfamily", 'entity': "value4"};

		client.api('data.api').set(packetOne.resource,{entity:packetOne.entity})
			.then(function() {
				return client.api('data.api').set(packetTwo.resource,{'entity':packetTwo.entity,'contentType':packetTwo.contentType});
			}).then(function() {
				return client.api('data.api').set(packetThree.resource,{'entity':packetThree.entity});
			}).then(function() {
				return client.api('data.api').set(packetFour.resource,{'entity':packetFour.entity});
			}).then(function() {
				return client.api('data.api').bulkGet("/family");
			}).then(function(reply) {
				expect(reply.response).toEqual("ok");
				expect(reply.entity.length).toEqual(3);
				expect(reply.entity[0]).toEqual(jasmine.objectContaining(packetOne));
				expect(reply.entity[1]).toEqual(jasmine.objectContaining(packetTwo));
				expect(reply.entity[2]).toEqual(jasmine.objectContaining(packetThree));
				done();
			})['catch'](function(error) {
				expect(error).toEqual('not have happened');
				done();
			});
	});

    it('sets a value visible to other clients',function(done) {
        var packet={
            'dst': "data.api",
            'resource': "/test",
            'action' : "set",
            'entity' : { 'foo' : 1 }
        };
        participant.send(packet,function() {

            client.api('data.api')
                .get(packet.resource)
                .then(function(reply) {
                    expect(reply.entity).toEqual(packet.entity);
                    done();
                })['catch'](function(error) {
                    expect(error).toEqual('not have happened');
                });
        });
    });

    it('setting a value generates a change to other clients',function(done) {
        var packet={
            'dst': "data.api",
            'resource': "/test",
            'action' : "set",
            'entity' : { 'foo' : 1 }
        };
        client.api('data.api').watch(packet.resource,function(reply) {
            if(reply.response==="changed") {
                expect(reply.entity.newValue).toEqual(packet.entity);
                expect(reply.entity.oldValue).toEqual({});
                done();
            }
            return true;
        }).then(function(reply) {
            participant.send(packet);
        })['catch'](function(error) {
            expect(error).toEqual('');
        });

    });

    it("can delete a value set by someone else",function(done) {
        var packet={
            'dst': "data.api",
            'resource': "/test",
            'action' : "set",
            'entity' : { 'foo' : 1 }
        };
        participant.send(packet,function() {
            client.api('data.api').delete(packet.resource)
                .then(function(reply) {
                    expect(reply.response).toEqual("ok");
                    client.api('data.api').get(packet.resource)
                        .then(function(reply) {
                            expect(reply.entity).toBeUndefined();
                            done();
                        })
                        ['catch'](function(error) {
                            expect(error).toEqual('');
                        });
                })
                ['catch'](function(error) {
                    expect(error).toEqual('');
                });
        });

    });

    it('Integration bus cleans up after every run',function(done) {
        client.api('data.api').get('/test')
            .then(function(reply) {
                expect(reply.entity).toEqual({});
                done();
            })
            ['catch'](function(error) {
                expect(error).toEqual('');
            });
    });

    xit('can list children added by another client',function(done) {

    });

    xit('can remove children added by another client',function(done){

    });

    xit('gets a change notice on a child being added by another client',function(done){

    });

    xit('gets a change notice on a child being removed by another client',function(done){

    });

    xit('permissions on the entity restrict access to the origin',function(done){

    });

    describe('Data load test', function() {

        it ('Gets the contents of the data api', function(done) {
            var called = false;
            client.api('data.api').get('dashboards/12345')
                .then(function (packet) {
                    expect(packet.response).toEqual('ok');
                    if (!called) {
                        called = true;
                        done();
                    }
                })['catch'](function (error) {
                    expect(error).toEqual('');
                });
        });
    });

    describe('Legacy API Tests', function () {

        afterEach(function (done) {
            var called = false;
            client.api('data.api').delete('/test')
                .then(function (packet) {
                    expect(packet.response).toEqual('ok');
                })['catch'](function (error) {
                    expect(error).toEqual('');
                });
            if (!called) {
                called = true;
                done();
            }
        });


        it('Client sets values', function (done) {
            var called = false;
            client.api('data.api').set('/test', { entity: "testData"})
                .then(function (packet) {
                    if (!called) {
                        called = true;
                        expect(packet.response).toEqual('ok');
                        done();
                    }
                })
                ['catch'](function (error) {
                    expect(error).toEqual('');
                });
        });


        it('Client gets values', function (done) {
            var called = false;

            client.api('data.api').set('/test', { entity: "testData"})
                .then(function (packet) {
                    client.api('data.api').get('/test', {})
                        .then(function (packet) {
                            if (!called) {
                                called = true;

                                expect(packet.entity).toEqual('testData');

                                done();
                            }
                        })
                        ['catch'](function (error) {
                            expect(error).toEqual('');
                        });
                })
                ['catch'](function (error) {
                    expect(error).toEqual('');
                });
        });

        it('Client deletes values', function (done) {
            var called = false;
            client.api('data.api').delete('/test')
                .then(function (packet) {
                    expect(packet.response).toEqual('ok');
                    if (!called) {
                        called = true;
                        done();
                    }
                })['catch'](function (error) {
                    expect(error).toEqual('');
                });
        });

//        xdescribe('Collection-like Actions', function () {
//
//            //TODO implement if needed
//        });
    });
});
