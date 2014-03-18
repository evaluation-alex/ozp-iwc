describe("Event",function() {
	var event;
	
	beforeEach(function() {
		jasmine.addMatchers(customMatchers);
		
		event=new sibilant.Event();
	});
	
	afterEach(function() {
		event=null;
	});
	
	it("single handlers gets event", function() {
		var hits=0;
		event.on("1",function() {
			hits++;
		});		
		event.trigger("1");
		expect(hits).toEqual(1);
	});
	
	it("multiple handlers gets event", function() {
		// how many registrations we want, gets
		// counted down be each listener
		var hits=0;
		for(var i=0; i< 10; ++i) {
			event.on("1",function() {	hits++;});		
		}
		event.trigger("1");		
		
		expect(hits).toEqual(10);
	});
	
	it("unregisters handlers", function() {
		var hits=0;
		var handler=function() { hits++;};
		event.on("1",handler);		
		event.trigger("1");		
		expect(hits).toEqual(1);		

		event.off("1",handler);
		event.trigger("1");		
		expect(hits).toEqual(1);		
	});
	
	it("unregisters one of many handlers", function() {
		var hits=0;
		for(var i=0; i< 10; ++i) {
			event.on("1",function() {	hits++;});		
		}
		var handler=function() { hits++;};
		// 11 handlers at this point
		event.on("1",handler);		
		event.trigger("1");		
		expect(hits).toEqual(11);		

		event.off("1",handler);
		event.trigger("1");		
		expect(hits).toEqual(21);		
	});
	
	it("triggers only on the proper event",function() {
		var hits1=0,hits2=0;
		event.on("1",function() { hits1++;});
		event.on("2",function() { hits2++;});
		
		event.trigger("1");
		expect(hits1).toEqual(1);
		expect(hits2).toEqual(0);
		
		event.trigger("2");
		expect(hits1).toEqual(1);
		expect(hits2).toEqual(1);
	});
		
	it("passes single argument to the handler",function() {
		event.on("1",function(event) {
			expect(event.foo).toEqual("bar");
		});
		event.trigger("1",{foo:"bar"});
	});
	
	describe("trigger returns boolean",function() {
		var hits;
		beforeEach(function() {
			hits=0;
			event.on("1",function() {hits++;});
		});
		
		it("returns false from trigger by default",function() {
			expect(event.trigger("1").canceled).toEqual(false);	
		});

		it("returns false from trigger if the cancelable event is not canceled",function() {
			expect(event.trigger("1",new sibilant.CancelableEvent()).canceled).toEqual(false);
		});

		it("returns true from trigger if the event is canceled",function() {
			event.on("1",function(event) { event.cancel();});
			expect(event.trigger("1",new sibilant.CancelableEvent()).canceled).toEqual(true);
		});

	});
	describe("Allows 'this' parameter",function() {
		it("calls handlers with a 'this' pointer",function() {
			var obj={x:10};
			event.on("1",function() {	this.x++;	},obj);
			event.trigger("1");

			expect(obj.x).toEqual(11);
		});

		it("calls handles with arguments",function() {
			var obj={x:10};
			event.on("1",function(e) { this.x+=e.v;	},obj);
			event.trigger("1",{v:5});

			expect(obj.x).toEqual(15);
		});
		
		it("unregisters handlers",function() {
			var obj={x:10};
			var handler=function() {	this.x++;	};
			event.on("1",handler,obj);
			event.trigger("1");
			expect(obj.x).toEqual(11);
			
			event.off("1",handler);
			event.trigger("1");
			expect(obj.x).toEqual(11);
		});
		
		it("mixes in on() and off() functions to an object",function() {
			var obj={bar:1};

			event.mixinOnOff(obj);
			expect(event.on).toBeDefined();
			expect(event.off).toBeDefined();
		});
		
		it("delegates on() and off() mixins to the event",function() {
			var obj={bar:1};
			var count=0;
			event.mixinOnOff(obj);
			
			var callback=obj.on("1",function() { count++;});
			event.trigger("1");
			expect(count).toEqual(1);

			obj.off("1",callback);
			event.trigger("1");
			expect(count).toEqual(1);
			
		});
	});
});