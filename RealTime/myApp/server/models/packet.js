'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
  Schema = mongoose.Schema;


/**
 * Packet Schema
 *  Index:
 *    _id, timestamp, IP_ADDRESS
 *    If we can derive other device information like network region or
 *    similar, we can provide better metrics and should index on those as well
 *
 */
var PacketSchema = new Schema({
  /* Field Name: Timestamp
   * Lync: ConnectionInfo.TimeStamp
   */
  timestamp: {
    type: Date,
    default: Date.now
  },

  //These are properties about the data that are common to all incoming packets
  metadata: {

    //The packet type
    TYPE: {
      type:Number
    },

    //The packet length
    LENGTH: {
      type:Number
    }
  },

  //Decoded data from a packet, also contains quality of service metrics
  //Note, I opt for a flexible schema since this stores raw data decoded from an RTCP packet
  //It would be a pain to specify all fields because then mongoose limits you from entering 
  //in things that don't conform to the defined schema
  data: {
    //These are quality of service metrics that are specific to each vendor
    // qos: {
    //   Avaya: {
    //     //Field Name: RTCP Round Trip Time
    //     MID_RTCP_RTT: {
    //       type: Number
    //     },
    //     //Field Name: Jitter Buffer Delay
    //     MID_JITTER_BUFFER_DELAY: {
    //       type: Number
    //     },
    //     //Field Name: Largest Sequence Jump
    //     MID_LARGEST_SEQ_JUMP: {
    //       type: Number
    //     },
    //     //Field Name: Largest Sequence Fall
    //     MID_LARGEST_SEQ_FALL: {
    //       type: Number
    //     },
    //     //Field Name: RSVP Status
    //     MID_RSVP_RECEIVER_STATUS: {
    //       type: Number
    //     },
    //     //Field Name: Maximum Jitter
    //     MID_MAX_JITTER: {
    //       type: Number
    //     },
    //     //Field Name: Jitter Buffer Underruns
    //     MID_JITTER_BUFFER_UNDERRUNS: {
    //       type: Number
    //     },
    //     //Field Name: Jitter Buffer Overruns
    //     MID_JITTER_BUFFER_OVERRUNS: {
    //       type: Number
    //     },
    //     //Field Name: Sequence Jump Instances
    //     MID_SEQ_JUMP_INSTANCES: {
    //       type: Number
    //     },
    //     //Field Name: Sequence Fall Instances
    //     MID_SEQ_FALL_INSTANCES: {
    //       type: Number
    //     },
    //     //Field Name: Echo Tail Length
    //     MID_ECHO_TAIL_LENGTH: {
    //       type: Number
    //     },
    //     //Field Name: Remote IP Address & RTCP Port
    //     MID_ADDR_PORT: {
    //       type: Number
    //     },
    //     //Field Name: RTP Payload Type
    //     MID_PAYLOAD_TYPE: {
    //       type: Number
    //     },
    //     //Field Name: Frame Size
    //     MID_FRAME_SIZE: {
    //       type: Number
    //     },
    //     //Field Name: Time To Live
    //     MID_RTP_TTL: {
    //       type: Number
    //     },
    //     //Field Name: DiffServ Code Point
    //     MID_RTP_DSCP: {
    //       type: Number
    //     },
    //     //Field Name: 802.1D
    //     MID_RTP_8021D: {
    //       type: Number
    //     },
    //     //Field Name: Media Encryption
    //     MID_MEDIA_ENCYPTION: {
    //       type: Number
    //     },
    //     //Field Name: Silence Suppression
    //     MID_SILENCE_SUPPRESSION: {
    //       type: Number
    //     },
    //     //Field Name: Acoustic Echo Cancellation
    //     MID_ECHO_CANCELLATION: {
    //       type: Number
    //     },
    //     //Field Name: Incoming Stream RTP Source Port
    //     MID_IN_RTP_SRC_PORT: {
    //       type: Number
    //     },
    //     //Field Name: Incoming Stream RTP Destination Port
    //     MID_IN_RTP_DEST_PORT: {
    //       type: Number
    //     }

    //   },

    //   Cisco: {

    //   },

    //   /* These are QOS metrics in a Lync packet
    //    * Lync: QualityUpdate.Properties
    //    */
    //   Lync: {
    //     Protocol: {
    //       type: String
    //     },
    //     EstimatedBandwidth: {
    //       Avg: {
    //         type: String
    //       },
    //       Low: {
    //         type: String
    //       },
    //       High: {
    //         type: String
    //       },
    //       Codec: {
    //         type: String
    //       }
    //     },
    //     ConversationalMOS: {
    //       type: String
    //     },
    //     PacketUtilization: {
    //       type: String
    //     },
    //     //xs:decimal
    //     PacketLossRate: {
    //       type: Number
    //     },
    //     PacketLossRateMax: {
    //       type: String
    //     },
    //     //xs:decimal
    //     JitterInterArrival: {
    //       type: String
    //     },
    //     JitterInterArrivalMax: {
    //       type: String
    //     },
    //     //xs:decimal
    //     RoundTrip: {
    //       type: Number
    //     },
    //     RoundTripMax: {
    //       type: String
    //     },
    //     HealerPacketDropRatio: {
    //       type: String
    //     },
    //     DegradationAvg: {
    //       //xs:decimal
    //       Limit: {
    //         type: Number
    //       }
    //     },
    //     RatioConcealedSamplesAvg: {
    //       //xs:decimal
    //       Limit: {
    //         type: Number
    //       }
    //     },
    //     EchoPercentMicIn: {
    //       type: String
    //     },
    //     EchoPercentSend: {
    //       type: String
    //     },
    //     EchoReturn: {
    //       type: String
    //     },
    //     EchoEventCauses: {
    //       type: String
    //     },
    //     RecvNoiseLevel: {
    //       type: String
    //     },
    //     RecvSignalLevel: {
    //       type: String
    //     },
    //     SampleRate: {
    //       //xs:decimal
    //       Limit: {
    //         type: Number
    //       }
    //     },
    //     BurstDuration: {
    //       type: String
    //     },
    //     BurstDensity: {
    //       type: String
    //     },
    //     BurstGapDuration: {
    //       type: String
    //     },
    //     BurstGapDensity: {
    //       type: String
    //     },
    //     DegradationJitterAvg: {
    //       type: String
    //     },
    //     DegradationMax: {
    //       type: String
    //     },
    //     RecvListenMOSMin: {
    //       type: String
    //     },
    //     SendListenMOSMin: {
    //       type: String
    //     },
    //     SendListenMOS: {
    //       type: String
    //     },
    //     RecvListenMOS: {
    //       type: String
    //     },
    //     OverallMinNetworkMOS: {
    //       type: String
    //     },
    //     OverallAvgNetworkMOS: {
    //       type: String
    //     },
    //     DegradationPacketLossAvg: {
    //       type: String
    //     },
    //     VideoPacketLossRate: {
    //       //xs:decimal
    //       Limit: {
    //         type: Number
    //       }
    //     },
    //     RecvFrameRateAverage: {
    //       //xs:decimal
    //       Limit: {
    //         type: Number
    //       }
    //     },
    //     VideoLocalFrameLossPercentageAvg: {
    //       //xs:decimal
    //       Limit: {
    //         type: Number
    //       }
    //     },
    //     DynamicCapabilityPercent: {
    //       //xs:decimal
    //       Limit: {
    //         type: Number
    //       }
    //     },
    //     LowFrameRateCallPercent: {
    //       //xs:decimal
    //       Limit: {
    //         type: Number
    //       }
    //     },
    //     LowResolutionCallPercent: {
    //       //xs:decimal
    //       Limit: {
    //         type: Number
    //       }
    //     },
    //     VideoFrameLossRate: {
    //       type: String
    //     },
    //     LocalFrameLossPercentageAvg: {
    //       type: String
    //     },
    //     BitRateMax: {
    //       type: String
    //     },
    //     BitRateAvg: {
    //       type: String
    //     },
    //     VGAQualityRatio: {
    //       type: String
    //     },
    //     HDQualityRatio: {
    //       type: String
    //     },
    //     RelativeOneWayBurstDensity: {
    //       //xs:decimal
    //       Limit: {
    //         type: Number
    //       }
    //     },
    //     RelativeOneWayAverage: {
    //       //xs:decimal
    //       Limit: {
    //         type: Number
    //       }
    //     },
    //     RDPTileProcessingLatencyBurstDensity: {
    //       //xs:decimal
    //       Limit: {
    //         type: Number
    //       }
    //     },
    //     RDPTileProcessingLatencyAverage: {
    //       //xs:decimal
    //       Limit: {
    //         type: Number
    //       }
    //     },
    //     SpoiledTilePercentTotal: {
    //       //xs:decimal
    //       Limit: {
    //         type: Number
    //       }
    //     },
    //     //xs: decimal
    //     SpoiledTilePercentAverage: {
    //       type: Number
    //     },
    //     //xs: decimal
    //     FrameRate: {
    //       type: Number
    //     }
    //   }
    // }
  },

  //These fields are common to every incoming datagram related to the device
  //So far for RTCP packets, there is only the IP address.  SSRC is specific to the
  //actual packet
  device: {
    IP_ADDRESS: {
      type: String
    }
  }
});


/*
* Indexes
*/
PacketSchema.index({ 'device.IP_ADDRESS': 1, 'metadata.TYPE': 1, 'data.subtype': 1, 'device.timestamp':1});
PacketSchema.index({ 'device.IP_ADDRESS': 1, 'metadata.TYPE': 1, 'data.subtype': 1});
PacketSchema.index({ 'device.timestamp': 1});


/**
 * Statics
 */
PacketSchema.statics = {
  load: function (id, cb) {
    this.findOne({
      _id: id
    }).exec(cb);
  },

  slice: function (startTime, endTime, density, cb) {
    endTime = new Date().getTime();
    // console.log(new Date(endTime));
    this.find({
      timestamp: {
        $gte: startTime, 
        $lt: endTime
      }
    }).exec(cb);
  },

  //deviceIP is a string IP
  //startTime & endTime is a string (unix date in ms) or a date object
  //Create compound index in MONGO
  //db.packets.ensureIndex({'device.IP_ADDRESS':1, 'metadata.TYPE':1, 'data.subtype':1})
  sliceByIP: function(deviceIP, startTime, endTime, cb) {
        //makes this function a little more robust
        if (startTime instanceof Date) {
            startTime = startTime.getTime();
        }

        if (endTime instanceof Date) {
            endTime = endTime.getTime();
        }
        
        this.collection.find({ 
            $and: [{ 
                  'device.IP_ADDRESS': deviceIP
                }, {
                  'metadata.TYPE': 204
                },{
                  'data.subtype': 4
                },{
                  'timestamp': { 
                    $gte: new Date(startTime), 
                    $lte: new Date(endTime) 
                }
            }]
          }, {
            _id: 0
          }).sort({ _id : 1 }).toArray(function(err, packets) {
            //console.log('[PACKET] compute window for %s has %d packets.', deviceIP, packets.length);
            if (cb)
                cb(err, packets);
        });
    }
};

mongoose.model('Packet', PacketSchema);