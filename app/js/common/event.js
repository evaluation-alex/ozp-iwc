/** @namespace */
var sibilant=sibilant || {};

/**
	* @class
	*/
sibilant.Event=function() {
	this.events={};
};	

/**
 * Registers a handler for the the event.
 * @param {string} event The name of the event to trigger on
 * @param {function} callback Function to be invoked
 * @param {object} [self] Used as the this pointer when callback is invoked.
 * @returns {object} A handle that can be used to unregister the callback via [off()]{@link sibilant.Event#off}
 */
sibilant.Event.prototype.on=function(event,callback,self) {
	var wrapped=callback;
	if(self) {
		wrapped=function() { 
			callback.apply(self,arguments);
		};
		wrapped.sibilantDelegateFor=callback;
	}
	this.events[event]=this.events[event]||[];
	this.events[event].push(wrapped);
	return wrapped;
};

/**
 * Unregisters an event handler previously registered.
 * @param {type} event
 * @param {type} callback
 */	
sibilant.Event.prototype.off=function(event,callback) {
	this.events[event]=(this.events[event]||[]).filter( function(h) {
		return h!==callback && h.sibilantDelegateFor !== callback;
	});
};

/**
 * Fires an event that will be received by all handlers.
 * @param {string} eventName  - Name of the event
 * @param {object} event - Event object to pass to the handers.
 * @returns {object} The event after all handlers have processed it
 */
sibilant.Event.prototype.trigger=function(eventName,event) {
	event = event || new sibilant.CancelableEvent();
	var handlers=this.events[eventName] || [];

	handlers.forEach(function(h) {
		h(event);
	});
	return event;
};


/**
 * Adds an on() and off() function to the target that delegate to this object 
 * @param {object} target Target to receive the on/off functions
 */
sibilant.Event.prototype.mixinOnOff=function(target) {
	var self=this;
	target.on=function() { return self.on.apply(self,arguments);};
	target.off=function() { return self.off.apply(self,arguments);};
};

/**
 * Convenient base for events that can be canceled.  Provides and manages
 * the properties canceled and cancelReason, as well as the member function
 * cancel().
 * @class
 * @param {object} data - Data that will be copied into the event
 */
sibilant.CancelableEvent=function(data) {
	data = data || {};
	for(k in data) {
		this[k]=data[k];
	}
	this.canceled=false;
	this.cancelReason=null;
};

/**
 * Marks the event as canceled.
 * @param {type} reason - A text description of why the event was canceled.
 * @returns {sibilant.CancelableEvent} Reference to self
 */
sibilant.CancelableEvent.prototype.cancel=function(reason) {
	reason= reason || "Unknown";
	this.canceled=true;
	this.cancelReason=reason;
	return this;
};
