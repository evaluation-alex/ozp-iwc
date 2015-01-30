/** @namespace */
var ozpIwc=ozpIwc || {};

/**
 * @submodule bus.transport
 */

/**
 * @class PostMessageParticipant
 * @namespace ozpIwc
 * @extends ozpIwc.Participant
 *
 * @param {Object} config
 * @param {String} config.origin
 * @param {Object} config.sourceWindow
 * @param {Object} config.credentials
 */
ozpIwc.PostMessageParticipant=ozpIwc.util.extend(ozpIwc.Participant,function(config) {
	ozpIwc.Participant.apply(this,arguments);

    /**
     * The origin of the Participant.
     * @property origin
     */
    /**
     * The name of the Participant.
     * @property name
     */
	this.origin=this.name=config.origin;

    /**
     * The window of the Participant.
     * @property sourceWindow
     * @type Window
     */
	this.sourceWindow=config.sourceWindow;

    /**
     * @property credentials
     * @type
     */
    this.credentials=config.credentials;

    /**
     * The type of the participant.
     * @property participantType
     * @type  String
     * @default "postMessageProxy"
     */
	this.participantType="postMessageProxy";

    /**
     * @property securityAttributes.origin
     * @type String
     */
    //this.securityAttributes.origin=this.origin;

    var self = this;
    this.on("connectedToRouter",function() {
        self.securityAttributes.pushIfNotExist('ozp:iwc:participant:address',
            {'dataType': 'http://www.w3.org/2001/XMLSchema#string','attributeValue': self.address});

        self.securityAttributes.pushIfNotExist('ozp:iwc:participant:sendAs',
            {'dataType': 'http://www.w3.org/2001/XMLSchema#string','attributeValue': self.address});

        self.securityAttributes.pushIfNotExist('ozp:iwc:participant:receiveAs',
            {'dataType': 'http://www.w3.org/2001/XMLSchema#string','attributeValue': self.address});

        self.securityAttributes.pushIfNotExist('ozp:iwc:participant:permissions',
            {'dataType': 'http://www.w3.org/2001/XMLSchema#string','attributeValue': []});
        
        ozpIwc.metrics.gauge(self.metricRoot,"registeredCallbacks").set(function() {
            return self.getCallbackCount();
        });
    });
    /**
     * @property heartBeatStatus.origin
     * @type String
     */
    this.heartBeatStatus.origin=this.origin;
});

/**
 * Receives a packet on behalf of this participant and forwards it via PostMessage.
 *
 * @method receiveFromRouterImpl
 * @param {ozpIwc.TransportPacketContext} packetContext
 */
ozpIwc.PostMessageParticipant.prototype.receiveFromRouterImpl=function(packetContext) {
    var request = {
        'subject':"",
        'resource': "",
        'action': "",
        'policies': ['policy/readWritePolicy.json']
    };
    var self = this;
    return ozpIwc.authorization.isPermitted().then(function(resolution){
        self.receivedPacketsMeter.mark();
        self.sendToRecipient(packetContext.packet);
        return resolution;
    })['catch'](function(e){
        console.error(e);
    });
};

/**
 * Sends a message to the other end of our connection.  Wraps any string mangling
 * necessary by the postMessage implementation of the browser.
 *
 * @method sendToParticipant
 * @param {ozpIwc.TransportPacket} packet
 * @todo Only IE requires the packet to be stringified before sending, should use feature detection?
 */
ozpIwc.PostMessageParticipant.prototype.sendToRecipient=function(packet) {
	ozpIwc.util.safePostMessage(this.sourceWindow,packet,this.origin);
};

/**
 * The participant hijacks anything addressed to "$transport" and serves it
 * directly.  This isolates basic connection checking from the router, itself.
 *
 * @method handleTransportpacket
 * @param {Object} packet
 */
ozpIwc.PostMessageParticipant.prototype.handleTransportPacket=function(packet) {
	var reply={
		'ver': 1,
		'dst': this.address,
		'src': '$transport',
		'replyTo': packet.msgId,
		'msgId': this.generateMsgId(),
		'entity': {
			"address": this.address
		}
	};
	this.sendToRecipient(reply);
};


/**
 * Sends a packet received via PostMessage to the Participant's router.
 *
 * @method forwardFromPostMessage
 * @todo track the last used timestamp and make sure we don't send a duplicate messageId
 * @param {ozpIwc.TransportPacket} packet
 * @param {type} event
 */
ozpIwc.PostMessageParticipant.prototype.forwardFromPostMessage=function(packet,event) {
	if(typeof(packet) !== "object") {
		ozpIwc.log.error("Unknown packet received: " + JSON.stringify(packet));
		return;
	}
	if(event.origin !== this.origin) {
		/** @todo participant changing origins should set off more alarms, probably */
		ozpIwc.metrics.counter("transport."+this.address+".invalidSenderOrigin").inc();
		return;
	}

	packet=this.fixPacket(packet);

	// if it's addressed to $transport, hijack it
	if(packet.dst === "$transport") {
		this.handleTransportPacket(packet);
	} else {
		this.router.send(packet,this);
	}
};

/**
 * @TODO (DOC)
 * Listens for PostMessage messages and forwards them to the respected Participant.
 *
 * @class PostMessageParticipantListener
 * @param {Object} config
 * @param {ozpIwc.Router} config.router
 */
ozpIwc.PostMessageParticipantListener=function(config) {
	config = config || {};

    /**
     * @property Participants
     * @type ozpiwc.PostMessageParticipant[]
     */
	this.participants=[];

    /**
     * @property router
     * @type ozpIwc.Router
     */
	this.router=config.router || ozpIwc.defaultRouter;

	var self=this;

	window.addEventListener("message", function(event) {
		self.receiveFromPostMessage(event);
	}, false);

    ozpIwc.metrics.gauge('transport.postMessageListener.participants').set(function() {
        return self.getParticipantCount();
    });
};

/**
 * Gets the count of known participants
 *
 * @method getParticipantCount
 *
 * @returns {Number} the number of known participants
 */
ozpIwc.PostMessageParticipantListener.prototype.getParticipantCount=function() {
    if (!this.participants) {
        return 0;
    }
    return this.participants.length;
};

/**
 * Finds the participant associated with the given window.  Unfortunately, this is an
 * o(n) algorithm, since there doesn't seem to be any way to hash, order, or any other way to
 * compare windows other than equality.
 *
 * @method findParticipant
 * @param {Object} sourceWindow - the participant window handle from message's event.source
 */
ozpIwc.PostMessageParticipantListener.prototype.findParticipant=function(sourceWindow) {
	for(var i=0; i< this.participants.length; ++i) {
		if(this.participants[i].sourceWindow === sourceWindow) {
			return this.participants[i];
		}
	}
};

/**
 * Process a post message that is received from a peer
 *
 * @method receiveFromPostMessage
 * @param {Object} event - The event received from the "message" event handler
 * @param {String} event.origin
 * @param {Object} event.source
 * @param {ozpIwc.TransportPacket} event.data
 */
ozpIwc.PostMessageParticipantListener.prototype.receiveFromPostMessage=function(event) {
	var participant=this.findParticipant(event.source);
    var packet=event.data;
    if(event.source === window) {
        // the IE profiler seems to make the window receive it's own postMessages
        // ... don't ask.  I don't know why
        return;
    }
	if(typeof(event.data)==="string") {
		try {
            packet=JSON.parse(event.data);
        } catch(e) {
            // assume that it's some other library using the bus and let it go
            return;
        }
	}

    var isPacket = function(packet){
        if (ozpIwc.util.isIWCPacket(packet)) {
            participant.forwardFromPostMessage(packet, event);
        } else {
            ozpIwc.log.log("Packet does not meet IWC Packet criteria, dropping.", packet);
        }
    };

	// if this is a window who hasn't talked to us before, sign them up
	if(!participant) {
        var request = {
            'subject':{'dataType': 'http://www.w3.org/2001/XMLSchema#string','attributeValue': event.origin},
            'resource':{'dataType': 'http://www.w3.org/2001/XMLSchema#string','attributeValue': '$bus.multicast'},
            'action': {'dataType': 'http://www.w3.org/2001/XMLSchema#string','attributeValue': 'connect'},
            'policies': ['policy/connectPolicy.json']
        };

        var self = this;
        ozpIwc.authorization.isPermitted(request).then(function(){
                participant=new ozpIwc.PostMessageParticipant({
                    'origin': event.origin,
                    'sourceWindow': event.source,
                    'credentials': packet.entity
                });
                self.router.registerParticipant(participant,packet,true);
                self.participants.push(participant);
                isPacket(packet);
        })['catch'](function(e){
            console.error("Failed to connect. Could not authorize:",e);
        });

	} else{
        isPacket(packet);
    }
};
